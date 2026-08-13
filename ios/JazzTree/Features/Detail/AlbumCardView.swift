import SwiftUI
import JazzTreeCore

/// One record. Everything the web card carries — artist, title, the facts, why this
/// one, what to listen for, difficulty, confidence, and the three streaming
/// destinations — laid out for a 390pt column.
struct AlbumCardView: View {
    let album: Album
    var highlight: Bool = false
    var showGenres: Bool = false

    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n
    @Environment(\.openURL) private var openURL
    @State private var resolvingAppleMusic = false

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            VStack(alignment: .leading, spacing: 1) {
                Text(album.artist)
                    .font(.overline)
                    .foregroundStyle(Palette.ink3)
                    .fixedSize(horizontal: false, vertical: true)
                Text(album.title)
                    .font(.display(.headline))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }

            facts

            if showGenres {
                Text(l10n.t("album.filedUnder", ["genres": genreNames]))
                    .font(.caption2)
                    .foregroundStyle(Palette.ink4)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(l10n.albumWhyThisOne(album))
                .font(.subheadline)
                .foregroundStyle(Palette.ink2)
                .fixedSize(horizontal: false, vertical: true)

            Callout(title: l10n.t("album.listenFor"), text: l10n.albumListenFor(album))

            if let note = l10n.albumNote(album) {
                Text(l10n.t("album.note", ["note": note]))
                    .font(.caption2)
                    .italic()
                    .foregroundStyle(Palette.ink4)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Divider().background(Palette.ruleSoft)

            HStack(alignment: .center, spacing: 8) {
                DifficultyLabel(difficulty: album.difficulty)
                if album.confidence != .high {
                    Pill(
                        text: l10n.t("album.confidence", ["confidence": l10n.t("confidence.\(album.confidence.rawValue)")]),
                        tint: album.confidence == .low ? Palette.oxblood : Palette.ink4
                    )
                }
                Spacer()
                serviceButtons
            }
        }
        .padding(12)
        .background {
            RoundedRectangle(cornerRadius: 10)
                .fill(highlight ? Palette.accent.opacity(0.07) : Palette.bgRaise)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 10)
                .stroke(highlight ? Palette.accentSoft : Palette.ruleSoft, lineWidth: 1)
        }
    }

    private var facts: some View {
        // Wraps naturally at narrow widths and with large Dynamic Type sizes.
        Text(factParts.joined(separator: "  ·  "))
            .font(.caption2)
            .foregroundStyle(Palette.ink4)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var factParts: [String] {
        var parts: [String] = []
        if let released = album.released, released != album.recorded {
            parts.append(l10n.t("album.recorded", ["recorded": album.recorded, "released": released]))
        } else {
            parts.append(l10n.t("album.recordedReleased", ["year": album.recorded]))
        }
        parts.append(album.labelAndCatalog)
        if let track = album.startTrack {
            parts.append(l10n.t("album.startWith", ["track": track]))
        }
        return parts
    }

    private var genreNames: String {
        album.genreIds
            .compactMap { model.library.genre($0) }
            .map { l10n.genreName($0) }
            .joined(separator: ", ")
    }

    /// Apple Music and NetEase resolve opaque catalog IDs to real album pages.
    private var serviceButtons: some View {
        HStack(spacing: 5) {
            ForEach(StreamingLinks.ordered(preferring: model.service)) { service in
                Button {
                    Task { await open(service) }
                } label: {
                    Group {
                        if service == .appleMusic, resolvingAppleMusic {
                            ProgressView().controlSize(.mini)
                        } else {
                            Text(service.badge)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(service == model.service ? Palette.ink : Palette.ink3)
                        }
                    }
                    .frame(width: 30, height: 28)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Palette.bg))
                    .overlay {
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(service == model.service ? Palette.ink4 : Palette.rule, lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
                .disabled(service == .appleMusic && resolvingAppleMusic)
                .accessibilityLabel("\(l10n.serviceName(service)): \(album.artist), \(album.title)")
            }
        }
    }

    @MainActor
    private func open(_ service: StreamingService) async {
        guard let fallback = StreamingLinks.url(service, for: album) else { return }

        if service == .appleMusic {
            guard !resolvingAppleMusic else { return }
            resolvingAppleMusic = true
            defer { resolvingAppleMusic = false }
            if let direct = try? await AppleMusicCatalog.directURL(for: album) {
                openURL(direct)
                return
            }
            openURL(fallback)
            return
        }

        if service == .netease,
           let direct = NetEaseCatalog.appURL(for: album),
           let webFallback = NetEaseCatalog.webURL(for: album) {
            openURL(direct) { accepted in
                if !accepted { openURL(webFallback) }
            }
            return
        }

        openURL(fallback)
    }
}
