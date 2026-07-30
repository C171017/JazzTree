#!/usr/bin/env node
/**
 * JazzTree dataset validator.  Run:  node data/validate.js
 * Exits non-zero if any ERROR is found.  WARNs are advisory.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'));

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const { genres, lineage, families, eras, meta } = read('genres.json');
const albums = read('albums.json');
const paths = existsSync(join(dataDir, 'paths.json')) ? read('paths.json') : null;

const ASPECTS = new Set([
  'harmony', 'rhythm', 'form', 'instrumentation', 'improvisation',
  'timbre', 'repertoire', 'social-context', 'technology',
]);
const EDGE_TYPES = new Set([
  'direct-descendant', 'reaction-against', 'fusion-of', 'parallel-influence', 'revival-of',
]);
const STRENGTHS = new Set(['strong', 'moderate', 'weak']);
const TIERS = new Set(['gateway', 'core', 'deep']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);

/* ---------------------------------------------------------------- genres */
const genreIds = new Set();
const familyIds = new Set(families.map((f) => f.id));

for (const g of genres) {
  const at = `genre "${g.id ?? '(no id)'}"`;
  if (!g.id) err(`${at}: missing id`);
  else if (genreIds.has(g.id)) err(`${at}: duplicate genre id`);
  else genreIds.add(g.id);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id ?? '')) err(`${at}: id is not kebab-case`);
  for (const k of ['name', 'oneLine', 'summary', 'contested', 'confidence', 'family']) {
    if (!g[k]) err(`${at}: missing ${k}`);
  }
  if (!familyIds.has(g.family)) err(`${at}: unknown family "${g.family}"`);
  if (!CONFIDENCE.has(g.confidence)) err(`${at}: bad confidence "${g.confidence}"`);

  const e = g.era ?? {};
  if (typeof e.start !== 'number') err(`${at}: era.start must be a number`);
  if (e.end !== null && typeof e.end !== 'number') err(`${at}: era.end must be a number or null`);
  if (typeof e.end === 'number' && e.end < e.start) err(`${at}: era ends before it starts`);
  if (!Array.isArray(e.peak) || e.peak.length !== 2) err(`${at}: era.peak must be [start, end]`);
  else {
    if (e.peak[0] < e.start) err(`${at}: peak starts before era.start`);
    if (typeof e.end === 'number' && e.peak[1] > e.end) err(`${at}: peak ends after era.end`);
  }

  for (const k of ['musicalTraits', 'earMarkers', 'keyFigures', 'keyLabels']) {
    if (!g[k]) err(`${at}: missing ${k}`);
  }
  for (const t of ['harmony', 'rhythm', 'form', 'instrumentation', 'improvisation', 'timbre']) {
    if (!g.musicalTraits?.[t]) err(`${at}: missing musicalTraits.${t}`);
  }
  if ((g.earMarkers?.length ?? 0) < 3) err(`${at}: needs at least 3 earMarkers`);
  if ((g.keyFigures?.length ?? 0) < 3) warn(`${at}: only ${g.keyFigures?.length ?? 0} keyFigures`);
  for (const f of g.keyFigures ?? []) {
    if (!f.name || !f.instrument || !f.why) err(`${at}: incomplete keyFigure ${JSON.stringify(f)}`);
  }
  const wc = String(g.summary ?? '').split(/\s+/).filter(Boolean).length;
  if (wc < 120 || wc > 300) warn(`${at}: summary is ${wc} words (target 150–250)`);
}

/* ------------------------------------------------------------------ eras */
for (let i = 1; i < eras.length; i++) {
  if (eras[i].start < eras[i - 1].start) err(`eras are not in chronological order at "${eras[i].id}"`);
}

/* --------------------------------------------------------------- lineage */
const edgeKeys = new Set();
const adjacency = new Map(genres.map((g) => [g.id, []]));
const byId = new Map(genres.map((g) => [g.id, g]));

