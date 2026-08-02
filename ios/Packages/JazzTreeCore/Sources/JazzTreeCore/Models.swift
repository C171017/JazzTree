import Foundation

// MARK: - Small vocabularies
//
// These are closed sets in the dataset and the web validator enforces them, so
// they are modelled as enums here. Decoding fails loudly if the data ever grows a
// value the app does not know how to render, which is what we want — a silent
// `default` case would hide a real problem.

public enum Confidence: String, Codable, CaseIterable, Sendable {
    case high, medium, low
}

public enum Tier: String, Codable, CaseIterable, Sendable {
    case gateway, core, deep
}

public enum Strength: String, Codable, CaseIterable, Sendable {
    case strong, moderate, weak

    /// Relative line weight when the edge is drawn.
    public var lineWidth: Double {
        switch self {
        case .strong: return 2.2
        case .moderate: return 1.5
        case .weak: return 1.0
        }
    }
}

public enum EdgeType: String, Codable, CaseIterable, Sendable {
    case directDescendant = "direct-descendant"
    case reactionAgainst = "reaction-against"
    case fusionOf = "fusion-of"
    case parallelInfluence = "parallel-influence"
    case revivalOf = "revival-of"
}

public enum Aspect: String, Codable, CaseIterable, Sendable {
    case harmony, rhythm, form, instrumentation, improvisation, timbre, repertoire
    case socialContext = "social-context"
    case technology
}

public enum FamilyID: String, Codable, CaseIterable, Sendable {
    case tradMainstream = "trad-mainstream"
    case avant
    case electric
    case global
}

// MARK: - Reference tables

public struct Family: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let short: String
    public let blurb: String
}

public struct Era: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let start: Int
    public let end: Int
}

// MARK: - Genre

public struct EraSpan: Codable, Hashable, Sendable {
    public let start: Int
    /// Two elements: [peakStart, peakEnd].
    public let peak: [Int]
    /// `nil` means the genre is still active; render against `Library.present`.
    public let end: Int?

    public var peakStart: Int { peak.first ?? start }
    public var peakEnd: Int { peak.count > 1 ? peak[1] : peakStart }
    public var isOngoing: Bool { end == nil }

    public func endYear(present: Int) -> Int { end ?? present }
    public var decade: Int { (start / 10) * 10 }
}

public struct Origin: Codable, Hashable, Sendable {
    public let city: String
    public let country: String
}

public struct KeyFigure: Codable, Hashable, Sendable, Identifiable {
    public let name: String
    public let instrument: String
    public let why: String
    public var id: String { name }
}

public struct MusicalTraits: Codable, Hashable, Sendable {
    public let harmony: String
    public let rhythm: String
    public let form: String
    public let instrumentation: String
    public let improvisation: String
    public let timbre: String

    public struct Trait: Identifiable, Hashable, Sendable {
        public let aspect: Aspect
        public let text: String
        public var id: Aspect { aspect }
    }

    /// Display order is fixed and intentional: what the harmony does, then what
    /// the rhythm does, and so on outward to timbre. A named type rather than a
    /// tuple so `ForEach` over it is unambiguous.
    public var ordered: [Trait] {
        [
            Trait(aspect: .harmony, text: harmony),
            Trait(aspect: .rhythm, text: rhythm),
            Trait(aspect: .form, text: form),
            Trait(aspect: .instrumentation, text: instrumentation),
            Trait(aspect: .improvisation, text: improvisation),
            Trait(aspect: .timbre, text: timbre),
        ]
    }
}

public struct Genre: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let aka: [String]?
    public let family: String
    public let era: EraSpan
    public let origin: Origin
    public let oneLine: String
    public let summary: String
    public let musicalTraits: MusicalTraits
    public let earMarkers: [String]
    public let keyFigures: [KeyFigure]
    public let keyLabels: [String]
    public let contested: String
    public let confidence: Confidence

    public var familyID: FamilyID? { FamilyID(rawValue: family) }
}

// MARK: - Lineage

public struct LineageEdge: Codable, Identifiable, Hashable, Sendable {
    public let from: String
    public let to: String
    public let type: EdgeType
    /// Approximate year the influence took hold. Not always inside the child's
    /// span — see DECISIONS.md §3.
    public let year: Int
    public let aspects: [Aspect]
    public let explanation: String
    public let hingeAlbum: String?
    public let strength: Strength

    public var id: String { "\(from)->\(to)" }
}

// MARK: - Album

public struct Album: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let genreIds: [String]
    public let tier: Tier
    public let artist: String
    public let title: String
    public let recorded: Int
    public let released: Int?
    public let label: String
    public let catalogNo: String?
    public let personnel: [String]?
    public let whyThisOne: String
    public let listenFor: String
    public let startTrack: String?
    /// 1 (easy listen) … 5 (very demanding).
    public let difficulty: Int
    public let confidence: Confidence
    public let note: String?

    /// The genre this album is filed under. Cross-listings come after it.
    public var primaryGenreID: String { genreIds.first ?? "" }

    /// "rec. 1958 · rel. 1959", or a single year when they match.
    public var yearsLabel: String {
        guard let released, released != recorded else { return "\(recorded)" }
        return "\(recorded) · \(released)"
    }

    public var labelAndCatalog: String {
        guard let catalogNo, !catalogNo.isEmpty else { return label }
        return "\(label) \(catalogNo)"
    }
}

// MARK: - Listening paths

public struct ListeningPath: Codable, Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let subtitle: String
    public let blurb: String
    public let expect: Expect?
    public let steps: [Step]

    public struct Expect: Codable, Hashable, Sendable {
        public let count: Int?
        public let maxDifficulty: Int?
        public let chronological: Bool?
    }

    public struct Step: Codable, Hashable, Sendable, Identifiable {
        public let albumId: String
        /// The year this step represents in the narrative, which is not always the
        /// album's recording year — a 1970 Joplin recital belongs at 1899.
        public let year: Int
        public let bridge: String
        public var id: String { albumId }
    }
}

// MARK: - Dataset

public struct DatasetMeta: Codable, Hashable, Sendable {
    public let present: Int
    public let generated: String?

    public init(present: Int, generated: String?) {
        self.present = present
        self.generated = generated
    }
}

/// Mirrors data/genres.json exactly.
struct GenresFile: Codable {
    let meta: DatasetMeta
    let families: [Family]
    let eras: [Era]
    let genres: [Genre]
    let lineage: [LineageEdge]
}
