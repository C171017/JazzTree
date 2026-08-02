import SwiftUI
import JazzTreeCore

@main
struct JazzTreeApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(model)
                .environment(\.l10n, model.l10n)
                .preferredColorScheme(model.appearance.colorScheme)
                .tint(Palette.accent)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    var body: some View {
        if let error = model.loadError {
            DataFailureView(message: error)
        } else {
            TabView {
                LineageTab()
                    .tabItem { Label(l10n.t("ios.tab.lineage"), systemImage: "point.topleft.down.to.point.bottomright.curvepath") }
                GenresTab()
                    .tabItem { Label(l10n.t("ios.tab.genres"), systemImage: "square.grid.2x2") }
                PathsTab()
                    .tabItem { Label(l10n.t("ios.tab.paths"), systemImage: "list.number") }
                SettingsTab()
                    .tabItem { Label(l10n.t("ios.tab.more"), systemImage: "ellipsis.circle") }
            }
            // The genre profile is presented once, from the root, so it can be
            // raised from any tab and dismissed with a swipe.
            //
            // Only ONE sheet modifier here on purpose: SwiftUI allows a single
            // presentation per view level, and a second `.sheet` on the same view
            // silently wins over the first. The influence sheet is only ever raised
            // from inside the genre sheet, so it is attached there instead — see
            // GenreDetailView.
            .sheet(item: $model.selectedGenre) { genre in
                NavigationStack {
                    GenreDetailView(genre: genre)
                }
                .presentationDragIndicator(.visible)
            }
        }
    }
}

/// Shown only if the bundled JSON cannot be read, which would mean a corrupt
/// install. Better than a crash, and it tells the user what to do.
struct DataFailureView: View {
    let message: String
    @Environment(\.l10n) private var l10n

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(Palette.oxblood)
            Text(l10n.t("ios.error.title"))
                .font(.display(.title3))
            Text(l10n.t("ios.error.detail", ["message": message]))
                .font(.footnote)
                .foregroundStyle(Palette.ink3)
                .multilineTextAlignment(.center)
            Text(l10n.t("ios.error.hint"))
                .font(.footnote)
                .foregroundStyle(Palette.ink4)
                .multilineTextAlignment(.center)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.bg)
    }
}

// Genre, Album and LineageEdge already conform to Identifiable in JazzTreeCore,
// which is what `.sheet(item:)` needs.
