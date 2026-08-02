import Foundation

public struct LayoutPoint: Hashable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) { self.x = x; self.y = y }
}

/// A faithful port of `js/lib/layout.js`, used by the pinch-zoomable Map view.
///
/// It is a port rather than a reimplementation on purpose: the tests assert that
/// this produces the same crossing count as the web version (533), which is the
/// only practical way to check a layout algorithm without eyes on a screen.
///
/// No physics. Given the same data it returns identical coordinates every time.
public struct DAGLayout: Sendable {

    // Matching the JS constants exactly.
    private static let iterations = 12
    private static let refinePasses = 6
    /// Minimum clear years between two capsules sharing a row.
    private static let rowGapYears = 3

    /// Empirically the fewest-crossing order of the 24 possibilities. See
    /// DECISIONS.md §2.
    public static let familyOrder = ["avant", "trad-mainstream", "global", "electric"]
    /// The Spans view has no edges, so it can use the narrative order.
    public static let narrativeFamilyOrder = ["trad-mainstream", "global", "avant", "electric"]

    public struct Node: Identifiable, Sendable {
        public let id: String
        public let genre: Genre
        public let family: String
        public let row: Int
        public let startYear: Int
        public let endYear: Int
        public let peak: (start: Int, end: Int)
        /// Top edge of the capsule, in layout points.
        public let y: Double
        public let height: Double
        public var midY: Double { y + height / 2 }
    }

    public struct Edge: Identifiable, Sendable {
        public let id: String
        public let edge: LineageEdge
        /// Year the curve leaves the parent's span.
        public let fromYear: Int
        /// Year the curve meets the child.
        public let toYear: Int
        public let fromY: Double
        public let toY: Double
        public var type: EdgeType { edge.type }
        public var strength: Strength { edge.strength }
    }

    public struct LaneBand: Identifiable, Sendable {
        public let family: String
        public let top: Double
        public let rows: Int
        public var id: String { family }
    }

    public let nodes: [Node]
    public let edges: [Edge]
    public let laneBands: [LaneBand]
    public let contentHeight: Double
    /// Crossing count of the chosen arrangement. Asserted in tests.
    public let crossings: Int

    private let nodeIndex: [String: Node]
    public func node(_ id: String) -> Node? { nodeIndex[id] }

    public struct Options: Sendable {
        public var present: Int
        public var rowHeight: Double
        public var capsuleHeight: Double
        public var laneGap: Double
        public var topPad: Double

        public init(
            present: Int = 2027,
            rowHeight: Double = 34,
            capsuleHeight: Double = 22,
            laneGap: Double = 34,
            topPad: Double = 0
        ) {
            self.present = present
            self.rowHeight = rowHeight
            self.capsuleHeight = capsuleHeight
            self.laneGap = laneGap
            self.topPad = topPad
        }
    }

