#!/usr/bin/env node
/**
 * Resolve JazzTree albums to verified Apple Music album URLs.
 *
 * Apple Music's public, server-rendered search pages are used instead of the
 * legacy iTunes Search API. This has three useful properties for JazzTree: the
 * result is a real Music-app deep link, it reflects the requested storefront,
 * and an ambiguous album can be verified against its public track listing.
 *
 * Usage:
 *   node build/resolve-apple-music.js [--storefront=CN] [--delay=650]
 *     [--ids=album-id,album-id] [--limit=25] [--dry-run=true]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const albums = JSON.parse(readFileSync(join(root, 'data/albums.json'), 'utf8'));
const mbReport = JSON.parse(readFileSync(join(root, 'build/mb-report.json'), 'utf8'));
const mbRetry = JSON.parse(readFileSync(join(root, 'build/mb-retry.json'), 'utf8'));
const mbByID = new Map([...mbReport, ...mbRetry].map((row) => [row.id, row]));

const arg = (name, fallback) => {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback;
};
const storefront = arg('storefront', 'CN').toUpperCase();
let requestDelay = Number(arg('delay', '650'));
const requestedIDs = new Set(arg('ids', '').split(',').map((value) => value.trim()).filter(Boolean));
const limit = Math.max(1, Number(arg('limit', String(albums.length))) || albums.length);
const dryRun = arg('dry-run', 'false') === 'true';
const selectedAlbums = (requestedIDs.size ? albums.filter((album) => requestedIDs.has(album.id)) : albums).slice(0, limit);
const cacheDir = arg('cache', `/tmp/jazztree-apple-music-web-${storefront.toLowerCase()}`);
mkdirSync(cacheDir, { recursive: true });
// Apple credits these releases under the composer, band name, or individual
// members rather than JazzTree's historically useful lead credit. Their pages
// and track lists were inspected manually during the catalog pass.
const VERIFIED_CREDIT_EXCEPTIONS = new Set([
  'nec-red-back-book',
  'eddie-palmieri-harlem-river-drive',
  'bobo-stenson-goodbye',
]);
const VERIFIED_EDITION_EXCEPTIONS = new Set([
  // Apple adds both the original mix and edition wording; the page contains
  // the correct 1958 program and the JazzTree start track, "Angel Eyes".
  'frank-sinatra-only-the-lonely',
]);
const MANUALLY_VERIFIED_COLLECTIONS = new Map([
  // Apple splits "Diminuendo and Crescendo in Blue" across the complete
  // Newport program, so a literal single-track comparison cannot succeed.
  ['ellington-at-newport-1956', '999653079'],
  // "Streams" is the name of the continuous improvised suite; Apple exposes
  // its instrumental sections as three separate tracks.
  ['sam-rivers-streams', '1438788039'],
  // The public page matches artist, title, live venue era, release year, and the
  // original seven-track program even though JazzTree's cue is not indexed.
  ['steve-coleman-curves-of-life', '575859987'],
]);
let lastRequestAt = 0;
let requestCount = 0;
let cacheHits = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const norm = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[‘’´]/g, "'")
  .replace(/[–—]/g, '-')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'on', 'at', 'for', 'to', 'his', 'her', 'feat', 'featuring', 'with']);
const tokenSet = (value) => new Set(norm(value).split(' ').filter((token) => token.length > 1 && !STOP.has(token)));
const intersection = (a, b) => [...a].filter((value) => b.has(value));

function similarity(a, b) {
  const A = norm(a), B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const aTokens = tokenSet(A), bTokens = tokenSet(B);
  if (!aTokens.size || !bTokens.size) return 0;
  const common = intersection(aTokens, bTokens).length;
  const dice = (2 * common) / (aTokens.size + bTokens.size);
  const containment = common / Math.min(aTokens.size, bTokens.size);
  const phrase = A.includes(B) || B.includes(A) ? 0.92 : 0;
  return Math.max(dice, containment * 0.9, phrase);
}

function baseTitle(title) {
  return title
    .split(/[:\[(]/)[0]
    .replace(/\s+(?:19|20)\d{2}\s*[-–/]\s*(?:(?:19|20)?\d{2})\s*$/, '')
    .trim() || title;
}

function artistParts(artist) {
  const values = [artist, ...artist.split(/\s+(?:&|\/|with|feat\.?|featuring)\s+/i)];
  return [...new Set(values.map((value) => value.replace(/\s+and\s+(?:his|her|the)\s+.*$/i, '').trim()).filter(Boolean))];
}

function candidateScore(album, candidate) {
  const fullTitle = similarity(album.title, candidate.collectionName);
  const reducedTitle = similarity(baseTitle(album.title), baseTitle(candidate.collectionName)) * 0.92;
  const title = Math.max(fullTitle, reducedTitle);
  const artist = Math.max(...artistParts(album.artist).map((want) => similarity(want, candidate.artistName)));
  let score = title * 68 + artist * 32;
  const found = norm(candidate.collectionName);
  const wanted = norm(album.title);
  if ((candidate.trackCount ?? 3) <= 2 || /\bsingle\b/.test(found)) score -= 32;
  if (/\blive\b/.test(found) && !/\blive\b/.test(wanted)) score -= 18;
  if (/\btribute\b/.test(found) && !/\btribute\b/.test(wanted)) score -= 22;
  return { title, artist, score };
}

function creditIsPlausible(album, candidate, artistScore) {
  return artistScore >= 0.5
    || /[\u3400-\u9fff]/u.test(candidate.artistName)
    || VERIFIED_CREDIT_EXCEPTIONS.has(album.id);
}

function queryVariants(album) {
  const primaryArtist = artistParts(album.artist).slice(1).sort((a, b) => a.length - b.length)[0] ?? album.artist;
  const mb = mbByID.get(album.id);
  const variants = [
    `${primaryArtist} ${baseTitle(album.title)}`,
    `${album.artist} ${album.title}`,
    album.title,
  ];
  if (mb?.mbTitle || mb?.mbArtist) variants.push(`${mb.mbArtist ?? primaryArtist} ${mb.mbTitle ?? baseTitle(album.title)}`);
  if (album.catalogNo) variants.push(`${primaryArtist} ${album.catalogNo}`);
  if (album.startTrack) variants.push(`${primaryArtist} ${album.startTrack} ${baseTitle(album.title)}`);
  return [...new Set(variants.map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean))];
}

function cachePath(url) {
  return join(cacheDir, `${createHash('sha256').update(url).digest('hex')}.html`);
}

async function page(url) {
  const path = cachePath(url);
  if (existsSync(path)) {
    cacheHits++;
    return readFileSync(path, 'utf8');
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = Math.max(0, lastRequestAt + requestDelay - Date.now());
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
    requestCount++;
    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      requestDelay = Math.max(1200, Math.ceil(requestDelay * 1.2));
      if (attempt === 4) throw error;
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if ([403, 429, 500, 502, 503, 504].includes(response.status)) {
      requestDelay = Math.max(1800, Math.ceil(requestDelay * 1.35));
      await sleep(4000 * (attempt + 1));
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    const html = await response.text();
    writeFileSync(path, html);
    return html;
  }
  throw new Error(`rate-limited after retries: ${url}`);
}

function serializedData(html) {
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = match[1].trim();
    if (!body.startsWith('{') || !body.includes('userTokenHash')) continue;
    try { return JSON.parse(body); } catch { /* try the next script */ }
  }
  throw new Error('Apple Music page did not contain serialized catalog data');
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

