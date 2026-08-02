import SwiftUI
import Combine
import JazzTreeCore

/// All app state in one place, mirroring the web app's `js/store.js`.
///
/// `ObservableObject` rather than the newer `@Observable` macro: the object is tiny,
/// the difference is immaterial at this scale, and this spelling works on every iOS
/// version the app supports.
///
/// Not `@MainActor`: the app contains no concurrency whatsoever — no `async`, no
/// `Task`, no background queues — so everything already runs on the main thread by
/// construction, and the attribute would only create an isolation question at
/// `@StateObject var model = AppModel()` in the `App` struct.
final class AppModel: ObservableObject {

    // MARK: Data

    let library: Library
    /// Non-nil when the bundled data failed to load, which should be impossible in
    /// a shipped build — the verification harness runs over the same files.
    let loadError: String?

    // MARK: Navigation

    enum LineageMode: String, CaseIterable, Identifiable {
        case rail, spans, map
        var id: String { rawValue }
        var labelKey: String {
            switch self {
            case .rail: return "ios.mode.rail"
            case .spans: return "ios.mode.spans"
            case .map: return "ios.mode.map"
            }
        }
        var symbol: String {
            switch self {
            case .rail: return "arrow.down.circle"
            case .spans: return "chart.bar.doc.horizontal"
            case .map: return "map"
            }
        }
    }

    @Published var lineageMode: LineageMode = .rail
    /// The genre the rail is collapsed onto, if any. This is the phone's answer to
    /// the web app's hover-dimming: persistent, so the edge explanations are
    /// readable without holding a finger down.
    @Published var focus: String?
    @Published var selectedGenre: Genre?
    @Published var selectedEdge: LineageEdge?

    // MARK: Filters

    @Published var aspects: Set<Aspect> = []
    /// `nil` means "show everything"; a value ghosts out genres born later.
    @Published var scrubYear: Int?
    @Published var showScrubber = false

    @Published var search = ""
    @Published var familyFilter: String = "all"

    enum GenreSort: String, CaseIterable, Identifiable {
        case era, name, family, difficulty
        var id: String { rawValue }
        var labelKey: String { "grid.sort.\(rawValue)" }
    }
    @Published var genreSort: GenreSort = .era

    // MARK: Preferences (persisted)
    //
    // Deliberately *not* @AppStorage: that is a DynamicProperty designed for use in
    // a View, and inside an ObservableObject it reads and writes UserDefaults
    // without ever publishing — so a `$model.gentle` binding would silently fail to
    // refresh anything else. These are plain @Published properties that persist in
    // their own didSet.

    enum Appearance: String, CaseIterable, Identifiable {
        case system, dark, light
        var id: String { rawValue }
        var colorScheme: ColorScheme? {
            switch self {
            case .system: return nil
            case .dark: return .dark
            case .light: return .light
            }
        }
        var labelKey: String { "ios.appearance.\(rawValue)" }
    }

    private enum Key {
        static let service = "jazztree.service"
        static let gentle = "jazztree.gentle"
        static let appearance = "jazztree.appearance"
        static let locale = "jazztree.locale"
    }

    private let defaults: UserDefaults

    @Published var service: StreamingService = .spotify {
        didSet { defaults.set(service.rawValue, forKey: Key.service) }
    }
    @Published var gentle = false {
        didSet { defaults.set(gentle, forKey: Key.gentle) }
    }
    @Published var appearance: Appearance = .system {
        didSet { defaults.set(appearance.rawValue, forKey: Key.appearance) }
    }

    /// Published so every view re-renders when the language changes.
    @Published private(set) var l10n = Localization.shared

    // MARK: Path progress

    private let progressStore: PathProgressStore
    @Published private(set) var progress: PathProgress

    // MARK: Init

