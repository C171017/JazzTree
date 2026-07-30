# Build Prompt — "JazzTree": A Jazz Genre Lineage & Listening Guide

> Paste everything below the line into Claude Code (Opus recommended) as a single task.
> Give it write access to an empty project directory.

---

## ROLE

You are a senior front-end engineer *and* a jazz musicologist. You are building a
single, self-contained, static website called **JazzTree**: a comprehensive visual
guide to jazz genres, their historical lineage, and what to actually listen to.

Work autonomously to completion. Do not stop to ask me questions. Where a detail
is unspecified, make the choice a careful specialist would make and note it in
`DECISIONS.md`.

---

## PHASE 0 — NON-NEGOTIABLE ACCURACY RULES

Read this section twice. Factual accuracy is the primary success criterion of this
project; the code is the easy part.

1. **Never invent a discography detail.** Album titles, recording years, release
   years, labels, and sideman personnel must be verified against real sources
   before they enter the dataset.
2. **Two-source rule.** Every album entry must be corroborated by at least two
   independent sources (see PHASE 1). If you cannot corroborate it, either drop
   the album or set `"confidence": "low"` and add a `"note"` explaining what is
   uncertain.
3. **Distinguish recording year from release year.** These differ constantly in
   jazz (Blue Note sat on sessions for years; *Money Jungle*, most Mingus
   Candid material, half the Mosaic boxes). Store both. Sort lineage by
   *recording* year.
4. **Never fabricate a streaming ID.** Do not write Spotify album IDs, Apple
   Music IDs, or NetEase song IDs from memory — they will be wrong. Use the
   search-URL scheme specified in PHASE 3.
5. **Genre boundaries are contested, not factual.** Where scholars disagree
   (is *Kind of Blue* modal or post-bop? is ECM a genre or a label aesthetic?),
   say so in the genre's `contested` field rather than asserting a clean answer.
6. If a claim is your own interpretation rather than an established one, mark it
   as interpretation in the prose. Do not launder opinion as consensus.

---

## PHASE 1 — RESEARCH (do this before writing any code)

Search the web and gather real material. Prioritize, roughly in this order:

- **Structured/aggregated data already on the web** — look for existing
  open datasets and repos before hand-rolling anything. Search terms worth
  trying: `jazz genre taxonomy dataset github`, `music genre lineage JSON`,
  `Ishkur music genre guide data`, `MusicBrainz jazz genre hierarchy`,
  `Every Noise at Once jazz`, `discogs jazz style taxonomy`,
  `awesome jazz github`. Reuse anything with a permissive license; credit it.
- **Canonical album lists** — the Penguin Guide to Jazz "Core Collection"
  crowns, the *Down Beat* Hall of Fame, NPR's Jazz 100, Blue Note / Impulse! /
  ECM catalog listings, AllMusic genre pages and their "album highlights".
- **Musicological framing** — Wikipedia genre articles (use their cited
  sources, not the summaries), *Grove Music Online* if reachable, Ted Gioia's
  *The History of Jazz* structure, the AACM / M-Base / loft-jazz literature.
- **Per-album facts** — Discogs and MusicBrainz release pages for label,
  catalog number, recording date, personnel.

Save your raw findings as `research/notes.md` with a source URL beside every
non-obvious claim. This file is a deliverable — I want to be able to audit you.

**Record what you could not verify.** A short "Known gaps" section at the end of
`research/notes.md` is worth more to me than false completeness.

---

## PHASE 2 — THE DATASET

Produce `data/genres.json` and `data/albums.json`. These are separate from the
code so I can hand-correct them later without touching JavaScript.

### Scope

Target **35–40 genres**. Use the list below as your starting scope. Verify it,
merge anything you judge redundant, split anything you judge conflated, and add
what's missing — but document every change in `DECISIONS.md`.

*Precursors & early:* Ragtime · New Orleans/Dixieland · Chicago Jazz · Stride
Piano · Kansas City Jazz · Swing & Big Band · Gypsy Jazz (Jazz Manouche) ·
Vocal Jazz / Songbook

*Modern jazz core:* Bebop · Cool Jazz / West Coast · Hard Bop · Soul Jazz &
Organ Trio · Modal Jazz · Third Stream · Post-Bop

*Global currents:* Afro-Cuban & Latin Jazz · Bossa Nova & Brazilian Jazz ·
Ethio-Jazz · J-Jazz (Japanese jazz) · European free improvisation

