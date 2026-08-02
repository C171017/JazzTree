import Foundation

/// Locale handling that mirrors the web app exactly, from the same tables.
///
/// `Resources/localization.json` is generated from `js/i18n.js` by
/// `node build/extract-i18n.js`, so the two apps cannot drift apart. Note what is
/// and is not translated: every interface string and every piece of editorial
/// prose is localised. Canonical artist, album, track, person and label names stay
/// unchanged so streaming searches and historical metadata remain accurate.
public final class Localization: @unchecked Sendable {

    public struct LocaleOption: Codable, Identifiable, Hashable, Sendable {
        public let id: String
        public let label: String
        public let short: String
    }

    struct Tables: Codable {
        struct FamilyStrings: Codable {
            let name: String
            let short: String
            let blurb: String
        }
        struct PathStrings: Codable {
            let name: String
            let subtitle: String
            let blurb: String
        }
        struct OriginStrings: Codable {
            let city: String
            let country: String
        }
        struct FigureStrings: Codable {
            let instrument: String
            let why: String
        }
        struct GenreContent: Codable {
            let aka: [String]
            let origin: OriginStrings
            let summary: String
            let musicalTraits: [String: String]
            let earMarkers: [String]
            let keyFigures: [String: FigureStrings]
            let contested: String
        }
        struct LineageContent: Codable { let explanation: String }
        struct AlbumContent: Codable {
            let whyThisOne: String
            let listenFor: String
            let note: String?
        }
        struct PathContent: Codable { let bridges: [String: String] }
        let ui: [String: String]
        let genreNames: [String: String]
        let genreOneLines: [String: String]
        let families: [String: FamilyStrings]
        let eras: [String: String]
        let aspects: [String: String]
        let edgeTypes: [String: String]
        let edgeDescriptions: [String: String]
        let paths: [String: PathStrings]
        let genreContent: [String: GenreContent]
        let lineageContent: [String: LineageContent]
        let albumContent: [String: AlbumContent]
        let pathContent: [String: PathContent]
    }

    struct Payload: Codable {
        let locales: [LocaleOption]
        let tables: [String: Tables]
    }

    public static let shared = Localization()

    public let locales: [LocaleOption]
    private let tables: [String: Tables]
    private let fallbackID = "en"

    private let lock = NSLock()
    private var _active: String

    private init() {
        // A missing or malformed localisation file must not crash the app; falling
        // back to the identity table means the UI shows raw keys, which is ugly but
        // recoverable and immediately obvious in testing.
        let payload = (try? DataLoader.decode("localization", as: Payload.self, bundle: .module))
            ?? Payload(locales: [LocaleOption(id: "en", label: "English", short: "EN")], tables: [:])
        self.locales = payload.locales
        self.tables = payload.tables
        self._active = Localization.preferredLocale(from: payload.locales)
    }

    /// Best match for the device's language settings, so a Chinese phone opens in
    /// Chinese without the user hunting for a setting.
    static func preferredLocale(from locales: [LocaleOption]) -> String {
        let available = locales.map(\.id)
        for preferred in Foundation.Locale.preferredLanguages {
            if available.contains(preferred) { return preferred }
            let base = preferred.split(separator: "-").first.map(String.init) ?? preferred
            if base == "zh", available.contains("zh-CN") {
                // Treat Hans as zh-CN; leave Hant users in English rather than
                // showing them simplified characters.
                let lower = preferred.lowercased()
                let isTraditional = lower.contains("hant") || lower.contains("tw")
                    || lower.contains("hk") || lower.contains("mo")
                if !isTraditional { return "zh-CN" }
            }
            if let exact = available.first(where: { $0.hasPrefix(base + "-") || $0 == base }) {
                return exact
            }
        }
        return available.first ?? "en"
    }

    public var active: String {
        lock.lock(); defer { lock.unlock() }
        return _active
    }

    public func setActive(_ id: String) {
        guard locales.contains(where: { $0.id == id }) else { return }
        lock.lock(); _active = id; lock.unlock()
    }

    private var table: Tables? { tables[active] }
    private var fallback: Tables? { tables[fallbackID] }

    private func string(_ path: (Tables) -> String?) -> String? {
        if let table, let value = path(table), !value.isEmpty { return value }
        if let fallback, let value = path(fallback), !value.isEmpty { return value }
        return nil
    }

    private func value<T>(_ path: (Tables) -> T?) -> T? {
        if let table, let value = path(table) { return value }
        if let fallback, let value = path(fallback) { return value }
        return nil
    }

    // MARK: - UI strings

    /// `t("grid.count", ["shown": 12, "total": 39])`, matching the web `t()`.
    public func t(_ key: String, _ vars: [String: CustomStringConvertible] = [:]) -> String {
        var value = string { $0.ui[key] } ?? key
        for (name, replacement) in vars {
            value = value.replacingOccurrences(of: "{\(name)}", with: replacement.description)
        }
        return value
    }

    // MARK: - Content strings

    public func genreName(_ genre: Genre) -> String {
        string { $0.genreNames[genre.id] } ?? genre.name
    }

    public func genreOneLine(_ genre: Genre) -> String {
        string { $0.genreOneLines[genre.id] } ?? genre.oneLine
    }

