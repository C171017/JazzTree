import SwiftUI
import JazzTreeCore

/// Browse and search. The web app's grid, one column wide.
struct GenresTab: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 10) {
                    filters

                    ForEach(model.filteredGenres) { genre in
                        GenreCard(genre: genre)
                    }

                    if model.filteredGenres.isEmpty {
                        Text(l10n.t("grid.empty", ["query": model.search]))
                            .font(.display(.body))
                            .foregroundStyle(Palette.ink4)
                            .padding(.vertical, 50)
                    }
                    Spacer(minLength: 24)
                }
                .padding(.horizontal, 16)
            }
            .background(Palette.bg)
            .navigationTitle(l10n.t("view.grid"))
            .searchable(
                text: $model.search,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: l10n.t("grid.search.placeholder")
            )
        }
    }

    private var filters: some View {
        VStack(spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    familyChip(id: "all", label: l10n.t("grid.allFamilies"), color: Palette.accent)
                    ForEach(DAGLayout.narrativeFamilyOrder, id: \.self) { id in
                        if let family = model.library.family(id) {
                            familyChip(id: id, label: l10n.familyShort(family), color: Palette.family(id))
                        }
                    }
                }
                .padding(.vertical, 2)
            }

            HStack {
                Picker(l10n.t("grid.sort.label"), selection: $model.genreSort) {
                    ForEach(AppModel.GenreSort.allCases) { sort in
                        Text(l10n.t(sort.labelKey)).tag(sort)
                    }
                }
                .pickerStyle(.menu)
                .font(.footnote)

                Spacer()

                Text(l10n.t("grid.count", [
                    "shown": model.filteredGenres.count, "total": model.library.genres.count,
                ]))
                .font(.overline)
                .foregroundStyle(Palette.ink4)
            }
        }
        .padding(.top, 4)
    }

    private func familyChip(id: String, label: String, color: Color) -> some View {
        Button {
            model.familyFilter = id
        } label: {
            Pill(text: label, tint: color, filled: model.familyFilter == id)
        }
        .accessibilityAddTraits(model.familyFilter == id ? [.isSelected] : [])
    }
}

struct GenreCard: View {
    let genre: Genre
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var familyColor: Color { Palette.family(genre.family) }
    private var gateway: Album? { model.library.gatewayAlbum(for: genre.id) }

    var body: some View {
        Button {
            model.selectedGenre = genre
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(l10n.eraSpan(genre, present: model.present))
                        .font(.mono)
                        .foregroundStyle(Palette.ink4)
                    Spacer()
                    Pill(
                        text: model.library.family(genre.family).map { l10n.familyShort($0) } ?? genre.family,
                        tint: familyColor
                    )
                }

                Text(l10n.genreName(genre))
                    .font(.display(.title3))
                    .foregroundStyle(Palette.ink)
                    .fixedSize(horizontal: false, vertical: true)

                Text(l10n.genreOneLine(genre))
                    .font(.subheadline)
                    .foregroundStyle(Palette.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                if let gateway {
                    Text(l10n.t("grid.start", ["artist": gateway.artist, "title": gateway.title]))
                        .font(.caption2)
                        .foregroundStyle(Palette.ink4)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Text(l10n.t("grid.records", ["count": model.library.albumCount(for: genre.id)]))
                    .font(.overline)
                    .foregroundStyle(Palette.ink4)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(13)
            .padding(.leading, 5)
            .background(RoundedRectangle(cornerRadius: 10).fill(Palette.bgRaise))
            .overlay(alignment: .leading) {
                UnevenRoundedRectangle(
                    topLeadingRadius: 10, bottomLeadingRadius: 10,
                    bottomTrailingRadius: 0, topTrailingRadius: 0
                )
                .fill(familyColor)
                .frame(width: 4)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 10).stroke(Palette.ruleSoft, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(l10n.genreName(genre)). \(l10n.genreOneLine(genre))")
    }
}
