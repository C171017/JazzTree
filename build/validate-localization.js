#!/usr/bin/env node
/** Strict coverage checks for the Simplified Chinese editorial sidecar. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => JSON.parse(readFileSync(join(root, ...parts), 'utf8'));
const source = read('data', 'genres.json');
const albums = read('data', 'albums.json');
const paths = read('data', 'paths.json');
const locale = read('data', 'localization.zh-CN.json');
const errors = [];
const fail = (message) => errors.push(message);
const hasHan = (value) => /\p{Script=Han}/u.test(String(value ?? ''));
// Terms with established Chinese renderings must not drift back into otherwise
// translated prose. Canonical people, record, track, ensemble, label, and
// institution names remain untouched and are deliberately absent from this list.
const untranslatedJargon = /\b(?:ragged time|cakewalk|stomp|explosion|stride|la pompe|musette|bal-musette|manouche|scat|vocalese|contrafact|cool|shuffle|chitlin(?:'|’) circuit|break|boogaloo|clave|tumbao|third stream|qignit|tizita|bati|ambassel|anchihoye|chik chika|shellela|harmolodics?|boom-bap|dub|mod|G-funk|go-go|dancehall|cumbia|grime|jungle|Afrobeats?|calypso)\b/;
const prose = (value, at) => {
  if (!String(value ?? '').trim()) fail(`${at}: empty`);
  else if (!hasHan(value)) fail(`${at}: contains no Chinese characters`);
  else {
    const untranslated = String(value).match(untranslatedJargon)?.[0];
    if (untranslated) fail(`${at}: untranslated music term "${untranslated}"`);
  }
};

function exactKeys(actual, expected, at) {
  const a = new Set(actual);
  const e = new Set(expected);
  for (const id of e) if (!a.has(id)) fail(`${at}: missing "${id}"`);
  for (const id of a) if (!e.has(id)) fail(`${at}: unexpected "${id}"`);
}

exactKeys(Object.keys(locale.genres ?? {}), source.genres.map((genre) => genre.id), 'genres');
exactKeys(Object.keys(locale.lineage ?? {}), source.lineage.map((edge) => `${edge.from}->${edge.to}`), 'lineage');
exactKeys(Object.keys(locale.albums ?? {}), albums.map((album) => album.id), 'albums');
exactKeys(Object.keys(locale.paths ?? {}), paths.map((path) => path.id), 'paths');

const traitKeys = ['harmony', 'rhythm', 'form', 'instrumentation', 'improvisation', 'timbre'];
for (const genre of source.genres) {
  const zh = locale.genres?.[genre.id];
  if (!zh) continue;
  if (!Array.isArray(zh.aka) || zh.aka.length !== (genre.aka?.length ?? 0)) {
    fail(`${genre.id}.aka: expected ${genre.aka?.length ?? 0} entries, got ${zh.aka?.length ?? 'non-array'}`);
  } else {
    zh.aka.forEach((value, index) => {
      if (!String(value ?? '').trim()) fail(`${genre.id}.aka[${index}]: empty`);
    });
  }
  prose(zh.origin?.city, `${genre.id}.origin.city`);
  prose(zh.origin?.country, `${genre.id}.origin.country`);
  prose(zh.summary, `${genre.id}.summary`);
  exactKeys(Object.keys(zh.musicalTraits ?? {}), traitKeys, `${genre.id}.musicalTraits`);
  for (const key of traitKeys) prose(zh.musicalTraits?.[key], `${genre.id}.musicalTraits.${key}`);
  if (!Array.isArray(zh.earMarkers) || zh.earMarkers.length !== genre.earMarkers.length) {
    fail(`${genre.id}.earMarkers: expected ${genre.earMarkers.length} entries, got ${zh.earMarkers?.length ?? 'non-array'}`);
  } else {
    zh.earMarkers.forEach((value, index) => prose(value, `${genre.id}.earMarkers[${index}]`));
  }
  exactKeys(Object.keys(zh.keyFigures ?? {}), genre.keyFigures.map((figure) => figure.name), `${genre.id}.keyFigures`);
  for (const figure of genre.keyFigures) {
    prose(zh.keyFigures?.[figure.name]?.instrument, `${genre.id}.keyFigures.${figure.name}.instrument`);
    prose(zh.keyFigures?.[figure.name]?.why, `${genre.id}.keyFigures.${figure.name}.why`);
  }
  prose(zh.contested, `${genre.id}.contested`);
}

for (const edge of source.lineage) {
  const key = `${edge.from}->${edge.to}`;
  prose(locale.lineage?.[key]?.explanation, `${key}.explanation`);
}

for (const album of albums) {
  const zh = locale.albums?.[album.id];
  if (!zh) continue;
  prose(zh.whyThisOne, `${album.id}.whyThisOne`);
  prose(zh.listenFor, `${album.id}.listenFor`);
  if (album.note == null) {
    if (zh.note != null) fail(`${album.id}.note: translation exists but source note does not`);
  } else {
    prose(zh.note, `${album.id}.note`);
  }
}

for (const path of paths) {
  const zh = locale.paths?.[path.id];
  if (!zh) continue;
  exactKeys(Object.keys(zh.bridges ?? {}), path.steps.map((step) => step.albumId), `${path.id}.bridges`);
  for (const step of path.steps) prose(zh.bridges?.[step.albumId], `${path.id}.${step.albumId}.bridge`);
}

if (errors.length) {
  console.error(`Simplified Chinese localization: ${errors.length} error(s)`);
  for (const error of errors.slice(0, 80)) console.error(`  x ${error}`);
  if (errors.length > 80) console.error(`  …and ${errors.length - 80} more`);
  process.exit(1);
}

console.log(
  `Simplified Chinese localization OK — ${source.genres.length} genres, ${source.lineage.length} edges, ` +
  `${albums.length} albums, ${paths.reduce((sum, path) => sum + path.steps.length, 0)} path transitions`
);
