import Foundation

/// The dataset and layout invariants, expressed once and callable from three places:
/// the `jazztree-verify` command-line tool, the XCTest suite (when Xcode is
/// available), and a debug assertion at app launch.
///
/// This exists as library code rather than test code because XCTest and
/// swift-testing both ship with Xcode, and the checks needed to be runnable from a
/// machine that only has the Swift toolchain.
public struct Verification: Sendable {

    public struct Check: Sendable {
        public let group: String
        public let name: String
        public let failures: [String]
        public var passed: Bool { failures.isEmpty }
    }

    public struct Report: Sendable {
        public let checks: [Check]
        public var passed: Bool { checks.allSatisfy(\.passed) }
        public var failureCount: Int { checks.reduce(0) { $0 + $1.failures.count } }
        public var summary: String {
            let ok = checks.filter(\.passed).count
            return "\(ok)/\(checks.count) checks passed, \(failureCount) failures"
        }
    }

    /// Collects failures for one named check.
    final class Collector {
        var failures: [String] = []
        func expect(_ condition: Bool, _ message: @autoclosure () -> String) {
            if !condition { failures.append(message()) }
        }
        func equal<T: Equatable>(_ a: T, _ b: T, _ label: @autoclosure () -> String) {
            if a != b { failures.append("\(label()): expected \(b), got \(a)") }
        }
    }

