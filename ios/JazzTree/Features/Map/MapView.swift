import SwiftUI
import JazzTreeCore

/// The whole DAG on a pinch-zoom canvas.
///
/// The Rail is how you *use* the lineage on a phone; this is how you *see* it. It
/// renders the same layered layout the web app uses — ported in `DAGLayout` and
/// checked against the JS crossing count — inside a scroll view you can pinch and
/// pan, the way you would a map. Portrait-only, like the rest of the app: the canvas
/// is wider than the screen and you move around it, rather than the app rotating.
struct MapView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    /// Layout points per year. Wide enough that capsule labels are readable at 1×.
    private let yearWidth: Double = 9
    private let leftInset: Double = 14
    private let topInset: Double = 34
    private let startYear = 1890

    @State private var scale: CGFloat = 1
    @State private var committedScale: CGFloat = 1

    private var layout: DAGLayout { model.mapLayout() }
    private var canvasWidth: Double {
        leftInset * 2 + Double(model.present - startYear) * yearWidth
    }
    private var canvasHeight: Double { layout.contentHeight + topInset + 24 }

    private func x(_ year: Int) -> Double {
        leftInset + Double(year - startYear) * yearWidth
    }

    var body: some View {
        VStack(spacing: 0) {
            header

            ScrollView([.horizontal, .vertical]) {
                canvas
                    .frame(width: canvasWidth * scale, height: canvasHeight * scale)
            }
            .background(Palette.bgSunk)
            .gesture(
                MagnificationGesture()
                    .onChanged { value in
                        scale = min(3, max(0.34, committedScale * value))
                    }
                    .onEnded { _ in committedScale = scale }
            )
            .overlay(alignment: .bottomTrailing) { zoomControls }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(l10n.t("ios.map.lede"))
                .font(.caption)
                .foregroundStyle(Palette.ink3)
                .fixedSize(horizontal: false, vertical: true)
            EdgeLegend()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Palette.bgRaise)
        .overlay(alignment: .bottom) { Rectangle().fill(Palette.rule).frame(height: 1) }
    }

    private var canvas: some View {
        Canvas { context, size in
            context.scaleBy(x: scale, y: scale)
            let colors = ResolvedColors()

            // Decade gridlines and era bands.
            for era in model.library.eras {
                let x0 = x(max(era.start, startYear))
                let x1 = x(min(era.end, model.present))
                let rect = CGRect(x: x0, y: topInset - 18, width: max(0, x1 - x0), height: canvasHeight)
                context.fill(Path(rect), with: .color(colors.ink.opacity(0.03)))
                var eraLabel = context.resolve(
                    Text(l10n.eraName(era).uppercased()).font(.system(size: 8))
                )
                eraLabel.shading = .color(colors.ink4)
                context.draw(eraLabel, at: CGPoint(x: x0 + 22, y: topInset - 24), anchor: .leading)
            }
            for year in stride(from: startYear, through: model.present, by: 10) {
                var line = Path()
                line.move(to: CGPoint(x: x(year), y: topInset - 18))
                line.addLine(to: CGPoint(x: x(year), y: canvasHeight - 18))
                context.stroke(line, with: .color(colors.ruleSoft), lineWidth: 0.5)
                if year % 20 == 0 {
                    var tick = context.resolve(
                        Text(String(year)).font(.system(size: 8, design: .monospaced))
                    )
                    tick.shading = .color(colors.ink4)
                    context.draw(tick, at: CGPoint(x: x(year) + 2, y: topInset - 10), anchor: .leading)
                }
            }

            // Edges under nodes.
            let active = model.aspects
            for edge in layout.edges {
                if !active.isEmpty && active.isDisjoint(with: edge.edge.aspects) { continue }
                let curve = edge.curve(x: { x($0) })
                var path = Path()
                path.move(to: CGPoint(x: curve.start.x, y: curve.start.y + topInset))
                path.addCurve(
                    to: CGPoint(x: curve.end.x, y: curve.end.y + topInset),
                    control1: CGPoint(x: curve.c1.x, y: curve.c1.y + topInset),
                    control2: CGPoint(x: curve.c2.x, y: curve.c2.y + topInset)
                )
                context.stroke(
                    path,
                    with: .color(colors.edge(edge.type)),
                    style: StrokeStyle(
                        lineWidth: EdgeStyle.width(edge.strength) * (edge.type == .fusionOf ? 1.5 : 1),
                        lineCap: .round,
                        dash: EdgeStyle.dash(edge.type)
                    )
                )
            }

            // Capsules.
            for node in layout.nodes {
                let x0 = x(node.startYear)
                let x1 = x(node.endYear)
                let rect = CGRect(x: x0, y: node.y + topInset, width: max(6, x1 - x0), height: node.height)
                let color = colors.family(node.family)
                let capsule = Path(roundedRect: rect, cornerRadius: 3)
                context.fill(capsule, with: .color(colors.bgRaise))
                context.stroke(capsule, with: .color(color), lineWidth: 1.2)

                // Peak years as a solid block along the bottom — the non-colour
                // signal of intensity, same as the web capsules.
                let peakEnd = min(node.peak.end, node.endYear)
                let peakRect = CGRect(
                    x: x(node.peak.start), y: rect.maxY - 3.5,
                    width: max(2, x(peakEnd) - x(node.peak.start)), height: 3
                )
                context.fill(Path(peakRect), with: .color(color.opacity(0.55)))

                var label = context.resolve(
                    Text(l10n.genreName(node.genre)).font(.system(size: 10.5, design: .serif))
                )
                label.shading = .color(colors.ink)
                let inside = (x1 - x0) > 150
                context.draw(
                    label,
                    at: CGPoint(x: inside ? x0 + 6 : x1 + 6, y: rect.midY),
                    anchor: .leading
                )
            }
        }
        .accessibilityHidden(true)   // the Rail and Genres tabs carry the accessible copy
    }

    private var zoomControls: some View {
        VStack(spacing: 4) {
            zoomButton("plus", label: l10n.t("graph.zoomIn")) { setScale(scale * 1.35) }
            zoomButton("minus", label: l10n.t("graph.zoomOut")) { setScale(scale / 1.35) }
            zoomButton("arrow.up.left.and.arrow.down.right", label: l10n.t("graph.fit")) { setScale(0.34) }
            zoomButton("arrow.counterclockwise", label: l10n.t("graph.resetView")) { setScale(1) }
        }
        .padding(10)
    }

    private func zoomButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Palette.ink3)
                .frame(width: 32, height: 32)
                .background(RoundedRectangle(cornerRadius: 7).fill(Palette.bgRaise.opacity(0.95)))
                .overlay { RoundedRectangle(cornerRadius: 7).stroke(Palette.rule, lineWidth: 1) }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(label))
    }

    private func setScale(_ value: CGFloat) {
        withAnimation(.snappy(duration: 0.2)) {
            scale = min(3, max(0.34, value))
            committedScale = scale
        }
    }
}

