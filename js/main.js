/** Wiring: load data, mount views, own the tab switcher and the global chrome. */

import * as store from './store.js?v=2';
import { loadData } from './data.js?v=3';
import { el, $, announce } from './lib/utils.js?v=3';
import { SERVICES } from './lib/links.js?v=6';
import * as graph from './views/graph.js?v=3';
import * as timeline from './views/timeline.js?v=3';
import * as grid from './views/grid.js?v=3';
import * as pathsView from './views/paths.js?v=3';
import * as panel from './views/panel.js?v=4';
import { setLocale, t } from './i18n.js?v=3';

const VIEWS = [
  ['graph', 'view.graph', 'view.graph.title'],
  ['timeline', 'view.timeline', 'view.timeline.title'],
  ['grid', 'view.grid', 'view.grid.title'],
  ['paths', 'view.paths', 'view.paths.title'],
];

const NARROW = 720;
const isNarrow = () => window.matchMedia(`(max-width: ${NARROW}px)`).matches;
const viewTrail = [];
let activeViewForBack = null;
let restoringViewFromBack = false;

boot();

async function boot() {
  const requestedLocale = new URLSearchParams(location.search).get('lang');
  if (requestedLocale === 'en' || requestedLocale === 'zh-CN') {
    store.set({ locale: requestedLocale });
  }
  setLocale(store.get().locale);
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  applyTheme(store.get().theme);

  const data = await loadData(store.get().locale);
  const app = $('#app');
  // The <noscript> block never renders while scripting is on, but dropping it
  // keeps the DOM honest for anything reading the page after boot.
  $('#noscript-fallback')?.remove();

  app.replaceChildren(
    masthead(),
    el('main', { class: 'main', id: 'main', tabindex: '-1' },
      viewShell('graph'), viewShell('timeline'), viewShell('grid'), viewShell('paths')
    ),
    footer(data.source)
  );

  panel.mount(document.body);
  graph.mount($('#view-graph'));
  timeline.mount($('#view-timeline'));
  grid.mount($('#view-grid'));
  pathsView.mount($('#view-paths'));

  // On phones the DAG is unreadable, so open on the grid instead — but only if
  // the user has not chosen a view before.
  const persistedView = store.get().view;
  const startView = isNarrow() && persistedView === 'graph' ? 'grid' : persistedView;

  store.set({ ...data, year: data.present, view: startView });
  syncViews(startView);
  activeViewForBack = startView;
  window.__jazztreeHandleBack = handleInAppBack;
  if (isNarrow() && startView === 'grid') {
    announce(t('narrow.opened'));
  }

  store.subscribe((state, changed) => {
    if (changed.includes('view')) {
      if (activeViewForBack != null && state.view !== activeViewForBack) {
        if (restoringViewFromBack) {
          restoringViewFromBack = false;
        } else {
          viewTrail.push(activeViewForBack);
          if (viewTrail.length > 24) viewTrail.shift();
        }
        activeViewForBack = state.view;
      }
      syncViews(state.view);
    }
    if (changed.includes('theme')) applyTheme(state.theme);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    const i = VIEWS.findIndex(([id]) => id === store.get().view);
    if (e.key === ']') store.set({ view: VIEWS[(i + 1) % VIEWS.length][0] });
    if (e.key === '[') store.set({ view: VIEWS[(i - 1 + VIEWS.length) % VIEWS.length][0] });
    if (e.key === '/') { e.preventDefault(); store.set({ view: 'grid' }); setTimeout(() => $('#grid-search')?.focus(), 60); }
  });

  // First paint of the view we opened on.
  requestAnimationFrame(() => rebuild(startView));
}

/** Called by the Android shell before it considers leaving the Activity. */
function handleInAppBack() {
  if (document.querySelector('.edge-pop:not([hidden])')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return true;
  }
  if (store.get().selectedGenre) {
    store.set({ selectedGenre: null });
    return true;
  }
  const previousView = viewTrail.pop();
  if (previousView) {
    restoringViewFromBack = true;
    store.set({ view: previousView });
    return true;
  }
  return false;
}

