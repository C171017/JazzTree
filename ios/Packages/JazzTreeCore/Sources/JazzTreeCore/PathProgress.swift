import Foundation

/// Which path steps the listener has ticked off.
///
/// Keys are `"pathID:albumID"`, the same scheme the web app stores in
/// `localStorage`, so the two could be synced later without a migration.
/// Backed by a protocol so tests do not need `UserDefaults`.
public protocol KeyValueStore: AnyObject {
    func data(forKey key: String) -> Data?
    func set(_ data: Data?, forKey key: String)
}

extension UserDefaults: KeyValueStore {
    public func data(forKey key: String) -> Data? { object(forKey: key) as? Data }
    public func set(_ data: Data?, forKey key: String) { set(data as Any?, forKey: key) }
}

/// In-memory store, used by tests and by SwiftUI previews.
public final class MemoryStore: KeyValueStore {
    private var storage: [String: Data] = [:]
    public init() {}
    public func data(forKey key: String) -> Data? { storage[key] }
    public func set(_ data: Data?, forKey key: String) {
        if let data { storage[key] = data } else { storage.removeValue(forKey: key) }
    }
}

public struct PathProgress: Sendable, Equatable {
    private var heard: Set<String>

    public init(heard: Set<String> = []) { self.heard = heard }

    static func key(path: String, album: String) -> String { "\(path):\(album)" }

    public func isHeard(path: String, album: String) -> Bool {
        heard.contains(Self.key(path: path, album: album))
    }

    public mutating func set(_ value: Bool, path: String, album: String) {
        let key = Self.key(path: path, album: album)
        if value { heard.insert(key) } else { heard.remove(key) }
    }

    public mutating func toggle(path: String, album: String) {
        set(!isHeard(path: path, album: album), path: path, album: album)
    }

    public mutating func clear(path: ListeningPath) {
        for step in path.steps { heard.remove(Self.key(path: path.id, album: step.albumId)) }
    }

    public func count(in path: ListeningPath) -> Int {
        path.steps.filter { isHeard(path: path.id, album: $0.albumId) }.count
    }

    public func fraction(in path: ListeningPath) -> Double {
        guard !path.steps.isEmpty else { return 0 }
        return Double(count(in: path)) / Double(path.steps.count)
    }

    /// Index of the first unheard step, for the "resume" affordance. `nil` when the
    /// path is complete.
    public func nextStepIndex(in path: ListeningPath) -> Int? {
        path.steps.firstIndex { !isHeard(path: path.id, album: $0.albumId) }
    }

    public var allKeys: Set<String> { heard }
}

/// Loads and saves `PathProgress`. Deliberately dumb: one JSON blob, written on
/// every change. The data is a handful of short strings.
public final class PathProgressStore {
    private static let storageKey = "jazztree.pathProgress.v1"
    private let store: KeyValueStore

    public private(set) var progress: PathProgress

    public init(store: KeyValueStore) {
        self.store = store
        if let data = store.data(forKey: Self.storageKey),
           let keys = try? JSONDecoder().decode([String].self, from: data) {
            self.progress = PathProgress(heard: Set(keys))
        } else {
            self.progress = PathProgress()
        }
    }

    public func update(_ transform: (inout PathProgress) -> Void) {
        var next = progress
        transform(&next)
        guard next != progress else { return }
        progress = next
        persist()
    }

    private func persist() {
        // Sorted so the stored blob is stable and diffable.
        let data = try? JSONEncoder().encode(progress.allKeys.sorted())
        store.set(data, forKey: Self.storageKey)
    }
}