    public func genreAliases(_ genre: Genre) -> [String] {
        value { $0.genreContent[genre.id]?.aka } ?? genre.aka ?? []
    }

    public func genreOriginCity(_ genre: Genre) -> String {
        string { $0.genreContent[genre.id]?.origin.city } ?? genre.origin.city
    }

    public func genreOriginCountry(_ genre: Genre) -> String {
        string { $0.genreContent[genre.id]?.origin.country } ?? genre.origin.country
    }

    public func genreSummary(_ genre: Genre) -> String {
        string { $0.genreContent[genre.id]?.summary } ?? genre.summary
    }

    public func genreEarMarkers(_ genre: Genre) -> [String] {
        value { $0.genreContent[genre.id]?.earMarkers } ?? genre.earMarkers
    }

    public func genreTrait(_ genre: Genre, _ aspect: Aspect) -> String {
        if let translated = string({ $0.genreContent[genre.id]?.musicalTraits[aspect.rawValue] }) {
            return translated
        }
        return genre.musicalTraits.ordered.first(where: { $0.aspect == aspect })?.text ?? ""
    }

    public func keyFigureInstrument(_ figure: KeyFigure, in genre: Genre) -> String {
        string { $0.genreContent[genre.id]?.keyFigures[figure.name]?.instrument } ?? figure.instrument
    }

    public func keyFigureWhy(_ figure: KeyFigure, in genre: Genre) -> String {
        string { $0.genreContent[genre.id]?.keyFigures[figure.name]?.why } ?? figure.why
    }

    public func genreContested(_ genre: Genre) -> String {
        string { $0.genreContent[genre.id]?.contested } ?? genre.contested
    }

    public func familyName(_ family: Family) -> String {
        string { $0.families[family.id]?.name } ?? family.name
    }

    public func familyShort(_ family: Family) -> String {
        string { $0.families[family.id]?.short } ?? family.short
    }

    public func familyBlurb(_ family: Family) -> String {
        string { $0.families[family.id]?.blurb } ?? family.blurb
    }

    public func eraName(_ era: Era) -> String {
        string { $0.eras[era.id] } ?? era.name
    }

    public func aspectLabel(_ aspect: Aspect) -> String {
        string { $0.aspects[aspect.rawValue] } ?? aspect.rawValue
    }

    public func edgeTypeLabel(_ type: EdgeType) -> String {
        string { $0.edgeTypes[type.rawValue] }
            ?? type.rawValue.replacingOccurrences(of: "-", with: " ")
    }

    public func edgeDescription(_ type: EdgeType) -> String {
        string { $0.edgeDescriptions[type.rawValue] } ?? ""
    }

    public func pathName(_ path: ListeningPath) -> String {
        string { $0.paths[path.id]?.name } ?? path.name
    }

    public func pathSubtitle(_ path: ListeningPath) -> String {
        string { $0.paths[path.id]?.subtitle } ?? path.subtitle
    }

    public func pathBlurb(_ path: ListeningPath) -> String {
        string { $0.paths[path.id]?.blurb } ?? path.blurb
    }

    public func edgeExplanation(_ edge: LineageEdge) -> String {
        string { $0.lineageContent[edge.id]?.explanation } ?? edge.explanation
    }

    public func albumWhyThisOne(_ album: Album) -> String {
        string { $0.albumContent[album.id]?.whyThisOne } ?? album.whyThisOne
    }

    public func albumListenFor(_ album: Album) -> String {
        string { $0.albumContent[album.id]?.listenFor } ?? album.listenFor
    }

    public func albumNote(_ album: Album) -> String? {
        if album.note == nil { return nil }
        return string { $0.albumContent[album.id]?.note } ?? album.note
    }

    public func pathStepBridge(_ path: ListeningPath, _ step: ListeningPath.Step) -> String {
        string { $0.pathContent[path.id]?.bridges[step.albumId] } ?? step.bridge
    }

    public func strengthLabel(_ strength: Strength) -> String {
        t("strength.\(strength.rawValue)")
    }

    public func serviceName(_ service: StreamingService) -> String {
        t("service.name.\(service.rawValue)")
    }

    public func decadeLabel(_ decade: Int) -> String {
        t("decade.format", ["decade": decade])
    }

    // MARK: - Formatting

    /// "1954–present" / "1948–1964", using an en dash.
    public func eraSpan(_ genre: Genre, present: Int) -> String {
        if let end = genre.era.end { return "\(genre.era.start)–\(end)" }
        return "\(genre.era.start)–\(t("era.present"))"
    }

    public func difficultyLabel(_ difficulty: Int) -> String {
        let keys = ["", "difficulty.1", "difficulty.2", "difficulty.3", "difficulty.4", "difficulty.5"]
        guard difficulty >= 1, difficulty < keys.count else { return "" }
        return t(keys[difficulty])
    }

    /// Filled and hollow dots, so difficulty never depends on colour alone.
    public static func difficultyDots(_ difficulty: Int) -> String {
        let clamped = max(0, min(5, difficulty))
        return String(repeating: "●", count: clamped) + String(repeating: "○", count: 5 - clamped)
    }
}