function albumCandidates(html) {
  const result = [];
  const seen = new Set();
  walk(serializedData(html), (item) => {
    if (item.contentDescriptor?.kind !== 'album') return;
    const collectionId = item.contentDescriptor.identifiers?.storeAdamID;
    const collectionName = item.titleLinks?.[0]?.title;
    const artistName = item.subtitleLinks?.[0]?.title;
    const rawURL = item.contentDescriptor.url;
    if (!collectionId || !collectionName || !artistName || !rawURL || seen.has(collectionId)) return;
    const collectionViewUrl = new URL(rawURL, `https://music.apple.com/${storefront.toLowerCase()}/`).toString();
    if (!collectionViewUrl.startsWith(`https://music.apple.com/${storefront.toLowerCase()}/album/`)) return;
    seen.add(collectionId);
    result.push({ collectionId, collectionName, artistName, collectionViewUrl, trackCount: item.trackCount ?? null });
  });
  return result;
}

async function search(query) {
  const url = new URL(`https://music.apple.com/${storefront.toLowerCase()}/search`);
  url.searchParams.set('term', query);
  return albumCandidates(await page(url.toString()));
}

function trackNames(html) {
  const names = [];
  walk(serializedData(html), (item) => {
    if (item.contentDescriptor?.kind !== 'song') return;
    const name = item.titleLinks?.[0]?.title ?? item.title;
    if (name) names.push(name);
  });
  return [...new Set(names)];
}

