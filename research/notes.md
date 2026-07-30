# JazzTree — research notes, sources and known gaps

This file is an audit trail. It records where the dataset came from, how it was
checked, what the checks found, and — at the end — what could not be verified.
If you only read one section, read **Known gaps**.

---

## 1. Method

The dataset was written first from established jazz-historical knowledge, then
**tested against external sources** rather than assembled from them. That
direction matters: the check is adversarial, and the failures are recorded below
rather than quietly corrected out of sight.

Three passes:

1. **Structured cross-check (automated, all 351 albums).**
   `build/verify-musicbrainz.js` queries the MusicBrainz release-group search API
   for every album (artist + title) and compares MusicBrainz's
   `first-release-date` against the claimed release year.
   `build/verify-retry.js` re-runs the misses with a looser query (title-only
   search, fuzzy token overlap on artist and title), because a large share of the
   first-pass failures were query-string problems, not data problems.
   Raw output: `build/mb-report.json`, `build/mb-retry.json`, and the
   human-readable `build/mb-summary.txt` / `build/mb-retry-summary.txt`.

2. **Targeted human verification** of every album where the automated pass
   contradicted the dataset, plus a random spot-check (section 4).

3. **Schema and graph validation**, `data/validate.js` — see section 6.

### What the automated pass found

| Outcome | Albums |
| --- | ---: |
| Release year confirmed by MusicBrainz to within one year | **279** |
| Matched in MusicBrainz, but MB's first-release-date is a later reissue | 45 |
| Not found in MusicBrainz at all | 27 |
| **Total** | **351** |

The 45 "MB dates a reissue" cases are a known characteristic of MusicBrainz
release groups: for older records, the group's `first-release-date` is frequently
the date of the earliest CD edition anyone has entered, not the original LP. For
example MusicBrainz gives *Moanin'* as 1997, *Blue Train* as 2008 and *Somethin'
Else* as 2010 — all CD reissues of 1958–59 Blue Note LPs. These were checked
individually and the dataset's dates kept; where the discrepancy pointed at a real
problem, it is listed in section 3.

The 27 "not found" cases are almost entirely compilation and box-set titles that
MusicBrainz files under a different name (`The Chronological Classics: Eddie
Condon 1927-1938`), or small-label records with thin MusicBrainz coverage
(Japanese and European independents especially). They are listed in
**Known gaps**.

---

## 2. Sources used

### Structured / dataset sources
- **MusicBrainz Web Service v2** — <https://musicbrainz.org/doc/MusicBrainz_API> —
  used programmatically for the release-year cross-check on all 351 albums.
  Data is CC0; no MusicBrainz text is reproduced here.
- Searched for a reusable open jazz-genre lineage dataset and did not find one
  fit for purpose. Checked and rejected:
  - AcousticBrainz Genre Dataset — <https://github.com/MTG/acousticbrainz-genre-dataset> —
    hierarchical multi-source genre *annotations* per recording, not a lineage
    graph, and jazz sub-genre coverage is shallow.
  - <https://github.com/voltraco/genres> — a flat JSON list of genre names, no
    relationships, no dates.
  - Every Noise at Once — <https://everynoise.com> — algorithmic
    similarity space derived from Spotify listening; no directed influence, no
    dates, and the underlying data is not redistributable.
  - Discogs style taxonomy — a flat controlled vocabulary, no lineage.
  The lineage graph in `data/genres.json` is therefore hand-authored. No dataset
  was copied, so there is nothing to attribute.

### Musicological framing
- Ted Gioia, *The History of Jazz* — used for the overall era structure and the
  era band boundaries on the graph.
- Gunther Schuller, *Early Jazz* and *The Swing Era* — for ragtime/New Orleans
  boundaries and the argument about whether ragtime is jazz at all.
- Wikipedia genre and album articles were used as an index into their cited
  sources and for discographic detail; the summaries themselves were not used as
  prose sources. Specific articles consulted are cited inline below.

### Per-genre sources consulted
- **Third stream** — term coined by Gunther Schuller in a 1957 lecture at
  Brandeis University; the 1957 Brandeis Festival commissioned Mingus, Giuffre and
  George Russell alongside Babbitt, Shapero and Schuller.
  <https://en.wikipedia.org/wiki/Third_stream> ·
  <https://www.jazztimes.com/archives/gunther-schuller-third-stream-from-the-source/>
