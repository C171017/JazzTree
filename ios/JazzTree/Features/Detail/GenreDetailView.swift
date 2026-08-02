import SwiftUI
import JazzTreeCore

/// The genre profile, presented as a sheet so the rail keeps its scroll position and
/// the whole thing is dismissible with a swipe.
///
/// Three segments rather than one long scroll: on a phone the web app's single
/// column would be a 4,000pt scroll, and the three things people come for — what it
/// sounds like, where it came from, what to play — are genuinely separate tasks.
struct GenreDetailView: View {
    let genre: Genre

    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n
    @Environment(\.dismiss) private var dismiss

    /// Named DetailSection rather than Section so it cannot shadow SwiftUI.Section.
    enum DetailSection: String, CaseIterable, Identifiable {
        case sound, lineage, records
        var id: String { rawValue }
        var labelKey: String { "ios.detail.\(rawValue)" }
    }
    @State private var section: DetailSection = .sound

    private var family: Family? { model.library.family(genre.family) }
    private var familyColor: Color { Palette.family(genre.family) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header

                Picker("", selection: $section) {
                    ForEach(DetailSection.allCases) { item in
                        Text(l10n.t(item.labelKey)).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                switch section {
                case .sound: SoundSection(genre: genre)
                case .lineage: LineageSection(genre: genre)
                case .records: RecordsSection(genre: genre)
                }
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 40)
        }
        .background(Palette.bg)
        // Attached here rather than at the root: one sheet per view level.
        .sheet(item: $model.selectedEdge) { edge in
            NavigationStack {
                EdgeDetailView(edge: edge)
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Text(l10n.genreName(genre))
                    .font(.display(.headline))
                    .foregroundStyle(Palette.ink)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    model.setFocus(genre.id)
                    model.lineageMode = .rail
                    dismiss()
                } label: {
                    Label(l10n.t("ios.rail.focus"), systemImage: "arrow.triangle.branch")
                        .labelStyle(.iconOnly)
                }
                .accessibilityLabel(l10n.t("ios.detail.focusInRail"))
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Pill(text: family.map { l10n.familyShort($0) } ?? genre.family, tint: familyColor)
                Text(l10n.eraSpan(genre, present: model.present))
                    .font(.mono)
                    .foregroundStyle(Palette.ink4)
                Text("·").foregroundStyle(Palette.ink4)
                Text(l10n.genreOriginCity(genre))
                    .font(.facts)
                    .foregroundStyle(Palette.ink4)
                    .lineLimit(1)
            }

            Text(l10n.genreOneLine(genre))
                .font(.display(.title3, weight: .regular))
                .italic()
                .foregroundStyle(Palette.accent)
                .fixedSize(horizontal: false, vertical: true)

            let aliases = l10n.genreAliases(genre)
            if !aliases.isEmpty {
                Text(l10n.t("panel.alsoCalled", ["names": aliases.joined(separator: " · ")]))
                    .font(.caption)
                    .foregroundStyle(Palette.ink4)
            }
        }
        .padding(.top, 6)
    }
}

// MARK: - Sound

private struct SoundSection: View {
    let genre: Genre
    @Environment(\.l10n) private var l10n

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text(l10n.genreSummary(genre))
                .font(.body)
                .foregroundStyle(Palette.ink2)
                .fixedSize(horizontal: false, vertical: true)

