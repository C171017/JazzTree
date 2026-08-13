import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// Resolves JazzTree metadata to a real Apple Music album page.
///
/// Apple Music's web search URL is not a reliable app deep-link on iPhone. Its
/// album URLs are, so this resolver uses Apple's public, unauthenticated iTunes
/// Search API to find a confident album match before handing the URL to iOS.
public enum AppleMusicCatalog {
    private struct CuratedCatalog: Decodable {
        let storefront: String
        let albums: [String: CuratedAlbum]
    }

    private struct CuratedAlbum: Decodable {
        let collectionId: String
        let artist: String
        let title: String
        let url: URL
        let method: String
    }

    private struct SearchResponse: Decodable {
        let results: [Candidate]
    }

    private struct Candidate: Decodable {
        let artistName: String
        let collectionName: String
        let collectionViewUrl: URL
        let releaseDate: String?
        let trackCount: Int?
    }

    /// A reviewed, storefront-specific catalog ships with the app. It avoids a
    /// network round trip on every known album and prevents Apple's fuzzy search
    /// from changing behaviour between taps.
    private static let curatedCatalog: CuratedCatalog? = {
        try? DataLoader.decode("apple-music", as: CuratedCatalog.self, bundle: .module)
    }()

    public static var curatedCount: Int { curatedCatalog?.albums.count ?? 0 }

    public static func curatedURL(for album: Album) -> URL? {
        guard let url = curatedCatalog?.albums[album.id]?.url,
              isSafeAppleMusicURL(url),
              url.path.contains("/album/") else { return nil }
        return url
    }

    /// The API request used for a single tap. Kept separate so its shape can be
    /// verified without making a network request.
    public static func searchURL(
        for album: Album,
        countryCode: String = Locale.current.region?.identifier ?? "US"
    ) -> URL? {
        searchURL(query: StreamingLinks.query(for: album), countryCode: countryCode)
    }

    private static func searchURL(query: String, countryCode: String) -> URL? {
        let country = normalizedCountryCode(countryCode)
        var components = URLComponents()
        components.scheme = "https"
        components.host = "itunes.apple.com"
        components.path = "/search"
        components.queryItems = [
            URLQueryItem(name: "term", value: query),
            URLQueryItem(name: "country", value: country),
            URLQueryItem(name: "media", value: "music"),
            URLQueryItem(name: "entity", value: "album"),
            URLQueryItem(name: "limit", value: "15"),
        ]
        return components.url
    }

    /// Returns a direct `music.apple.com` album URL when the catalog contains a
    /// confident match. A nil result deliberately sends the caller back to the
    /// existing search URL rather than opening a plausible-but-wrong record.
    public static func directURL(
        for album: Album,
        countryCode: String = Locale.current.region?.identifier ?? "US",
        session: URLSession = .shared
    ) async throws -> URL? {
        if let curated = curatedURL(for: album) { return curated }
        guard let requestURL = searchURL(for: album, countryCode: countryCode) else { return nil }
        let firstData = try await responseData(from: requestURL, session: session)
        if let direct = try directURL(in: firstData, for: album) {
            return direct
        }

        // Catalog credits often differ from the historical metadata JazzTree
        // presents. A title-only second pass catches cases such as "Gunther
        // Schuller / John Lewis — Jazz Abstractions", which Apple files under
        // "John Lewis Presents Jazz Abstractions" and cannot find from the full
        // artist string.
        guard let titleURL = searchURL(query: album.title, countryCode: countryCode) else { return nil }
        let titleData = try await responseData(from: titleURL, session: session)
        return try directURL(in: titleData, for: album)
    }

