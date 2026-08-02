#!/usr/bin/env node
/** Browser-free smoke test for the exact data snapshot rendered by the web app. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { localizeData } from '../js/localize-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => JSON.parse(readFileSync(join(root, ...parts), 'utf8'));
const genresFile = read('data', 'genres.json');
const raw = {
  genres: genresFile.genres,
  lineage: genresFile.lineage,
  families: genresFile.families,
  eras: genresFile.eras,
  present: genresFile.meta.present,
  albums: read('data', 'albums.json'),
  paths: read('data', 'paths.json'),
  source: 'test',
};
globalThis.__JAZZ_ZH_CN__ = read('data', 'localization.zh-CN.json');

const zh = localizeData(raw, 'zh-CN');
const hasHan = (value) => /\p{Script=Han}/u.test(String(value ?? ''));
const failures = [];
const expectHan = (value, at) => { if (!hasHan(value)) failures.push(`${at}: ${value}`); };

if (zh === raw || zh.genres[0] === raw.genres[0]) failures.push('localizer mutated/reused the canonical snapshot');
if (raw.genres[0].summary === zh.genres[0].summary) failures.push('first genre summary was not overlaid');

for (const genre of zh.genres) {
  expectHan(genre.summary, `${genre.id}.summary`);
  expectHan(genre.contested, `${genre.id}.contested`);
  genre.earMarkers.forEach((value, index) => expectHan(value, `${genre.id}.earMarkers[${index}]`));
  Object.entries(genre.musicalTraits).forEach(([key, value]) => expectHan(value, `${genre.id}.${key}`));
  genre.keyFigures.forEach((figure) => {
    expectHan(figure.instrument, `${genre.id}.${figure.name}.instrument`);
    expectHan(figure.why, `${genre.id}.${figure.name}.why`);
  });
}
for (const edge of zh.lineage) expectHan(edge.explanation, `${edge.from}->${edge.to}`);
for (const album of zh.albums) {
  expectHan(album.whyThisOne, `${album.id}.whyThisOne`);
  expectHan(album.listenFor, `${album.id}.listenFor`);
  if (album.note != null) expectHan(album.note, `${album.id}.note`);
}
for (const path of zh.paths) {
  for (const step of path.steps) expectHan(step.bridge, `${path.id}.${step.albumId}`);
}

globalThis.document = { documentElement: {} };
const i18n = await import('../js/i18n.js');
const links = await import('../js/lib/links.js');

const netEaseAlbumSearch = links.searchUrl('netease', "Art Blakey & The Jazz Messengers", "Moanin'");
if (!netEaseAlbumSearch.startsWith('https://music.163.com/#/search/m/?s=')) {
  failures.push(`netease search has wrong endpoint: ${netEaseAlbumSearch}`);
}
if (!netEaseAlbumSearch.endsWith('&type=10')) {
  failures.push(`netease search is not album-filtered: ${netEaseAlbumSearch}`);
}
if (!netEaseAlbumSearch.includes('%26')) {
  failures.push(`netease search did not encode artist/album metadata: ${netEaseAlbumSearch}`);
}

const englishUIKeys = i18n.uiTranslationKeys('en');
const chineseUIKeys = i18n.uiTranslationKeys('zh-CN');
const englishUISet = new Set(englishUIKeys);
const chineseUISet = new Set(chineseUIKeys);
for (const key of englishUIKeys) {
  if (!chineseUISet.has(key)) failures.push(`ui.${key}: missing zh-CN key`);
}
for (const key of chineseUIKeys) {
  if (!englishUISet.has(key)) failures.push(`ui.${key}: missing English key`);
}

i18n.setLocale('en');
const englishUI = Object.fromEntries(englishUIKeys.map((key) => [key, i18n.t(key)]));
i18n.setLocale('zh-CN');
const allowedIdenticalUI = new Set(['service.name.spotify', 'service.name.appleMusic']);
for (const key of englishUIKeys) {
  const translated = i18n.t(key, { decade: 1950 });
  if (translated.includes('【缺少中文：')) failures.push(`ui.${key}: missing zh-CN value`);
  if (translated === englishUI[key] && !allowedIdenticalUI.has(key)) {
    failures.push(`ui.${key}: still identical to English`);
  }
}

for (const genre of genresFile.genres) {
  expectHan(i18n.genreName(genre), `${genre.id}.displayName`);
  expectHan(i18n.genreOneLine(genre), `${genre.id}.oneLine`);
}
for (const family of genresFile.families) {
  expectHan(i18n.familyName(family), `${family.id}.familyName`);
  expectHan(i18n.familyShort(family), `${family.id}.familyShort`);
  expectHan(i18n.familyBlurb(family), `${family.id}.familyBlurb`);
}
for (const era of genresFile.eras) expectHan(i18n.eraName(era), `${era.id}.eraName`);
for (const path of raw.paths) {
  for (const field of ['name', 'subtitle', 'blurb']) {
    expectHan(i18n.pathText(path, field), `${path.id}.${field}`);
  }
}
for (const aspect of ['harmony', 'rhythm', 'form', 'instrumentation', 'improvisation', 'timbre', 'repertoire', 'social-context', 'technology']) {
  expectHan(i18n.aspectLabel(aspect), `aspect.${aspect}`);
}
for (const type of ['direct-descendant', 'reaction-against', 'fusion-of', 'parallel-influence', 'revival-of']) {
  expectHan(i18n.edgeTypeLabel(type), `edgeType.${type}`);
  expectHan(i18n.edgeDescription(type), `edgeDescription.${type}`);
}

if (failures.length) {
  console.error(`Web localization runtime: ${failures.length} failure(s)`);
  failures.slice(0, 40).forEach((failure) => console.error(`  x ${failure}`));
  process.exit(1);
}
console.log(`Web localization runtime OK — ${zh.genres.length} genres, ${zh.lineage.length} edges, ${zh.albums.length} albums`);