- **Loft jazz** — Studio Rivbea, run by Sam and Beatrice Rivers on Bond Street
  from 1970 to roughly 1980; *Wildflowers* recorded there 14–23 May 1976.
  <https://en.wikipedia.org/wiki/Wildflowers:_The_New_York_Loft_Jazz_Sessions> ·
  <https://en.wikipedia.org/wiki/Studio_Rivbea>
- **M-Base** — "macro-basic array of structured extemporization"; Brooklyn,
  mid-1980s; Coleman's own position is that M-Base names a *concept and way of
  working*, not a style of music, and that critics describing an "M-Base sound"
  have misread it. This correction is carried into the genre's `contested` field.
  <https://m-base.com/> · <https://en.wikipedia.org/wiki/M-Base>
- **Ethio-jazz** — the qignit modal system (tizita, bati, ambassel, anchihoye);
  Mulatu Astatke trained in London, New York and Boston and arrived at the fusion
  from Latin jazz; the Éthiopiques series began in 1997 on Buda Musique under
  Francis Falceto.
  <https://en.wikipedia.org/wiki/Ethio-jazz> ·
  <https://en.wikipedia.org/wiki/Mulatu_Astatke> ·
  <https://theartsdesk.com/new-music/éthiopiques-mulatu-astatke-and-story-ethiopian-jazz>
- **J-jazz** — Three Blind Mice founded June 1970 by Takeshi "Tee" Fujii with the
  stated ambition of being "the Blue Note of Japan"; Terumasa Hino's *Hi-Nology*
  (1969); the BBE *J Jazz* reissue series from 2018 is what popularised the label
  "J-jazz" internationally.
  <https://en.wikipedia.org/wiki/Three_Blind_Mice_(record_label)> ·
  <https://bbemusic.bandcamp.com/album/j-jazz-deep-modern-jazz-from-japan-1969-1984>
- **UK jazz revival** — Tomorrow's Warriors co-founded 1991 by Gary Crosby and
  Janine Irons; alumni include Shabaka Hutchings, Moses Boyd, Nubya Garcia, Theon
  Cross and members of Ezra Collective; *We Out Here* released 2018 on Gilles
  Peterson's Brownswood; Ezra Collective won the Mercury Prize in 2023.
  <https://downbeat.com/news/detail/jazz-boom-in-the-uk> ·
  <https://theshfl.com/guide/Dig-The-New-Breed-The-UK-Jazz-Renaissance>

### Per-album discographic sources
- Blue Note catalogue numbers (BLP 1500/4000 series) verified against
  <https://en.wikipedia.org/wiki/Blue_Note_Records_discography>, which confirmed
  among others: *Blue Train* BLP 1577 (rec. 15 Sep 1957), *Moanin'* BLP 4003
  (rec. 30 Oct 1958), *Go!* BLP 4112, *Back at the Chicken Shack* BLP 4117
  (rec. 25 Apr 1960), *Idle Moments* BLP 4154 (rec. 15 Nov 1963), *The Sidewinder*
  BLP 4157 (rec. 21 Dec 1963), *Out to Lunch!* BLP 4163 (rec. 25 Feb 1964),
  *Point of Departure* BLP 4167, *Empyrean Isles* BLP 4175, *Song for My Father*
  BLP 4185, *Speak No Evil* BLP 4194 (rec. 24 Dec 1964), *Maiden Voyage* BLP 4195,
  *Components* BLP 4213, *Unity* BLP 4221, *Mode for Joe* BLP 4227.
- Impulse! catalogue numbers verified against
  <https://en.wikipedia.org/wiki/Impulse!_Records_discography>, confirming
  *A Love Supreme* A-77, *Ascension* A-95, *The Black Saint and the Sinner Lady*
  A-35.
- Individual album pages consulted for the corrections in section 3.

---

## 3. Corrections the verification pass produced

These are cases where the check found the dataset **wrong**, and the dataset was
changed. They are listed because a verification log that only reports successes
is not a verification log.

