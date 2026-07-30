/**
 * Card grid — searchable, sortable, and the default view on narrow screens
 * where the DAG is unreadable.
 */

import * as store from '../store.js?v=2';
import { el, eraSpanLabel, matches, debounce, announce } from '../lib/utils.js?v=2';
import { NARRATIVE_FAMILY_ORDER as FAMILY_ORDER } from '../lib/layout.js';
import { familyBlurb, familyShort, genreName, genreOneLine, t } from '../i18n.js?v=2';

const SORTS = [
  ['era', 'grid.sort.era'],
  ['name', 'grid.sort.name'],
  ['family', 'grid.sort.family'],
  ['difficulty', 'grid.sort.difficulty'],
];

let wrap, cardsEl, countEl;

export function mount(container) {
  wrap = el('div', { class: 'grid-wrap' });
  container.append(wrap);

  store.subscribe((state, changed) => {
    if (changed.includes('genres')) build();
    if (changed.some((k) => ['search', 'gridSort', 'gridFamily', 'selectedGenre', 'gentle'].includes(k))) {
      renderCards();
    }
  });
}

export function build() {
  const state = store.get();
  if (!state.genres.length) return;

  const search = el('input', {
    class: 'filters__search', type: 'search', id: 'grid-search',
    placeholder: t('grid.search.placeholder'),
    'aria-label': t('grid.search.label'),
    value: state.search,
    oninput: debounce((e) => store.set({ search: e.target.value }), 140),
  });

  const famChips = [
    el('button', {
      class: 'chip', type: 'button', dataset: { fam: 'all' },
      'aria-pressed': state.gridFamily === 'all' ? 'true' : 'false',
      text: t('grid.allFamilies'),
      onclick: () => store.set({ gridFamily: 'all' }),
    }),
    ...FAMILY_ORDER.map((fid) => {
      const f = state.families.find((x) => x.id === fid);
      return el('button', {
        class: 'chip', type: 'button', dataset: { fam: fid },
        'aria-pressed': state.gridFamily === fid ? 'true' : 'false',
        title: f ? familyBlurb(f) : '',
        onclick: () => store.set({ gridFamily: fid }),
      },
        el('span', { class: 'chip__dot', style: `background: var(--fam-${fid})` }),
        f ? familyShort(f) : fid
      );
    }),
  ];

  const sortSel = el('select', {
    class: 'select', id: 'grid-sort', 'aria-label': t('grid.sort.label'),
    onchange: (e) => store.set({ gridSort: e.target.value }),
  }, SORTS.map(([v, key]) => el('option', { value: v, text: t(key), selected: state.gridSort === v })));

  countEl = el('span', { style: 'font-size:var(--step--2);color:var(--ink-4);margin-left:auto' });

  // On phones this is the landing view, so the lineage graph needs an explicit
  // way in — it is unreadable at 375px without pinch-zooming.
  const toGraph = el('button', {
    class: 'chip graph-cta', type: 'button',
    onclick: () => store.set({ view: 'graph' }),
    text: t('grid.graphCta'),
    title: t('grid.graphCta.title'),
  });

  wrap.replaceChildren(
    el('div', { class: 'intro is-compact' },
      el('h2', { class: 'intro__title', text: t('grid.title') }),
      el('p', { class: 'intro__lede', text: t('grid.lede') }),
      el('p', { class: 'graph-cta-wrap' },
        toGraph,
        el('span', { class: 'note-inline', text: t('grid.wideNote') })
      )
    ),
    el('div', { class: 'filters' }, search, famChips, sortSel, countEl),
    (cardsEl = el('div', { class: 'cards', role: 'list' }))
  );
  renderCards();
}

function easiestDifficulty(genreId, albums) {
  const own = albums.filter((a) => a.genreIds[0] === genreId);
  return own.length ? Math.min(...own.map((a) => a.difficulty)) : 5;
}

function renderCards() {
  const state = store.get();
  if (!cardsEl) return;

  const q = state.search.trim();
  let list = state.genres.filter((g) => {
    if (state.gridFamily !== 'all' && g.family !== state.gridFamily) return false;
    if (!q) return true;
    const hay = [
      g.name, genreName(g), g.oneLine, g.summary, g.contested, g.origin.city, g.origin.country,
      ...(g.aka ?? []), ...g.keyLabels, ...g.keyFigures.map((f) => `${f.name} ${f.instrument}`),
      ...g.earMarkers,
    ].join(' ');
    return matches(hay, q);
  });

  const famIndex = (g) => FAMILY_ORDER.indexOf(g.family);
  const sorters = {
    era: (a, b) => a.era.start - b.era.start || a.name.localeCompare(b.name),
    name: (a, b) => genreName(a).localeCompare(genreName(b)),
    family: (a, b) => famIndex(a) - famIndex(b) || a.era.start - b.era.start,
    difficulty: (a, b) =>
      easiestDifficulty(a.id, state.albums) - easiestDifficulty(b.id, state.albums) ||
      a.era.start - b.era.start,
  };
  list = [...list].sort(sorters[state.gridSort] ?? sorters.era);

  countEl.textContent = t('grid.count', { shown: list.length, total: state.genres.length });

  if (!list.length) {
    cardsEl.replaceChildren(el('p', { class: 'empty', text: t('grid.empty', { query: q }) }));
    return;
  }

  cardsEl.replaceChildren(
    ...list.map((g) => {
      const gateway = state.albums.find((a) => a.genreIds[0] === g.id && a.tier === 'gateway');
      const count = state.albums.filter((a) => a.genreIds.includes(g.id)).length;
      const fam = state.families.find((f) => f.id === g.family);
      return el('button', {
        class: 'card', type: 'button', role: 'listitem',
        style: `--fam: var(--fam-${g.family})`,
        'aria-label': `${genreName(g)}. ${genreOneLine(g)}`,
        onclick: () => store.set({ selectedGenre: g.id }),
      },
        el('span', { class: 'card__fam', 'aria-hidden': 'true' }),
        el('span', { class: 'card__years', text: eraSpanLabel(g, state.present) }),
        el('h3', { class: 'card__name', text: genreName(g) }),
        el('p', { class: 'card__one', text: genreOneLine(g) }),
        el('div', { class: 'card__foot' },
          el('span', { class: 'tag', style: `--fam: var(--fam-${g.family})`, text: fam ? familyShort(fam) : g.family }),
          gateway ? el('span', { text: t('grid.start', { artist: gateway.artist, title: gateway.title }) }) : null,
          el('span', { text: t('grid.records', { count }) })
        )
      );
    })
  );
  if (q) announce(t('grid.matches', { count: list.length, query: q }));
}
