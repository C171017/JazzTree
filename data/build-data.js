#!/usr/bin/env node
/**
 * Generates data/data.js from the three JSON files so the site works from file://,
 * where fetch() is blocked by Chrome's origin rules.  The JSON remains the single
 * source of truth — never hand-edit data.js.
 *
 * Run:  node data/build-data.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'));

const payload = {
  genresFile: read('genres.json'),
  albums: read('albums.json'),
  paths: read('paths.json'),
};

const out = `/* GENERATED FILE — do not edit.
 * Source: data/genres.json, data/albums.json, data/paths.json
 * Regenerate with: node data/build-data.js
 * Exists so index.html works when opened directly from the filesystem (file://),
 * where fetch() of local JSON is blocked.
 */
window.__JAZZ_DATA__ = ${JSON.stringify(payload)};
`;

writeFileSync(join(dataDir, 'data.js'), out);
console.log(
  `wrote data/data.js — ${payload.genresFile.genres.length} genres, ` +
  `${payload.genresFile.lineage.length} edges, ${payload.albums.length} albums, ${payload.paths.length} paths`
);
