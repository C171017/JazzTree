/** Small shared helpers. No dependencies. */

import { t } from '../i18n.js?v=3';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Create an element with attributes and children in one call. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  append(node, children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs, true);
  append(node, children);
  return node;
}

function applyAttrs(node, attrs, isSvg = false) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.setAttribute('class', v);
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (!isSvg && k in node && k !== 'list' && k !== 'form') node[k] = v;
    else node.setAttribute(k, v);
  }
}

function append(node, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** era.end === null means "still going"; render it as the present marker. */
export const endYear = (genre, present) => genre.era.end ?? present;

export function eraSpanLabel(genre, present) {
  const end = genre.era.end;
  return end == null ? `${genre.era.start}–${t('era.present')}` : `${genre.era.start}–${end}`;
}

/** Case- and accent-insensitive substring search. */
export function matches(haystack, needle) {
  if (!needle) return true;
  const norm = (s) =>
    String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return norm(haystack).includes(norm(needle));
}

export function debounce(fn, ms = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const difficultyLabel = (d) => t(`difficulty.${d}`);

/** Dots + a number, so difficulty is never communicated by colour alone. */
export function difficultyDots(d) {
  return '●'.repeat(d) + '○'.repeat(5 - d);
}

export const uniq = (arr) => [...new Set(arr)];

export function groupBy(arr, keyFn) {
  const out = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

/** Screen-reader announcements for state changes that have no visual focus move. */
let liveRegion;
export function announce(message) {
  if (!liveRegion) {
    liveRegion = el('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(liveRegion);
  }
  liveRegion.textContent = message;
}