    public init(genres: [Genre], lineage: [LineageEdge], options: Options = Options()) {
        let present = options.present
        let byID = Dictionary(uniqueKeysWithValues: genres.map { ($0.id, $0) })

        func span(_ genre: Genre) -> (start: Int, end: Int) {
            (genre.era.start, genre.era.end ?? present)
        }
        func span(id: String) -> (start: Int, end: Int) {
            guard let genre = byID[id] else { return (0, 0) }
            return span(genre)
        }

        // Undirected neighbours, weighted by strength — the barycentre reads the
        // whole graph so lanes arrange relative to each other, not just internally.
        struct Neighbour { let id: String; let weight: Double }
        var neighbours: [String: [Neighbour]] = [:]
        for genre in genres { neighbours[genre.id] = [] }
        for edge in lineage {
            guard byID[edge.from] != nil, byID[edge.to] != nil else { continue }
            let weight: Double
            switch edge.strength {
            case .strong: weight = 3
            case .moderate: weight = 2
            case .weak: weight = 1
            }
            neighbours[edge.from]?.append(Neighbour(id: edge.to, weight: weight))
            neighbours[edge.to]?.append(Neighbour(id: edge.from, weight: weight))
        }

        // Lanes, seeded in era-start then id order so ties never depend on input order.
        func seedMembers(_ family: String) -> [Genre] {
            genres.filter { $0.family == family }
                .sorted { $0.era.start != $1.era.start ? $0.era.start < $1.era.start : $0.id < $1.id }
        }
        var lanes: [(family: String, members: [Genre])] = DAGLayout.familyOrder
            .map { ($0, seedMembers($0)) }
            .filter { !$0.members.isEmpty }
        // A genre with an unrecognised family still gets a lane rather than vanishing.
        let known = Set(DAGLayout.familyOrder)
        let strays = genres.filter { !known.contains($0.family) }
        if !strays.isEmpty { lanes.append(("other", strays)) }

        /// First-fit interval packing: no two capsules overlapping in time share a row.
        func pack(_ members: [Genre]) -> [String: Int] {
            var rowEnds: [Int] = []   // latest occupied year per row
            var assign: [String: Int] = [:]
            for genre in members {
                let (start, end) = span(genre)
                var row = -1
                for (index, last) in rowEnds.enumerated() where start - last >= DAGLayout.rowGapYears {
                    row = index
                    break
                }
                if row == -1 {
                    row = rowEnds.count
                    rowEnds.append(Int.min / 2)
                }
                rowEnds[row] = end
                assign[genre.id] = row
            }
            return assign
        }

        func globalIndex(_ laneAssigns: [(assign: [String: Int], height: Int)]) -> [String: Int] {
            var out: [String: Int] = [:]
            var cursor = 0
            for lane in laneAssigns {
                for (id, row) in lane.assign { out[id] = cursor + row }
                cursor += lane.height
            }
            return out
        }

        func buildArrangement(_ orders: [[Genre]]) -> (laneAssigns: [(assign: [String: Int], height: Int)], index: [String: Int]) {
            let laneAssigns: [(assign: [String: Int], height: Int)] = orders.map { members in
                let assign = pack(members)
                let height = (assign.values.max() ?? -1) + 1
                return (assign, height)
            }
            return (laneAssigns, globalIndex(laneAssigns))
        }

        /// Crossings, counted the way they matter visually: two edges cross when
        /// their vertical order is opposite to their order at the child end, and
        /// their horizontal extents overlap.
        func crossings(_ index: [String: Int]) -> Int {
            struct Seg { let x1: Int; let y1: Int; let x2: Int; let y2: Int }
            var segments: [Seg] = []
            segments.reserveCapacity(lineage.count)
            for edge in lineage {
                guard let y1 = index[edge.from], let y2 = index[edge.to],
                      let child = byID[edge.to] else { continue }
                segments.append(Seg(
                    x1: span(id: edge.from).start,
                    y1: y1,
                    x2: max(child.era.start, edge.year),
                    y2: y2
                ))
            }
            var count = 0
            for i in 0..<segments.count {
                for j in (i + 1)..<segments.count {
                    let a = segments[i], b = segments[j]
                    if max(a.x1, b.x1) > min(a.x2, b.x2) { continue }
                    if (a.y1 - b.y1) * (a.y2 - b.y2) < 0 { count += 1 }
                }
            }
            return count
        }

        var orders: [[Genre]] = lanes.map { $0.members }
        var bestOrders = orders
        var bestScore = crossings(buildArrangement(orders).index)

        for iteration in 0..<DAGLayout.iterations {
            let index = buildArrangement(orders).index
            orders = orders.map { members -> [Genre] in
                struct Scored { let genre: Genre; let bary: Double }
                let scored: [Scored] = members.map { genre in
                    let ns = (neighbours[genre.id] ?? []).filter { index[$0.id] != nil }
                    let totalWeight = ns.reduce(0.0) { $0 + $1.weight }
                    let bary: Double = totalWeight > 0
                        ? ns.reduce(0.0) { $0 + Double(index[$1.id] ?? 0) * $1.weight } / totalWeight
                        : Double(index[genre.id] ?? 0)
                    return Scored(genre: genre, bary: bary)
                }
                // Alternating sweep: descending on odd passes, then reversed — which
                // is not the same as ascending, because it flips the tiebreaks too.
                // Replicated exactly from the JS so the two agree.
                let descending = iteration % 2 == 1
                var sorted = scored.sorted { a, b in
                    let delta = descending ? (b.bary - a.bary) : (a.bary - b.bary)
                    if delta != 0 { return delta < 0 }
                    if a.genre.era.start != b.genre.era.start {
                        return a.genre.era.start < b.genre.era.start
                    }
                    return a.genre.id < b.genre.id
                }
                if descending { sorted.reverse() }
                return sorted.map(\.genre)
            }
            let score = crossings(buildArrangement(orders).index)
            if score < bestScore {
                bestScore = score
                bestOrders = orders
            }
        }

        var arrangement = buildArrangement(bestOrders)

        // Refinement: move single genres between rows inside their own lane. The
        // barycentre sweep converges almost immediately here because nearly every
        // capsule overlaps nearly every other one in time, so the packing
        // constraint dominates the ordering — this pass is the only one that can
        // break those ties. Deterministic: fixed lane order, fixed member order,
        // first improvement wins.
        do {
            var assigns = arrangement.laneAssigns.map(\.assign)
            let heights = arrangement.laneAssigns.map(\.height)

            func indexFrom() -> [String: Int] {
                var out: [String: Int] = [:]
                var cursor = 0
                for (i, assign) in assigns.enumerated() {
                    for (id, row) in assign { out[id] = cursor + row }
                    cursor += heights[i]
                }
                return out
            }

            func fits(lane: Int, id: String, row: Int) -> Bool {
                let (start, end) = span(id: id)
                for (otherID, otherRow) in assigns[lane] where otherID != id && otherRow == row {
                    let (otherStart, otherEnd) = span(id: otherID)
                    if start - DAGLayout.rowGapYears < otherEnd
                        && otherStart - DAGLayout.rowGapYears < end { return false }
                }
                return true
            }

            var score = crossings(indexFrom())
            for _ in 0..<DAGLayout.refinePasses {
                var improved = false
                for (laneIndex, lane) in lanes.enumerated() {
                    for genre in lane.members {
                        guard let current = assigns[laneIndex][genre.id] else { continue }
                        for row in 0..<heights[laneIndex] {
                            if row == current || !fits(lane: laneIndex, id: genre.id, row: row) { continue }
                            assigns[laneIndex][genre.id] = row
                            let next = crossings(indexFrom())
                            if next < score {
                                score = next
                                improved = true
                                break
                            }
                            assigns[laneIndex][genre.id] = current
                        }
                    }
                }
                if !improved { break }
            }
            bestScore = score
            arrangement = (
                laneAssigns: zip(assigns, heights).map { (assign: $0, height: $1) },
                index: indexFrom()
            )
        }

        // Materialise coordinates.
        var builtNodes: [Node] = []
        var bands: [LaneBand] = []
        var y = options.topPad
        for (laneIndex, lane) in lanes.enumerated() {
            let assign = arrangement.laneAssigns[laneIndex].assign
            let height = arrangement.laneAssigns[laneIndex].height
            let bandTop = y
            for genre in lane.members {
                let row = assign[genre.id] ?? 0
                let (start, end) = span(genre)
                builtNodes.append(Node(
                    id: genre.id,
                    genre: genre,
                    family: lane.family,
                    row: row,
                    startYear: start,
                    endYear: end,
                    peak: (genre.era.peakStart, genre.era.peakEnd),
                    y: y + Double(row) * options.rowHeight,
                    height: options.capsuleHeight
                ))
            }
            y += Double(height) * options.rowHeight
            bands.append(LaneBand(family: lane.family, top: bandTop, rows: height))
            y += options.laneGap
        }

        self.nodes = builtNodes.sorted { $0.y != $1.y ? $0.y < $1.y : $0.id < $1.id }
        self.laneBands = bands
        self.contentHeight = max(0, y - options.laneGap) + options.capsuleHeight
        self.crossings = bestScore
        let index = Dictionary(uniqueKeysWithValues: builtNodes.map { ($0.id, $0) })
        self.nodeIndex = index

        self.edges = lineage.compactMap { edge in
            guard let from = index[edge.from], let to = index[edge.to] else { return nil }
            // Source: where on the parent's span the influence took hold.
            let fromYear = min(max(edge.year, from.startYear), from.endYear)
            // Target: the child's start, unless the influence is dated later.
            let toYear = min(max(edge.year, to.startYear), to.endYear)
            return Edge(
                id: edge.id,
                edge: edge,
                fromYear: fromYear,
                toYear: toYear,
                fromY: from.midY,
                toY: to.midY
            )
        }
    }
}

