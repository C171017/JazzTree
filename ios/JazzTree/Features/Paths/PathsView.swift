import SwiftUI
import JazzTreeCore

/// The three curated routes, as vertical steppers with a bridge sentence before each
/// record. Progress persists, and the phone adds one thing the web version does not:
/// a Resume button that jumps to the first record you have not heard.
struct PathsTab: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    @State private var selection: String?

    private var path: ListeningPath? {
        model.library.path(selection ?? "") ?? model.library.paths.first
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        picker

                        if let path {
                            PathHeader(path: path) {
                                if let index = model.progress.nextStepIndex(in: path),
                                   index < path.steps.count {
                                    withAnimation(.snappy) {
                                        proxy.scrollTo(path.steps[index].albumId, anchor: .top)
                                    }
                                }
                            }

                            ForEach(Array(path.steps.enumerated()), id: \.element.albumId) { index, step in
                                if let album = model.library.album(step.albumId) {
                                    StepView(path: path, step: step, album: album, number: index + 1)
                                        .id(step.albumId)
                                }
                            }
                        }
                        Spacer(minLength: 30)
                    }
                    .padding(.horizontal, 16)
                }
            }
            .background(Palette.bg)
            .navigationTitle(l10n.t("view.paths"))
        }
    }

    private var picker: some View {
        VStack(spacing: 8) {
            ForEach(model.library.paths) { item in
                Button {
                    selection = item.id
                } label: {
                    HStack(spacing: 10) {
                        ProgressRing(fraction: model.progress.fraction(in: item))
                            .frame(width: 26, height: 26)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(l10n.pathName(item))
                                .font(.display(.headline))
                                .foregroundStyle(Palette.ink)
                            Text(l10n.pathSubtitle(item))
                                .font(.caption)
                                .foregroundStyle(Palette.ink4)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer()
                        if path?.id == item.id {
                            Image(systemName: "checkmark")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Palette.accent)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Palette.bgRaise))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(path?.id == item.id ? Palette.accentSoft : Palette.ruleSoft, lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 6)
    }
}

private struct PathHeader: View {
    let path: ListeningPath
    let onResume: () -> Void

    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l10n.pathBlurb(path))
                .font(.subheadline)
                .foregroundStyle(Palette.ink2)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 12) {
                Text(l10n.t("paths.heard", [
                    "done": model.progress.count(in: path), "total": path.steps.count,
                ]))
                .font(.overline)
                .foregroundStyle(Palette.ink3)

                Spacer()

                if model.progress.nextStepIndex(in: path) != nil,
                   model.progress.count(in: path) > 0 {
                    Button(l10n.t("ios.paths.resume"), action: onResume)
                        .font(.overline)
                        .buttonStyle(.bordered)
                }
                if model.progress.count(in: path) > 0 {
                    Button(l10n.t("paths.clear")) { model.clearProgress(for: path) }
                        .font(.overline)
                        .foregroundStyle(Palette.ink4)
                }
            }
        }
        .padding(.top, 6)
    }
}

private struct StepView: View {
    let path: ListeningPath
    let step: ListeningPath.Step
    let album: Album
    let number: Int

    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var heard: Bool { model.isHeard(path: path, album: album) }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    Circle()
                        .fill(heard ? Palette.accent : Palette.bgRaise)
                        .overlay { Circle().stroke(heard ? Palette.accent : Palette.rule, lineWidth: 1) }
                    if heard {
                        Image(systemName: "checkmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Palette.bg)
                    } else {
                        Text(String(number))
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(Palette.ink3)
                    }
                }
                .frame(width: 24, height: 24)

                Text(l10n.pathStepBridge(path, step))
                    .font(.system(.subheadline, design: .serif))
                    .italic()
                    .foregroundStyle(Palette.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            AlbumCardView(album: album)

            Toggle(isOn: Binding(
                get: { heard },
                set: { _ in
                    tapFeedback()
                    model.toggleHeard(path: path, album: album)
                }
            )) {
                Text(l10n.t("paths.heardIt") + (album.startTrack.map {
                    l10n.t("paths.startWith", ["track": $0])
                } ?? ""))
                .font(.caption)
                .foregroundStyle(Palette.ink3)
            }
            .toggleStyle(.switch)
            .tint(Palette.accent)
        }
        .padding(.bottom, 6)
    }
}

struct ProgressRing: View {
    let fraction: Double

    var body: some View {
        ZStack {
            Circle().stroke(Palette.rule, lineWidth: 3)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, fraction)))
                .stroke(Palette.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .accessibilityHidden(true)
    }
}
