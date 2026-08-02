import Foundation

/// The decoded dataset plus the indexes and graph queries the UI needs.
/// Immutable and `Sendable`, so it can be built once at launch and read from
/// anywhere without synchronisation.
public struct Library: Sendable {
    public let present: Int
    public let families: [Family]
    public let eras: [Era]
    public let genres: [Genre]
    public let lineage: [LineageEdge]
    public let albums: [Album]
    public let paths: [ListeningPath]

    private let genreByID: [String: Genre]
    private let albumByID: [String: Album]
    private let familyByID: [String: Family]
    private let parentEdges: [String: [LineageEdge]]   // keyed by child id
    private let childEdges: [String: [LineageEdge]]    // keyed by parent id
    private let primaryAlbums: [String: [Album]]       // keyed by genre id
    private let crossListedAlbums: [String: [Album]]   // keyed by genre id
    private let genreOrder: [String: Int]              // id -> chronological rank

    public init(
        meta: DatasetMeta,
        families: [Family],
        eras: [Era],
        genres: [Genre],
        lineage: [LineageEdge],
        albums: [Album],
        paths: [ListeningPath]
    ) {
        self.present = meta.present
        self.families = families
        self.eras = eras
        self.albums = albums
        self.paths = paths
        self.lineage = lineage

        // Chronological order, with id as the tiebreak so the ordering is stable
        // regardless of how the JSON happens to be sorted.
        let sorted = genres.sorted {
            $0.era.start != $1.era.start ? $0.era.start < $1.era.start : $0.id < $1.id
        }
        self.genres = sorted
        self.genreOrder = Dictionary(
            uniqueKeysWithValues: sorted.enumerated().map { ($1.id, $0) }
        )

        self.genreByID = Dictionary(uniqueKeysWithValues: sorted.map { ($0.id, $0) })
        self.albumByID = Dictionary(uniqueKeysWithValues: albums.map { ($0.id, $0) })
        self.familyByID = Dictionary(uniqueKeysWithValues: families.map { ($0.id, $0) })

        var parents: [String: [LineageEdge]] = [:]
        var children: [String: [LineageEdge]] = [:]
        for edge in lineage {
            parents[edge.to, default: []].append(edge)
            children[edge.from, default: []].append(edge)
        }
        // Oldest influence first in both directions.
        let byYear: (LineageEdge, LineageEdge) -> Bool = {
            $0.year != $1.year ? $0.year < $1.year : $0.id < $1.id
        }
        self.parentEdges = parents.mapValues { $0.sorted(by: byYear) }
        self.childEdges = children.mapValues { $0.sorted(by: byYear) }

        let tierRank: [Tier: Int] = [.gateway: 0, .core: 1, .deep: 2]
        var primary: [String: [Album]] = [:]
        var cross: [String: [Album]] = [:]
        for album in albums {
            for (index, gid) in album.genreIds.enumerated() {
                if index == 0 {
                    primary[gid, default: []].append(album)
                } else {
                    cross[gid, default: []].append(album)
                }
            }
        }
        let byTier: (Album, Album) -> Bool = {
            let a = tierRank[$0.tier] ?? 3
            let b = tierRank[$1.tier] ?? 3
            if a != b { return a < b }
            if $0.recorded != $1.recorded { return $0.recorded < $1.recorded }
            return $0.id < $1.id
        }
        self.primaryAlbums = primary.mapValues { $0.sorted(by: byTier) }
        self.crossListedAlbums = cross.mapValues { $0.sorted(by: byTier) }
    }

    // MARK: - Lookups

    public func genre(_ id: String) -> Genre? { genreByID[id] }
    public func album(_ id: String) -> Album? { albumByID[id] }
    public func family(_ id: String) -> Family? { familyByID[id] }
    public func path(_ id: String) -> ListeningPath? { paths.first { $0.id == id } }

    /// Chronological rank, used by the rail to order rows and by the layout to
    /// decide which way an edge travels.
    public func rank(_ id: String) -> Int { genreOrder[id] ?? 0 }

    // MARK: - Lineage queries

    /// Influences flowing *into* this genre, oldest first.
    public func parents(of id: String) -> [LineageEdge] { parentEdges[id] ?? [] }

    /// Influences flowing *out of* this genre, oldest first.
    public func children(of id: String) -> [LineageEdge] { childEdges[id] ?? [] }

    /// Every edge touching this genre in either direction.
    public func edges(touching id: String) -> [LineageEdge] {
        (parents(of: id) + children(of: id)).sorted {
            $0.year != $1.year ? $0.year < $1.year : $0.id < $1.id
        }
    }

    /// Genres directly connected to this one, plus itself. This — not the full
    /// transitive closure — is what the UI emphasises: closure lights 32 of 39
    /// genres for a hub like hard bop and communicates nothing.
    public func neighbourhood(of id: String) -> Set<String> {
        var out: Set<String> = [id]
        for edge in parents(of: id) { out.insert(edge.from) }
        for edge in children(of: id) { out.insert(edge.to) }
        return out
    }

    public func ancestors(of id: String) -> Set<String> {
        walk(from: id) { self.parents(of: $0).map(\.from) }
    }

    public func descendants(of id: String) -> Set<String> {
        walk(from: id) { self.children(of: $0).map(\.to) }
    }