// MARK: - Edge geometry

extension DAGLayout.Edge {
    /// Cubic bezier control points for the curve, given a year→x mapping.
    /// `revival-of` hooks backwards before turning forward, so a retrospective
    /// influence reads differently from a forward one at a glance.
    public func curve(x: (Int) -> Double) -> (start: LayoutPoint, c1: LayoutPoint, c2: LayoutPoint, end: LayoutPoint) {
        let sx = x(fromYear)
        let tx = x(toYear)
        let dx = tx - sx

        if type == .revivalOf {
            let hook = max(28, min(70, abs(dx) * 0.18))
            return (
                LayoutPoint(x: sx, y: fromY),
                LayoutPoint(x: sx - hook, y: fromY + (toY > fromY ? 10 : -10)),
                LayoutPoint(x: tx - abs(dx) * 0.3, y: toY),
                LayoutPoint(x: tx, y: toY)
            )
        }

        // Near-vertical connectors get a gentle S rather than a flat line so they
        // stay traceable.
        let bend = max(26, abs(dx) * 0.45)
        return (
            LayoutPoint(x: sx, y: fromY),
            LayoutPoint(x: sx + bend, y: fromY),
            LayoutPoint(x: tx - bend, y: toY),
            LayoutPoint(x: tx, y: toY)
        )
    }
}
