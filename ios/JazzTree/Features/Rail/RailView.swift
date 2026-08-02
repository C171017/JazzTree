import SwiftUI
import JazzTreeCore

/// The Lineage tab. Three modes behind a segmented control:
///
/// - **Rail** — time flows *down*, one genre per full-width row, influence curves in
///   a left gutter. The primary view, and the whole reason this app can show a DAG
///   in portrait at all.
/// - **Spans** — proportional time: every genre gets a 1890→now bar.
/// - **Map** — the whole graph on a pinch-zoom canvas, for people who want the shape.
struct LineageTab: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                switch model.lineageMode {
                case .rail: RailView()
                case .spans: SpansView()
                case .map: MapView()
                }
            }
            .background(Palette.bg)
            .navigationTitle(l10n.t("view.graph"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("", selection: $model.lineageMode) {
                        ForEach(AppModel.LineageMode.allCases) { mode in
                            Text(l10n.t(mode.labelKey)).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 260)
                }
            }
        }
    }
}

struct RailView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var plan: RailPlan { model.railPlan }

    var body: some View {
        VStack(spacing: 0) {
            AspectFilterBar()
            if model.showScrubber { YearScrubberBar() }
            Divider().background(Palette.rule)

            if plan.isFocused {
                FocusBanner(plan: plan)
            }

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                        if !plan.isFocused { RailIntro() }

                        ForEach(plan.rows) { row in
                            // Decade headers only make sense in the full rail; under
                            // focus the rows are a neighbourhood, not a timeline.
                            if row.isDecadeStart && !plan.isFocused {
                                DecadeHeader(label: l10n.decadeLabel(row.decade))
                            }
                            RailRowView(row: row, plan: plan)
                                .id(row.id)
                        }

                        if plan.rows.isEmpty { EmptyRailNote() }
                        Spacer(minLength: 32)
                    }
                }
                .onChange(of: model.focus) { _, newValue in
                    guard let newValue else { return }
                    withAnimation(.snappy) { proxy.scrollTo(newValue, anchor: .center) }
                }
            }
        }
    }
}

// MARK: - Header pieces

private struct RailIntro: View {
    @Environment(\.l10n) private var l10n
    @EnvironmentObject private var model: AppModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(l10n.t("ios.rail.title"))
                .font(.display(.title2))
                .foregroundStyle(Palette.ink)
            Text(l10n.t("ios.rail.lede"))
                .font(.subheadline)
                .foregroundStyle(Palette.ink3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 18)
    }
}

private struct DecadeHeader: View {
    let label: String

    var body: some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.mono)
                .foregroundStyle(Palette.ink3)
            Rectangle().fill(Palette.ruleSoft).frame(height: 1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 7)
        .background(Palette.bg.opacity(0.96))
        .accessibilityAddTraits(.isHeader)
    }
}

/// Shown while the rail is collapsed onto one genre. Doubles as the way out.
private struct FocusBanner: View {
    let plan: RailPlan
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var genre: Genre? { plan.focus.flatMap { model.library.genre($0) } }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "scope")
                .font(.footnote)
                .foregroundStyle(Palette.accent)
            VStack(alignment: .leading, spacing: 1) {
                Text(genre.map { l10n.genreName($0) } ?? "")
                    .font(.display(.subheadline))
                    .foregroundStyle(Palette.ink)
                Text(l10n.t("ios.rail.focusCount", [
                    "parents": plan.connectors.filter(\.isIncoming).count,
                    "children": plan.connectors.filter { !$0.isIncoming }.count,
                ]))
                .font(.overline)
                .foregroundStyle(Palette.ink4)
            }
            Spacer()
            Button {
                model.setFocus(nil)
            } label: {
                Label(l10n.t("ios.rail.clearFocus"), systemImage: "xmark")
                    .labelStyle(.iconOnly)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Palette.ink3)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(Palette.bgRaise))
            }
            .accessibilityLabel(l10n.t("ios.rail.clearFocus"))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Palette.bgRaise)
        .overlay(alignment: .bottom) { Rectangle().fill(Palette.rule).frame(height: 1) }
    }
}

private struct EmptyRailNote: View {
    @Environment(\.l10n) private var l10n

    var body: some View {
        Text(l10n.t("ios.rail.empty"))
            .font(.display(.body))
            .foregroundStyle(Palette.ink4)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
            .padding(.vertical, 60)
            .frame(maxWidth: .infinity)
    }
}

// MARK: - Aspect filter

/// The web app calls this the single most interesting feature, so it is pinned
/// directly under the nav bar rather than buried in a filter sheet.
struct AspectFilterBar: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    Button {
                        model.clearAspects()
                    } label: {
                        Pill(
                            text: l10n.t("graph.all"),
                            tint: Palette.accent,
                            filled: model.aspects.isEmpty
                        )
                    }
                    .accessibilityLabel(l10n.t("graph.clearFilter"))

                    ForEach(Aspect.allCases, id: \.self) { aspect in
                        Button {
                            model.toggleAspect(aspect)
                            tapFeedback()
                        } label: {
                            Pill(
                                text: l10n.aspectLabel(aspect),
                                tint: Palette.ink2,
                                filled: model.aspects.contains(aspect)
                            )
                        }
                        .accessibilityLabel(l10n.t("graph.aspectOnly", ["aspect": l10n.aspectLabel(aspect)]))
                        .accessibilityAddTraits(model.aspects.contains(aspect) ? [.isSelected] : [])
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }

            HStack(spacing: 10) {
                Text(l10n.t("ios.filter.count", [
                    "shown": model.railPlan.visibleEdgeCount,
                    "total": model.railPlan.totalEdgeCount,
                ]))
                .font(.overline)
                .foregroundStyle(model.aspects.isEmpty ? Palette.ink4 : Palette.accent)

                Spacer()

                Button {
                    withAnimation(.snappy(duration: 0.2)) { model.showScrubber.toggle() }
                } label: {
                    Label(l10n.t("ios.scrubber.show"), systemImage: "clock.arrow.circlepath")
                        .font(.overline)
                        .foregroundStyle(model.showScrubber ? Palette.accent : Palette.ink3)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 6)
        }
        .background(Palette.bgRaise)
    }
}

/// The web app's time scrubber. Dragging it forward makes the rail fill in, which
/// is the same "watch it grow" moment translated to a vertical list.
struct YearScrubberBar: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var year: Double {
        Double(model.scrubYear ?? model.present)
    }

    var body: some View {
        HStack(spacing: 12) {
            Text(model.scrubYear.map(String.init) ?? l10n.t("era.present"))
                .font(.system(.subheadline, design: .monospaced))
                .foregroundStyle(Palette.accent)
                .frame(width: 62, alignment: .leading)
                .accessibilityHidden(true)

            Slider(
                value: Binding(
                    get: { year },
                    set: { newValue in
                        let rounded = Int(newValue.rounded())
                        model.scrubYear = rounded >= model.present ? nil : rounded
                    }
                ),
                in: 1890...Double(model.present),
                step: 1
            )
            .accessibilityLabel(l10n.t("graph.year"))
            .accessibilityValue(model.scrubYear.map(String.init) ?? l10n.t("era.present"))

            Button(l10n.t("graph.reset")) { model.scrubYear = nil }
                .font(.overline)
                .foregroundStyle(Palette.ink3)
                .disabled(model.scrubYear == nil)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .background(Palette.bgRaise)
        .transition(.move(edge: .top).combined(with: .opacity))
    }
}
