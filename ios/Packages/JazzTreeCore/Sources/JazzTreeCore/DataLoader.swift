import Foundation

public enum DataLoaderError: Error, LocalizedError {
    case missingResource(String)
    case decodeFailed(String, underlying: Error)

    public var errorDescription: String? {
        switch self {
        case .missingResource(let name):
            return "Bundled data file \(name) is missing from the app bundle."
        case .decodeFailed(let name, let underlying):
            return "Could not decode \(name): \(underlying)"
        }
    }
}

/// Loads the bundled JSON. There is no network anywhere in this app: the whole
/// dataset ships inside the binary, so it works offline and needs no permissions.
public enum DataLoader {

    /// `Bundle.module` resolves to the package's resource bundle both in the app
    /// and under `swift test`, which is why the JSON lives in the package rather
    /// than in the app target. It is internal to the package, so callers pass
    /// `nil` (the default) and it is resolved here.
    public static func load(from bundle: Bundle? = nil) throws -> Library {
        let bundle = bundle ?? .module
        let genresFile: GenresFile = try decode("genres", as: GenresFile.self, bundle: bundle)
        let albums: [Album] = try decode("albums", as: [Album].self, bundle: bundle)
        let paths: [ListeningPath] = try decode("paths", as: [ListeningPath].self, bundle: bundle)

        return Library(
            meta: genresFile.meta,
            families: genresFile.families,
            eras: genresFile.eras,
            genres: genresFile.genres,
            lineage: genresFile.lineage,
            albums: albums,
            paths: paths
        )
    }

    static func decode<T: Decodable>(_ name: String, as type: T.Type, bundle: Bundle) throws -> T {
        guard let url = bundle.url(forResource: name, withExtension: "json") else {
            throw DataLoaderError.missingResource("\(name).json")
        }
        do {
            let data = try Data(contentsOf: url)
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw DataLoaderError.decodeFailed("\(name).json", underlying: error)
        }
    }
}