    public static func run(library: Library) -> Report {
        var checks: [Check] = []

        func check(_ group: String, _ name: String, _ body: (Collector) -> Void) {
            let collector = Collector()
            body(collector)
            // Cap the noise: 8 examples is enough to diagnose, and a broken
            // invariant can otherwise produce hundreds of lines.
            let shown = collector.failures.count > 8
                ? Array(collector.failures.prefix(8)) + ["…and \(collector.failures.count - 8) more"]
                : collector.failures
            checks.append(Check(group: group, name: name, failures: shown))
        }

        func containsHan(_ value: String) -> Bool {
            value.unicodeScalars.contains { scalar in
                switch scalar.value {
                case 0x3400...0x4DBF, 0x4E00...0x9FFF, 0xF900...0xFAFF:
                    return true
                default:
                    return false
                }
            }
        }

        // MARK: Decoding

        check("data", "dataset decodes completely") { c in
            c.equal(library.genres.count, 39, "genres")
            c.equal(library.lineage.count, 103, "lineage edges")
            c.equal(library.albums.count, 351, "albums")
            c.equal(library.paths.count, 3, "paths")
            c.equal(library.families.count, 4, "families")
            c.equal(library.eras.count, 6, "eras")
            c.equal(library.present, 2027, "present year")
        }

        check("data", "genre ids unique and chronologically ordered") { c in
            c.equal(Set(library.genres.map(\.id)).count, library.genres.count, "unique ids")
            for (a, b) in zip(library.genres, library.genres.dropFirst()) {
                c.expect(a.era.start <= b.era.start, "\(a.id) (\(a.era.start)) sorts after \(b.id) (\(b.era.start))")
            }
        }

        check("data", "genre fields are complete and sane") { c in
            let familyIDs = Set(library.families.map(\.id))
            for genre in library.genres {
                c.expect(familyIDs.contains(genre.family), "\(genre.id): unknown family \(genre.family)")
                c.expect(genre.era.peak.count == 2, "\(genre.id): peak is not a pair")
                c.expect(genre.era.peakStart >= genre.era.start, "\(genre.id): peak starts before era")
                if let end = genre.era.end {
                    c.expect(end >= genre.era.start, "\(genre.id): era ends before it starts")
                    c.expect(genre.era.peakEnd <= end, "\(genre.id): peak ends after era")
                }
                c.expect(genre.earMarkers.count >= 3, "\(genre.id): only \(genre.earMarkers.count) ear markers")
                c.expect(genre.keyFigures.count >= 3, "\(genre.id): only \(genre.keyFigures.count) key figures")
                c.expect(!genre.contested.isEmpty, "\(genre.id): no contested note")
                c.expect(!genre.summary.isEmpty, "\(genre.id): no summary")
            }
        }

        // MARK: Lineage

        check("lineage", "edges resolve, are unique, and carry an explanation") { c in
            let ids = Set(library.genres.map(\.id))
            for edge in library.lineage {
                c.expect(ids.contains(edge.from), "\(edge.id): unknown from")
                c.expect(ids.contains(edge.to), "\(edge.id): unknown to")
                c.expect(edge.from != edge.to, "\(edge.id): self loop")
                c.expect(!edge.aspects.isEmpty, "\(edge.id): no aspects")
                c.expect(edge.explanation.count > 40, "\(edge.id): explanation too short")
            }
            c.equal(Set(library.lineage.map(\.id)).count, library.lineage.count, "unique edges")
        }

        check("lineage", "graph is acyclic") { c in
            c.expect(library.isAcyclic, "lineage graph contains a cycle")
        }

        check("lineage", "no orphan genres") { c in
            for genre in library.genres {
                c.expect(!library.edges(touching: genre.id).isEmpty, "\(genre.id) has no lineage edges")
            }
        }

        check("lineage", "hinge albums resolve") { c in
            for edge in library.lineage {
                guard let hinge = edge.hingeAlbum else { continue }
                c.expect(library.album(hinge) != nil, "\(edge.id): hingeAlbum \(hinge) does not resolve")
            }
        }

        check("lineage", "direct neighbourhood is small where closure is not") { c in
            // The premise behind the phone UI emphasising direct neighbours.
            let closure = library.ancestors(of: "hard-bop").union(library.descendants(of: "hard-bop"))
            let near = library.neighbourhood(of: "hard-bop")
            c.expect(closure.count > 25, "hard bop closure is only \(closure.count)")
            c.expect(near.count < 12, "hard bop neighbourhood is \(near.count)")
        }

        // MARK: Albums

        check("albums", "tier counts per genre") { c in
            for genre in library.genres {
                let gateway = library.albums(for: genre.id, tier: .gateway).count
                let core = library.albums(for: genre.id, tier: .core).count
                let deep = library.albums(for: genre.id, tier: .deep).count
                c.expect(gateway == 1, "\(genre.id): \(gateway) gateway albums, expected 1")
                c.expect((4...6).contains(core), "\(genre.id): \(core) core albums, expected 4–6")
                c.expect((3...4).contains(deep), "\(genre.id): \(deep) deep albums, expected 3–4")
                c.expect(gateway + core + deep >= 8, "\(genre.id): only \(gateway + core + deep) primary albums")
            }
        }

        check("albums", "album fields are complete and sane") { c in
            let genreIDs = Set(library.genres.map(\.id))
            c.equal(Set(library.albums.map(\.id)).count, library.albums.count, "unique album ids")
            for album in library.albums {
                c.expect(!album.artist.isEmpty, "\(album.id): no artist")
                c.expect(!album.title.isEmpty, "\(album.id): no title")
                c.expect(!album.label.isEmpty, "\(album.id): no label")
                c.expect(!album.whyThisOne.isEmpty, "\(album.id): no whyThisOne")
                c.expect(!album.listenFor.isEmpty, "\(album.id): no listenFor")
                c.expect((1890...2027).contains(album.recorded), "\(album.id): recorded \(album.recorded)")
                if let released = album.released {
                    c.expect(released >= album.recorded, "\(album.id): released \(released) before recorded \(album.recorded)")
                }
                c.expect((1...5).contains(album.difficulty), "\(album.id): difficulty \(album.difficulty)")
                c.expect(!album.genreIds.isEmpty, "\(album.id): no genreIds")
                for gid in album.genreIds {
                    c.expect(genreIDs.contains(gid), "\(album.id): unknown genre \(gid)")
                }
                if album.confidence == .low {
                    c.expect(album.note != nil, "\(album.id): low confidence with no note")
                }
            }
        }

        // MARK: Paths

        check("paths", "steps resolve and honour their declared constraints") { c in
            for path in library.paths {
                c.expect(!path.steps.isEmpty, "\(path.id): no steps")
                var seen: Set<String> = []
                var previousYear = Int.min
                for step in path.steps {
                    let album = library.album(step.albumId)
                    c.expect(album != nil, "\(path.id): unknown album \(step.albumId)")
                    c.expect(!seen.contains(step.albumId), "\(path.id): \(step.albumId) repeats")
                    seen.insert(step.albumId)
                    c.expect(!step.bridge.isEmpty, "\(path.id): \(step.albumId) has no bridge")
                    if path.expect?.chronological == true {
                        c.expect(step.year >= previousYear, "\(path.id): \(step.albumId) (\(step.year)) breaks order")
                    }
                    previousYear = step.year
                    if let maxDifficulty = path.expect?.maxDifficulty, let album {
                        c.expect(album.difficulty <= maxDifficulty,
                                 "\(path.id): \(album.id) difficulty \(album.difficulty) > \(maxDifficulty)")
                    }
                }
                if let count = path.expect?.count {
                    c.equal(path.steps.count, count, "\(path.id) step count")
                }
            }
        }

        // MARK: DAG layout port

        check("layout", "DAG port agrees with js/lib/layout.js") { c in
            let layout = DAGLayout(
                genres: library.genres,
                lineage: library.lineage,
                options: .init(present: library.present, rowHeight: 30, capsuleHeight: 20, laneGap: 34)
            )
            c.equal(layout.nodes.count, 39, "layout nodes")
            c.equal(layout.edges.count, 103, "layout edges")
            // The single strongest check available without a screen: the JS version
            // scores 533 crossings on this dataset.
            c.equal(layout.crossings, 533, "crossing count")
        }

        check("layout", "DAG layout is deterministic and rows never overlap in time") { c in
            let build = {
                DAGLayout(
                    genres: library.genres, lineage: library.lineage,
                    options: .init(present: library.present, rowHeight: 30, capsuleHeight: 20, laneGap: 34)
                )
            }
            let a = build(), b = build()
            c.equal(a.crossings, b.crossings, "crossings differ between runs")
            for (nodeA, nodeB) in zip(a.nodes, b.nodes) {
                c.expect(nodeA.id == nodeB.id && nodeA.y == nodeB.y,
                         "\(nodeA.id) moved between identical runs")
            }
            var byRow: [Double: [DAGLayout.Node]] = [:]
            for node in a.nodes { byRow[node.y, default: []].append(node) }
            for (y, nodes) in byRow where nodes.count > 1 {
                for i in 0..<nodes.count {
                    for j in (i + 1)..<nodes.count {
                        let one = nodes[i], two = nodes[j]
                        let overlap = one.startYear <= two.endYear && two.startYear <= one.endYear
                        c.expect(!overlap, "\(one.id) and \(two.id) share row y=\(y) and overlap in time")
                    }
                }
            }
        }

        check("layout", "revival edges hook backwards before turning forward") { c in
            let layout = DAGLayout(genres: library.genres, lineage: library.lineage)
            let scale: (Int) -> Double = { Double($0 - 1890) * 6 }
            let revival = layout.edges.filter { $0.type == .revivalOf }
            c.expect(!revival.isEmpty, "no revival-of edges in the dataset")
            for edge in revival {
                let curve = edge.curve(x: scale)
                c.expect(curve.c1.x < curve.start.x, "\(edge.id): revival curve does not reach back")
            }
        }

        // MARK: Rail plan

        check("rail", "unfocused rail lists every genre once, in order, with decade headers") { c in
            let plan = RailPlan.build(library: library)
            c.equal(plan.rows.count, 39, "rows")
            c.expect(plan.connectors.isEmpty, "unfocused rail should draw no edges")
            c.equal(Set(plan.rows.map(\.id)).count, 39, "unique rows")
            c.expect(plan.rows.first?.isDecadeStart == true, "first row must start a decade section")
            for (a, b) in zip(plan.rows, plan.rows.dropFirst()) {
                c.expect(a.genre.era.start <= b.genre.era.start, "\(a.id) after \(b.id)")
                c.equal(b.index, a.index + 1, "row index continuity at \(b.id)")
                c.expect(b.isDecadeStart == (b.decade != a.decade), "decade header wrong at \(b.id)")
            }
        }

        check("rail", "focus collapses to the direct neighbourhood") { c in
            let plan = RailPlan.build(library: library, focus: "hard-bop")
            c.equal(Set(plan.rows.map(\.id)), library.neighbourhood(of: "hard-bop"), "focused rows")
            c.equal(plan.connectors.count, library.edges(touching: "hard-bop").count, "connectors")
            guard let centre = plan.rows.first(where: { $0.id == "hard-bop" })?.index else {
                return c.expect(false, "focused genre missing from its own rail")
            }
            for connector in plan.connectors {
                c.expect(connector.fromIndex == centre || connector.toIndex == centre,
                         "\(connector.id) does not touch the focused row")
            }
            c.equal(Set(plan.connectors.map(\.lane)).count, plan.connectors.count, "unique lanes")
            for (a, b) in zip(plan.connectors, plan.connectors.dropFirst()) {
                c.expect(a.span >= b.span, "lanes not ordered longest-span-first")
            }
        }

        check("rail", "gutter segments are consistent with the connectors") { c in
            let plan = RailPlan.build(library: library, focus: "fusion")
            c.equal(plan.gutters.count, plan.rows.count, "one gutter row per rail row")
            for gutter in plan.gutters {
                c.equal(gutter.count, plan.laneCount, "lane count per row")
            }
            for connector in plan.connectors {
                let top = min(connector.fromIndex, connector.toIndex)
                let bottom = max(connector.fromIndex, connector.toIndex)
                let lane = connector.lane
                if case .origin = plan.gutter(row: top)[lane] {} else {
                    c.expect(false, "\(connector.id): no origin segment at row \(top)")
                }
                if case .terminus = plan.gutter(row: bottom)[lane] {} else {
                    c.expect(false, "\(connector.id): no terminus segment at row \(bottom)")
                }
                if bottom > top + 1 {
                    for row in (top + 1)..<bottom {
                        if case .through = plan.gutter(row: row)[lane] {} else {
                            c.expect(false, "\(connector.id): lane \(lane) breaks at row \(row)")
                        }
                    }
                }
            }
            // No lane may carry two different edges at the same row.
            for (index, gutter) in plan.gutters.enumerated() {
                let occupied = gutter.enumerated().filter { !$0.element.isEmpty }.map(\.offset)
                c.equal(Set(occupied).count, occupied.count, "row \(index) reuses a lane")
            }
            // Out of range must be safe rather than crashing.
            c.equal(plan.gutter(row: 9_999).count, plan.laneCount, "out-of-range gutter")
            c.expect(RailPlan.build(library: library).gutters.isEmpty, "unfocused rail should have no gutters")
        }

        check("rail", "aspect filter matches the web semantics") { c in
            c.equal(RailPlan.build(library: library).visibleEdgeCount, 103, "unfiltered edges")
            let rhythm = RailPlan.build(library: library, aspects: [.rhythm])
            // The web app reports 42 of 103 for the rhythm filter.
            c.equal(rhythm.visibleEdgeCount, 42, "rhythm-filtered edges")
            c.equal(rhythm.rows.count, 39, "filter fades rows rather than removing them")
            c.expect(rhythm.rows.contains { !$0.matchesFilter }, "no genre falls out of the rhythm filter")
            for row in rhythm.rows where !row.matchesFilter {
                c.equal(row.parentCount + row.childCount, 0, "\(row.id) is flagged but still has edges")
            }
        }

        check("rail", "year scrubber hides unborn genres") { c in
            let plan = RailPlan.build(library: library, upToYear: 1947)
            c.expect(plan.rows.allSatisfy { $0.genre.era.start <= 1947 }, "unborn genre present at 1947")
            c.expect(plan.rows.allSatisfy(\.isBorn), "row marked unborn but included")
            c.expect(plan.rows.count < 39 && plan.rows.count > 5, "1947 should show a partial graph, got \(plan.rows.count)")
            c.expect(RailPlan.build(library: library, upToYear: 1890).rows.isEmpty, "1890 should be empty")
        }

        // MARK: Streaming

        check("streaming", "search URLs are well formed for every album") { c in
            guard let moanin = library.album("moanin-1959") else {
                return c.expect(false, "moanin-1959 missing from dataset")
            }
            c.equal(StreamingLinks.query(for: moanin), "Art Blakey & The Jazz Messengers Moanin'", "query string")
            if let spotify = StreamingLinks.url(.spotify, for: moanin)?.absoluteString {
                c.expect(spotify.hasPrefix("https://open.spotify.com/search/"), "spotify prefix: \(spotify)")
                c.expect(!spotify.contains(" "), "spotify URL contains a raw space")
                c.expect(spotify.contains("%26"), "spotify URL does not escape the ampersand")
            } else {
                c.expect(false, "spotify URL was nil")
            }
            c.expect(StreamingLinks.url(.appleMusic, for: moanin)?.absoluteString
                .hasPrefix("https://music.apple.com/us/search?term=") == true, "apple prefix")
            c.expect(StreamingLinks.url(.netease, for: moanin)?.absoluteString
                .hasPrefix("https://music.163.com/#/search/m/?s=") == true, "netease prefix")
            c.expect(StreamingLinks.url(.netease, for: moanin)?.absoluteString
                .hasSuffix("&type=10") == true, "netease album search type")
            c.expect(StreamingLinks.appURL(.netease, for: moanin)?.absoluteString
                .hasPrefix("orpheus://search?keyword=") == true, "netease app deep link")
            c.equal(StreamingLinks.appURL(.spotify, for: moanin), nil, "spotify has no custom app URL")

            for album in library.albums {
                for service in StreamingService.allCases {
                    c.expect(StreamingLinks.url(service, for: album) != nil, "\(album.id)/\(service.rawValue): nil URL")
                }
            }
            c.equal(StreamingLinks.ordered(preferring: .netease).first, .netease, "preferred service first")
            c.equal(StreamingLinks.ordered(preferring: .netease).count, 3, "service count")
        }

        // MARK: Localisation

        check("i18n", "both locales cover every genre, path, family, aspect and edge type") { c in
            let l10n = Localization.shared
            let previous = l10n.active
            defer { l10n.setActive(previous) }
            c.equal(l10n.locales.map(\.id), ["en", "zh-CN"], "locales")
            for locale in l10n.locales {
                l10n.setActive(locale.id)
                c.equal(l10n.active, locale.id, "setActive(\(locale.id))")
                for genre in library.genres {
                    c.expect(!l10n.genreName(genre).isEmpty, "\(locale.id)/\(genre.id): empty name")
                    c.expect(!l10n.genreOneLine(genre).isEmpty, "\(locale.id)/\(genre.id): empty one-line")
                }
                for path in library.paths {
                    c.expect(!l10n.pathName(path).isEmpty, "\(locale.id)/\(path.id): empty name")
                    c.expect(!l10n.pathBlurb(path).isEmpty, "\(locale.id)/\(path.id): empty blurb")
                }
                for family in library.families {
                    c.expect(!l10n.familyShort(family).isEmpty, "\(locale.id)/\(family.id): empty short")
                }
                for aspect in Aspect.allCases {
                    c.expect(l10n.aspectLabel(aspect) != aspect.rawValue || locale.id == "en",
                             "\(locale.id)/\(aspect.rawValue): untranslated")
                }
                for type in EdgeType.allCases {
                    c.expect(!l10n.edgeTypeLabel(type).isEmpty, "\(locale.id)/\(type.rawValue): empty label")
                    c.expect(!l10n.edgeDescription(type).isEmpty, "\(locale.id)/\(type.rawValue): empty description")
                }
                for difficulty in 1...5 {
                    c.expect(!l10n.difficultyLabel(difficulty).isEmpty, "\(locale.id)/difficulty \(difficulty)")
                }
            }
        }

        check("i18n", "Chinese table is actually applied and placeholders resolve") { c in
            let l10n = Localization.shared
            let previous = l10n.active
            defer { l10n.setActive(previous) }
            guard let hardBop = library.genre("hard-bop") else {
                return c.expect(false, "hard-bop missing")
            }
            l10n.setActive("en")
            let english = l10n.genreName(hardBop)
            c.equal(l10n.t("grid.count", ["shown": 12, "total": 39]), "12 of 39", "interpolation")
            l10n.setActive("zh-CN")
            c.expect(l10n.genreName(hardBop) != english, "zh-CN name matches English")
            c.equal(l10n.genreName(hardBop), "硬博普", "zh-CN name")
            let interpolated = l10n.t("paths.heard", ["done": 3, "total": 12])
            c.expect(!interpolated.contains("{"), "unfilled placeholder in zh-CN: \(interpolated)")
        }

        check("i18n", "Chinese editorial prose covers every rendered detail") { c in
            let l10n = Localization.shared
            let previous = l10n.active
            defer { l10n.setActive(previous) }
            l10n.setActive("zh-CN")

            func expectChinese(_ value: String, _ label: String) {
                c.expect(!value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                         "\(label): empty")
                c.expect(containsHan(value), "\(label): no Simplified Chinese content")
            }

            for genre in library.genres {
                expectChinese(l10n.genreOriginCity(genre), "\(genre.id)/origin.city")
                expectChinese(l10n.genreOriginCountry(genre), "\(genre.id)/origin.country")
                expectChinese(l10n.genreSummary(genre), "\(genre.id)/summary")
                expectChinese(l10n.genreContested(genre), "\(genre.id)/contested")
                c.equal(l10n.genreAliases(genre).count, genre.aka?.count ?? 0,
                        "\(genre.id)/alias count")
                c.equal(l10n.genreEarMarkers(genre).count, genre.earMarkers.count,
                        "\(genre.id)/ear-marker count")
                for marker in l10n.genreEarMarkers(genre) {
                    expectChinese(marker, "\(genre.id)/ear marker")
                }
                for trait in genre.musicalTraits.ordered {
                    expectChinese(l10n.genreTrait(genre, trait.aspect),
                                  "\(genre.id)/\(trait.aspect.rawValue)")
                }
                for figure in genre.keyFigures {
                    expectChinese(l10n.keyFigureInstrument(figure, in: genre),
                                  "\(genre.id)/\(figure.name)/instrument")
                    expectChinese(l10n.keyFigureWhy(figure, in: genre),
                                  "\(genre.id)/\(figure.name)/why")
                }
            }
            for edge in library.lineage {
                expectChinese(l10n.edgeExplanation(edge), "\(edge.id)/explanation")
            }
            for album in library.albums {
                expectChinese(l10n.albumWhyThisOne(album), "\(album.id)/whyThisOne")
                expectChinese(l10n.albumListenFor(album), "\(album.id)/listenFor")
                if album.note != nil {
                    expectChinese(l10n.albumNote(album) ?? "", "\(album.id)/note")
                }
            }
            for path in library.paths {
                for step in path.steps {
                    expectChinese(l10n.pathStepBridge(path, step),
                                  "\(path.id)/\(step.albumId)/bridge")
                }
            }
        }

        check("i18n", "difficulty dots never rely on colour alone") { c in
            c.equal(Localization.difficultyDots(1), "●○○○○", "difficulty 1")
            c.equal(Localization.difficultyDots(5), "●●●●●", "difficulty 5")
            c.equal(Localization.difficultyDots(0).count, 5, "clamped low")
            c.equal(Localization.difficultyDots(9).count, 5, "clamped high")
        }

        // MARK: Progress

        check("progress", "progress round-trips and is scoped per path") { c in
            let backing = MemoryStore()
            guard let path = library.paths.first, let first = path.steps.first?.albumId else {
                return c.expect(false, "no paths to test")
            }
            let store = PathProgressStore(store: backing)
            c.equal(store.progress.count(in: path), 0, "starts empty")
            c.equal(store.progress.nextStepIndex(in: path), 0, "resume index")
            store.update { $0.set(true, path: path.id, album: first) }
            c.expect(store.progress.isHeard(path: path.id, album: first), "did not record")
            c.equal(store.progress.count(in: path), 1, "count after one")
            c.expect(PathProgressStore(store: backing).progress.isHeard(path: path.id, album: first),
                     "did not persist across reload")
            store.update { $0.clear(path: path) }
            c.equal(PathProgressStore(store: backing).progress.count(in: path), 0, "clear did not persist")

            // Same album in two paths must be tracked separately.
            let pairs = library.paths.flatMap { p in p.steps.map { ($0.albumId, p.id) } }
            let shared = Dictionary(grouping: pairs, by: \.0).filter { $0.value.count > 1 }
            if let entries = shared.values.first, entries.count >= 2 {
                var progress = PathProgress()
                progress.set(true, path: entries[0].1, album: entries[0].0)
                c.expect(progress.isHeard(path: entries[0].1, album: entries[0].0), "not set")
                c.expect(!progress.isHeard(path: entries[1].1, album: entries[1].0), "leaked across paths")
            } else {
                c.expect(false, "expected an album shared between two paths")
            }
        }

        // MARK: Search

        check("search", "finds genres by figure, label, ear marker and localised name") { c in
            c.expect(library.search("blakey").contains { $0.id == "hard-bop" }, "figure search")
            c.expect(library.search("Three Blind Mice").contains { $0.id == "j-jazz" }, "label search")
            c.expect(library.search("harp").contains { $0.id == "spiritual-jazz" }, "ear-marker search")
            c.equal(library.search("").count, 39, "empty query returns all")
            c.expect(library.search("zzzznothing").isEmpty, "nonsense query returns none")
            c.expect(library.search("bop", family: "avant").allSatisfy { $0.family == "avant" }, "family filter")

            let l10n = Localization.shared
            let previous = l10n.active
            defer { l10n.setActive(previous) }
            l10n.setActive("zh-CN")
            c.expect(library.search("硬博普").contains { $0.id == "hard-bop" }, "Chinese query")
        }

        return Report(checks: checks)
    }
}