            group(l10n.t("panel.listenFor")) {
                VStack(alignment: .leading, spacing: 9) {
                    ForEach(Array(l10n.genreEarMarkers(genre).enumerated()), id: \.offset) { _, marker in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "ear")
                                .font(.system(size: 11))
                                .foregroundStyle(Palette.accent)
                                .padding(.top, 3)
                            Text(marker)
                                .font(.subheadline)
                                .foregroundStyle(Palette.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            group(l10n.t("panel.how")) {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(genre.musicalTraits.ordered) { trait in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(l10n.aspectLabel(trait.aspect).uppercased())
                                .font(.overline).tracking(1)
                                .foregroundStyle(Palette.ink4)
                            Text(l10n.genreTrait(genre, trait.aspect))
                                .font(.subheadline)
                                .foregroundStyle(Palette.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            group(l10n.t("panel.figures")) {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(genre.keyFigures) { figure in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text(figure.name)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Palette.ink)
                                Text(l10n.keyFigureInstrument(figure, in: genre))
                                    .font(.overline)
                                    .foregroundStyle(Palette.ink4)
                            }
                            Text(l10n.keyFigureWhy(figure, in: genre))
                                .font(.subheadline)
                                .foregroundStyle(Palette.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            group(l10n.t("panel.labels")) {
                Text(genre.keyLabels.joined(separator: " · "))
                    .font(.footnote)
                    .foregroundStyle(Palette.ink3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            group(l10n.t("panel.contested")) {
                Callout(title: nil, text: l10n.genreContested(genre), tint: Palette.oxblood)
            }
        }
    }

    @ViewBuilder
    private func group<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(text: title)
            content()
        }
    }
}

// MARK: - Lineage

/// "Came out of" and "Fed into" as navigable rows. This is how you walk a DAG on a
/// phone: one hop at a time, with the explanation right there.
private struct LineageSection: View {
    let genre: Genre
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var parents: [LineageEdge] { model.library.parents(of: genre.id) }
    private var children: [LineageEdge] { model.library.children(of: genre.id) }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            if parents.isEmpty && children.isEmpty {
                Text(l10n.t("ios.detail.noLineage"))
                    .font(.footnote)
                    .foregroundStyle(Palette.ink4)
            }

            if !parents.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(text: l10n.t("ios.rail.cameOutOf"))
                    ForEach(parents) { edge in
                        EdgeRow(edge: edge, otherID: edge.from, incoming: true)
                    }
                }
            }

            if !children.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(text: l10n.t("ios.rail.fedInto"))
                    ForEach(children) { edge in
                        EdgeRow(edge: edge, otherID: edge.to, incoming: false)
                    }
                }
            }
        }
    }
}

/// One influence, collapsed to what matters: which genre, what type, what year,
/// what was inherited, and one line of why. Tapping opens the full explanation.
private struct EdgeRow: View {
    let edge: LineageEdge
    let otherID: String
    let incoming: Bool

    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private var other: Genre? { model.library.genre(otherID) }

    var body: some View {
        Button {
            model.selectedEdge = edge
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Image(systemName: incoming ? "arrow.down.right" : "arrow.up.right")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Palette.edge(edge.type))
                    Text(other.map { l10n.genreName($0) } ?? otherID)
                        .font(.display(.subheadline))
                        .foregroundStyle(Palette.ink)
                    Spacer(minLength: 4)
                    Text(String(edge.year))
                        .font(.mono)
                        .foregroundStyle(Palette.ink4)
                }

                HStack(spacing: 5) {
                    Pill(
                        text: l10n.edgeTypeLabel(edge.type),
                        tint: Palette.edge(edge.type),
                        symbol: EdgeStyle.symbol(edge.type)
                    )
                    ForEach(edge.aspects.prefix(3), id: \.self) { aspect in
                        Pill(text: l10n.aspectLabel(aspect), tint: Palette.ink4)
                    }
                    if edge.aspects.count > 3 {
                        Text("+\(edge.aspects.count - 3)")
                            .font(.overline)
                            .foregroundStyle(Palette.ink4)
                    }
                }

                Text(l10n.edgeExplanation(edge))
                    .font(.footnote)
                    .foregroundStyle(Palette.ink3)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(11)
            .background(RoundedRectangle(cornerRadius: 8).fill(Palette.bgRaise))
            .overlay {
                RoundedRectangle(cornerRadius: 8).stroke(Palette.ruleSoft, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityHint(l10n.t("ios.detail.edgeHint"))
    }
}

/// The full influence explanation, plus the hinge record where the shift is audible.
struct EdgeDetailView: View {
    let edge: LineageEdge

    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n
    @Environment(\.dismiss) private var dismiss