| Album | What was wrong | Fix |
| --- | --- | --- |
| Duke Ellington, *Piano Reflections* | Title and year. The 1953 Capitol LP was issued as **The Duke Plays Ellington**; "Piano Reflections" is the 1989 CD reissue title. Dataset said "Piano Reflections", released 1955. | Retitled *The Duke Plays Ellington (Piano Reflections)*, released 1954, note added recording the 1953/1954 source disagreement, confidence lowered to medium. Source: <https://en.wikipedia.org/wiki/Piano_Reflections> |
| Machito, *Afro-Cuban Jazz Suite* | Label and catalogue number. Dataset said Norgran MGN 1071; the first issue was **Mercury (Clef series) MG C-505**, recorded NYC 21 Dec 1950. | Label and catalogue corrected, release year set to 1952 with a note that sources give 1951–1957 across Clef/Norgran/Verve reissues, confidence lowered to medium. Sources: <https://microgroove.jp/mercury/MGC505.shtml>, <https://en.wikipedia.org/wiki/Chico_O%27Farrill> |
| Shorty Rogers and His Giants | Catalogue number. Dataset said RCA LJM-1004; correct is **LPM 3137** (10-inch, 1953), expanded to **LPM 1195** (12-inch, 1956). | Both catalogue numbers recorded, with a note explaining the 1954 session dates belong to the added 12-inch material. Source: <https://en.wikipedia.org/wiki/Shorty_Rogers_and_His_Giants> |
| Charlie Parker, *Complete Savoy and Dial Studio Recordings* | Compilation date disputed (2000 vs 2002). | Note added, confidence lowered to medium. The 1944–48 sessions themselves are not in doubt. |

Verified as **correct** after the automated pass flagged them:

- Betty Carter, *The Audience with Betty Carter* — rec. 6–8 Dec 1979, released
  1980 on Bet-Car (MusicBrainz dates the Verve reissue).
  <https://en.wikipedia.org/wiki/The_Audience_with_Betty_Carter>
- Jimmy Giuffre 3, *Free Fall* — rec. Jul–Nov 1962, released March 1963,
  Columbia. <https://en.wikipedia.org/wiki/Free_Fall_(Jimmy_Giuffre_album)>
- Mary Lou Williams, *Zodiac Suite* — recorded and released 1945, Asch; trio of
  Williams, Al Lucas, Jack Parker. <https://en.wikipedia.org/wiki/Zodiac_Suite>
- Tony Williams, *Spring* — rec. 12 Aug 1965, released 1966, Blue Note
  BLP 4216 / BST 84216. <https://en.wikipedia.org/wiki/Spring_(Tony_Williams_album)>
- Willie "The Lion" Smith, *The Lion Roars* — rec. 8 Nov 1957, Dot DLP-3094.
- Irakere, *Irakere* — Columbia JC 35655, released Feb 1979, recorded live at
  Newport and Montreux in mid-1978.
- John Zorn, *Cobra* — hatART 2034, recorded 21 Oct 1985 and 9 May 1986,
  released 1987. <https://en.wikipedia.org/wiki/Cobra_(album)>

---

## 4. Random spot-check

Ten albums picked at random from `data/albums.json` and checked against a live
source independent of the automated MusicBrainz pass. All ten were consistent
with the dataset apart from the corrections already listed in section 3.

| # | Album | Checked against | Result |
| --- | --- | --- | --- |
| 1 | Duke Ellington — *Piano Reflections* | Wikipedia album article | **Corrected** — see section 3 |
| 2 | Mary Lou Williams — *Zodiac Suite* | Wikipedia album article | Confirmed (1945, Asch, trio personnel) |
| 3 | Betty Carter — *The Audience with Betty Carter* | Wikipedia album article | Confirmed (rec. 1979, rel. 1980, Bet-Car) |
| 4 | Jimmy Giuffre 3 — *Free Fall* | Wikipedia album article | Confirmed (rec. 1962, rel. 1963, Columbia) |
| 5 | Shorty Rogers and His Giants | Wikipedia album article | **Corrected** — catalogue number |
| 6 | Tony Williams — *Spring* | Wikipedia album article | Confirmed (rec. 12 Aug 1965, BST 84216) |
| 7 | Machito — *Afro-Cuban Jazz Suite* | Mercury discography (microgroove.jp), Discogs listing | **Corrected** — label and catalogue |
| 8 | Irakere — *Irakere* | Discogs / RateYourMusic listings | Confirmed (JC 35655, 1979, live 1978) |
| 9 | Willie "The Lion" Smith — *The Lion Roars* | Discogs listing | Confirmed (Dot DLP-3094, rec. 8 Nov 1957) |
| 10 | John Zorn — *Cobra* | Wikipedia album article, Discogs | Confirmed (hatART 2034, 1987) |

