import SwiftUI
import JazzTreeCore

/// One genre in the rail: a gutter slice on the left, the genre card on the right.
///
/// The whole row is one tap target that opens the profile; the focus control is a
/// separate button so the two never fight. Long-press also focuses, for people who
/// find that faster.
struct RailRowView: View {
    let row: RailPlan.Row
    let plan: RailPlan

    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var isFocusTarget: Bool { plan.focus == row.genre.id }
    private var familyColor: Color { Palette.family(row.genre.family) }

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            RailGutterView(
                segments: plan.gutter(row: row.index),
                laneCount: plan.laneCount,
                isFocusTarget: isFocusTarget,
                familyColor: familyColor
            )

            card
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 7)
        .opacity(row.matchesFilter ? 1 : 0.38)
        .background(isFocusTarget ? familyColor.opacity(0.08) : .clear)
        .contentShape(Rectangle())
        .onTapGesture { model.selectedGenre = row.genre }
        .onLongPressGesture(minimumDuration: 0.3) {
            tapFeedback(.medium)
            model.setFocus(isFocusTarget ? nil : row.genre.id)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityText)
        .accessibilityHint(l10n.t("ios.rail.a11yHint"))
        .accessibilityActions {
            Button(l10n.t("ios.rail.focus")) { model.setFocus(row.genre.id) }
            if plan.isFocused {
                Button(l10n.t("ios.rail.clearFocus")) { model.setFocus(nil) }
            }
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(l10n.genreName(row.genre))
                    .font(.display(.headline))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 4)

                Text(l10n.eraSpan(row.genre, present: model.present))
                    .font(.mono)
                    .foregroundStyle(Palette.ink4)
                    .layoutPriority(-1)
            }

            Text(l10n.genreOneLine(row.genre))
                .font(.subheadline)
                .foregroundStyle(Palette.ink2)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: 8) {
                Pill(
                    text: model.library.family(row.genre.family).map { l10n.familyShort($0) } ?? row.genre.family,
                    tint: familyColor
                )

                // Parent/child counts stand in for the edges the rail does not draw
                // when unfocused. They are also the affordance that says "there is
                // more here" — tapping focus reveals the curves.
                if row.parentCount > 0 {
                    Label("\(row.parentCount)", systemImage: "arrow.down.to.line")
                        .font(.overline)
                        .foregroundStyle(Palette.ink4)
                        .accessibilityLabel(l10n.t("ios.rail.parents", ["count": row.parentCount]))
                }
                if row.childCount > 0 {
                    Label("\(row.childCount)", systemImage: "arrow.up.to.line")
                        .font(.overline)
                        .foregroundStyle(Palette.ink4)
                        .accessibilityLabel(l10n.t("ios.rail.children", ["count": row.childCount]))
                }

                Spacer()

                Button {
                    tapFeedback()
                    model.setFocus(isFocusTarget ? nil : row.genre.id)
                } label: {
                    Image(systemName: isFocusTarget ? "scope" : "arrow.triangle.branch")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(isFocusTarget ? Palette.accent : Palette.ink3)
                        .frame(width: 34, height: 30)
                        .background(RoundedRectangle(cornerRadius: 6).fill(Palette.bgRaise))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isFocusTarget ? l10n.t("ios.rail.clearFocus") : l10n.t("ios.rail.focus"))
            }
        }
        .padding(.leading, 10)
        .overlay(alignment: .leading) {
            // The family colour bar doubles as the row's left edge.
            RoundedRectangle(cornerRadius: 1.5)
                .fill(familyColor)
                .frame(width: 3)
                .opacity(row.isBorn ? 1 : 0.3)
        }
    }

    private var accessibilityText: String {
        var parts = [
            l10n.genreName(row.genre),
            l10n.eraSpan(row.genre, present: model.present),
            l10n.genreOneLine(row.genre),
        ]
        if row.parentCount > 0 { parts.append(l10n.t("ios.rail.parents", ["count": row.parentCount])) }
        if row.childCount > 0 { parts.append(l10n.t("ios.rail.children", ["count": row.childCount])) }
        return parts.joined(separator: ", ")
    }
}

/// The gutter slice for one row.
///
/// Drawn per row rather than as one overlay across the scroll view, which is what
/// lets it work with any row height — no measurement pass, no fragile coordinate
/// space maths, and it composes inside a `LazyVStack`.
struct RailGutterView: View {
    let segments: [RailPlan.LaneSegment]
    let laneCount: Int
    let isFocusTarget: Bool
    let familyColor: Color

    private let laneWidth: CGFloat = 13
    private let spineWidth: CGFloat = 16

    private var width: CGFloat {
        spineWidth + CGFloat(max(0, laneCount)) * laneWidth
    }

    var body: some View {
        Canvas { context, size in
            let midY = size.height / 2
            let spineX = size.width - spineWidth / 2

            // The spine: a short vertical tick marking where this row sits.
            if laneCount > 0 {
                var spine = Path()
                spine.move(to: CGPoint(x: spineX, y: 0))
                spine.addLine(to: CGPoint(x: spineX, y: size.height))
                context.stroke(spine, with: .color(Palette.ruleSoft), lineWidth: 1)
            }

            for (lane, segment) in segments.enumerated() {
                guard !segment.isEmpty,
                      let type = segment.edgeType,
                      let strength = segment.strength else { continue }
                let laneX = CGFloat(lane) * laneWidth + laneWidth / 2
                let color = Palette.edge(type)
                let style = StrokeStyle(
                    lineWidth: EdgeStyle.width(strength),
                    lineCap: .round,
                    dash: EdgeStyle.dash(type)
                )

                var path = Path()
                switch segment {
                case .through:
                    path.move(to: CGPoint(x: laneX, y: 0))
                    path.addLine(to: CGPoint(x: laneX, y: size.height))
                case .origin:
                    // Attach to the spine at this row, then curve down into the lane.
                    path.move(to: CGPoint(x: spineX, y: midY))
                    path.addCurve(
                        to: CGPoint(x: laneX, y: size.height),
                        control1: CGPoint(x: laneX + laneWidth * 0.6, y: midY),
                        control2: CGPoint(x: laneX, y: midY + (size.height - midY) * 0.5)
                    )
                case .terminus:
                    // Come up out of the lane and attach to the spine at this row.
                    path.move(to: CGPoint(x: laneX, y: 0))
                    path.addCurve(
                        to: CGPoint(x: spineX, y: midY),
                        control1: CGPoint(x: laneX, y: midY * 0.5),
                        control2: CGPoint(x: laneX + laneWidth * 0.6, y: midY)
                    )
                case .empty:
                    break
                }
                context.stroke(path, with: .color(color), style: style)
            }

            // A filled dot on the focused row makes the centre of the fan obvious.
            if isFocusTarget {
                let dot = Path(ellipseIn: CGRect(x: spineX - 3.5, y: midY - 3.5, width: 7, height: 7))
                context.fill(dot, with: .color(familyColor))
            } else if laneCount > 0 {
                let dot = Path(ellipseIn: CGRect(x: spineX - 2.5, y: midY - 2.5, width: 5, height: 5))
                context.fill(dot, with: .color(Palette.ink4))
            }
        }
        .frame(width: width)
        .accessibilityHidden(true)
    }
}