    /// Internal for deterministic verification with a local JSON fixture.
    static func directURL(in data: Data, for album: Album) throws -> URL? {
        let response = try JSONDecoder().decode(SearchResponse.self, from: data)
        let ranked = response.results.compactMap { candidate -> (Candidate, Int)? in
            guard isSafeAppleMusicURL(candidate.collectionViewUrl) else { return nil }
            guard let score = matchScore(candidate, album: album) else { return nil }
            return (candidate, score)
        }
        .sorted { lhs, rhs in
            if lhs.1 != rhs.1 { return lhs.1 > rhs.1 }
            return (lhs.0.trackCount ?? 0) > (rhs.0.trackCount ?? 0)
        }

        guard let best = ranked.first, best.1 >= 125 else { return nil }
        return best.0.collectionViewUrl
    }

    private static func matchScore(_ candidate: Candidate, album: Album) -> Int? {
        let wantedTitle = normalized(album.title)
        let foundTitle = normalized(candidate.collectionName)
        let wantedArtist = normalized(album.artist)
        let foundArtist = normalized(candidate.artistName)

        let titleScore: Int
        if foundTitle == wantedTitle {
            titleScore = 120
        } else if foundTitle.hasPrefix(wantedTitle + " "), containsEditionMarker(foundTitle) {
            // A remaster or expanded edition is a useful fallback when the exact
            // original issue is unavailable in this storefront.
            titleScore = containsWord(foundTitle, "single") ? 70 : 90
        } else if foundTitle.hasSuffix(" " + wantedTitle), containsWord(foundTitle, "presents") {
            // Apple sometimes makes the credited presenter part of the album
            // title even when discographies keep it solely in the artist field.
            titleScore = 90
        } else {
            return nil
        }

        let artistScore: Int
        if foundArtist == wantedArtist {
            artistScore = 70
        } else if foundArtist.contains(wantedArtist) || wantedArtist.contains(foundArtist) {
            artistScore = 50
        } else {
            let wantedWords = Set(wantedArtist.split(separator: " ").map(String.init))
            let foundWords = Set(foundArtist.split(separator: " ").map(String.init))
            let union = wantedWords.union(foundWords)
            let overlap = wantedWords.intersection(foundWords)
            artistScore = union.isEmpty ? 0 : Int((Double(overlap.count) / Double(union.count)) * 45)
        }
        guard artistScore >= 15 else { return nil }

        var score = titleScore + artistScore
        if let releaseYear = candidate.releaseDate.flatMap({ Int($0.prefix(4)) }) {
            let wantedYear = album.released ?? album.recorded
            switch abs(releaseYear - wantedYear) {
            case 0: score += 20
            case 1...2: score += 12
            case 3...5: score += 6
            default: break // Common for catalogued reissues of historic records.
            }
        }
        if let trackCount = candidate.trackCount, trackCount <= 2 { score -= 70 }
        if containsWord(foundTitle, "live"), !containsWord(wantedTitle, "live") { score -= 35 }
        if containsWord(foundTitle, "tribute"), !containsWord(wantedTitle, "tribute") { score -= 40 }
        return score
    }

    private static func normalized(_ value: String) -> String {
        let folded = value.folding(
            options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive],
            locale: Locale(identifier: "en_US_POSIX")
        )
        let words = folded.unicodeScalars.split { scalar in
            !CharacterSet.alphanumerics.contains(scalar)
        }
        return words.map(String.init).joined(separator: " ")
    }

    private static func containsEditionMarker(_ value: String) -> Bool {
        ["remaster", "remastered", "edition", "deluxe", "expanded", "anniversary", "mono", "stereo", "single", "feat", "featuring", "with"]
            .contains { containsWord(value, $0) }
    }

    private static func containsWord(_ value: String, _ word: String) -> Bool {
        value.split(separator: " ").contains(Substring(word))
    }

    private static func normalizedCountryCode(_ value: String) -> String {
        let upper = value.uppercased()
        guard upper.count == 2, upper.unicodeScalars.allSatisfy(CharacterSet.letters.contains) else { return "US" }
        return upper
    }

    private static func isSafeAppleMusicURL(_ url: URL) -> Bool {
        url.scheme == "https" && url.host?.lowercased() == "music.apple.com"
    }

    private static func responseData(from url: URL, session: URLSession) async throws -> Data {
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }
}
