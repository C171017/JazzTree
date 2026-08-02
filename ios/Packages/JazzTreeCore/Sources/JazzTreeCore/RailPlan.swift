import Foundation

/// Structure for the Rail — the portrait-first primary view.
///
/// The web app puts time on the x axis, which needs a wide screen. On a phone held
/// vertically that is hostile: at a readable row height the whole graph is roughly
/// 1100pt tall and 1400pt wide, so you pan in two axes reading 10pt type. So the
/// axis is rotated: **time flows downward**, one genre per full-width row, and the
/// left gutter carries the influence curves.
///
/// Two deliberate departures from the web version:
///
/// 1. **Time is ordered and labelled, not scaled.** At a readable row height a
///    proportional axis would be mostly whitespace (ragtime alone owns 1895–1919)
///    while 1954–1970 crams fourteen genres into sixteen years. Rows are therefore
///    uniform and chronological, with decade headers marking the passage of time and
///    each row showing its own span. Proportional time lives in the Spans view,
///    where every row draws its own 1890→now bar. Rail = order and structure;
///    Spans = proportion.
///
/// 2. **Edges are drawn only under focus.** 103 curves in a 76pt gutter is noise.
///    Unfocused rows carry parent/child counts instead; focusing a genre collapses
///    the rail to that genre and its direct neighbours and draws just those edges,
///    labelled with what they passed on. That is the phone equivalent of the web
///    app's hover-dimming, and it is persistent, so you can actually read the
///    explanations.
///
/// Geometry is *not* computed here: row heights depend on Dynamic Type, so the view
/// measures them and this type only supplies ordering, sectioning and lane indices.
public struct RailPlan: Sendable {

    public struct Row: Identifiable, Sendable {
        public let genre: Genre
        /// Position in the rail, 0-based.
        public let index: Int
        public let decade: Int
        /// True when this row starts a new decade section.
        public let isDecadeStart: Bool
        /// Influences in, under the active aspect filter.
        public let parentCount: Int
        /// Influences out, under the active aspect filter.
        public let childCount: Int
        /// False when the year scrubber has not reached this genre yet.
        public let isBorn: Bool
        /// False when an aspect filter is on and this genre has no surviving edge.
        public let matchesFilter: Bool
        public var id: String { genre.id }
        public var decadeLabel: String { "\(decade)s" }
    }

    /// An edge to draw in the gutter. Only produced in focus mode.
    public struct Connector: Identifiable, Sendable {
        public let edge: LineageEdge
        public let fromIndex: Int
        public let toIndex: Int
        /// Gutter lane, 0 = innermost. Longer connectors get outer lanes so shorter
        /// ones nest inside them, which is what makes a bundle of curves readable.
        public let lane: Int
        /// True when the influence flows *into* the focused genre.
        public let isIncoming: Bool
        public var id: String { edge.id }
        public var span: Int { abs(toIndex - fromIndex) }
    }

    /// What one lane does as it passes a given row.
    ///
    /// The gutter is drawn per row rather than as one overlay across the whole
    /// scroll view, which is what lets it survive Dynamic Type: each row renders
    /// its own slice with no knowledge of anyone else's height, and no measurement
    /// pass is needed. Same trick a git-graph renderer uses.
    public enum LaneSegment: Sendable, Equatable {
        case empty
        /// The line runs straight down past this row.
        case through(EdgeType, Strength)
        /// The curve attaches to this row and heads down into the lane.
        case origin(EdgeType, Strength, isIncoming: Bool)
        /// The curve comes up out of the lane and attaches to this row.
        case terminus(EdgeType, Strength, isIncoming: Bool)

        public var edgeType: EdgeType? {
            switch self {
            case .empty: return nil
            case .through(let t, _), .origin(let t, _, _), .terminus(let t, _, _): return t
            }
        }
        public var strength: Strength? {
            switch self {
            case .empty: return nil
            case .through(_, let s), .origin(_, let s, _), .terminus(_, let s, _): return s
            }
        }
        public var isEmpty: Bool { self == .empty }
    }

    public let rows: [Row]
    public let connectors: [Connector]
    public let laneCount: Int
    /// `gutters[rowIndex][lane]`. Empty when the rail is not focused.
    public let gutters: [[LaneSegment]]
    /// The genre the rail is focused on, if any.
    public let focus: String?
    /// Edges surviving the aspect filter, for the "42 of 103" counter.
    public let visibleEdgeCount: Int
    public let totalEdgeCount: Int

    public var isFocused: Bool { focus != nil }

