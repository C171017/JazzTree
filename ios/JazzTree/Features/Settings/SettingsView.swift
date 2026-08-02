import SwiftUI
import JazzTreeCore

struct SettingsTab: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    var body: some View {
        NavigationStack {
            List {
                Section(l10n.t("ios.settings.listening")) {
                    Picker(l10n.t("service.label"), selection: Binding(
                        get: { model.service },
                        set: { model.service = $0 }
                    )) {
                        ForEach(StreamingService.allCases) { service in
                            Text(l10n.serviceName(service)).tag(service)
                        }
                    }
                    Toggle(l10n.t("gentle"), isOn: $model.gentle)
                        .tint(Palette.accent)
                    Text(l10n.t("gentle.title"))
                        .font(.caption)
                        .foregroundStyle(Palette.ink4)
                }

                Section(l10n.t("ios.settings.appearance")) {
                    Picker(l10n.t("ios.settings.theme"), selection: Binding(
                        get: { model.appearance },
                        set: { model.appearance = $0 }
                    )) {
                        ForEach(AppModel.Appearance.allCases) { option in
                            Text(l10n.t(option.labelKey)).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)

                    Picker(l10n.t("locale.label"), selection: Binding(
                        get: { l10n.active },
                        set: { model.setLocale($0) }
                    )) {
                        ForEach(l10n.locales) { locale in
                            Text(l10n.t(locale.id == "zh-CN" ? "locale.name.zhCN" : "locale.name.en"))
                                .tag(locale.id)
                        }
                    }
                    Text(l10n.t("ios.settings.translationNote"))
                        .font(.caption)
                        .foregroundStyle(Palette.ink4)
                }

                Section(l10n.t("ios.settings.reading")) {
                    NavigationLink(l10n.t("ios.settings.howToRead")) { HowToReadView() }
                    NavigationLink(l10n.t("ios.settings.about")) { AboutView() }
                }

                Section(l10n.t("ios.settings.data")) {
                    row(l10n.t("ios.settings.genres"), "\(model.library.genres.count)")
                    row(l10n.t("ios.settings.edges"), "\(model.library.lineage.count)")
                    row(l10n.t("ios.settings.albums"), "\(model.library.albums.count)")
                    row(l10n.t("ios.settings.lowConfidence"),
                        "\(model.library.albums.filter { $0.confidence == .low }.count)")
                    Text(l10n.t("ios.settings.offlineNote"))
                        .font(.caption)
                        .foregroundStyle(Palette.ink4)
                }
            }
            .navigationTitle(l10n.t("ios.tab.more"))
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            Text(value)
                .font(.system(.body, design: .monospaced))
                .foregroundStyle(Palette.ink3)
        }
    }
}

/// The web app's legend, as a screen. Colour is always paired with a dash pattern
/// and a symbol, and this is where that pairing is explained.
struct HowToReadView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.l10n) private var l10n

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(text: l10n.t("ios.settings.edgeTypes"))
                    ForEach(EdgeType.allCases, id: \.self) { type in
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: EdgeStyle.symbol(type))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Palette.edge(type))
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(l10n.edgeTypeLabel(type))
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Palette.ink)
                                Text(l10n.edgeDescription(type))
                                    .font(.caption)
                                    .foregroundStyle(Palette.ink3)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(text: l10n.t("ios.settings.families"))
                    ForEach(DAGLayout.narrativeFamilyOrder, id: \.self) { id in
                        if let family = model.library.family(id) {
                            HStack(alignment: .top, spacing: 10) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Palette.family(id))
                                    .frame(width: 12, height: 12)
                                    .padding(.top, 3)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(l10n.familyName(family))
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Palette.ink)
                                    Text(l10n.familyBlurb(family))
                                        .font(.caption)
                                        .foregroundStyle(Palette.ink3)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeader(text: l10n.t("ios.settings.tiersAndDifficulty"))
                    ForEach(Tier.allCases, id: \.self) { tier in
                        VStack(alignment: .leading, spacing: 1) {
                            Text(l10n.t("panel.\(tier.rawValue)"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Palette.ink)
                            Text(l10n.t("panel.\(tier.rawValue).note"))
                                .font(.caption)
                                .foregroundStyle(Palette.ink3)
                        }
                    }
                    ForEach(1...5, id: \.self) { level in
                        HStack(spacing: 6) {
                            Text(Localization.difficultyDots(level))
                                .font(.system(size: 9))
                                .foregroundStyle(Palette.accent)
                            Text(l10n.difficultyLabel(level))
                                .font(.caption)
                                .foregroundStyle(Palette.ink3)
                        }
                    }
                }

                Callout(title: l10n.t("ios.settings.railNote.title"),
                        text: l10n.t("ios.settings.railNote"))
            }
            .padding(18)
        }
        .background(Palette.bg)
        .navigationTitle(l10n.t("ios.settings.howToRead"))
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct AboutView: View {
    @Environment(\.l10n) private var l10n

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(l10n.t("ios.about.intro"))
                    .font(.body)
                    .foregroundStyle(Palette.ink2)
                    .fixedSize(horizontal: false, vertical: true)

                Callout(title: l10n.t("ios.about.accuracy.title"),
                        text: l10n.t("ios.about.accuracy"),
                        tint: Palette.oxblood)

                Text(l10n.t("ios.about.links"))
                    .font(.footnote)
                    .foregroundStyle(Palette.ink3)
                    .fixedSize(horizontal: false, vertical: true)

                Text(l10n.t("ios.about.credits"))
                    .font(.caption)
                    .foregroundStyle(Palette.ink4)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(18)
        }
        .background(Palette.bg)
        .navigationTitle(l10n.t("ios.settings.about"))
        .navigationBarTitleDisplayMode(.inline)
    }
}