*The break:* Free Jazz · Avant-Garde / AACM & Great Black Music ·
Spiritual Jazz · Loft Jazz

*Electric & crossover:* Jazz Fusion / Jazz-Rock · Jazz-Funk · Smooth Jazz ·
Acid Jazz · Jazz Rap / Hip-Hop Jazz · Nu Jazz & Electronic Jazz

*Chamber & European:* ECM / Nordic & Chamber Jazz

*Since 1980:* Neo-Bop / Young Lions · M-Base · Downtown / Punk Jazz ·
Contemporary Creative / Modern Jazz · UK Jazz Revival (2010s London) ·
LA Beat-Scene Jazz (Brainfeeder orbit)

### `data/genres.json` schema

```jsonc
{
  "id": "hard-bop",                    // kebab-case, stable
  "name": "Hard Bop",
  "aka": ["Funky hard bop"],
  "era": { "start": 1954, "peak": [1957, 1965], "end": null },  // null = ongoing
  "origin": { "city": "New York / Detroit / Philadelphia", "country": "USA" },
  "oneLine": "Bebop with the blues and gospel put back in — heavier, slower, groovier.",
  "summary": "150–250 words. Plain language first, terminology second. What it sounds like BEFORE what it is historically.",
  "musicalTraits": {
    "harmony": "…",                    // each 1–2 sentences, concrete
    "rhythm": "…",
    "form": "…",
    "instrumentation": "…",
    "improvisation": "…",
    "timbre": "…"
  },
  "earMarkers": [                      // 3–5 things a novice can literally hear
    "Drummer plays a hard backbeat on 2 and 4, not just ride-cymbal swing",
    "Gospel-style church chords in the piano comping"
  ],
  "keyFigures": [{ "name": "Art Blakey", "instrument": "drums", "why": "…" }],
  "keyLabels": ["Blue Note", "Prestige", "Riverside"],
  "contested": "Some writers treat hard bop and soul jazz as one continuum; …",
  "confidence": "high"
}
```

### Lineage edges — `lineage` array inside `genres.json`

**Jazz lineage is a directed acyclic graph, not a tree.** Genres routinely have
multiple parents (fusion ← modal jazz + rock + funk). Model it that way. Do not
force a single-parent hierarchy.

```jsonc
{
  "from": "bebop",
  "to": "hard-bop",
  "type": "direct-descendant",   // direct-descendant | reaction-against | fusion-of | parallel-influence | revival-of
  "year": 1954,                  // approx. year the influence took hold
  "aspects": ["harmony", "repertoire", "improvisation"],  // WHAT was inherited
  "explanation": "1–3 sentences: what specifically carried over, and what was deliberately changed. Name a recording that shows the hinge.",
  "hingeAlbum": "album-id",      // optional, the record where the shift is audible
  "strength": "strong"           // strong | moderate | weak
}
```

`aspects` must come from this closed vocabulary so the UI can filter on it:
`harmony`, `rhythm`, `form`, `instrumentation`, `improvisation`, `timbre`,
`repertoire`, `social-context`, `technology`.