for (const e of lineage) {
  const at = `edge ${e.from} -> ${e.to}`;
  if (!genreIds.has(e.from)) err(`${at}: unknown "from" genre`);
  if (!genreIds.has(e.to)) err(`${at}: unknown "to" genre`);
  if (e.from === e.to) err(`${at}: self-loop`);
  const key = `${e.from}->${e.to}`;
  if (edgeKeys.has(key)) err(`${at}: duplicate edge`);
  edgeKeys.add(key);

  if (!EDGE_TYPES.has(e.type)) err(`${at}: bad type "${e.type}"`);
  if (!STRENGTHS.has(e.strength)) err(`${at}: bad strength "${e.strength}"`);
  if (typeof e.year !== 'number') err(`${at}: year must be a number`);
  if (!e.explanation || e.explanation.length < 40) err(`${at}: explanation too short or missing`);
  if (!Array.isArray(e.aspects) || e.aspects.length === 0) err(`${at}: aspects must be a non-empty array`);
  for (const a of e.aspects ?? []) {
    if (!ASPECTS.has(a)) err(`${at}: aspect "${a}" is outside the closed vocabulary`);
  }

  const from = byId.get(e.from);
  const to = byId.get(e.to);
  if (from && typeof e.year === 'number' && e.year < from.era.start) {
    err(`${at}: edge year ${e.year} precedes parent's era.start ${from.era.start}`);
  }
  // Not an error: influence can flow from a genre that began later (the layout draws these
  // as vertical connectors at the edge year). Flagged so each case stays a deliberate choice.
  if (from && to && from.era.start > to.era.start) {
    warn(`${at}: parent starts (${from.era.start}) after child (${to.era.start}) — check this is intentional`);
  }
  if (genreIds.has(e.from) && genreIds.has(e.to)) adjacency.get(e.from).push(e.to);
}