function viewShell(id) {
  return el('section', {
    class: 'view', id: `view-${id}`,
    role: 'tabpanel', 'aria-labelledby': `tab-${id}`, tabindex: '-1',
  });
}

function masthead() {
  const tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': t('views.label') },
    VIEWS.map(([id, labelKey, titleKey]) =>
      el('button', {
        class: 'tabs__btn', id: `tab-${id}`, role: 'tab', type: 'button',
        'aria-selected': 'false', 'aria-controls': `view-${id}`, title: t(titleKey),
        text: t(labelKey),
        onclick: () => store.set({ view: id }),
      })
    )
  );

  const service = el('select', {
    class: 'select', 'aria-label': t('service.label'),
    title: t('service.title'),
    onchange: (e) => store.set({ service: e.target.value }),
  }, SERVICES.map((s) => el('option', { value: s.id, text: t(`service.name.${s.id}`), selected: store.get().service === s.id })));

  const gentle = el('button', {
    class: 'chip', type: 'button', id: 'gentle-btn',
    'aria-pressed': store.get().gentle ? 'true' : 'false',
    title: t('gentle.title'),
    text: t('gentle'),
    onclick: () => {
      const next = !store.get().gentle;
      store.set({ gentle: next });
      gentle.setAttribute('aria-pressed', next ? 'true' : 'false');
      announce(t(next ? 'gentle.on' : 'gentle.off'));
    },
  });

  const themeBtn = el('button', {
    class: 'icon-btn', type: 'button',
    title: t('theme'),
    'aria-label': t('theme'),
    text: store.get().theme === 'dark' ? '☾' : '☀',
    onclick: () => {
      const next = store.get().theme === 'dark' ? 'light' : 'dark';
      store.set({ theme: next });
      themeBtn.textContent = next === 'dark' ? '☾' : '☀';
    },
  });

  const language = el('a', {
    class: 'icon-btn locale-btn', id: 'language-btn',
    'aria-label': t('language'), title: t('language'),
    href: store.get().locale === 'zh-CN' ? '?lang=en' : '?lang=zh-CN',
    text: store.get().locale === 'zh-CN' ? t('locale.switchEnglish') : '简中',
  });

  return el('header', { class: 'masthead' },
    el('a', { class: 'skip-link', href: '#main', text: t('skip') }),
    el('div', { class: 'brand' },
      el('span', { class: 'brand__mark' }, 'Jazz', el('em', { text: 'Tree' })),
      el('span', { class: 'brand__tag', text: t('brand.tag') })
    ),
    tabs,
    el('div', { class: 'mast-tools' }, gentle, service, language, themeBtn)
  );
}

function footer(source) {
  const { genres, albums, lineage } = store.get();
  return el('footer', { class: 'site-foot' },
    el('p', {},
      t('footer.stats', { genres: genres.length || 39, edges: lineage.length || 103, albums: albums.length || 351 }),
      t('footer.sources.before'),
      el('a', { href: 'research/notes.md', text: 'research/notes.md' }),
      t('footer.sources.middle'),
      el('a', { href: 'DECISIONS.md', text: 'DECISIONS.md' }),
      t('footer.sources.after')
    ),
    el('p', { text: t('footer.streaming') }),
    el('p', { style: 'color:var(--ink-4)', text: source === 'inline' ? t('footer.inline') : '' })
  );
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function syncViews(view) {
  for (const [id] of VIEWS) {
    const tab = $(`#tab-${id}`);
    const panelEl = $(`#view-${id}`);
    const on = id === view;
    tab?.setAttribute('aria-selected', on ? 'true' : 'false');
    tab?.setAttribute('tabindex', on ? '0' : '-1');
    panelEl?.classList.toggle('is-active', on);
  }
  rebuild(view);
}

const built = new Set();
function rebuild(view) {
  if (!store.get().genres.length) return;
  const first = !built.has(view);
  built.add(view);
  if (view === 'graph') graph.build();
  if (view === 'timeline') timeline.build();
  if (view === 'grid' && first) grid.build();
  if (view === 'paths' && first) pathsView.build();
}