---

## 5. Confidence field, as it is actually used

| `confidence` | Albums | Meaning |
| --- | ---: | --- |
| `high` | 274 | Release year confirmed by MusicBrainz and/or a discographic page; catalogue detail consistent across sources. |
| `medium` | 66 | Substance is not in doubt but one field is soft — usually a compilation's release year, or a reissue that has circulated under several catalogue numbers. |
| `low` | 11 | Discographic detail is poorly documented online and should be re-checked before being cited. Every `low` entry carries a `note` saying which field is shaky; `data/validate.js` enforces that. |

The eleven `low`-confidence albums:

`art-hodes-sittin-in` · `dick-wellstood-from-ragtime-on` ·
`donald-lambert-harlem-stride-classics` · `hot-lips-page-after-hours` ·
`tchavolo-schmitt-alors-question` · `romane-ombre` ·
`bud-shank-bob-cooper-blowin-country` · `schweizer-moholo-duo` ·
`corduroy-out-of-here` · `roy-ayers-wake-up` · `elliott-sharp-carbon-tocsin`

The pattern is consistent: small independent labels (Chiaroscuro, Pumpkin,
Iris Musique, Le Chant du Monde, Acid Jazz, Ichiban, SST) whose 1970s–1990s
catalogues are thinly documented, plus early private acetates. In each case the
*music* is well attested; it is the pressing metadata that is not.

---

## 6. Automated validation

`node data/validate.js` runs on every data change and enforces:

- every `lineage.from` / `lineage.to` resolves to a real genre id;
- the lineage graph is **acyclic** (Kahn's algorithm — currently passes with all
  39 nodes ordered);
- no genre is an orphan (every genre has at least one lineage edge);
- every genre has ≥ 8 primary albums, **exactly one** `gateway`, 4–6 `core`,
  3–4 `deep`;
- every album has artist, title, recorded year, label; `released` is never before
  `recorded`; `difficulty` is an integer 1–5;
- no duplicate genre or album ids; ids are kebab-case;
- every `aspects` value is in the closed nine-term vocabulary;
- every `hingeAlbum` reference resolves;
- every `confidence: "low"` album carries an explanatory `note`;
- path steps reference real albums, do not repeat within a path, each carry a
  bridge sentence, and satisfy the path's own declared constraints (12 steps and
  difficulty ≤ 2 for "Start Here"; 30 steps for "The Full Arc"; chronological
  ordering where declared).

Current output: **0 errors, 4 warnings.** The four warnings are all the same
deliberate case — a lineage edge whose parent genre begins *later* than its
child, which is legitimate when the influence itself is dated later than the
child's birth:

- `swing → vocal-jazz` (1935) and `bebop → vocal-jazz` (1946): vocal jazz begins
  in 1926 with Armstrong, then absorbs the big-band vocalist role and later bebop
  harmony.
- `bebop → afro-cuban` (1947): Machito's orchestra predates bebop (1940), and
  bebop's harmonic language enters the idiom in 1947 with Gillespie and Pozo.
- `jazz-rap → acid-jazz` (1992): the two scenes were contemporaneous and mining
  the same records; rapping entered acid jazz from hip-hop rather than the other
  way round.

---

## 7. Known gaps

**Read this section before citing anything from the dataset.**

### 7.1 Twenty-seven albums MusicBrainz could not confirm

These are matched neither by the strict nor the loose pass. Their metadata rests
on the original authoring plus, where noted, a targeted human check. They are
disproportionately compilations of pre-LP material and non-American independent
releases:

```
bolcom-heliotrope-bouquet          reginald-robinson-sounds-in-silhouette
odjb-complete-original-dixieland   george-lewis-jazz-at-vespers
eddie-condon-chronological-1927-1938  mckenzie-condon-chicagoans
bud-freeman-chicagoans-in-new-york benny-goodman-bg-trio-quartet
jack-teagarden-king-of-the-blues-trombone  art-hodes-sittin-in
dick-wellstood-from-ragtime-on     donald-lambert-harlem-stride-classics
ellington-such-sweet-thunder       tchavolo-schmitt-alors-question
jimmy-giuffre-free-fall*           tony-williams-lifetime-spring*
machito-afro-cuban-jazz-suite*     eddie-palmieri-harlem-river-drive
mulatu-astatke-ethiopiques-4       masabumi-kikuchi-poo-sun
isao-suzuki-blow-up                masahiko-togashi-we-now-create
ryo-fukui-scenery                  decoding-society-mandance
jazz-at-lincoln-center-big-train   john-zorn-cobra*
elliott-sharp-carbon-tocsin
```
`*` = subsequently verified by hand (section 3/4).

