# JazzTree

A visual guide to 39 jazz genres, how they descend from and react against each
other, and about 350 records to actually listen to.

Static site. No build step, no npm install, no framework. `index.html` opens and
works from `file://`.

---

## Run it

Just open the file:

```bash
open index.html
```

That works because `data/data.js` carries the same data as the JSON files, for the
case where Chrome blocks `fetch` of local files. If you would rather serve it:

```bash
python3 -m http.server 8787
```

then visit <http://localhost:8787>. D3 v7 loads from jsDelivr with
`vendor/d3.v7.min.js` as an automatic offline fallback, so the site works with no
network at all.

---

## What is where

```
index.html            the app shell; embeds static.html in a <noscript> block
static.html           GENERATED — the whole guide as one plain page, no JS

css/theme.css         design tokens: colour, type scale, dark + light themes
css/main.css          shell, cards, side panel, paths, responsive rules
css/graph.css         the DAG and timeline

js/main.js            boot, tab switcher, masthead, keyboard shortcuts
js/store.js           the entire application state (~90 lines, plain object
                      plus subscribers). Views subscribe; nothing reads state
                      out of DOM attributes.
js/data.js            loads the JSON, falls back to window.__JAZZ_DATA__
js/lib/layout.js      the deterministic layered DAG layout + edge paths
js/lib/links.js       streaming search-URL generation
js/lib/utils.js       DOM helpers, formatting, live-region announcements
js/views/graph.js     the lineage DAG (the centrepiece)
js/views/timeline.js  Gantt view, no edges
js/views/grid.js      searchable genre cards; the mobile landing view
js/views/paths.js     the three curated listening routes
js/views/panel.js     the slide-in genre profile and the album card component

data/genres.json      39 genres + 103 lineage edges + families + eras
data/albums.json      351 albums
data/paths.json       3 listening paths
data/data.js          GENERATED from the three files above, for file:// use
data/build-data.js    regenerates data/data.js
data/validate.js      the dataset validator — run this after any data edit

build/                authoring fragments + the verification scripts
  genres-*.json         hand-authored genre fragments
  albums-*.json         hand-authored album fragments
  lineage.json          hand-authored lineage edges
  merge.js              merges the fragments into data/*.json
  gen-static.js         regenerates static.html
  verify-musicbrainz.js cross-checks every album against MusicBrainz
  verify-retry.js       second, looser pass over the misses
  mb-*.json / *.txt     GENERATED verification output

research/notes.md     sources, the verification log, and Known gaps
DECISIONS.md          every judgment call and its counter-argument
vendor/d3.v7.min.js   offline D3 fallback
```

---

## Editing the data

`data/genres.json`, `data/albums.json` and `data/paths.json` are the source of
truth and are meant to be hand-corrected. They are deliberately kept out of the
JavaScript.

**After any edit, run:**

```bash
node data/validate.js && node data/build-data.js && node build/gen-static.js
```

Or in one go:

```bash
npm run data
```

`validate.js` exits non-zero on any error. It checks that the lineage graph is
acyclic, that every genre has exactly one gateway album and 4–6 core / 3–4 deep,
that every `aspects` value is in the closed vocabulary, that `hingeAlbum` and path
album references resolve, that `released` is never before `recorded`, and about a
dozen other things. Full list in `research/notes.md` §6.

`build-data.js` regenerates `data/data.js`; `gen-static.js` regenerates
`static.html`. Neither should ever be hand-edited.

### The `build/` fragments

The genre and album data was authored as fragments under `build/` and merged with
`node build/merge.js`. If you are making corrections, **edit `data/*.json`
directly and do not re-run the merge** — it would overwrite your changes with the
fragments. The fragments are kept because they are the readable authoring format
and they document the ID-correction map that was applied.

### Re-running verification

```bash
node build/verify-musicbrainz.js   # ~7 min; respects MusicBrainz's 1 req/sec
node build/verify-retry.js         # ~2 min; looser matching over the misses
```

Both write JSON reports plus a human-readable summary of everything that needs
review. What the last run found is written up in `research/notes.md` §1 and §3.

---

## The graph

