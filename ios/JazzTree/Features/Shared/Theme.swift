import SwiftUI
import JazzTreeCore

/// Design tokens, ported from `css/theme.css` so the phone and the web app look
/// like the same product: warm charcoal ground, one ochre accent with an oxblood
/// second, a serif for names and headings, and type doing most of the work.
///
/// Colours are declared as dynamic `UIColor`s rather than asset-catalog entries so
/// the palette lives in one readable file next to the CSS it mirrors.
enum Palette {

    static func dynamic(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { traits in
            UIColor(hex: traits.userInterfaceStyle == .dark ? dark : light)
        })
    }

    // Ground
    static let bg        = dynamic(light: 0xF5F1E8, dark: 0x13110E)
    static let bgRaise   = dynamic(light: 0xFFFDF7, dark: 0x1B1815)
    static let bgSunk    = dynamic(light: 0xEAE4D6, dark: 0x0D0C0A)
    static let rule      = dynamic(light: 0xD3C9B4, dark: 0x332C24)
    static let ruleSoft  = dynamic(light: 0xE3DCCB, dark: 0x241F1A)

    // Ink
    static let ink       = dynamic(light: 0x1A1713, dark: 0xEBE4D7)
    static let ink2      = dynamic(light: 0x443C31, dark: 0xC4BBAC)
    static let ink3      = dynamic(light: 0x6D6355, dark: 0x918879)
    static let ink4      = dynamic(light: 0x978D7C, dark: 0x665F54)

    // Accents
    static let accent    = dynamic(light: 0x9C6512, dark: 0xD2922F)
    static let accentSoft = dynamic(light: 0xE5CFA4, dark: 0x7A5417)
    static let oxblood   = dynamic(light: 0x8E2E23, dark: 0xC0574A)

    /// Family colours. Every use in the UI is paired with a text label or a shape,
    /// never colour alone — same rule as the web version.
    static func family(_ id: String) -> Color {
        switch id {
        case "trad-mainstream": return dynamic(light: 0x9C6512, dark: 0xD2922F)
        case "avant":           return dynamic(light: 0x3D6383, dark: 0x7FA3BD)
        case "electric":        return dynamic(light: 0xA0402F, dark: 0xC4685A)
        case "global":          return dynamic(light: 0x5A7233, dark: 0x8FA867)
        default:                return ink3
        }
    }

    /// Edge-type colours, paired with a dash pattern in `EdgeStyle`.
    static func edge(_ type: EdgeType) -> Color {
        switch type {
        case .directDescendant:  return dynamic(light: 0x6D6355, dark: 0xA3998A)
        case .fusionOf:          return dynamic(light: 0x9C6512, dark: 0xD2922F)
        case .reactionAgainst:   return dynamic(light: 0x8E2E23, dark: 0xC0574A)
        case .parallelInfluence: return dynamic(light: 0xA2988A, dark: 0x6E665C)
        case .revivalOf:         return dynamic(light: 0x5A7233, dark: 0x8FA867)
        }
    }
}

/// Dash pattern per edge type, so type is never communicated by colour alone.
enum EdgeStyle {
    static func dash(_ type: EdgeType) -> [CGFloat] {
        switch type {
        case .directDescendant:  return []
        case .fusionOf:          return []
        case .reactionAgainst:   return [6, 3]
        case .parallelInfluence: return [1, 3]
        case .revivalOf:         return [9, 2, 2, 2]
        }
    }

    /// A marker shape drawn at the endpoint — the third, non-colour signal.
    static func symbol(_ type: EdgeType) -> String {
        switch type {
        case .directDescendant:  return "arrow.down"
        case .fusionOf:          return "arrow.triangle.merge"
        case .reactionAgainst:   return "arrow.uturn.down"
        case .parallelInfluence: return "arrow.left.and.right"
        case .revivalOf:         return "arrow.counterclockwise"
        }
    }

    static func width(_ strength: Strength) -> CGFloat {
        switch strength {
        case .strong: return 2.4
        case .moderate: return 1.6
        case .weak: return 1.0
        }
    }
}

extension Font {
    /// Serif for genre names, album titles and headings. Scales with Dynamic Type.
    static func display(_ style: Font.TextStyle, weight: Font.Weight = .semibold) -> Font {
        .system(style, design: .serif).weight(weight)
    }

    /// Small all-caps label used for section headers and metadata.
    static var overline: Font { .system(.caption2, design: .default).weight(.semibold) }
    static var facts: Font { .system(.caption, design: .default) }
    static var mono: Font { .system(.caption2, design: .monospaced) }
}

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }
}

// MARK: - Reusable chrome

/// Small all-caps section header, matching the web app's `.sec__h`.
struct SectionHeader: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(.overline)
            .tracking(1.2)
            .foregroundStyle(Palette.ink4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.bottom, 4)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Palette.ruleSoft).frame(height: 1)
            }
            .accessibilityAddTraits(.isHeader)
    }
}

/// Pill used for aspects, families, tiers and edge types.
struct Pill: View {
    let text: String
    var tint: Color = Palette.ink3
    var filled: Bool = false
    var symbol: String? = nil

    var body: some View {
        HStack(spacing: 3) {
            if let symbol { Image(systemName: symbol).font(.system(size: 9, weight: .semibold)) }
            Text(text)
        }
        .font(.overline)
        .tracking(0.6)
        .foregroundStyle(filled ? Palette.bg : tint)
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background {
            Capsule(style: .continuous)
                .fill(filled ? tint : Color.clear)
                .overlay { Capsule(style: .continuous).stroke(tint.opacity(filled ? 1 : 0.55), lineWidth: 1) }
        }
    }
}

/// A quoted aside with a coloured rule, used for `contested` and `listenFor`.
struct Callout: View {
    let title: String?
    let text: String
    var tint: Color = Palette.accent

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Rectangle().fill(tint).frame(width: 2)
            VStack(alignment: .leading, spacing: 3) {
                if let title {
                    Text(title.uppercased())
                        .font(.overline).tracking(1)
                        .foregroundStyle(tint)
                }
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(Palette.ink2)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Difficulty as dots plus a word — never colour alone.
struct DifficultyLabel: View {
    let difficulty: Int
    @Environment(\.l10n) private var l10n

    var body: some View {
        HStack(spacing: 5) {
            Text(Localization.difficultyDots(difficulty))
                .font(.system(size: 8))
                .foregroundStyle(Palette.accent)
            Text(l10n.difficultyLabel(difficulty))
                .font(.overline)
                .foregroundStyle(Palette.ink4)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(l10n.t("album.difficulty", [
            "difficulty": difficulty, "label": l10n.difficultyLabel(difficulty),
        ]))
    }
}

// MARK: - Environment

private struct LocalizationKey: EnvironmentKey {
    static let defaultValue = Localization.shared
}

extension EnvironmentValues {
    /// Injected so views re-render when the locale changes.
    var l10n: Localization {
        get { self[LocalizationKey.self] }
        set { self[LocalizationKey.self] = newValue }
    }
}

extension View {
    /// Haptic tap used for focus changes and toggles.
    func tapFeedback(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
}
