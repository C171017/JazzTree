/** Apply editorial translations while retaining canonical metadata for search. */

function canonicalGenreSearch(genre) {
  return [
    genre.name, genre.oneLine, genre.summary, genre.contested,
    genre.origin?.city, genre.origin?.country,
    ...(genre.aka ?? []), ...(genre.keyLabels ?? []), ...(genre.earMarkers ?? []),
    ...Object.values(genre.musicalTraits ?? {}),
    ...(genre.keyFigures ?? []).flatMap((figure) => [figure.name, figure.instrument, figure.why]),
  ].filter(Boolean).join(' ');
}

export function localizeData(data, locale) {
  if (locale !== 'zh-CN') return data;
  const table = globalThis.__JAZZ_ZH_CN__;
  if (!table) throw new Error('Simplified Chinese content bundle did not load.');

  // Language changes reload the web page, so localising one cloned snapshot keeps
  // renderers simple and leaves the canonical fallback untouched.
  // The payload is plain JSON. This clone also works on older Android WebViews
  // that predate the structuredClone browser API.
  const localized = JSON.parse(JSON.stringify(data));

  localized.genres = localized.genres.map((genre, index) => {
    const source = data.genres[index];
    const zh = table.genres[genre.id];
    if (!zh) throw new Error(`Missing Simplified Chinese genre content: ${genre.id}`);
    return {
      ...genre,
      aka: zh.aka,
      origin: zh.origin,
      summary: zh.summary,
      musicalTraits: zh.musicalTraits,
      earMarkers: zh.earMarkers,
      keyFigures: genre.keyFigures.map((figure) => {
        const translated = zh.keyFigures[figure.name];
        if (!translated) {
          throw new Error(`Missing Simplified Chinese key-figure content: ${genre.id}/${figure.name}`);
        }
        return { ...figure, instrument: translated.instrument, why: translated.why };
      }),
      contested: zh.contested,
      __canonicalSearch: canonicalGenreSearch(source),
    };
  });

  localized.lineage = localized.lineage.map((edge) => {
    const id = `${edge.from}->${edge.to}`;
    const zh = table.lineage[id];
    if (!zh) throw new Error(`Missing Simplified Chinese lineage content: ${id}`);
    return { ...edge, explanation: zh.explanation };
  });

  localized.albums = localized.albums.map((album) => {
    const zh = table.albums[album.id];
    if (!zh) throw new Error(`Missing Simplified Chinese album content: ${album.id}`);
    if (album.note != null && !zh.note) {
      throw new Error(`Missing Simplified Chinese album note: ${album.id}`);
    }
    return {
      ...album,
      whyThisOne: zh.whyThisOne,
      listenFor: zh.listenFor,
      note: album.note == null ? album.note : zh.note,
    };
  });

  localized.paths = localized.paths.map((path) => {
    const zh = table.paths[path.id];
    if (!zh) throw new Error(`Missing Simplified Chinese path content: ${path.id}`);
    return {
      ...path,
      steps: path.steps.map((step) => {
        const bridge = zh.bridges[step.albumId];
        if (!bridge) {
          throw new Error(`Missing Simplified Chinese path transition: ${path.id}/${step.albumId}`);
        }
        return { ...step, bridge };
      }),
    };
  });

  return localized;
}