X is time, from a `d3-scaleTime` year scale — a genre's capsule literally spans
its active years, and the solid block along the bottom marks its peak. Y comes
from a layered, Sugiyama-style pass in `js/lib/layout.js`: genres are grouped into
four family swimlanes, ordered within each lane by a barycentre sweep, packed into
rows so no two capsules that overlap in time share a row, then refined by trying
alternative rows and keeping the moves that reduce edge crossings.

**There is no physics anywhere.** No `d3-force`, no `d3-hierarchy`, no `d3-dag`.
The layout is a pure function of the data: the same input produces byte-identical
coordinates on every load. A force layout would scatter nodes off their years and
destroy the time axis, which is the entire point of the visualisation.

D3 is used for `d3-scale`, `d3-shape`, `d3-zoom`, `d3-selection` and `d3-axis`.

### What you can do with it

| | |
| --- | --- |
| **Hover a genre** | Immediate parents and children light up, the wider lineage dims to 45%, everything else to 12%. Labels appear on the connecting edges showing what was inherited. |
| **Click a genre** | Side panel: what it sounds like, how it works, who made it, what is disputed about it, and its three album tiers. |
| **Click an edge** | Popover with what specifically carried over, what was deliberately changed, and a link to the record where the shift is audible. |
| **Aspect filter** | Nine toggles — harmony, rhythm, form, instrumentation, improvisation, timbre, repertoire, social context, technology. Turn on "rhythm" and only the influences that passed on rhythm remain. |
| **Time scrubber** | Drag the year handle and the graph grows from 1890 forward — capsules clip at the current year, unborn genres ghost out. |
| **Zoom / pan / fit / reset** | Scroll or pinch to zoom, drag to pan, ⤢ to fit everything, ⟲ to reset. |

### Keyboard

| Key | |
| --- | --- |
| `Tab` | into the graph, then between genres |
| `↑` `↓` | previous / next genre |
| `←` `→` | jump to a parent / a child |
| `Enter` | open the genre profile |
| `Esc` | close the panel or popover |
| `[` `]` | previous / next view |
| `/` | jump to the genre search |

---

## Other views

- **Timeline** — every genre as one bar, no edges, grouped by family. Good for
  scanning eras.
- **Genres** — all 39 as cards, searchable across names, figures, labels, cities
  and ear-markers; sortable by era, name, family or difficulty. This is the
  landing view below 760px, where the DAG is unreadable without pinch-zooming; a
  button offers the graph explicitly.
- **Paths** — three ordered listening routes, each step with a sentence explaining
  why that record follows the one before. Progress is stored in `localStorage`.

**Gentle path** (in the masthead) hides difficulty-4 and 5 records everywhere.

---

## Streaming links

Every album card has three buttons — Spotify, Apple Music, NetEase Cloud Music —
generated at runtime from artist and title:

```js
const q = encodeURIComponent(`${artist} ${title}`);
`https://open.spotify.com/search/${q}`
`https://music.apple.com/us/search?term=${q}`
`https://music.163.com/#/search/m/?s=${q}`
```

These are **searches, not direct album links**, deliberately. Album IDs on these
services are opaque strings that cannot be derived from metadata; a guessed ID
resolves confidently to the wrong record. Pick a default service in the masthead
and it is remembered and shown first.

---

## Accuracy

The dataset was written from prior knowledge and then tested against external
sources — 279 of 351 albums had their release year confirmed to within a year by
an automated MusicBrainz cross-check, and the cases where the check found the data
**wrong** are listed with their corrections in `research/notes.md` §3.

Every album carries a `confidence` field (`high` / `medium` / `low`), shown on the
card when it is not `high`; every `low` entry carries a note saying which field is
shaky, and the validator enforces that. Every genre carries a `contested` field
describing where scholars disagree, because genre boundaries are arguments, not
facts.

`research/notes.md` ends with a **Known gaps** section listing what could not be
verified, what is missing from the coverage, and what could not be checked at all.
Read it before citing anything.

---

## Licence and credit

The dataset and the code are original work for this project. No external dataset
was reused, so there is nothing to attribute — see `research/notes.md` §2 for the
open datasets that were evaluated and why none of them fit.

D3 is BSD-3-Clause, © Mike Bostock. MusicBrainz data (used only to verify, never
reproduced) is CC0.