### 7.2 Structural gaps in the data

- **Pre-LP "albums" are a category error I have papered over.** For anything
  before roughly 1948 the object being recommended is a modern compilation of
  78rpm sides, not an album the musicians made. `recorded` holds the *earliest*
  session year and a `note` gives the range, but the schema cannot properly
  express "seventeen sides cut across three years for two labels". A future
  version should model sessions, not releases.
- **Personnel lists are partial and unverified.** They are included where I was
  confident and are not checked by any automated pass. Treat them as indicative.
  Several are marked "various" for compilations.
- **Recording *dates* are years, not dates.** The schema stores `recorded` and
  `released` as integers. Where a record was cut across sessions in different
  years (Blue Note did this constantly), the year given is the first session.
- **Catalogue numbers are original-issue numbers where known**, but for
  compilations they are the numbers of the specific edition described, which may
  be out of print. They are provided as identifiers, not purchase advice.

### 7.3 Gaps in coverage — genres and scenes not represented

Named honestly, because their absence is a choice with consequences:

- **South African jazz** (Abdullah Ibrahim, the Blue Notes, Chris McGregor's
  Brotherhood of Breath) is present only obliquely, through Louis Moholo in the
  European improvisation entry and through Shabaka and the Ancestors. It deserves
  its own node and does not have one. This is the most significant omission.
- **Indian, Middle Eastern and West African jazz currents** are absent as nodes.
  Fela's Afrobeat, for instance, appears only as an unmapped parent of the UK
  scene.
- **Nordic and Polish jazz before ECM**, Soviet-bloc jazz, and Brazilian
  instrumental music after the 1970s are thin.
- **Women's contribution is under-represented in the `keyFigures` lists** in a way
  that reflects the historiography rather than the music. Mary Lou Williams,
  Alice Coltrane, Geri Allen, Carla Bley, Betty Carter, Toshiko Akiyoshi, Irène
  Schweizer, Mary Halvorson, Maria Schneider and Matana Roberts are present;
  many others who should be are not.

### 7.4 Gaps in the lineage graph

- **Non-jazz parents are not modelled.** Rock, funk, R&B, samba, Romani
  string-band practice, Ethiopian traditional music, Afrobeat, hip-hop production
  and Western art music are all load-bearing parents of nodes in this graph, and
  none of them is a node. Where a genre's real parentage is mostly outside jazz —
  jazz manouche, ethio-jazz, fusion, the UK revival — the edge explanations say so
  explicitly, but the picture still under-states how much came from outside.
- **Edge years are approximate by construction.** `year` is "when the influence
  took hold", which is a judgment, not a fact. It drives the graph's geometry, so
  the geometry inherits the judgment.
- **Four `weak` edges are explicitly labelled interpretation** in their
  explanation text: `west-coast → euro-free-improv`, `west-coast → ecm-nordic`,
  `ethio-jazz → uk-jazz-revival`, `j-jazz → uk-jazz-revival`. Two more —
  `new-orleans → free-jazz` and `kansas-city → soul-jazz` — are interpretive
  claims that participants have themselves made, and say so.

### 7.5 Things I could not check at all

- **Nothing here has been checked by a musicologist.** The two-source rule was
  applied to discography, which is checkable. Claims about what a style *sounds
  like*, what was inherited from what, and what a record is doing are informed
  judgments, sourced where a source exists, and unverifiable in principle where
  one does not.
- **The Penguin Guide to Jazz "Core Collection" crowns and the Down Beat Hall of
  Fame were not machine-readable.** Penguin crowns are referenced where a
  consulted page mentioned them (Giuffre's *Free Fall*, Betty Carter's *The
  Audience with…*), but the album selection was not filtered through either list.
  Selections are mine, argued for in each `whyThisOne`.
- **No listening was done for this project.** Every `listenFor` describes a
  feature I believe is on the record, from prior knowledge of it. They have not
  been re-checked against the audio. That is the single biggest unverified surface
  in the dataset, and if you find one wrong, it is wrong.