    /// Lane segments for one row, safe to call for any index.
    public func gutter(row index: Int) -> [LaneSegment] {
        guard gutters.indices.contains(index) else {
            return Array(repeating: .empty, count: laneCount)
        }
        return gutters[index]
    }

    /// Builds `gutters` from the connector list.
    static func buildGutters(rowCount: Int, laneCount: Int, connectors: [Connector]) -> [[LaneSegment]] {
        guard rowCount > 0, laneCount > 0 else { return [] }
        var grid = Array(
            repeating: Array(repeating: LaneSegment.empty, count: laneCount),
            count: rowCount
        )
        for connector in connectors {
            let top = min(connector.fromIndex, connector.toIndex)
            let bottom = max(connector.fromIndex, connector.toIndex)
            guard grid.indices.contains(top), grid.indices.contains(bottom),
                  connector.lane < laneCount else { continue }
            let type = connector.edge.type
            let strength = connector.edge.strength
            grid[top][connector.lane] = .origin(type, strength, isIncoming: connector.isIncoming)
            grid[bottom][connector.lane] = .terminus(type, strength, isIncoming: connector.isIncoming)
            if bottom > top + 1 {
                for row in (top + 1)..<bottom {
                    grid[row][connector.lane] = .through(type, strength)
                }
            }
        }
        return grid
    }

    // MARK: - Building

    public static func build(
        library: Library,
        aspects: Set<Aspect> = [],
        upToYear: Int? = nil,
        focus: String? = nil
    ) -> RailPlan {
        let surviving = library.filteredLineage(aspects: aspects)
        let survivingIDs = Set(surviving.map(\.id))
        let matching = library.genresWithEdges(aspects: aspects)

        func parents(_ id: String) -> [LineageEdge] {
            library.parents(of: id).filter { survivingIDs.contains($0.id) }
        }
        func children(_ id: String) -> [LineageEdge] {
            library.children(of: id).filter { survivingIDs.contains($0.id) }
        }

        // Which genres appear, and in what order.
        let ordered: [Genre]
        if let focus, let focused = library.genre(focus) {
            var ids: Set<String> = [focus]
            for edge in parents(focus) { ids.insert(edge.from) }
            for edge in children(focus) { ids.insert(edge.to) }
            ordered = library.genres.filter { ids.contains($0.id) }
            _ = focused
        } else {
            ordered = library.genres.filter { genre in
                guard let upToYear else { return true }
                return genre.era.start <= upToYear
            }
        }

        var rows: [Row] = []
        var lastDecade: Int? = nil
        for (index, genre) in ordered.enumerated() {
            let decade = genre.era.decade
            rows.append(Row(
                genre: genre,
                index: index,
                decade: decade,
                isDecadeStart: decade != lastDecade,
                parentCount: parents(genre.id).count,
                childCount: children(genre.id).count,
                isBorn: upToYear.map { genre.era.start <= $0 } ?? true,
                matchesFilter: aspects.isEmpty || matching.contains(genre.id)
            ))
            lastDecade = decade
        }

        // Connectors, focus mode only.
        var connectors: [Connector] = []
        if let focus {
            let rowIndex = Dictionary(uniqueKeysWithValues: rows.map { ($0.genre.id, $0.index) })
            guard let centre = rowIndex[focus] else {
                return RailPlan(
                    rows: rows, connectors: [], laneCount: 0, gutters: [], focus: focus,
                    visibleEdgeCount: surviving.count, totalEdgeCount: library.lineage.count
                )
            }
            var pending: [(edge: LineageEdge, from: Int, to: Int, incoming: Bool)] = []
            for edge in parents(focus) {
                guard let from = rowIndex[edge.from] else { continue }
                pending.append((edge, from, centre, true))
            }
            for edge in children(focus) {
                guard let to = rowIndex[edge.to] else { continue }
                pending.append((edge, centre, to, false))
            }
            // Longest span outermost, then a stable tiebreak.
            pending.sort {
                let a = abs($0.to - $0.from), b = abs($1.to - $1.from)
                if a != b { return a > b }
                return $0.edge.id < $1.edge.id
            }
            for (lane, item) in pending.enumerated() {
                connectors.append(Connector(
                    edge: item.edge,
                    fromIndex: item.from,
                    toIndex: item.to,
                    lane: lane,
                    isIncoming: item.incoming
                ))
            }
        }

        return RailPlan(
            rows: rows,
            connectors: connectors,
            laneCount: connectors.count,
            gutters: buildGutters(
                rowCount: rows.count,
                laneCount: connectors.count,
                connectors: connectors
            ),
            focus: focus,
            visibleEdgeCount: surviving.count,
            totalEdgeCount: library.lineage.count
        )
    }
}
