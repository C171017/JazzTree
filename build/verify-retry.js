#!/usr/bin/env node
/**
 * Second pass over the albums the first MusicBrainz sweep could not match.
 * Uses a looser query (title only, more results, fuzzy artist match) because
 * most first-pass misses were search-string failures rather than data errors.
 *
 * Run after build/verify-musicbrainz.js:  node build/verify-retry.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const albums = JSON.parse(readFileSync(join(root, 'data/albums.json'), 'utf8'));
const report = JSON.parse(readFileSync(join(root, 'build/mb-report.json'), 'utf8'));
const UA = 'JazzTree/1.0 (static jazz lineage guide; research verification)';

const RETRY = new Set(['not-found', 'no-title-match', 'error', 'found-no-date']);
const todo = report.filter((r) => RETRY.has(r.status));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) =>
  String(s).toLowerCase().normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’´]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/\bvol(ume)?\.?\s*/g, 'vol ')
    .replace(/\b(the|a|an|and|his|her|feat|featuring|with)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();

const tokens = (s) => new Set(norm(s).split(' ').filter((t) => t.length > 2));
function overlap(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return n / Math.min(A.size, B.size);
}

async function mb(url) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 503) { await sleep(3000); continue; }
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }
  throw new Error('rate-limited');
}

const out = [];
let i = 0;
for (const r of todo) {
  i++;
  const album = albums.find((a) => a.id === r.id);
  const bareTitle = album.title.split(/[:(]/)[0].trim();
  const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(bareTitle)}&fmt=json&limit=25`;
  const row = { id: r.id, artist: album.artist, title: album.title, claimed: album.released ?? album.recorded, status: 'still-unmatched' };
  try {
    const json = await mb(url);
    const groups = json['release-groups'] ?? [];
    const scored = groups
      .map((g) => ({
        g,
        t: overlap(bareTitle, g.title),
        a: overlap(album.artist, g['artist-credit']?.map((c) => c.name).join(' ') ?? ''),
      }))
      .filter((s) => s.t >= 0.6 && s.a >= 0.34)
      .sort((a, b) => b.t + b.a - (a.t + a.a));
    if (scored.length) {
      const best = scored[0].g;
      const year = best['first-release-date'] ? Number(best['first-release-date'].slice(0, 4)) : null;
      row.mbArtist = best['artist-credit']?.[0]?.name;
      row.mbTitle = best.title;
      row.mbFirstRelease = year;
      row.delta = year == null ? null : year - row.claimed;
      row.status =
        year == null ? 'found-no-date'
        : Math.abs(row.delta) <= 1 ? 'ok'
        : year > row.claimed ? 'mb-later-reissue-date'
        : 'mb-earlier';
    } else {
      row.candidates = groups.slice(0, 3).map((g) => `${g['artist-credit']?.[0]?.name} — ${g.title} (${g['first-release-date'] || '?'})`);
    }
  } catch (e) {
    row.status = 'error';
    row.error = String(e.message);
  }
  out.push(row);
  if (i % 15 === 0) process.stderr.write(`  …${i}/${todo.length}\n`);
  await sleep(1100);
}

writeFileSync(join(root, 'build/mb-retry.json'), JSON.stringify(out, null, 2) + '\n');
const counts = {};
for (const r of out) counts[r.status] = (counts[r.status] ?? 0) + 1;
console.log('Retry summary (' + out.length + ' albums)');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
console.log('\nStill unmatched or contradicted:');
for (const r of out.filter((x) => x.status !== 'ok' && x.status !== 'mb-later-reissue-date')) {
  console.log(`  [${r.status}] ${r.id} | ${r.artist} — ${r.title} (claimed ${r.claimed})` +
    (r.mbTitle ? ` | MB: ${r.mbArtist} — ${r.mbTitle} (${r.mbFirstRelease})` : '') +
    (r.candidates?.length ? ` | near: ${r.candidates.join(' ; ')}` : ''));
}
