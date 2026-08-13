#!/usr/bin/env node
/**
 * Resolve JazzTree records to exact NetEase Cloud Music album IDs.
 *
 * NetEase's public album search endpoint is used only at build time. The app
 * ships the conservative result so a tap never waits for search and never has
 * to guess an opaque album ID.
 *
 * Usage:
 *   node build/resolve-netease.js [--concurrency=8] [--limit=25]
 *     [--ids=album-id,album-id] [--dry-run=true]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const albums = JSON.parse(readFileSync(join(root, 'data/albums.json'), 'utf8'));
const arg = (name, fallback) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};
const requestedIDs = new Set(arg('ids', '').split(',').map((value) => value.trim()).filter(Boolean));
const limit = Math.max(1, Number(arg('limit', String(albums.length))) || albums.length);
const concurrency = Math.min(12, Math.max(1, Number(arg('concurrency', '8')) || 8));
const dryRun = arg('dry-run', 'false') === 'true';
const selected = (requestedIDs.size ? albums.filter((album) => requestedIDs.has(album.id)) : albums).slice(0, limit);
const cacheDir = arg('cache', '/tmp/jazztree-netease-catalog');
mkdirSync(cacheDir, { recursive: true });

let requestCount = 0;
let cacheHits = 0;

const norm = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[‘’´]/g, "'")
  .replace(/[–—]/g, '-')
  .toLowerCase()
  .replace(/[^a-z0-9\u3400-\u9fff]+/gu, ' ')
  .trim();

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'at', 'for', 'to', 'his', 'her', 'feat', 'featuring', 'with', 'orchestra', 'quartet', 'quintet', 'sextet', 'trio']);
const tokenSet = (value) => new Set(norm(value).split(' ').filter((token) => token.length > 1 && !STOP.has(token)));

function similarity(a, b) {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const aTokens = tokenSet(A), bTokens = tokenSet(B);
  const common = [...aTokens].filter((token) => bTokens.has(token)).length;
  if (!common) return 0;
  const dice = (2 * common) / (aTokens.size + bTokens.size);
  const containment = common / Math.min(aTokens.size, bTokens.size);
  return Math.max(dice, containment * 0.92, A.includes(B) || B.includes(A) ? 0.9 : 0);
}

function baseTitle(value) {
  return String(value)
    .replace(/\s*[([](?:deluxe|expanded|complete|remaster(?:ed)?|bonus|anniversary|mono|stereo)[^\])]*[\])].*$/i, '')
    .replace(/\s+-\s+(?:deluxe|expanded|complete|remaster(?:ed)?|bonus|anniversary|mono|stereo).*$/i, '')
    .trim();
}

function artistParts(value) {
  const parts = [value, ...String(value).split(/\s+(?:&|\/|with|feat\.?|featuring|and)\s+/i)];
  return [...new Set(parts.map((part) => part.replace(/\s+(?:and\s+)?(?:his|her|the)\s+.*$/i, '').trim()).filter(Boolean))];
}

function releaseYear(candidate) {
  if (!Number.isFinite(candidate.publishTime)) return null;
  return new Date(candidate.publishTime).getUTCFullYear();
}

function metrics(album, candidate) {
  const title = Math.max(
    similarity(album.title, candidate.name),
    similarity(baseTitle(album.title), baseTitle(candidate.name)) * 0.96,
  );
  const foundArtists = [candidate.artist?.name, ...(candidate.artists ?? []).map((artist) => artist.name)].filter(Boolean);
  const artist = Math.max(0, ...artistParts(album.artist).flatMap((wanted) => foundArtists.map((found) => similarity(wanted, found))));
  let score = title * 68 + artist * 32;
  const wantedTitle = norm(album.title), foundTitle = norm(candidate.name);
  const year = releaseYear(candidate);
  const wantedYear = album.released ?? album.recorded;
  if (year != null) {
    const delta = Math.abs(year - wantedYear);
    if (delta === 0) score += 18;
    else if (delta <= 2) score += 12;
    else if (delta <= 5) score += 6;
    else if (year > wantedYear + 20) score -= 4;
  }
  if ((candidate.size ?? 3) <= 2 || /\bsingle\b/.test(foundTitle)) score -= 34;
  if (/\blive\b/.test(foundTitle) && !/\blive\b/.test(wantedTitle)) score -= 20;
  if (/\btribute\b/.test(foundTitle) && !/\btribute\b/.test(wantedTitle)) score -= 24;
  if (/\b(?:four|five|classic) albums\b/.test(foundTitle)) score -= 20;
  return { title, artist, score, year };
}

function cachePath(url) {
  return join(cacheDir, `${createHash('sha256').update(url).digest('hex')}.json`);
}

async function json(url) {
  const path = cachePath(url);
  if (existsSync(path)) {
    cacheHits++;
    return JSON.parse(readFileSync(path, 'utf8'));
  }
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    requestCount++;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Referer: 'https://music.163.com/',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        },
        signal: AbortSignal.timeout(35_000),
      });
      if ([429, 500, 502, 503, 504].includes(response.status)) throw new Error(`temporary HTTP ${response.status}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.code !== 200) throw new Error(`NetEase code ${result.code}`);
      writeFileSync(path, JSON.stringify(result));
      return result;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function search(query) {
  const url = new URL('https://interface.music.163.com/api/search/get/web');
  url.searchParams.set('s', query);
  url.searchParams.set('type', '10');
  url.searchParams.set('offset', '0');
  url.searchParams.set('total', 'true');
  url.searchParams.set('limit', '30');
  const response = await json(url.toString());
  return response.result?.albums ?? [];
}

function compact(candidate, scored) {
  return {
    albumId: String(candidate.id),
    artist: candidate.artist?.name ?? candidate.artists?.map((artist) => artist.name).join(', ') ?? '',
    title: candidate.name,
    year: scored.year,
    trackCount: candidate.size ?? null,
    titleScore: Number(scored.title.toFixed(3)),
    artistScore: Number(scored.artist.toFixed(3)),
    totalScore: Number(scored.score.toFixed(1)),
  };
}

async function resolve(album) {
  const primary = artistParts(album.artist).slice(1).sort((a, b) => a.length - b.length)[0] ?? album.artist;
  // NetEase's search behaves best with a clean album title. Artist metadata is
  // used to rank those results; the narrower combined query is only a fallback.
  const queries = [album.title, `${primary} ${baseTitle(album.title)}`];
  const byID = new Map();
  let used = 0;
  for (const query of queries) {
    used++;
    for (const candidate of await search(query)) byID.set(String(candidate.id), candidate);
    const ranked = [...byID.values()]
      .map((candidate) => ({ candidate, scored: metrics(album, candidate) }))
      .sort((a, b) => b.scored.score - a.scored.score);
    const best = ranked[0], next = ranked[1];
    if (best) {
      const gap = best.scored.score - (next?.scored.score ?? 0);
      const strongMetadata = best.scored.title >= 0.9 && best.scored.artist >= 0.5 && best.scored.score >= 78;
      const exactOriginal = best.scored.title >= 0.96 && best.scored.artist >= 0.85
        && best.scored.year != null && Math.abs(best.scored.year - (album.released ?? album.recorded)) <= 2;
      if (strongMetadata && (exactOriginal || gap >= 5)) {
        return { status: 'resolved', method: exactOriginal ? 'metadata-year' : 'metadata', queries: queries.slice(0, used), best: compact(best.candidate, best.scored) };
      }
    }
  }
  const ranked = [...byID.values()]
    .map((candidate) => ({ candidate, scored: metrics(album, candidate) }))
    .sort((a, b) => b.scored.score - a.scored.score);
  return {
    status: ranked.length ? 'review' : 'not-found',
    method: null,
    queries,
    best: ranked[0] ? compact(ranked[0].candidate, ranked[0].scored) : null,
    candidates: ranked.slice(0, 5).map((item) => compact(item.candidate, item.scored)),
  };
}

const report = new Array(selected.length);
let cursor = 0;
let completed = 0;
const startedAt = Date.now();
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= selected.length) return;
    const album = selected[index];
    try {
      report[index] = { id: album.id, tier: album.tier, artist: album.artist, title: album.title, recorded: album.recorded, released: album.released ?? null, startTrack: album.startTrack, ...await resolve(album) };
    } catch (error) {
      report[index] = { id: album.id, tier: album.tier, artist: album.artist, title: album.title, status: 'error', error: String(error.message ?? error) };
    }
    completed++;
    if (completed % 20 === 0 || completed === selected.length) {
      const resolved = report.filter((row) => row?.status === 'resolved').length;
      const elapsed = ((Date.now() - startedAt) / 60000).toFixed(1);
      process.stderr.write(`  …${completed}/${selected.length} · ${resolved} resolved · ${requestCount} requests · ${elapsed} min\n`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));

const resolved = report.filter((row) => row.status === 'resolved');
const unresolved = report.filter((row) => row.status !== 'resolved');
if (dryRun) {
  console.log(JSON.stringify(report, null, 2));
  console.error(`NetEase dry run: ${resolved.length}/${report.length} resolved; ${unresolved.length} unresolved`);
  process.exit(0);
}
if (selected.length !== albums.length) {
  throw new Error('Refusing to replace the catalog with a partial run. Pass --dry-run=true or remove --ids/--limit.');
}

const generated = new Date().toISOString();
writeFileSync(join(root, 'build/netease-report.json'), JSON.stringify({ generated, requestCount, cacheHits, albums: report }, null, 2) + '\n');
const mapping = Object.fromEntries(resolved.map((row) => [row.id, {
  albumId: row.best.albumId,
  artist: row.best.artist,
  title: row.best.title,
  year: row.best.year,
  method: row.method,
}]));
writeFileSync(join(root, 'data/netease.json'), JSON.stringify({ generated, albums: mapping }, null, 2) + '\n');
const markdown = [
  '# NetEase unresolved albums',
  '',
  `Resolved automatically: **${resolved.length} / ${report.length}**`,
  `Needs review or unavailable: **${unresolved.length}**`,
  '',
  '| JazzTree album | Status | Best NetEase candidate | Why it was not accepted |',
  '| --- | --- | --- | --- |',
  ...unresolved.map((row) => {
    const wanted = `${row.artist} — ${row.title}`.replaceAll('|', '\\|');
    const candidate = row.best ? `${row.best.artist} — ${row.best.title} (${row.best.year ?? '?'})`.replaceAll('|', '\\|') : 'None returned';
    const reason = row.status === 'error' ? row.error : row.best
      ? `title ${row.best.titleScore}; artist ${row.best.artistScore}; score ${row.best.totalScore}`
      : 'No plausible album in searched results';
    return `| ${wanted} | ${row.status} | ${candidate} | ${reason} |`;
  }),
  '',
].join('\n');
writeFileSync(join(root, 'build/netease-unresolved.md'), markdown);

console.log(`NetEase: ${resolved.length}/${report.length} resolved; ${unresolved.length} unresolved`);
console.log(`Requests: ${requestCount}; cache hits: ${cacheHits}`);
