/**
 * The whole application state lives here. Views subscribe; nothing reads state
 * out of DOM attributes. `set()` shallow-merges and notifies every subscriber
 * with (state, changedKeys).
 */

const LS_KEY = 'jazztree.v1';

const persistedKeys = ['theme', 'service', 'view', 'pathProgress', 'gentle', 'locale'];

function loadPersisted() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return Object.fromEntries(Object.entries(parsed).filter(([k]) => persistedKeys.includes(k)));
  } catch {
    return {};
  }
}

const prefersLight =
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
const prefersChinese =
  typeof navigator !== 'undefined' && /^zh\b/i.test(navigator.language ?? '');

const initial = {
  // data (filled once by main.js)
  genres: [],
  lineage: [],
  families: [],
  eras: [],
  albums: [],
  paths: [],
  present: 2027,

  // navigation
  view: 'graph',            // graph | timeline | grid | paths
  selectedGenre: null,      // genre id
  selectedEdge: null,       // "from->to"
  hoverGenre: null,

  // graph controls
  aspects: [],              // active aspect filters; [] means "no filter"
  year: 2027,               // time scrubber position
  scrubbing: false,

  // grid controls
  gridSort: 'era',          // era | name | family | difficulty
  gridFamily: 'all',
  search: '',

  // preferences
  theme: prefersLight ? 'light' : 'dark',
  service: 'spotify',       // spotify | appleMusic | netease
  gentle: false,            // "gentle path": hide difficulty >= 4 albums
  pathProgress: {},         // { [pathId + ':' + albumId]: true }
  locale: prefersChinese ? 'zh-CN' : 'en',
};

const state = { ...initial, ...loadPersisted() };
const subscribers = new Set();

function persist() {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify(Object.fromEntries(persistedKeys.map((k) => [k, state[k]])))
    );
  } catch {
    /* private browsing, quota, file:// restrictions — non-fatal */
  }
}

export function get() {
  return state;
}

export function set(patch) {
  const changed = [];
  for (const [k, v] of Object.entries(patch)) {
    if (state[k] !== v) {
      state[k] = v;
      changed.push(k);
    }
  }
  if (!changed.length) return;
  if (changed.some((k) => persistedKeys.includes(k))) persist();
  for (const fn of subscribers) fn(state, changed);
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Convenience: true when any of `keys` appear in the changed list. */
export function touched(changed, ...keys) {
  return keys.some((k) => changed.includes(k));
}