/// `Canvas` needs concrete colours, so the dynamic palette is resolved once per draw.
private struct ResolvedColors {
    private let isDark = UITraitCollection.current.userInterfaceStyle == .dark

    var ink: Color { isDark ? Color(UIColor(hex: 0xEBE4D7)) : Color(UIColor(hex: 0x1A1713)) }
    var ink4: Color { isDark ? Color(UIColor(hex: 0x665F54)) : Color(UIColor(hex: 0x978D7C)) }
    var ruleSoft: Color { isDark ? Color(UIColor(hex: 0x241F1A)) : Color(UIColor(hex: 0xE3DCCB)) }
    var bgRaise: Color { isDark ? Color(UIColor(hex: 0x1B1815)) : Color(UIColor(hex: 0xFFFDF7)) }

    func family(_ id: String) -> Color {
        switch id {
        case "trad-mainstream": return isDark ? Color(UIColor(hex: 0xD2922F)) : Color(UIColor(hex: 0x9C6512))
        case "avant":           return isDark ? Color(UIColor(hex: 0x7FA3BD)) : Color(UIColor(hex: 0x3D6383))
        case "electric":        return isDark ? Color(UIColor(hex: 0xC4685A)) : Color(UIColor(hex: 0xA0402F))
        case "global":          return isDark ? Color(UIColor(hex: 0x8FA867)) : Color(UIColor(hex: 0x5A7233))
        default:                return ink4
        }
    }

    func edge(_ type: EdgeType) -> Color {
        switch type {
        case .directDescendant:  return isDark ? Color(UIColor(hex: 0xA3998A)) : Color(UIColor(hex: 0x6D6355))
        case .fusionOf:          return isDark ? Color(UIColor(hex: 0xD2922F)) : Color(UIColor(hex: 0x9C6512))
        case .reactionAgainst:   return isDark ? Color(UIColor(hex: 0xC0574A)) : Color(UIColor(hex: 0x8E2E23))
        case .parallelInfluence: return isDark ? Color(UIColor(hex: 0x6E665C)) : Color(UIColor(hex: 0xA2988A))
        case .revivalOf:         return isDark ? Color(UIColor(hex: 0x8FA867)) : Color(UIColor(hex: 0x5A7233))
        }
    }
}

/// Compact reading key: colour plus dash plus symbol, so type never depends on
/// colour alone.
struct EdgeLegend: View {
    @Environment(\.l10n) private var l10n

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(EdgeType.allCases, id: \.self) { type in
                    HStack(spacing: 4) {
                        DashSample(type: type)
                        Text(l10n.edgeTypeLabel(type))
                            .font(.system(size: 10))
                            .foregroundStyle(Palette.ink3)
                    }
                }
            }
            .padding(.vertical, 2)
        }
    }
}

private struct DashSample: View {
    let type: EdgeType

    var body: some View {
        Canvas { context, size in
            var path = Path()
            path.move(to: CGPoint(x: 0, y: size.height / 2))
            path.addLine(to: CGPoint(x: size.width, y: size.height / 2))
            context.stroke(
                path,
                with: .color(Palette.edge(type)),
                style: StrokeStyle(lineWidth: type == .fusionOf ? 2.6 : 1.6, dash: EdgeStyle.dash(type))
            )
        }
        .frame(width: 22, height: 8)
        .accessibilityHidden(true)
    }
}
