import Foundation

/// Safe search fallbacks for services without a verified direct album URL.
///
/// Spotify, Apple Music and NetEase album IDs are opaque strings that cannot be
/// derived from metadata; a guessed one resolves confidently to the wrong record.
/// Apple Music's search URL does not reliably hand off to its iPhone app, and
/// NetEase needs an exact album route. Their curated catalogs handle both cases.
public enum StreamingService: String, CaseIterable, Identifiable, Sendable, Codable {
    case spotify
    case appleMusic
    case netease

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .spotify: return "Spotify"
        case .appleMusic: return "Apple Music"
        case .netease: return "NetEase Cloud Music"
        }
    }

    /// Short mark for the compact buttons on an album card.
    public var badge: String {
        switch self {
        case .spotify: return "S"
        case .appleMusic: return "A"
        case .netease: return "网"
        }
    }

    /// SF Symbol used when the button has room for an icon.
    public var symbolName: String {
        switch self {
        case .spotify: return "magnifyingglass"
        case .appleMusic: return "music.note"
        case .netease: return "music.note.list"
        }
    }
}

public enum StreamingLinks {

    /// Query string used across all three services: "artist title".
    public static func query(for album: Album) -> String {
        "\(album.artist) \(album.title)"
    }

    public static func url(_ service: StreamingService, for album: Album) -> URL? {
        url(service, query: query(for: album))
    }

    public static func url(_ service: StreamingService, query: String) -> URL? {
        // `urlQueryAllowed` leaves some characters that break these paths, so the
        // set is narrowed: everything outside unreserved characters is escaped,
        // which matches encodeURIComponent closely enough for search terms.
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: allowed) else { return nil }
        switch service {
        case .spotify:
            return URL(string: "https://open.spotify.com/search/\(encoded)")
        case .appleMusic:
            return URL(string: "https://music.apple.com/us/search?term=\(encoded)")
        case .netease:
            return URL(string: "https://music.163.com/#/search/m/?s=\(encoded)&type=10")
        }
    }

    /// The preferred service first, matching the web app's behaviour.
    public static func ordered(preferring preferred: StreamingService) -> [StreamingService] {
        [preferred] + StreamingService.allCases.filter { $0 != preferred }
    }
}