The `reaction-against` edge type matters — a lot of jazz history is rejection,
not inheritance (cool jazz vs. bebop's heat; neo-bop vs. fusion). Use it.

### `data/albums.json` schema

Per genre, provide albums in **three listening tiers**:

- `gateway` — exactly **1** album. The one you hand someone who has never heard
  this genre. Accessibility beats canonicity here.
- `core` — **4–6** albums. The canon. What "representative of the genre" means.
- `deep` — **3–4** albums. For after they're hooked: outliers, late-period,
  non-American, or the record that broke the genre open into the next one.

```jsonc
{
  "id": "moanin-1959",
  "genreIds": ["hard-bop"],        // array — albums can belong to more than one
  "tier": "gateway",
  "artist": "Art Blakey & The Jazz Messengers",
  "title": "Moanin'",
  "recorded": 1958,
  "released": 1959,
  "label": "Blue Note",
  "catalogNo": "BLP 4003",
  "personnel": ["Lee Morgan (tp)", "Benny Golson (ts)", "Bobby Timmons (p)", "Jymie Merritt (b)", "Art Blakey (d)"],
  "whyThisOne": "2–3 sentences. Why THIS record for THIS genre.",
  "listenFor": "1–2 sentences. A concrete, hearable instruction. 'The piano's call-and-response with the horns in the opening head is a gospel church trope moved wholesale into jazz.'",
  "startTrack": "Moanin'",
  "difficulty": 1,                 // 1 easy listen → 5 demanding
  "confidence": "high"
}
```

`difficulty` powers a "gentle path" mode — do not skip it.

### Listening paths — `data/paths.json`

Three curated ordered routes through the whole site:

1. **"Start here" (12 albums)** — chronological, difficulty ≤ 2, one per major era.
2. **"The full arc" (30 albums)** — the historical spine, ragtime → today.
3. **"Into the deep end" (15 albums)** — free, spiritual, avant-garde, sequenced
   so each record prepares the ear for the next.

Each path step gets a one-sentence bridge explaining why this record follows the
previous one.

---

## PHASE 3 — STREAMING LINKS

Three services, **search deep-links only, no hardcoded IDs**. Generate at runtime
from artist + title:

```js
const q = encodeURIComponent(`${artist} ${title}`);
spotify: `https://open.spotify.com/search/${q}`
appleMusic: `https://music.apple.com/us/search?term=${q}`
netease: `https://music.163.com/#/search/m/?s=${encodeURIComponent(artist + ' ' + title)}`
```

Render as three small icon buttons on every album card. Let the user pick a
default service (persisted in `localStorage`) so their preferred one is shown
first. `target="_blank" rel="noopener noreferrer"` on all of them.

Do not attempt Spotify iframe embeds — they need verified album IDs, and you
will hallucinate them.

---

## PHASE 4 — THE VISUALIZATION

The centerpiece is a **time-anchored lineage DAG**. This is decided; do not
substitute a force-directed blob or a strict family tree.

**Do not use `d3-force`.** No physics simulation anywhere in this project. Node
positions must be computed deterministically and be identical on every page
load: x from a `d3-scaleTime` year scale, y from the layered pass described
below. A force layout would destroy the time axis, which is the entire point of
this visualization. You are using `d3-scale`, `d3-shape`, `d3-zoom`,
`d3-selection`, and `d3-axis` — not `d3-force`, not `d3-hierarchy`, not `d3-dag`.

**Layout**
- X axis = time, 1890 → present, with decade gridlines and era bands
  (Trad · Swing · Modern · The Break · Electric · Postmodern) as soft
  background shading.
- Each genre is a horizontal **capsule** spanning its active years. Width is
  meaningful. Vertical position is assigned by a layered/Sugiyama-style pass
  that minimizes edge crossings — genres are grouped into rough "families"
  (acoustic-mainstream / avant-garde / electric-crossover / global) as
  swimlanes, then packed within them.
- Influence edges are **curved paths** from parent's active span to child's
  start point.
  - `direct-descendant` → solid
  - `fusion-of` → solid, thicker, converging
  - `reaction-against` → dashed, distinct colour
  - `parallel-influence` → dotted, low opacity
  - `revival-of` → solid with a curve arcing backwards in time
  - Edge thickness encodes `strength`.

**Interaction**
- Hover a genre → dim everything except that genre and its direct ancestors and
  descendants; edge labels appear showing the inherited `aspects`.
- Click a genre → side panel slides in with the full genre profile, ear markers,
  and its three album tiers.
- Click an edge → small popover with the `explanation` and a link to the
  `hingeAlbum`.
- **Aspect filter** — a row of toggles (harmony / rhythm / form / …). Turning on
  "rhythm" shows only edges where rhythm was inherited. This is the single most
  interesting feature on the site; make it work well.
- **Time scrubber** — drag a year handle; genres not yet born are ghosted out.
  Watching the graph grow from 1900 forward is the "wow" moment.
- Zoom + pan (d3-zoom), with a "reset view" control.

**Secondary views** (tab switcher, same dataset)
- **Timeline** — a denser Gantt-style chart, no edges, good for scanning eras.
- **Grid** — all genres as cards, sortable by era / difficulty / family,
  searchable. This is the mobile-primary view.
- **Paths** — the three curated listening routes as vertical stepper lists with
  checkboxes; progress saved to `localStorage`.

**Mobile:** the DAG does not work at 375px. Below ~720px, default to the Grid
view and offer the DAG behind a "view lineage" button with pinch-zoom. Do not
ship a squashed unreadable graph.

**Accessibility:** every genre reachable by keyboard (tab + arrow keys), visible
focus rings, `aria-label` on all SVG nodes, and a `<noscript>`-safe static list
of genres and albums so the content is not JS-gated. Colour must never be the
only signal — pair every colour distinction with a shape, dash pattern, or label.

---

## PHASE 5 — TECH STACK (decided — build exactly this)

- **Vanilla HTML + CSS + JavaScript (ES modules). No build step, no npm, no
  framework.** `index.html` must open and fully work from `file://`.
- **D3 v7** for the DAG, timeline, scales, and zoom — via CDN
  `<script src="https://cdn.jsdelivr.net/npm/d3@7">`, with a local vendored copy
  in `vendor/d3.v7.min.js` as fallback so the site works offline.
- **No other dependencies.** Write the layered layout yourself; d3-dag is not
  worth the fragility here.
- **CSS:** hand-written, custom properties for theming, CSS Grid + Flexbox.
  No Tailwind, no CSS framework.
- **State:** one small central `store.js` (plain object + subscriber callbacks).
  ~60 lines. Every view subscribes and re-renders. Do not scatter state across
  DOM attributes.
- **Data:** `fetch()` the JSON files. Because `file://` blocks `fetch` in Chrome,
  also emit `data/data.js` which assigns the same data to `window.__JAZZ_DATA__`,
  and fall back to it if `fetch` throws. Generate it from the JSON with a small
  Node script so there is one source of truth.

### Design direction

Dark, warm, print-inspired — the visual language of Reid Miles' Blue Note covers
and ECM's Scandinavian minimalism, not "generic dark-mode dashboard."
Deep charcoal ground, one warm accent (ochre / oxblood), generous whitespace,
a strong serif for genre names and headings, clean sans for body and UI.
Type is doing the work; keep chrome minimal. Include a light theme toggle.

### File structure

```
index.html
css/  main.css  graph.css  theme.css
js/   main.js  store.js  data.js
      views/  graph.js  timeline.js  grid.js  paths.js  panel.js
      lib/    layout.js  links.js  utils.js
data/ genres.json  albums.json  paths.json  data.js
      build-data.js
vendor/ d3.v7.min.js
research/ notes.md
DECISIONS.md
README.md
```

---

## PHASE 6 — SELF-VERIFICATION (do not skip)

Before you tell me you're done:

1. **Validate the data.** Write and run `data/validate.js` (Node) that checks:
   every `lineage.from`/`to` resolves to a real genre id; the graph is acyclic;
   every genre has ≥ 8 albums across the three tiers and exactly one `gateway`;
   every album has artist, title, recorded, label; no duplicate ids; every
   `aspects` value is in the closed vocabulary. Fix everything it reports.
2. **Spot-check 10 albums** at random against a live source and correct any
   errors. Log what you checked in `research/notes.md`.
3. **Open the site in a browser and look at it.** Screenshot the DAG at
   1440px and at 375px. If edges cross into illegibility or text overflows,
   fix the layout and re-check. Repeat until it reads cleanly.
4. **Click through:** every tab, the aspect filter, the time scrubber, three
   genre panels, one path, and one streaming link per service. Check the
   browser console is free of errors.
5. **Sanity-check the history.** Read the lineage edges end to end as a
   narrative. If the graph implies something a jazz historian would object to,
   fix it.

---

## DELIVERABLES

The working site, plus:
- `README.md` — how to run it, how to edit the data, where each thing lives.
- `DECISIONS.md` — every judgment call: genres added/merged/dropped and why,
  contested lineage edges, layout compromises.
- `research/notes.md` — sources, with a "Known gaps" section.

Finish with a short summary of: what you built, what you're least confident
about factually, and the three things you'd improve next.

---

## ANTI-PATTERNS — do not do these

- Do not produce a genre list padded to 40 with near-duplicates.
- Do not write summaries that are Wikipedia's first paragraph reworded.
- Do not use "seminal", "quintessential", "iconic", "tapestry", "testament to",
  or "at its core". Write like a person who actually listens to this music.
- Do not put 60 albums on screen at once. Progressive disclosure.
- Do not let every genre's album list be the same eight famous records.
- Do not make the graph pretty at the expense of readable. If a layout choice
  forces a trade-off, readability wins.