async function trackEvidence(album, candidate) {
  const names = trackNames(await page(candidate.collectionViewUrl));
  const best = names.reduce((value, name) => Math.max(value, similarity(album.startTrack, name)), 0);
  return { score: best, names };
}

function compactCandidate(item) {
  return {
    collectionId: item.candidate.collectionId,
    artist: item.candidate.artistName,
    title: item.candidate.collectionName,
    trackCount: item.candidate.trackCount ?? null,
    url: item.candidate.collectionViewUrl,
    titleScore: Number(item.metrics.title.toFixed(3)),
    artistScore: Number(item.metrics.artist.toFixed(3)),
    totalScore: Number(item.metrics.score.toFixed(1)),
    trackScore: item.trackEvidence == null ? null : Number(item.trackEvidence.score.toFixed(3)),
  };
}

async function resolve(album) {
  const queries = queryVariants(album);
  const candidatesByID = new Map();
  let usedQueries = 0;

  for (const query of queries) {
    usedQueries++;
    for (const candidate of await search(query)) {
      if (!candidatesByID.has(candidate.collectionId)) candidatesByID.set(candidate.collectionId, candidate);
    }
    const verifiedID = MANUALLY_VERIFIED_COLLECTIONS.get(album.id);
    const verified = verifiedID ? candidatesByID.get(verifiedID) : null;
    if (verified) {
      const item = { candidate: verified, metrics: candidateScore(album, verified), trackEvidence: null };
      return { status: 'resolved', method: 'manual-verified', queryCount: usedQueries, queries: queries.slice(0, usedQueries), best: compactCandidate(item) };
    }
    const rankedNow = [...candidatesByID.values()]
      .map((candidate) => ({ candidate, metrics: candidateScore(album, candidate) }))
      .sort((a, b) => b.metrics.score - a.metrics.score);
    const best = rankedNow[0], next = rankedNow[1];
    const gap = best ? best.metrics.score - (next?.metrics.score ?? 0) : 0;
    const exact = best?.metrics.title === 1 && best.metrics.artist >= 0.9;
    if (best && best.metrics.title >= 0.9 && best.metrics.artist >= 0.5 && best.metrics.score >= 78 && (exact || gap >= 4)) {
      return { status: 'resolved', method: 'metadata', queryCount: usedQueries, queries: queries.slice(0, usedQueries), best: compactCandidate(best) };
    }
    // In non-English storefronts Apple often localizes only the artist name.
    // A strong title is enough to move directly to track verification; more
    // differently-worded searches cannot repair that localization mismatch.
    if (best && best.metrics.title >= 0.9 && best.metrics.score >= 55) break;
    if (usedQueries >= 2 && best && best.metrics.score >= 70) break;
  }

  const ranked = [...candidatesByID.values()]
    .map((candidate) => ({ candidate, metrics: candidateScore(album, candidate), trackEvidence: null }))
    .sort((a, b) => b.metrics.score - a.metrics.score);

  for (const item of ranked.slice(0, 2)) {
    if (item.metrics.title < 0.55 || item.metrics.score < 38) continue;
    item.trackEvidence = await trackEvidence(album, item.candidate);
    const adjusted = item.metrics.score + item.trackEvidence.score * 28;
    if (item.metrics.title >= 0.9
        && item.trackEvidence.score >= 0.9
        && adjusted >= 72
        && creditIsPlausible(album, item.candidate, item.metrics.artist)) {
      return { status: 'resolved', method: 'track-verified', queryCount: usedQueries, queries: queries.slice(0, usedQueries), best: compactCandidate(item) };
    }
  }
  ranked.sort((a, b) =>
    (b.metrics.score + (b.trackEvidence?.score ?? 0) * 28) -
    (a.metrics.score + (a.trackEvidence?.score ?? 0) * 28)
  );

  const best = ranked[0], next = ranked[1];
  if (best?.trackEvidence?.score >= 0.82 && best.metrics.title >= 0.58) {
    const adjusted = best.metrics.score + best.trackEvidence.score * 28;
    const nextAdjusted = next ? next.metrics.score + (next.trackEvidence?.score ?? 0) * 28 : 0;
    const strongTrack = best.trackEvidence.score >= 0.9
      && (best.metrics.title >= 0.9 || VERIFIED_EDITION_EXCEPTIONS.has(album.id));
    if (adjusted >= 72
        && (strongTrack || adjusted - nextAdjusted >= 5)
        && creditIsPlausible(album, best.candidate, best.metrics.artist)) {
      return { status: 'resolved', method: 'track-verified', queryCount: usedQueries, queries: queries.slice(0, usedQueries), best: compactCandidate(best) };
    }
  }

  return {
    status: ranked.length ? 'review' : 'not-found',
    method: null,
    queryCount: usedQueries,
    queries: queries.slice(0, usedQueries),
    best: ranked[0] ? compactCandidate(ranked[0]) : null,
    candidates: ranked.slice(0, 5).map(compactCandidate),
  };
}