// Kahn's algorithm — if any node remains, there is a cycle.
{
  const indeg = new Map(genres.map((g) => [g.id, 0]));
  for (const [, outs] of adjacency) for (const t of outs) indeg.set(t, indeg.get(t) + 1);
  const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
  let seen = 0;
  while (queue.length) {
    const n = queue.shift();
    seen++;
    for (const t of adjacency.get(n)) {
      indeg.set(t, indeg.get(t) - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  if (seen !== genres.length) {
    const stuck = [...indeg].filter(([, d]) => d > 0).map(([id]) => id);
    err(`lineage graph is NOT acyclic; nodes in cycles: ${stuck.join(', ')}`);
  }
}

const orphans = genres.filter((g) => !lineage.some((e) => e.to === g.id || e.from === g.id));
for (const g of orphans) err(`genre "${g.id}" has no lineage edges at all`);

/* ---------------------------------------------------------------- albums */
const albumIds = new Set();
// `primary` counts only albums whose FIRST genreId is this genre — that is the set the
// genre panel presents as its own three tiers. `all` includes cross-listed albums, which
// the panel shows separately under "also filed here".
const perGenre = new Map(genres.map((g) => [g.id, { gateway: [], core: [], deep: [], all: 0 }]));

for (const a of albums) {
  const at = `album "${a.id ?? a.title ?? '(unknown)'}"`;
  if (!a.id) err(`${at}: missing id`);
  else if (albumIds.has(a.id)) err(`${at}: duplicate album id`);
  else albumIds.add(a.id);

  for (const k of ['artist', 'title', 'recorded', 'label', 'whyThisOne', 'listenFor']) {
    if (!a[k]) err(`${at}: missing ${k}`);
  }
  if (typeof a.recorded !== 'number' || a.recorded < 1890 || a.recorded > 2027) {
    err(`${at}: implausible recorded year ${a.recorded}`);
  }
  if (a.released != null) {
    if (typeof a.released !== 'number') err(`${at}: released must be a number`);
    else if (a.released < a.recorded) err(`${at}: released (${a.released}) before recorded (${a.recorded})`);
  }
  if (!TIERS.has(a.tier)) err(`${at}: bad tier "${a.tier}"`);
  if (!CONFIDENCE.has(a.confidence)) err(`${at}: bad confidence "${a.confidence}"`);
  if (!Number.isInteger(a.difficulty) || a.difficulty < 1 || a.difficulty > 5) {
    err(`${at}: difficulty must be an integer 1–5 (got ${a.difficulty})`);
  }
  if (!Array.isArray(a.genreIds) || a.genreIds.length === 0) err(`${at}: genreIds must be non-empty`);
  (a.genreIds ?? []).forEach((gid, i) => {
    if (!genreIds.has(gid)) return err(`${at}: unknown genreId "${gid}"`);
    perGenre.get(gid).all++;
    if (i === 0 && TIERS.has(a.tier)) perGenre.get(gid)[a.tier].push(a.id);
  });
  if (a.confidence === 'low' && !a.note) err(`${at}: confidence "low" requires an explanatory note`);
}

for (const [gid, tiers] of perGenre) {
  const total = tiers.gateway.length + tiers.core.length + tiers.deep.length;
  if (tiers.gateway.length !== 1) {
    err(`genre "${gid}": must have exactly one gateway album (has ${tiers.gateway.length}: ${tiers.gateway.join(', ') || 'none'})`);
  }
  if (total < 8) err(`genre "${gid}": only ${total} primary albums across tiers (need >= 8)`);
  if (tiers.core.length < 4 || tiers.core.length > 6) err(`genre "${gid}": ${tiers.core.length} core albums (need 4–6)`);
  if (tiers.deep.length < 3 || tiers.deep.length > 4) err(`genre "${gid}": ${tiers.deep.length} deep albums (need 3–4)`);
}

for (const e of lineage) {
  if (e.hingeAlbum && !albumIds.has(e.hingeAlbum)) {
    err(`edge ${e.from} -> ${e.to}: hingeAlbum "${e.hingeAlbum}" does not resolve`);
  }
}

/* ----------------------------------------------------------------- paths */
if (paths) {
  const pathIds = new Set();
  for (const p of paths) {
    const at = `path "${p.id}"`;
    if (pathIds.has(p.id)) err(`${at}: duplicate path id`);
    pathIds.add(p.id);
    if (!p.name || !p.blurb) err(`${at}: missing name or blurb`);
    if (!Array.isArray(p.steps) || !p.steps.length) err(`${at}: missing steps`);
    const seen = new Set();
    p.steps?.forEach((s, i) => {
      if (!albumIds.has(s.albumId)) err(`${at} step ${i + 1}: unknown albumId "${s.albumId}"`);
      if (seen.has(s.albumId)) err(`${at} step ${i + 1}: album "${s.albumId}" repeats within the path`);
      seen.add(s.albumId);
      if (!s.bridge) err(`${at} step ${i + 1}: missing bridge sentence`);
    });
    if (p.expect?.count && p.steps?.length !== p.expect.count) {
      err(`${at}: expected ${p.expect.count} steps, found ${p.steps.length}`);
    }
    if (p.expect?.maxDifficulty) {
      for (const s of p.steps ?? []) {
        const a = albums.find((x) => x.id === s.albumId);
        if (a && a.difficulty > p.expect.maxDifficulty) {
          err(`${at}: "${s.albumId}" has difficulty ${a.difficulty}, above the path's max ${p.expect.maxDifficulty}`);
        }
      }
    }
    // Steps carry an explicit `year` — the year the music belongs to, which is not always
    // the recording date (revival performances, reissue compilations).
    for (const s of p.steps ?? []) {
      if (typeof s.year !== 'number') err(`${at}: step "${s.albumId}" is missing a year`);
    }
    if (p.expect?.chronological) {
      let prev = -Infinity;
      for (const s of p.steps ?? []) {
        if (s.year < prev) err(`${at}: "${s.albumId}" (${s.year}) breaks chronological order`);
        prev = s.year;
      }
    }
  }
} else {
  warn('data/paths.json not found — skipping path checks');
}

/* ---------------------------------------------------------------- report */
const stats = {
  genres: genres.length,
  lineageEdges: lineage.length,
  albums: albums.length,
  present: meta?.present,
  lowConfidenceAlbums: albums.filter((a) => a.confidence === 'low').length,
  mediumConfidenceAlbums: albums.filter((a) => a.confidence === 'medium').length,
};
console.log('JazzTree dataset validation');
console.log(Object.entries(stats).map(([k, v]) => `  ${k}: ${v}`).join('\n'));
if (warns.length) console.log(`\n${warns.length} WARN:\n` + warns.map((w) => '  ! ' + w).join('\n'));
if (errors.length) {
  console.error(`\n${errors.length} ERROR:\n` + errors.map((e) => '  x ' + e).join('\n'));
  process.exit(1);
}
console.log('\nOK — no errors.');
