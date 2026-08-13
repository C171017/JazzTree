/** Three curated listening routes as vertical steppers. Progress persists in localStorage. */

import * as store from '../store.js?v=2';
import { el, announce } from '../lib/utils.js?v=3';
import { albumCard } from './panel.js?v=4';
import { pathText, t } from '../i18n.js?v=3';

let wrap, activeId = 'start-here';

export function mount(container) {
  wrap = el('div', { class: 'paths-wrap' });
  container.append(wrap);

  store.subscribe((state, changed) => {
    if (changed.includes('paths')) build();
    if (changed.some((k) => ['pathProgress', 'service', 'gentle'].includes(k))) render();
  });
}

export function build() {
  const state = store.get();
  if (!state.paths.length) return;

  wrap.replaceChildren(
    el('div', { class: 'intro is-compact' },
      el('h2', { class: 'intro__title', text: t('paths.title') }),
      el('p', { class: 'intro__lede', text: t('paths.lede') })
    ),
    el('div', { class: 'path-picker', role: 'group', 'aria-label': t('paths.choose') },
      state.paths.map((p) =>
        el('button', {
          class: 'path-pick', type: 'button', dataset: { path: p.id },
          'aria-pressed': p.id === activeId ? 'true' : 'false',
          onclick: () => { activeId = p.id; build(); announce(t('paths.selected', { name: pathText(p, 'name') })); },
        },
          el('b', { text: pathText(p, 'name') }),
          el('span', { text: pathText(p, 'subtitle') })
        )
      )
    ),
    el('div', { id: 'path-body' })
  );
  render();
}

function render() {
  const state = store.get();
  const body = document.getElementById('path-body');
  if (!body) return;
  const path = state.paths.find((p) => p.id === activeId) ?? state.paths[0];
  if (!path) return;

  const done = path.steps.filter((s) => state.pathProgress[`${path.id}:${s.albumId}`]).length;
  const pct = Math.round((done / path.steps.length) * 100);

  body.replaceChildren(
    el('div', { class: 'path-head' },
      el('h3', { style: 'font-size:var(--step-2);margin-bottom:.5rem', text: pathText(path, 'name') }),
      el('p', { text: pathText(path, 'blurb') }),
      el('div', { class: 'path-progress' },
        el('span', { text: t('paths.heard', { done, total: path.steps.length }) }),
        el('span', { class: 'path-progress__bar', role: 'progressbar',
          'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100',
          'aria-label': t('paths.progress', { name: pathText(path, 'name') }) },
          el('span', { class: 'path-progress__fill', style: `width:${pct}%` })
        ),
        done ? el('button', {
          class: 'chip', type: 'button', text: t('paths.clear'),
          onclick: () => {
            const next = { ...state.pathProgress };
            for (const s of path.steps) delete next[`${path.id}:${s.albumId}`];
            store.set({ pathProgress: next });
          },
        }) : null
      )
    ),
    el('ol', { class: 'steps' },
      path.steps.map((step) => {
        const album = state.albums.find((a) => a.id === step.albumId);
        if (!album) return null;
        const key = `${path.id}:${step.albumId}`;
        const isDone = !!state.pathProgress[key];
        return el('li', { class: 'step' + (isDone ? ' is-done' : '') },
          el('p', { class: 'step__bridge', text: step.bridge }),
          albumCard(album, state.service),
          el('label', { class: 'step__check' },
            el('input', {
              type: 'checkbox', checked: isDone,
              onchange: (e) => {
                const next = { ...store.get().pathProgress };
                if (e.target.checked) next[key] = true;
                else delete next[key];
                store.set({ pathProgress: next });
              },
            }),
            `${t('paths.heardIt')}${album.startTrack ? t('paths.startWith', { track: album.startTrack }) : ''}`
          )
        );
      })
    )
  );
}