const report = [];
const startedAt = Date.now();
for (let index = 0; index < selectedAlbums.length; index++) {
  const album = selectedAlbums[index];
  try {
    const resolution = await resolve(album);
    report.push({ id: album.id, tier: album.tier, artist: album.artist, title: album.title, recorded: album.recorded, released: album.released ?? null, startTrack: album.startTrack, ...resolution });
  } catch (error) {
    report.push({ id: album.id, tier: album.tier, artist: album.artist, title: album.title, status: 'error', error: String(error.message ?? error) });
  }
  if ((index + 1) % 10 === 0 || index + 1 === selectedAlbums.length) {
    const resolved = report.filter((row) => row.status === 'resolved').length;
    const elapsed = ((Date.now() - startedAt) / 60000).toFixed(1);
    process.stderr.write(`  …${index + 1}/${selectedAlbums.length} · ${resolved} resolved · ${requestCount} requests · ${elapsed} min\n`);
  }
}

const resolved = report.filter((row) => row.status === 'resolved');
const unresolved = report.filter((row) => row.status !== 'resolved');
if (dryRun) {
  console.log(JSON.stringify(report, null, 2));
  console.error(`Apple Music ${storefront} dry run: ${resolved.length}/${report.length} resolved; ${unresolved.length} unresolved`);
  process.exit(0);
}

if (selectedAlbums.length !== albums.length) {
  throw new Error('Refusing to replace the catalog with a partial run. Pass --dry-run=true or remove --ids/--limit.');
}

const generated = new Date().toISOString();
const reportPath = join(root, 'build/apple-music-report.json');
writeFileSync(reportPath, JSON.stringify({ storefront, generated, requestCount, cacheHits, albums: report }, null, 2) + '\n');

const mapping = Object.fromEntries(resolved.map((row) => [row.id, {
  collectionId: row.best.collectionId,
  artist: row.best.artist,
  title: row.best.title,
  url: row.best.url,
  method: row.method,
}]));
writeFileSync(join(root, 'data/apple-music.json'), JSON.stringify({ storefront, generated, albums: mapping }, null, 2) + '\n');

const markdown = [
  '# Apple Music unresolved albums',
  '',
  `Storefront: **${storefront}**`,
  `Resolved automatically: **${resolved.length} / ${report.length}**`,
  `Needs review or unavailable: **${unresolved.length}**`,
  '',
  '| JazzTree album | Status | Best Apple candidate | Why it was not accepted |',
  '| --- | --- | --- | --- |',
  ...unresolved.map((row) => {
    const wanted = `${row.artist} — ${row.title}`.replaceAll('|', '\\|');
    const candidate = row.best ? `${row.best.artist} — ${row.best.title}`.replaceAll('|', '\\|') : 'None returned';
    const reason = row.status === 'error' ? row.error : row.best
      ? `title ${row.best.titleScore}; artist ${row.best.artistScore}; track ${row.best.trackScore ?? 'not verified'}`
      : 'No plausible album in searched results';
    return `| ${wanted} | ${row.status} | ${candidate} | ${reason} |`;
  }),
  '',
].join('\n');
writeFileSync(join(root, 'build/apple-music-unresolved.md'), markdown);

console.log(`Apple Music ${storefront}: ${resolved.length}/${report.length} resolved; ${unresolved.length} unresolved`);
console.log(`Requests: ${requestCount}; cache hits: ${cacheHits}; final delay: ${requestDelay}ms`);
console.log(`Report: ${reportPath}`);
