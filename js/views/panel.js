/** Slide-in genre profile: prose, ear markers, traits, figures, and the three album tiers. */

import { el, eraSpanLabel, difficultyDots, difficultyLabel, announce } from '../lib/utils.js?v=2';
import { serviceLinks } from '../lib/links.js?v=2';
import * as store from '../store.js?v=2';
import { aspectLabel, familyName, genreName, genreOneLine, t } from '../i18n.js?v=2';

let root, scrim, lastFocus;

export function mount(container) {
  scrim = el('div', { class: 'scrim', onclick: close });
  root = el('aside', {
    class: 'panel',
    id: 'genre-panel',
    role: 'dialog',
    'aria-modal': 'false',
    'aria-label': t('panel.aria'),
    tabindex: '-1',
    hidden: true,
  });
  container.append(scrim, root);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && store.get().selectedGenre) close();
  });

  store.subscribe((state, changed) => {
    if (changed.includes('selectedGenre')) {
      state.selectedGenre ? open(state.selectedGenre) : hide();
    } else if (state.selectedGenre && (changed.includes('service') || changed.includes('gentle'))) {
      render(state.selectedGenre);
    }
  });
}

function close() {
  store.set({ selectedGenre: null });
}

function hide() {
  root.classList.remove('is-open');
  scrim.classList.remove('is-open');
  setTimeout(() => {
    if (!store.get().selectedGenre) root.hidden = true;
  }, 240);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function open(id) {
  lastFocus = document.activeElement;
  root.hidden = false;
  render(id);
  requestAnimationFrame(() => {
    root.classList.add('is-open');
    scrim.classList.add('is-open');
    root.focus();
  });
}

function albumsFor(genreId) {
  const { albums } = store.get();
  const primary = albums.filter((a) => a.genreIds[0] === genreId);
  const also = albums.filter((a) => a.genreIds.includes(genreId) && a.genreIds[0] !== genreId);
  return { primary, also };
}

function render(id) {
  const state = store.get();
  const g = state.genres.find((x) => x.id === id);
  if (!g) return;
  const fam = state.families.find((f) => f.id === g.family);
  const { primary, also } = albumsFor(id);
  const gentle = state.gentle;
  const keep = (a) => !gentle || a.difficulty <= 3;

  root.replaceChildren(
    el('header', { class: 'panel__head' },
      el('div', {},
        el('h2', { class: 'panel__title', id: 'panel-title', text: genreName(g) }),
        el('div', { class: 'panel__sub', text: `${eraSpanLabel(g, state.present)} · ${g.origin.city} · ${fam ? familyName(fam) : g.family}` })
      ),
      el('button', {
        class: 'icon-btn panel__close', onclick: close,
        'aria-label': t('panel.close'), text: '✕',
      })
    ),
    el('div', { class: 'panel__body' },
      el('p', { class: 'panel__one', text: genreOneLine(g) }),
      g.aka?.length ? el('p', { class: 'note-inline', text: t('panel.alsoCalled', { names: g.aka.join(' · ') }) }) : null,
      el('p', { text: g.summary }),

      section(t('panel.listenFor'), el('ul', { class: 'ear' }, g.earMarkers.map((m) => el('li', { text: m })))),

      section(t('panel.how'), el('dl', { class: 'dl' },
        Object.entries(g.musicalTraits).flatMap(([k, v]) => [
          el('dt', { text: aspectLabel(k) }),
          el('dd', { text: v }),
        ])
      )),

      section(t('panel.figures'), el('ul', { class: 'figures' },
        g.keyFigures.map((f) =>
          el('li', {},
            el('b', { text: f.name }), ' ',
            el('i', { text: f.instrument }),
            el('br'),
            f.why
          )
        )
      )),

      section(t('panel.labels'), el('p', { class: 'note-inline', text: g.keyLabels.join(' · ') })),

      section(t('panel.contested'), el('p', { class: 'contested', text: g.contested })),

      section(
        t('panel.hear'),
        el('div', {},
          ['gateway', 'core', 'deep'].map((tier) => {
            const list = primary.filter((a) => a.tier === tier).filter(keep);
            if (!list.length) return null;
            return el('div', { class: 'tier' },
              el('div', { class: 'tier__h' }, el('b', { text: t(`panel.${tier}`) }), el('span', { text: t(`panel.${tier}.note`) })),
              list.map((a) => albumCard(a, state.service))
            );
          }),
          also.filter(keep).length
            ? el('div', { class: 'tier' },
                el('div', { class: 'tier__h' },
                  el('b', { text: t('panel.alsoFiled') }),
                  el('span', { text: t('panel.alsoFiled.note') })
                ),
                also.filter(keep).map((a) => albumCard(a, state.service, true))
              )
            : null,
          gentle && primary.some((a) => a.difficulty > 3)
            ? el('p', { class: 'note-inline', text: t('panel.gentleHidden') })
            : null
        )
      )
    )
  );
  root.setAttribute('aria-label', t('panel.profileAria', { name: genreName(g) }));
  announce(t('panel.opened', { name: genreName(g) }));
}

function section(title, body) {
  return el('section', { class: 'sec' }, el('h3', { class: 'sec__h', text: title }), body);
}

export function albumCard(a, service, showGenre = false) {
  const state = store.get();
  const facts = [
    a.recorded === a.released ? t('album.recordedReleased', { year: a.recorded }) : t('album.recorded', { recorded: a.recorded, released: a.released ?? '—' }),
    a.label + (a.catalogNo ? ` ${a.catalogNo}` : ''),
    a.startTrack ? t('album.startWith', { track: a.startTrack }) : null,
  ].filter(Boolean);

  return el('article', { class: 'album' + (a.tier === 'gateway' ? ' album--gateway' : '') },
    el('div', { class: 'album__top' },
      el('div', { class: 'album__id' },
        el('div', { class: 'album__artist', text: a.artist }),
        el('div', { class: 'album__title', text: a.title })
      )
    ),
    el('div', { class: 'album__facts' }, facts.map((f) => el('span', { text: f }))),
    showGenre
      ? el('div', { class: 'album__facts' },
          el('span', { text: t('album.filedUnder', { genres: a.genreIds.map((id) => {
            const genre = state.genres.find((g) => g.id === id);
            return genre ? genreName(genre) : id;
          }).join(', ') }) })
        )
      : null,
    el('p', { class: 'album__why', text: a.whyThisOne }),
    el('p', { class: 'album__listen' }, el('b', { text: t('album.listenFor') }), a.listenFor),
    a.note ? el('p', { class: 'note-inline', text: t('album.note', { note: a.note }) }) : null,
    el('div', { class: 'album__foot' },
      el('span', {
        class: 'diff',
        title: t('album.difficulty', { difficulty: a.difficulty, label: difficultyLabel(a.difficulty) }),
        text: `${difficultyDots(a.difficulty)} ${difficultyLabel(a.difficulty)}`,
      }),
      a.confidence !== 'high'
        ? el('span', {
            class: 'conf conf--' + a.confidence,
            title: a.note || t('album.weak'),
            text: t('album.confidence', { confidence: t(`confidence.${a.confidence}`) }),
          })
        : null,
      serviceLinks(a, service)
    )
  );
}
