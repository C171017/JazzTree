#!/usr/bin/env node
/**
 * Cross-checks every album in data/albums.json against the MusicBrainz release-group
 * search API and writes build/mb-report.json + a human-readable summary.
 *
 * MusicBrainz allows ~1 request/second for anonymous clients; we respect that.
 * Usage: node build/verify-musicbrainz.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const albums = JSON.parse(readFileSync(join(root, 'data/albums.json'), 'utf8'));
const UA = 'JazzTree/1.0 (static jazz lineage guide; research verification)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) =>
  s.toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/\b(the|a|an)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Strip subtitle/qualifier noise that MusicBrainz usually omits.
const searchTitle = (t) => t.split(/[:(–—]/)[0].trim() || t;
const searchArtist = (a) => a.split(/ (?:&|with|feat\.?|featuring|\/) /i)[0].replace(/ and (his|her|the) .*/i, '').trim();

async function mb(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 503) { await sleep(2500); continue; }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }
  throw new Error('rate-limited after 3 attempts');
}

const results = [];
let i = 0;
for (const a of albums) {
  i++;
  const q = `releasegroup:"${searchTitle(a.title).replace(/"/g, '')}" AND artist:"${searchArtist(a.artist).replace(/"/g, '')}"`;
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(q)}&fmt=json&limit=5`;
  let row = { id: a.id, artist: a.artist, title: a.title, recorded: a.recorded, released: a.released ?? null, status: 'unknown' };
  try {
    const json = await mb(url);
    const groups = json['release-groups'] ?? [];
    const wantT = norm(searchTitle(a.title));
    const hit =
      groups.find((g) => norm(g.title) === wantT) ??
      groups.find((g) => norm(g.title).includes(wantT) || wantT.includes(norm(g.title))) ??
      null;
    if (!hit) {
      row.status = groups.length ? 'no-title-match' : 'not-found';
      row.candidates = groups.slice(0, 3).map((g) => `${g['artist-credit']?.[0]?.name} — ${g.title} (${g['first-release-date'] || '?'})`);
    } else {
      const year = hit['first-release-date'] ? Number(hit['first-release-date'].slice(0, 4)) : null;
      row.mbTitle = hit.title;
      row.mbArtist = hit['artist-credit']?.[0]?.name;
      row.mbFirstRelease = year;
      row.mbScore = hit.score;
      const claimed = a.released ?? a.recorded;
      if (year == null) row.status = 'found-no-date';
      else if (year === claimed) row.status = 'ok';
      else if (Math.abs(year - claimed) <= 1) row.status = 'ok-1yr';
      else if (year <= claimed && year >= a.recorded - 1) row.status = 'ok-earlier-issue';
      else row.status = 'year-mismatch';
      row.delta = year == null ? null : year - claimed;
    }
  } catch (e) {
    row.status = 'error';
    row.error = String(e.message);
  }
  results.push(row);
  if (i % 25 === 0) process.stderr.write(`  …${i}/${albums.length}\n`);
  await sleep(1100);
}

writeFileSync(join(root, 'build/mb-report.json'), JSON.stringify(results, null, 2) + '\n');

const byStatus = {};
for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
console.log('MusicBrainz cross-check summary');
for (const [k, v] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
console.log('\nNeeds review:');
for (const r of results.filter((x) => ['year-mismatch', 'not-found', 'no-title-match', 'error'].includes(x.status))) {
  console.log(`  [${r.status}] ${r.id} | ${r.artist} — ${r.title} (claimed ${r.released ?? r.recorded})` +
    (r.mbFirstRelease ? ` | MB: ${r.mbArtist} — ${r.mbTitle} (${r.mbFirstRelease})` : '') +
    (r.candidates?.length ? ` | candidates: ${r.candidates.join(' ; ')}` : ''));
}
