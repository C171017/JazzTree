import SwiftUI
import JazzTreeCore

/// Proportional time, one row per genre.
///
/// This is where the web app's Timeline goes on a phone. Instead of one wide chart
/// you get 39 sparklines, each 1890→now across the row width — which is actually
/// *more* readable in portrait than the web version is, because the genre name sits
/// above its own bar instead of in a cramped left column.
struct SpansView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private let start = 1890

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0, pinnedViews: [.sectionHeaders]) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(l10n.t("ios.spans.title"))
                        .font(.display(.title2))
                        .foregroundStyle(Palette.ink)
                    Text(l10n.t("ios.spans.lede"))
                        .font(.subheadline)
                        .foregroundStyle(Palette.ink3)
                        .fixedSize(horizontal: false, vertical: true)
                    DecadeRuler(start: start, end: model.present)
                        .padding(.top, 6)
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 10)

                ForEach(DAGLayout.narrativeFamilyOrder, id: \.self) { familyID in
                    let members = model.library.genres.filter { $0.family == familyID }
                    if !members.isEmpty, let family = model.library.family(familyID) {
                        Section {
                            ForEach(members) { genre in
                                SpanRow(genre: genre, start: start)
                            }
                        } header: {
                            HStack(spacing: 8) {
                                Text(l10n.familyName(family).uppercased())
                                    .font(.overline).tracking(1.2)
                                    .foregroundStyle(Palette.family(familyID))
                                Rectangle().fill(Palette.ruleSoft).frame(height: 1)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 7)
                            .background(Palette.bg.opacity(0.96))
                        }
                    }
                }
                Spacer(minLength: 30)
            }
        }
    }
}

private struct SpanRow: View {
    let genre: Genre
    let start: Int

    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var color: Color { Palette.family(genre.family) }

    var body: some View {
        Button {
            model.selectedGenre = genre
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(l10n.genreName(genre))
                        .font(.display(.subheadline))
                        .foregroundStyle(Palette.ink)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(l10n.eraSpan(genre, present: model.present))
                        .font(.mono)
                        .foregroundStyle(Palette.ink4)
                }

                GeometryReader { geo in
                    let width = geo.size.width
                    let total = Double(model.present - start)
                    let x0 = width * Double(genre.era.start - start) / total
                    let endYear = genre.era.end ?? model.present
                    let x1 = width * Double(endYear - start) / total
                    let peakEnd = min(genre.era.peakEnd, endYear)
                    let p0 = width * Double(genre.era.peakStart - start) / total
                    let p1 = width * Double(peakEnd - start) / total

                    ZStack(alignment: .leading) {
                        // The whole span, outlined.
                        RoundedRectangle(cornerRadius: 2)
                            .fill(color.opacity(0.22))
                            .overlay {
                                RoundedRectangle(cornerRadius: 2).stroke(color.opacity(0.7), lineWidth: 1)
                            }
                            .frame(width: max(3, x1 - x0))
                            .offset(x: x0)
                        // The peak years, solid — the same second signal the web
                        // capsules use, so intensity is not colour alone.
                        RoundedRectangle(cornerRadius: 2)
                            .fill(color.opacity(0.75))
                            .frame(width: max(2, p1 - p0))
                            .offset(x: p0)
                        if genre.era.end == nil {
                            Text("→")
                                .font(.system(size: 9))
                                .foregroundStyle(Palette.ink4)
                                .offset(x: min(width - 10, x1 + 2))
                        }
                    }
                    .frame(height: 11)
                }
                .frame(height: 11)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 7)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(l10n.genreName(genre)), \(l10n.eraSpan(genre, present: model.present)). \(l10n.genreOneLine(genre))")
    }
}

/// Decade ticks, so the bars below have a scale to read against.
private struct DecadeRuler: View {
    let start: Int
    let end: Int

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            let total = Double(end - start)
            ZStack(alignment: .topLeading) {
                ForEach(Array(stride(from: start, through: end, by: 20)), id: \.self) { year in
                    let x = width * Double(year - start) / total
                    VStack(spacing: 1) {
                        Rectangle().fill(Palette.rule).frame(width: 1, height: 4)
                        Text(String(year % 100 == 0 ? year : year % 100))
                            .font(.system(size: 8, design: .monospaced))
                            .foregroundStyle(Palette.ink4)
                    }
                    .offset(x: min(width - 16, x))
                }
            }
        }
        .frame(height: 18)
        .accessibilityHidden(true)
    }
}
