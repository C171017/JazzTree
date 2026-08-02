/**
 * Data loading.
 *
 * Try the canonical JSON first, then fall back to window.__JAZZ_DATA__, which
 * data/data.js assigns. Both snapshots come from the same JSON files — see
 * data/build-data.js. The app itself must be served over HTTP because it uses
 * standard ES modules.
 */

import { localizeData } from './localize-data.js?v=1';

async function viaFetch() {
  const [genresFile, albums, paths] = await Promise.all([
    fetch('data/genres.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('data/albums.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    fetch('data/paths.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]);
  return { genresFile, albums, paths, source: 'fetch' };
}

function viaGlobal() {
  const d = window.__JAZZ_DATA__;
  if (!d) throw new Error('No data available: neither fetch nor data/data.js worked.');
  return { ...d, source: 'inline' };
}

export async function loadData(locale = 'en') {
  let payload;
  try {
    payload = await viaFetch();
  } catch {
    payload = viaGlobal();
  }
  const { genresFile, albums, paths, source } = payload;
  return localizeData({
    genres: genresFile.genres,
    lineage: genresFile.lineage,
    families: genresFile.families,
    eras: genresFile.eras,
    present: genresFile.meta?.present ?? 2027,
    albums,
    paths,
    source,
  }, locale);
}