    private var from: Genre? { model.library.genre(edge.from) }
    private var to: Genre? { model.library.genre(edge.to) }
    private var hinge: Album? { edge.hingeAlbum.flatMap { model.library.album($0) } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(from.map { l10n.genreName($0) } ?? edge.from)
                        .font(.display(.headline))
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(Palette.ink4)
                    Text(to.map { l10n.genreName($0) } ?? edge.to)
                        .font(.display(.headline))
                    Spacer()
                    Text(String(edge.year))
                        .font(.mono)
                        .foregroundStyle(Palette.ink4)
                }
                .foregroundStyle(Palette.ink)

                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 5) {
                        Pill(
                            text: l10n.edgeTypeLabel(edge.type),
                            tint: Palette.edge(edge.type),
                            filled: true,
                            symbol: EdgeStyle.symbol(edge.type)
                        )
                        Pill(text: l10n.t("graph.strength", ["strength": l10n.strengthLabel(edge.strength)]), tint: Palette.ink4)
                    }
                    Text(l10n.edgeDescription(edge.type))
                        .font(.caption)
                        .foregroundStyle(Palette.ink4)
                }

                VStack(alignment: .leading, spacing: 6) {
                    SectionHeader(text: l10n.t("ios.detail.inherited"))
                    HStack(spacing: 5) {
                        ForEach(edge.aspects, id: \.self) { aspect in
                            Pill(text: l10n.aspectLabel(aspect), tint: Palette.accent)
                        }
                    }
                }

                Text(l10n.edgeExplanation(edge))
                    .font(.body)
                    .foregroundStyle(Palette.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                if let hinge {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionHeader(text: l10n.t("ios.detail.hinge"))
                        AlbumCardView(album: hinge)
                    }
                }

                HStack(spacing: 10) {
                    if let from {
                        Button(l10n.genreName(from)) { model.selectedGenre = from }
                            .buttonStyle(.bordered)
                    }
                    if let to {
                        Button(l10n.genreName(to)) { model.selectedGenre = to }
                            .buttonStyle(.bordered)
                    }
                }
                .font(.footnote)
            }
            .padding(18)
        }
        .background(Palette.bg)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(l10n.t("panel.close")) { dismiss() }
            }
        }
    }
}

// MARK: - Records

private struct RecordsSection: View {
    let genre: Genre
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    private func albums(_ tier: Tier) -> [Album] {
        model.visible(model.library.albums(for: genre.id, tier: tier))
    }
    private var crossListed: [Album] {
        model.visible(model.library.crossListedAlbums(for: genre.id))
    }
    private var hidesSome: Bool {
        model.gentle && model.library.primaryAlbums(for: genre.id).contains { $0.difficulty > 3 }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            ForEach(Tier.allCases, id: \.self) { tier in
                let list = albums(tier)
                if !list.isEmpty {
                    tierGroup(
                        title: l10n.t("panel.\(tier.rawValue)"),
                        note: l10n.t("panel.\(tier.rawValue).note"),
                        albums: list,
                        highlight: tier == .gateway
                    )
                }
            }

            if !crossListed.isEmpty {
                tierGroup(
                    title: l10n.t("panel.alsoFiled"),
                    note: l10n.t("panel.alsoFiled.note"),
                    albums: crossListed,
                    highlight: false,
                    showGenres: true
                )
            }

            if hidesSome {
                Text(l10n.t("panel.gentleHidden"))
                    .font(.caption)
                    .italic()
                    .foregroundStyle(Palette.ink4)
            }
        }
    }

    @ViewBuilder
    private func tierGroup(
        title: String, note: String, albums: [Album],
        highlight: Bool, showGenres: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                SectionHeader(text: title)
                Text(note)
                    .font(.caption)
                    .foregroundStyle(Palette.ink4)
            }
            ForEach(albums) { album in
                AlbumCardView(album: album, highlight: highlight, showGenres: showGenres)
            }
        }
    }
}
