/**
 * Streaming links.
 *
 * Deliberately search URLs only — no hardcoded album/track IDs. Spotify, Apple
 * Music and NetEase IDs are opaque strings that cannot be derived from metadata,
 * and inventing them produces links that quietly go to the wrong record.
 */

import { el } from './utils.js?v=3';
import { t } from '../i18n.js?v=3';

export const SERVICES = [
  { id: 'spotify', name: 'Spotify', short: 'S', title: 'Search on Spotify' },
  { id: 'appleMusic', name: 'Apple Music', short: 'A', title: 'Search on Apple Music' },
  { id: 'netease', name: 'NetEase Cloud Music', short: '网', title: 'Search on NetEase Cloud Music (网易云音乐)' },
];

export function searchUrl(service, artist, title) {
  const plain = `${artist} ${title}`;
  const q = encodeURIComponent(plain);
  switch (service) {
    case 'spotify':
      return `https://open.spotify.com/search/${q}`;
    case 'appleMusic':
      return `https://music.apple.com/us/search?term=${q}`;
    case 'netease':
      return `https://music.163.com/#/search/m/?s=${encodeURIComponent(plain)}&type=10`;
    default:
      return '#';
  }
}

/**
 * Three small icon buttons. The user's preferred service (persisted in
 * localStorage) is rendered first and marked as the default.
 */
export function serviceLinks(album, preferred = 'spotify') {
  const ordered = [
    ...SERVICES.filter((s) => s.id === preferred),
    ...SERVICES.filter((s) => s.id !== preferred),
  ];
  return el(
    'div',
    { class: 'svc', role: 'group', 'aria-label': t('service.listen', { artist: album.artist, title: album.title }) },
    ordered.map((s, i) =>
      el('a', {
        class: 'svc__btn' + (i === 0 ? ' is-default' : ''),
        href: searchUrl(s.id, album.artist, album.title),
        target: '_blank',
        rel: 'noopener noreferrer',
        title: `${t(`service.${s.id}`)}: ${album.artist} – ${album.title}`,
        'aria-label': `${t(`service.${s.id}`)}: ${album.artist}, ${album.title}`,
        text: s.short,
      })
    )
  );
}
