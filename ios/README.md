# JazzTree for iOS

A portrait-first native app built on the same dataset as the web version: 39 genres,
103 influence edges, 351 records, English and Simplified Chinese. No network, no
accounts, no tracking — the whole guide ships inside the binary.

**Status: compiled and tested.** The app builds for a generic iOS Simulator target,
the complete Swift core verification passes, and the Xcode test suite passes. The
remaining work before public distribution is device/UI/accessibility review and App
Store signing/metadata, described under [Before you can ship](#before-you-can-ship).

---

## The design problem, and the answer

The web app puts **time on the x axis**. That is the whole point of it — a genre's
capsule literally spans its active years — and it needs a wide screen. Ported
literally to a phone held vertically you get a canvas roughly 1,400pt wide and
1,100pt tall, which means panning in two axes reading 10pt type. Hostile.

Portrait phones have height to spare and no width. So the axis is rotated:

### 1. The Rail — time runs downward

The primary view. One genre per full-width row, ordered chronologically, with a
gutter down the left carrying the influence curves. Genre names sit at real reading
size instead of 10pt, and you scroll time, which is what a phone is for.

Two deliberate departures from the web version, both documented in
`RailPlan.swift`:

- **Time is ordered and labelled, not drawn to scale.** At a readable row height a
  proportional axis would be mostly empty — ragtime alone owns 1895–1919, while
  1954–1970 crams fourteen genres into sixteen years. Rows are uniform and
  chronological with decade headers marking the passage of time. Proportional time
  lives in the Spans view instead. Rail = order and structure; Spans = proportion.
- **Edges are drawn only under focus.** 103 curves in a 76pt gutter is noise.
  Unfocused rows carry parent/child counts (`↓3 ↑5`) instead.

### 2. Focus mode — how you walk a DAG with a thumb

Hover does not exist on a phone. Tap the branch button on any row (or long-press the
row) and the rail **collapses to that genre and its direct influences**, drawing just
those curves in the gutter. Tap a neighbour to re-focus on it and walk the graph one
hop at a time.

This replaces the web app's hover-dimming and is arguably better: it is persistent,
so you can actually read the explanations instead of holding a finger down.

It also fixes something the web version gets wrong. Read as full transitive closure,
"dim everything except its ancestors and descendants" lights **32 of 39 genres** for a
hub like hard bop, which communicates nothing. The app uses direct neighbours, and
there is a test asserting that premise (`lineage / direct neighbourhood is small
where closure is not`).

### 3. Spans — proportional time

Every genre gets a bar spanning 1890→now within the row width, with the peak years
solid inside it. This is the web Timeline translated: instead of one wide chart you
get 39 sparklines, each with its name directly above its own bar. More readable in
portrait than the web version is.

### 4. Map — the whole shape

The complete DAG on a pinch-zoom canvas, rendered from a faithful Swift port of
`js/lib/layout.js`. For people who want to see the whole thing. Still portrait: the
canvas is wider than the screen and you move around it, like a map, rather than the
app rotating.

### What else carried over

| Web feature | On iOS |
| --- | --- |
| Aspect filter (the most interesting feature) | Chip scroller pinned under the nav bar, with a live "42 of 103 influences" count |
| Time scrubber | Year slider in a collapsible bar; dragging it forward makes the rail fill in |
| Genre profile | Sheet with three segments — Sound / Lineage / Records — instead of a 4,000pt scroll |
| Edge popover | Tappable influence rows → sheet with the explanation and the hinge record |
| Three album tiers | Gateway highlighted, then core, deep, and cross-listed |
| Listening paths | Vertical steppers with persisted progress, **plus** a Resume button that jumps to the first unheard record |
| Gentle path | Settings toggle, hides difficulty 4–5 everywhere |
| Streaming destinations | Three buttons per record; Apple Music and NetEase use verified exact-album hand-offs |
| Dark / light theme | Follows the system, with a manual override |
| English / 简体中文 | Follows the device, with a manual override |
| Confidence and contested honesty | Kept in full: confidence badges, notes, and a per-genre Contested section |

---

## Layout

```
ios/
  JazzTree.xcodeproj/            Xcode 16 project, file-system-synchronized groups
  JazzTree/                      the app target — SwiftUI only, no logic
    JazzTreeApp.swift            entry point, tab bar, root sheet
    AppModel.swift               all app state (mirrors the web js/store.js)
    Info.plist                   portrait-only, en + zh-Hans
    PrivacyInfo.xcprivacy        "collects nothing", UserDefaults reason CA92.1
    Assets.xcassets/             app icon (generated), accent + launch colours
    Features/
      Rail/                      RailView, RailRowView, gutter Canvas, filters, scrubber
      Spans/                     proportional-time bars
      Map/                       pinch-zoom DAG canvas
      Genres/                    search and browse
      Detail/                    genre profile, album card, influence sheet
      Paths/                     the three listening routes
      Settings/                  preferences, how-to-read, about
      Shared/Theme.swift         design tokens ported from css/theme.css
  Packages/JazzTreeCore/         pure Swift — no SwiftUI, no UIKit
    Sources/JazzTreeCore/
      Models.swift               Codable types for the dataset
      Library.swift              indexes and graph queries
      DataLoader.swift           bundled JSON loading
      RailPlan.swift             the rail's ordering, sections and gutter lanes
      DAGLayout.swift            port of js/lib/layout.js, for the Map view
      Localization.swift         en / zh-CN, from the same tables as the web app
      StreamingLinks.swift       search URL construction
      AppleMusicCatalog.swift    exact Apple Music album resolution at tap time
      NetEaseCatalog.swift       exact NetEase app route + official web fallback
      PathProgress.swift         listening progress, persisted
      Verification.swift         every dataset and layout invariant
      Resources/                 genres, albums, paths, localization — GENERATED
    Sources/jazztree-verify/     command-line runner for the invariants
    Tests/JazzTreeCoreTests/     XCTest wrapper (compiled only when Xcode is present)
```

**Why the split.** Everything that can be *wrong* — decoding, the graph, the layout,
the URLs, the translations — is in `JazzTreeCore`, which has no UI dependency and can
therefore be built and tested from the command line with no Xcode. The SwiftUI layer
holds no logic worth testing.

---

## Build it

```bash
open ios/JazzTree.xcodeproj
```

The checked project has a development team and bundle identifier for its current
owner. Select your own team and change the bundle identifier before installing on
another developer account or distributing it. Deployment target is iOS 17.0.

Run the core checks without Xcode at all:

```bash
cd ios/Packages/JazzTreeCore && swift run jazztree-verify
```

Regenerate the app icon (CoreGraphics, no Xcode needed):

```bash
swift build/icon/main.swift
```

### Keeping the data in step with the web version

The dataset lives once, in `data/*.json` at the repo root. After editing it:

```bash
npm run data        # validate + regenerate the web derived files
npm run sync-ios    # copy into the iOS package, regenerate localization.json
npm run verify-ios  # re-run the Swift invariants
```

`build/sync-ios.js` copies the three JSON files and regenerates
`localization.json` from `js/i18n.js` plus `build/ios-strings.json` — so the shared
strings physically cannot drift between the two apps. The extraction **fails the
build** if the Swift code references a localisation key that does not exist, which is
otherwise a silent bug that ships as a raw key on screen.

---

## What is verified

`swift run jazztree-verify` — **26 checks, 0 failures**, run on this machine. The
additional localisation check walks every rendered genre detail, all 103 lineage
explanations, all 351 album descriptions and notes, and every listening-path
transition in Simplified Chinese:

```
DATA      dataset decodes completely · ids unique and chronological · fields sane
LINEAGE   edges resolve · graph is acyclic · no orphans · hinge albums resolve
          direct neighbourhood is small where closure is not
ALBUMS    tier counts per genre (1 gateway, 4–6 core, 3–4 deep) · fields sane
PATHS     steps resolve and honour their own declared constraints
LAYOUT    DAG port agrees with js/lib/layout.js · deterministic · rows never
          overlap in time · revival edges hook backwards
RAIL      unfocused rail lists every genre once with decade headers · focus
          collapses to the neighbourhood · gutter segments match the connectors
          · aspect filter matches the web semantics · year scrubber works
STREAMING search URLs well formed for all 351 albums × 3 services · Apple Music
          matching rejects a same-name single · verified NetEase IDs produce
          exact app and mobile-web album routes
I18N      both locales cover every genre, path, family, aspect and edge type
          · complete Chinese editorial prose is applied · placeholders resolve
          · difficulty dots
PROGRESS  round-trips through storage and is scoped per path
SEARCH    finds genres by figure, label, ear marker and localised name
```

The strongest of these is **`DAG port agrees with js/lib/layout.js`**. A layout
algorithm is nearly impossible to check without looking at a screen, so the test
asserts the Swift port produces the same edge-crossing count as the JavaScript on the
same data — **533**. If the port drifts, that number moves.

The full SwiftUI app also compiles through `xcodebuild` for a generic iOS Simulator
destination, and all three Xcode tests pass. Every SwiftUI file separately passes
`swiftc -parse` as a fast syntax guard.

### What is *not* verified

- A complete interactive pass on physical iPhones, especially a small phone, a Pro
  Max, and Accessibility XL Dynamic Type.
- VoiceOver navigation. Labels, hints and custom actions are written throughout,
  but nobody has swiped through the complete app.
- Spotify, Apple Music and NetEase hand-off on a physical device. Exact-album URL
  construction is covered deterministically, but third-party app opening is not.

### Bugs already found and fixed by review

Recorded because it shows what kind of thing to look for on the first build:

1. **`@AppStorage` inside an `ObservableObject`** — it is a `DynamicProperty` meant
   for a `View`. In a class it reads and writes `UserDefaults` but never publishes, so
   `$model.gentle` would have mutated storage without refreshing anything. Replaced
   with plain `@Published` properties that persist in `didSet`.
2. **Two `.sheet` modifiers on the same view** — SwiftUI allows one presentation per
   view level and the second silently wins. The influence sheet moved down a level,
   into the genre sheet where it is actually raised from.
3. **`Text(…).foregroundStyle(…)` inside `Canvas`** — only returns `Text` on iOS 17+
   and picks a `some View` overload otherwise, which `context.draw` will not take.
   Replaced with `context.resolve` plus explicit `shading`.
4. **`ForEach` over a labelled-tuple array** — legal but fragile; replaced with a
   named `MusicalTraits.Trait` type.

---

## Before you can ship

Roughly in the order you would do them.

### 1. Install it under your developer account

- [ ] Open in Xcode, choose your **development team**, and use a bundle identifier
      owned by that account.
- [ ] Run on a physical iPhone. The simulator build, local package resolution, 26
      core invariants, and all three Xcode tests are already clean.

### 2. Look at it — a day

- [ ] Walk every screen on an iPhone SE (small) **and** a Pro Max, and at
      **Accessibility XL** Dynamic Type. The rail row and album card are the ones most
      likely to overflow.
- [ ] Check the **gutter curves** in focus mode actually meet the spine cleanly. The
      geometry is per-row arithmetic and has never been rendered; the control points
      in `RailGutterView` may need adjusting.
- [ ] Check the Map canvas at 0.34× (fit) and 3× — text legibility and whether
      `Canvas` redraw cost is acceptable while pinching.
- [ ] Both themes, both languages.

### 3. Accessibility — half a day

- [ ] VoiceOver pass over the rail: row labels, the focus custom action, the aspect
      chips, the year slider.
- [ ] Check contrast on the family and edge colours in both themes (they are ported
      from the web palette, which was designed for larger text).
- [ ] Reduce Motion: the focus transition uses `withAnimation(.snappy)` and should be
      suppressed.
- [ ] Confirm the Map's `.accessibilityHidden(true)` is the right call — the same
      content is reachable in the Rail and Genres tabs, which is the argument for it.

### 4. App Store submission — a day plus review time

Assets and metadata, none of which exist yet:

- [ ] **Screenshots** — 6.7" and 6.5" iPhone are required; iPad if you keep
      `TARGETED_DEVICE_FAMILY = "1,2"`. Consider dropping iPad to 1 (iPhone only)
      unless you want to design for it, because a portrait-only iPad app looks
      unfinished.
- [ ] **App name, subtitle, keywords, description, promotional text.**
- [ ] **Privacy policy URL** — required even though the app collects nothing. One
      short page saying so is enough.
- [ ] **Support URL.**
- [ ] **Age rating** questionnaire. Note: several album titles and genre notes discuss
      drug use, racism and violence in historical context. Answer honestly; this is
      most likely 12+ for "Infrequent/Mild Mature/Suggestive Themes".
- [ ] **App Privacy** section in App Store Connect: *Data Not Collected*. The bundled
      `PrivacyInfo.xcprivacy` already declares no tracking and `UserDefaults` reason
      `CA92.1`.
- [ ] **Export compliance**: `ITSAppUsesNonExemptEncryption` is already `false` in
      `Info.plist`.
- [ ] Archive, validate, upload, TestFlight yourself before submitting.

### 5. Things I would consider before 1.0

- [ ] **Third-party content review.** The app links out to Spotify search and direct
      public Apple Music/NetEase album pages. Only catalog identifiers and matching
      metadata are stored; no third-party audio or artwork is bundled.
- [ ] **The NetEase hand-off** uses `orpheus://album/<id>` for verified records and
      the official `y.music.163.com/m/album` page when the app is absent. Verify
      both branches on a physical device with and without NetEase installed.
- [ ] **An icon a designer has seen.** The current one is drawn programmatically by
      `build/icon/main.swift` — the rail plus four family-coloured branches. It is
      coherent and on-brand, and it is not a designed icon.
- [ ] **Launch screen** is a plain colour. Fine, but a wordmark would be better.
- [ ] **Search should probably cover albums too**, not just genres. The core already
      indexes them; it is a small addition to `Library.search`.

### 6. Deliberately not done

- **No landscape.** You asked for portrait, and the Rail is built around a vertical
  time axis; supporting landscape would mean a second layout for no gain.
- **No audio playback.** That needs the Spotify or MusicKit SDKs, an account model and
  a licensing conversation. External catalog destinations are the honest version.
- **No iCloud sync of listening progress.** Progress keys already use the same
  `"pathID:albumID"` scheme as the web app's `localStorage`, so adding
  `NSUbiquitousKeyValueStore` later needs no migration.
- **No widgets, no Shortcuts, no Watch app.**
- **Chinese covers the interface, genre names and one-line summaries only.** The long
  prose — genre summaries, musical traits, ear markers, key figures, all album notes —
  is English in both apps. This is stated in Settings rather than hidden. Translating
  it properly is roughly 60,000 words and needs someone who knows the music.