    private func walk(from id: String, step: (String) -> [String]) -> Set<String> {
        var seen: Set<String> = []
        var stack = step(id)
        while let next = stack.popLast() {
            guard !seen.contains(next), next != id else { continue }
            seen.insert(next)
            stack.append(contentsOf: step(next))
        }
        return seen
    }

    /// True when the lineage graph contains no cycles. Verified in tests; also
    /// worth asserting at launch in debug builds.
    public var isAcyclic: Bool {
        var indegree = Dictionary(uniqueKeysWithValues: genres.map { ($0.id, 0) })
        for edge in lineage where indegree[edge.to] != nil {
            indegree[edge.to]! += 1
        }
        var queue = indegree.filter { $0.value == 0 }.map(\.key)
        var visited = 0
        while let node = queue.popLast() {
            visited += 1
            for edge in children(of: node) {
                guard indegree[edge.to] != nil else { continue }
                indegree[edge.to]! -= 1
                if indegree[edge.to] == 0 { queue.append(edge.to) }
            }
        }
        return visited == genres.count
    }

    // MARK: - Albums

    /// The genre's own three tiers, in tier then chronological order.
    public func primaryAlbums(for genreID: String) -> [Album] {
        primaryAlbums[genreID] ?? []
    }

    /// Albums whose main home is a neighbouring genre but that are also filed here.
    public func crossListedAlbums(for genreID: String) -> [Album] {
        crossListedAlbums[genreID] ?? []
    }

    public func albums(for genreID: String, tier: Tier) -> [Album] {
        primaryAlbums(for: genreID).filter { $0.tier == tier }
    }

    public func gatewayAlbum(for genreID: String) -> Album? {
        primaryAlbums(for: genreID).first { $0.tier == .gateway }
    }

    /// Every album that mentions this genre, primary or cross-listed.
    public func albumCount(for genreID: String) -> Int {
        primaryAlbums(for: genreID).count + crossListedAlbums(for: genreID).count
    }

    /// Lowest difficulty among the genre's own albums — used by the "easiest
    /// first" sort. 5 when a genre somehow has none.
    public func easiestDifficulty(for genreID: String) -> Int {
        primaryAlbums(for: genreID).map(\.difficulty).min() ?? 5
    }

    // MARK: - Eras

    public func era(containing year: Int) -> Era? {
        eras.first { year >= $0.start && year < $0.end } ?? eras.last
    }

    /// Genres grouped into decade buckets in chronological order — the section
    /// model behind the rail.
    public func decadeSections(aspectFilter: Set<Aspect> = [], upTo year: Int? = nil) -> [DecadeSection] {
        var buckets: [Int: [Genre]] = [:]
        for genre in genres {
            if let year, genre.era.start > year { continue }
            buckets[genre.era.decade, default: []].append(genre)
        }
        return buckets.keys.sorted().map { decade in
            DecadeSection(decade: decade, genres: buckets[decade] ?? [])
        }
    }

    public struct DecadeSection: Identifiable, Sendable {
        public let decade: Int
        public let genres: [Genre]
        public var id: Int { decade }
        /// "1950s"
        public var label: String { "\(decade)s" }
    }

    // MARK: - Filtering

    /// Edges surviving an aspect filter. An empty filter means no filtering.
    public func filteredLineage(aspects: Set<Aspect>) -> [LineageEdge] {
        guard !aspects.isEmpty else { return lineage }
        return lineage.filter { edge in !aspects.isDisjoint(with: edge.aspects) }
    }

    /// Genres that still have at least one surviving edge under the filter.
    public func genresWithEdges(aspects: Set<Aspect>) -> Set<String> {
        guard !aspects.isEmpty else { return Set(genres.map(\.id)) }
        var out: Set<String> = []
        for edge in filteredLineage(aspects: aspects) {
            out.insert(edge.from)
            out.insert(edge.to)
        }
        return out
    }

    /// Free-text search across everything a person might reasonably type.
    public func search(_ query: String, family: String? = nil) -> [Genre] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return genres.filter { genre in
            if let family, family != "all", genre.family != family { return false }
            guard !trimmed.isEmpty else { return true }
            var haystack = [
                genre.name, genre.oneLine, genre.summary, genre.contested,
                genre.origin.city, genre.origin.country,
            ]
            haystack.append(contentsOf: genre.aka ?? [])
            haystack.append(contentsOf: genre.keyLabels)
            haystack.append(contentsOf: genre.earMarkers)
            haystack.append(contentsOf: genre.keyFigures.map { "\($0.name) \($0.instrument)" })
            // Keep canonical metadata searchable, then add the complete active
            // locale so Chinese queries find details as well as names.
            let l10n = Localization.shared
            haystack.append(contentsOf: [
                l10n.genreName(genre), l10n.genreOneLine(genre),
                l10n.genreSummary(genre), l10n.genreContested(genre),
                l10n.genreOriginCity(genre), l10n.genreOriginCountry(genre),
            ])
            haystack.append(contentsOf: l10n.genreAliases(genre))
            haystack.append(contentsOf: l10n.genreEarMarkers(genre))
            haystack.append(contentsOf: genre.musicalTraits.ordered.map {
                l10n.genreTrait(genre, $0.aspect)
            })
            haystack.append(contentsOf: genre.keyFigures.flatMap {
                [$0.name, l10n.keyFigureInstrument($0, in: genre), l10n.keyFigureWhy($0, in: genre)]
            })
            return haystack.contains { $0.range(of: trimmed, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
        }
    }
}
