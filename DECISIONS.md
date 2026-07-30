# DECISIONS.md

Every judgment call, and why. Where a decision is contestable, the counter-argument
is stated rather than buried.

---

## 1. The genre list

The brief supplied 37 genres. The shipped list has **39**. Three changes:

### Split: "Cool Jazz / West Coast" → `cool-jazz` + `west-coast`

The brief bundled these. They are commonly bundled. I split them because they are
two different things that happen to share a temperature:

- **Cool jazz** is the New York nonet-and-Tristano lineage — the 1949–50 Miles
  Davis nonet sessions, Gil Evans' arranging, Lennie Tristano's school, Lee
  Konitz. Its defining move is *written contrapuntal arrangement* replacing
  head-and-blow.
- **West Coast jazz** is the Los Angeles studio-musician scene from 1952 — the
  piano-less Mulligan quartet, Shorty Rogers' Giants, Shelly Manne, the Lighthouse.
  Its defining move is the *piano-less small group implying harmony through two
  horns*, and an economy where the players had day jobs scoring film.

They are connected — the graph carries a strong `cool-jazz → west-coast` edge —
but merging them makes the nonet and the Lighthouse the same event, and it makes
the West Coast entry's `contested` field (whether the label names a style or a
postcode) impossible to state.

**Against:** personnel overlap heavily, and many writers, including sympathetic
ones, treat "West Coast jazz" as a marketing geography rather than a style. The
genre's `confidence` is set to `medium` for exactly this reason.

### Added: `free-funk` (Free Funk & Harmolodics)

Not in the brief. Added because without it the graph tells a lie by omission:
`downtown` and `m-base` both appear to descend from free jazz and funk with no
intermediate step, when in fact Ornette Coleman's Prime Time (from 1975), Ronald
Shannon Jackson's Decoding Society and James Blood Ulmer did the specific work of
putting free melodic playing over a hard electric backbeat, and everyone
downstream knew it. It is a real node with a real repertoire, not padding.

**Against:** harmolodics is one man's theory, explained inconsistently by him and
described incompatibly by the musicians who played it. The genre entry says so,
and its `confidence` is `medium`.

### Renamed: "Gypsy Jazz" → **Jazz Manouche**

"Gypsy" is widely considered a slur by Romani people; "jazz manouche" is the term
used in France and by many players. "Gypsy jazz" is retained in `aka` because it
is what most English-language sources use and people will search for it.

### Considered and rejected

- **Boogie-woogie** — a blues piano idiom that fed jazz rather than a jazz genre.
  Its absence is defensible; its presence would have needed New Orleans R&B too.
- **Ragtime revival (1970s)** as a separate node — handled instead inside the
  `ragtime` entry, whose `deep` tier is largely revival recordings, since the
  revival produced no new style.
- **Merging `hard-bop` and `soul-jazz`** — the brief flagged the continuum, and
  several writers do merge them. Kept separate at the point where the Hammond
  organ trio and the R&B backbeat stop being flavours and become *the format*.
  Both entries say so in `contested`.
- **A separate "Jazz-Rock" node distinct from "Fusion"** — some writers use
  jazz-rock for the aggressive 1969–74 wing and fusion for what followed. Kept as
  one node with both names in `aka`; the split is a periodisation, not a
  structural difference.

### Genres kept despite doubts about whether they are genres at all

`spiritual-jazz`, `loft-jazz`, `j-jazz`, `m-base`, `ecm-nordic`,
`contemporary-creative` and `downtown` are all, to varying degrees, categories
constructed after the fact by compilers, critics or grant committees rather than
by musicians. All seven are kept, and every one states the objection in its
`contested` field. In the M-Base case the objection comes from Steve Coleman
himself, who has said repeatedly that M-Base is a concept and a way of working,
not a style — the entry says that plainly and notes that including it as a node
is a framing he would reject.

---

## 2. Families and swimlane order

Four families: `trad-mainstream`, `avant`, `electric`, `global`.

Two judgment calls worth flagging:

- **`third-stream` and `ecm-nordic` are filed under `avant`**, which is labelled
  "Avant-Garde & Composed" rather than "Avant-Garde" for that reason. Neither is
  avant-garde in the free-jazz sense; both belong to the composed/art-music wing,
  and giving them a fifth swimlane with two members would have wasted vertical
  space in an already tall graph.