    init(
        library: Library? = nil,
        loadError: String? = nil,
        defaults: UserDefaults = .standard,
        store: KeyValueStore? = nil
    ) {
        self.defaults = defaults
        if let library {
            self.library = library
            self.loadError = loadError
        } else {
            do {
                self.library = try DataLoader.load()
                self.loadError = nil
            } catch {
                // An empty library keeps the app running and lets the UI say what
                // went wrong, rather than crashing on a corrupt install.
                self.library = Library(
                    meta: DatasetMeta(present: 2027, generated: nil),
                    families: [], eras: [], genres: [], lineage: [], albums: [], paths: []
                )
                self.loadError = error.localizedDescription
            }
        }
        self.progressStore = PathProgressStore(store: store ?? defaults)
        self.progress = progressStore.progress

        // Restore preferences. Absent keys keep the declared defaults, and setting
        // them here before any view exists means no spurious writes.
        if let raw = defaults.string(forKey: Key.service), let value = StreamingService(rawValue: raw) {
            self.service = value
        }
        if defaults.object(forKey: Key.gentle) != nil {
            self.gentle = defaults.bool(forKey: Key.gentle)
        }
        if let raw = defaults.string(forKey: Key.appearance), let value = Appearance(rawValue: raw) {
            self.appearance = value
        }
        if let raw = defaults.string(forKey: Key.locale), !raw.isEmpty {
            Localization.shared.setActive(raw)
        }

        #if DEBUG
        // The same invariants the command-line harness checks, so a bad data edit
        // is caught on the first debug launch rather than in review.
        if loadError == nil, !self.library.genres.isEmpty {
            let report = Verification.run(library: self.library)
            assert(report.passed, "Dataset verification failed: \(report.summary)")
        }
        #endif
    }

    // MARK: Derived

    var present: Int { library.present }

    var railPlan: RailPlan {
        RailPlan.build(library: library, aspects: aspects, upToYear: scrubYear, focus: focus)
    }

    /// Built lazily and cached: it takes a few milliseconds and is only needed if
    /// the Map tab is opened.
    private var cachedMap: DAGLayout?
    func mapLayout() -> DAGLayout {
        if let cachedMap { return cachedMap }
        let layout = DAGLayout(
            genres: library.genres,
            lineage: library.lineage,
            options: .init(present: library.present, rowHeight: 30, capsuleHeight: 20, laneGap: 34)
        )
        cachedMap = layout
        return layout
    }

    var filteredGenres: [Genre] {
        let matches = library.search(search, family: familyFilter)
        let familyRank = { (genre: Genre) in
            DAGLayout.narrativeFamilyOrder.firstIndex(of: genre.family) ?? 99
        }
        switch genreSort {
        case .era:
            return matches.sorted { $0.era.start != $1.era.start ? $0.era.start < $1.era.start : $0.name < $1.name }
        case .name:
            return matches.sorted { l10n.genreName($0).localizedCompare(l10n.genreName($1)) == .orderedAscending }
        case .family:
            return matches.sorted {
                familyRank($0) != familyRank($1) ? familyRank($0) < familyRank($1) : $0.era.start < $1.era.start
            }
        case .difficulty:
            return matches.sorted {
                let a = library.easiestDifficulty(for: $0.id), b = library.easiestDifficulty(for: $1.id)
                return a != b ? a < b : $0.era.start < $1.era.start
            }
        }
    }

    /// Hides difficulty 4–5 records when the gentle path is on.
    func visible(_ albums: [Album]) -> [Album] {
        gentle ? albums.filter { $0.difficulty <= 3 } : albums
    }

    // MARK: Actions

    func toggleAspect(_ aspect: Aspect) {
        if aspects.contains(aspect) { aspects.remove(aspect) } else { aspects.insert(aspect) }
    }

    func clearAspects() { aspects.removeAll() }

    func setFocus(_ id: String?) {
        guard focus != id else { return }
        withAnimation(.snappy(duration: 0.28)) { focus = id }
    }

    func setLocale(_ id: String) {
        Localization.shared.setActive(id)
        defaults.set(id, forKey: Key.locale)
        // Rebroadcast: the tables changed under every view.
        l10n = Localization.shared
        objectWillChange.send()
    }

    func isHeard(path: ListeningPath, album: Album) -> Bool {
        progress.isHeard(path: path.id, album: album.id)
    }

    func toggleHeard(path: ListeningPath, album: Album) {
        progressStore.update { $0.toggle(path: path.id, album: album.id) }
        progress = progressStore.progress
    }

    func clearProgress(for path: ListeningPath) {
        progressStore.update { $0.clear(path: path) }
        progress = progressStore.progress
    }
}