- **The swimlane order on the DAG is `avant → trad-mainstream → global →
  electric`, which is not the narrative order.** This was measured, not guessed.
  All 24 orderings were run through the layout and scored by edge crossings:

  | Order | Crossings |
  | --- | ---: |
  | avant → mainstream → global → electric *(shipped)* | **533** |
  | avant → mainstream → electric → global | 564 |
  | global → electric → mainstream → avant | 560 |
  | mainstream → global → avant → electric | 662 |
  | mainstream → avant → electric → global *(narrative order)* | 694 |

  The mainstream sits in the middle because nearly everything connects to it;
  putting it at an edge forces long edges across the whole picture. That is a
  23% reduction in crossings for a cost of a slightly odd reading order, and the
  brief is explicit that readability wins. The **Timeline** and **Genres** views
  have no edges and therefore use the narrative order
  (`mainstream → global → avant → electric`) — see `NARRATIVE_FAMILY_ORDER` in
  `js/lib/layout.js`.

---

## 3. Contested and interpretive lineage edges

103 edges. These are the ones a jazz historian might argue with, listed with the
argument:

| Edge | Type | The claim, and the objection |
| --- | --- | --- |
| `new-orleans → free-jazz` | parallel-influence | That collective simultaneous improvisation returning in 1960 is a New Orleans procedure coming back. **Marked as interpretation in the explanation**, though it is one Coleman and Ayler made themselves, and Ayler's use of marches and hymns makes it audible rather than merely arguable. |
| `new-orleans → aacm-avant` | revival-of | "Ancient to the Future" is the Art Ensemble's own framing; the edge takes them at their word. A sceptic would say the New Orleans material is quotation, not inheritance. |
| `kansas-city → soul-jazz` | parallel-influence | That the organ trio's riff-over-blues construction and nightly local economy are Kansas City procedures reappearing twenty years later. Explicitly labelled interpretation. |
| `west-coast → euro-free-improv` | parallel-influence, **weak** | Giuffre's 1961–62 trio anticipates quiet European improvisation. The explanation says the direct historical link is thin and the resemblance is not. |
| `west-coast → ecm-nordic` | parallel-influence, **weak** | Same shape of claim: family resemblance, poorly documented influence. Labelled interpretation. |
| `ethio-jazz → uk-jazz-revival` | parallel-influence, **weak** | Éthiopiques as common currency in London crate-digging, plus the 2009 Astatke/Heliocentrics record. Labelled interpretation. |
| `j-jazz → uk-jazz-revival` | parallel-influence, **weak** | The weakest edge in the graph, and says so: the BBE reissues landed in the same ecosystem, but direct musical influence is unproven. |
| `neo-bop → contemporary-creative` | parallel-influence | That the conservatory and festival infrastructure the Young Lions built is what trains and funds the generation that rejects their premises. Uncomfortable, and I think true. |
| `jazz-rap` as a jazz genre at all | — | Filed here on the grounds of what it sent *back* — the boom-bap feel is now standard jazz drumming vocabulary. The entry notes that claiming it risks the old habit of annexing Black popular music for jazz once it becomes respectable. |
| `swing → afro-cuban`, `bebop → afro-cuban` | fusion-of | Both parents begin later than or around the child (Machito's orchestra dates from 1940). The edges are dated to when the influence took hold (1943, 1947), which the layout renders as near-vertical connectors. `data/validate.js` warns about these four cases by design so they stay deliberate. |

**Non-jazz parents are not in the graph at all** — rock, funk, R&B, samba,
Afrobeat, Romani string-band practice, Ethiopian traditional music, hip-hop
production, Western art music. Every affected edge names the missing parent in
its explanation text (see `swing → manouche`, `modal → fusion`,
`afro-cuban → ethio-jazz`), but the graph still under-represents how much of this
music came from outside jazz. Recorded as a known gap in `research/notes.md`.

---

## 4. Album selection

- **Tiers are per-genre and per-*primary*-genre.** An album's first `genreIds`
  entry is its home; the panel shows that genre's own 1 gateway / 4–6 core /
  3–4 deep, and lists cross-filed albums separately under "also filed here".
  Without this rule, cross-listing inflated hard bop to ten "core" albums and gave
  two genres two gateways each. `data/validate.js` enforces the tier counts against
  the primary set.
- **Gateway is chosen for accessibility over canonicity**, per the brief. This is
  why ragtime opens with Joshua Rifkin's 1970 Nonesuch record rather than a piano
  roll, why free jazz opens with *The Shape of Jazz to Come* rather than *Free
  Jazz*, and why the AACM opens with *Les Stances à Sophie* — which has a bass
  line and a backbeat — rather than *Sound*.
- **Deliberately unfamous choices.** The brief warns against every genre having
  the same eight famous records. Counter-examples: Curtis Counce and Hampton Hawes
  under West Coast (a Black LA scene that the stereotype erases); Shirley Scott
  under soul jazz; Donald Lambert under stride; Getatchew Mekurya under ethio-jazz;
  Koichi Matsukaze under J-jazz; Phil Ranelin's Tribe record under spiritual jazz.
- **Records included because they are historically unavoidable rather than good.**
  *Doo-Bop*, Kenny G's *Breathless* and Spyro Gyra's *Morning Dance* are in the
  dataset with `whyThisOne` text that says exactly that. Leaving them out would
  have made the smooth jazz and jazz rap entries dishonest.
- **The Original Dixieland Jazz Band is included** with the fact that the first
  jazz record was made by a white band claiming to have invented the music stated
  plainly in `whyThisOne`, not softened.

---

## 5. Layout compromises

- **The graph is ~37 rows and about 1,100px tall at its natural scale.** Capsules
  that overlap in time cannot share a row, and 28 of 39 genres are still active,
  so almost everything overlaps at the right edge. Options were: shrink the type
  until it all fits, or keep the type legible and pan. Legibility won. There is a
  **fit-to-view** control (⤢) for people who want the whole shape at once, at the
  cost of small labels.
- **The layout does a barycentre sweep *and* a row-refinement pass**, because the
  standard alternating sweep converges almost immediately here — with nearly
  everything overlapping nearly everything, the interval-packing constraint
  dominates the ordering. The refinement pass tries every feasible row for each
  genre and keeps moves that reduce crossings. It costs ~4ms and buys about 2
  crossings; the lane ordering (section 2) is what does the real work. Both are
  fully deterministic: same data in, identical pixels out.
- **The legend lives in the control bar, not floating over the canvas.** It began
  as a bottom-left overlay and covered a lane label and four genres. With 39
  capsules there is no corner of this graph an overlay can sit in without hiding
  something, so it moved into the chrome and became collapsible. On screens under
  760px or shorter than 700px it starts collapsed.
- **Hover uses three tiers, not two.** The brief says "dim everything except that
  genre and its direct ancestors and descendants". Read as full transitive
  closure, hovering hard bop lights 32 of 39 genres, which communicates nothing.
  Shipped behaviour: immediate neighbours at full strength, the wider lineage at
  45%, everything else at 12%. "Direct" is read as "directly connected".
- **Era labels are dropped when their band is narrower than the text.** At 375px
  the six era names otherwise collide into an unreadable run of letters.
- **`revival-of` edges hook backwards** before turning forward, per the brief's
  "arcing backwards in time". A literal backward arc would have to end at the
  child, which is always to the right, so the backward gesture is at the source
  end where it reads as retrospection.

---

## 6. Accessibility choices

- **Colour is never the only signal.** Edge types carry a dash pattern *and* a
  colour *and* a marker shape (diamond for `fusion-of`, circle for `revival-of`);
  families carry a colour *and* a text label on the capsule, the card, and the
  swimlane. Difficulty is dots *and* a number *and* a word ("● ○○○○ easy listen").
- **Every genre is reachable by keyboard.** Tab into the graph, arrow up/down to
  move between genres, arrow left/right to jump to a parent or child, Enter to
  open the profile. Focus rings are drawn as an explicit SVG rect because
  `outline` does not render usefully on SVG groups.
- **The content is not JavaScript-gated.** `static.html` is generated from the
  same JSON by `node build/gen-static.js` and contains every genre, every album,
  every source note as plain HTML. `index.html` embeds it in a `<noscript>` block,
  so with scripting off the whole guide renders — and browsers do not fetch it
  when scripting is on, so it costs nothing in the normal case.
- **Live-region announcements** fire for state changes that move no focus: opening
  a profile, applying an aspect filter, filtering the grid, toggling gentle path.

---

## 7. Streaming links

Search URLs only, generated at runtime from artist + title, exactly as the brief
specifies. Spotify, Apple Music and NetEase album IDs are opaque strings that
cannot be derived from metadata; writing them from memory produces links that go
confidently to the wrong record. All three URL patterns were checked and return
200. The preferred service is persisted in `localStorage` and rendered first.

No embeds, for the same reason.

---

## 8. Data-shape decisions

- **`era.end: null` means "still going"**, rendered to a `present` value of 2027
  held in `data/genres.json` under `meta.present`. Change it in one place.
- **Path steps carry an explicit `year`** separate from the album's `recorded`
  year, because "Start Here" and "The Full Arc" are ordered by the *music's*
  period, and a 1970 recording of Scott Joplin belongs at 1899 in that sequence.
  The validator checks chronology against `year`, not `recorded`.
- **`data/data.js` is generated, never hand-edited.** The three JSON files are the
  source of truth; `node data/build-data.js` regenerates the `window.__JAZZ_DATA__`
  bundle used when `fetch` is blocked under `file://`. Verified working: with
  `fetch` forced to fail, all 39 genres, 351 albums and 3 paths still load.
- **`build/*.json` fragments are the authoring format**, merged by
  `node build/merge.js` into `data/genres.json` and `data/albums.json`. If you are
  hand-correcting the data, edit `data/*.json` directly and skip the merge — see
  README.
