/**
 * The time-anchored lineage DAG.
 *
 * X is a d3-scaleTime year scale; Y comes from lib/layout.js. No d3-force, no
 * d3-hierarchy, no physics — positions are recomputed identically on every load.
 * d3 is used for scales, shapes, selection, zoom and the axis only.
 */

import * as store from '../store.js?v=2';
import { computeLayout, edgePath, relatives } from '../lib/layout.js';
import { el, svgEl, announce, eraSpanLabel } from '../lib/utils.js?v=2';
import { aspectLabel, edgeDescription, edgeTypeLabel, eraName, familyBlurb, familyName, familyShort, genreName, genreOneLine, t } from '../i18n.js?v=2';

const ASPECTS = [
  'harmony', 'rhythm', 'form', 'instrumentation',
  'improvisation', 'timbre', 'repertoire', 'social-context', 'technology',
];

const EDGE_TYPES = [
  'direct-descendant', 'fusion-of', 'reaction-against', 'parallel-influence', 'revival-of',
];

const START_YEAR = 1890;
const ROW_H = 30, CAP_H = 20, LANE_GAP = 34;
// top leaves room for three stacked strips: year axis, era labels, first lane label.
const MARGIN = { top: 78, right: 26, bottom: 10, left: 26 };
const AXIS_Y = 20, ERA_TOP = 28, BAND_TOP = 44;
const LABEL_PAD = 7;

let stage, svg, zoomG, gBands, gEdges, gNodes, gLabels, gAxis, pop;
let layout, x, baseWidth, baseHeight, zoom, currentTransform = d3.zoomIdentity;

export function mount(container) {
  const shell = el('div', { class: 'graph-shell' });

  shell.append(controls());
  stage = el('div', { class: 'graph-stage', id: 'graph-stage' });
  shell.append(stage);
  container.append(shell);

  svg = d3.select(stage).append('svg')
    .attr('role', 'group')
    .attr('aria-label', t('graph.aria'));

  zoomG = svg.append('g').attr('class', 'zoomable');
  gBands = zoomG.append('g').attr('class', 'bands');
  gEdges = zoomG.append('g').attr('class', 'edges');
  gLabels = zoomG.append('g').attr('class', 'edge-labels');
  gNodes = zoomG.append('g').attr('class', 'nodes');
  gAxis = svg.append('g').attr('class', 'axis');

  const hint = el('p', {
    class: 'graph-hint',
    text: t('graph.hint'),
  });
  stage.append(zoomControls(), hint);
  // The hint is useful once; after that it is just something covering the graph.
  const dismissHint = () => hint.classList.add('is-gone');
  setTimeout(dismissHint, 9000);
  stage.addEventListener('pointerdown', dismissHint, { once: true });
  stage.addEventListener('wheel', dismissHint, { once: true, passive: true });

  pop = el('div', { class: 'edge-pop', hidden: true, role: 'dialog', 'aria-label': t('graph.influenceDetail') });
  stage.append(pop);

  zoom = d3.zoom()
    .scaleExtent([0.28, 6])
    .on('zoom', (ev) => {
      currentTransform = ev.transform;
      zoomG.attr('transform', ev.transform);
      drawAxis();
    });
  svg.call(zoom).on('dblclick.zoom', null);

  window.addEventListener('resize', debouncedResize);
  document.addEventListener('click', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.edge-hit')) closePop();
  });

  store.subscribe((state, changed) => {
    if (changed.includes('view') && state.view === 'graph') requestAnimationFrame(build);
    if (changed.includes('genres')) build();
    if (changed.includes('aspects')) { applyAspectFilter(); syncAspectButtons(); }
    if (changed.includes('year')) { applyYear(); syncScrub(); }
    if (changed.includes('hoverGenre')) applyHover(state.hoverGenre);
    if (changed.includes('selectedGenre')) applySelection(state.selectedGenre);
    if (changed.includes('theme')) build();
  });
}

/* ------------------------------------------------------------------ chrome */

function controls() {
  const bar = el('div', { class: 'graph-controls' });

  bar.append(
    el('div', { class: 'ctl-group' },
      el('span', { class: 'ctl-group__label', id: 'aspect-label', text: t('graph.inherited') }),
      el('div', { class: 'aspects', role: 'group', 'aria-labelledby': 'aspect-label', id: 'aspect-btns' },
        ASPECTS.map((a) =>
          el('button', {
            class: 'aspect', type: 'button', dataset: { aspect: a },
            'aria-pressed': 'false',
            title: t('graph.aspectOnly', { aspect: aspectLabel(a) }),
            text: aspectLabel(a),
            onclick: () => toggleAspect(a),
          })
        ),
        el('button', {
          class: 'aspect', type: 'button', id: 'aspect-clear', text: t('graph.all'),
          title: t('graph.clearAspect'), 'aria-pressed': 'true',
          onclick: () => store.set({ aspects: [] }),
        })
      )
    )
  );

  const present = store.get().present;
  const range = el('input', {
    type: 'range', min: START_YEAR, max: present, step: 1, value: present,
    id: 'year-scrub', 'aria-label': t('graph.yearAria'),
    oninput: (e) => store.set({ year: +e.target.value }),
  });
  bar.append(
    el('div', { class: 'ctl-group scrub' },
      el('label', { class: 'ctl-group__label', for: 'year-scrub', text: t('graph.year') }),
      range,
      el('output', { id: 'year-out', for: 'year-scrub', text: String(present) }),
      el('button', {
        class: 'aspect', type: 'button', text: t('graph.reset'),
        title: t('graph.showAll'),
        onclick: () => store.set({ year: present }),
      })
    )
  );

  const lg = legend();
  lg.addEventListener('toggle', () => {
    // Opening the strip changes the stage height, so the layout has to be redrawn.
    if (store.get().view === 'graph') requestAnimationFrame(build);
  });
  bar.append(lg);
  return bar;
}

function legend() {
  const line = (cls, extra = {}) => {
    const s = svgEl('svg', { width: 42, height: 10, 'aria-hidden': 'true' });
    s.appendChild(svgEl('path', {
      class: `edge edge--${cls}`, d: 'M1,5 C14,5 28,5 41,5',
      'stroke-width': extra.w ?? 1.6,
    }));
    if (extra.cap) s.appendChild(svgEl('circle', { class: `edge-cap edge-cap--${cls}`, cx: 21, cy: 5, r: 2.6 }));
    return s;
  };
  // A <details> so it can be folded away — at 39 genres the graph needs the room.
  const box = el('details', { class: 'graph-legend', id: 'graph-legend', open: window.innerWidth > 760 && window.innerHeight > 700 },
    el('summary', { text: t('graph.how') }),
    el('div', { class: 'legend-rows' },
      EDGE_TYPES.map((id) =>
        el('div', { class: 'legend-row' },
          line(id, { w: id === 'fusion-of' ? 3 : 1.6, cap: id === 'fusion-of' || id === 'revival-of' }),
          el('span', {}, el('b', { text: edgeTypeLabel(id) }), ' — ', edgeDescription(id))
        )
      ),
      // Families are filled in by build(), because the data has not loaded yet at mount.
      el('div', { class: 'legend-row legend-fams', id: 'legend-fams' }),
      el('div', { class: 'legend-row' },
        el('span', { class: 'legend-note', text: t('graph.legendNote') })
      )
    )
  );
  return box;
}

/** Family swatches, populated once the dataset is in the store. */
function fillLegendFamilies() {
  const host = document.getElementById('legend-fams');
  if (!host) return;
  host.replaceChildren(
    el('span', { class: 'legend-note', style: 'flex:none', text: t('graph.families') }),
    ...store.get().families.map((f) =>
      el('span', { class: 'legend-fam', style: `color: var(--fam-${f.id})`, title: familyBlurb(f) },
        el('span', { class: 'legend-swatch', style: `background: var(--fam-${f.id})` }),
        el('span', { style: 'color: var(--ink-3)', text: familyShort(f) })
      )
    )
  );
}

function zoomControls() {
  const btn = (label, title, fn) =>
    el('button', { type: 'button', title, 'aria-label': title, text: label, onclick: fn });
  return el('div', { class: 'graph-zoom' },
    btn('+', t('graph.zoomIn'), () => svg.transition().duration(180).call(zoom.scaleBy, 1.4)),
    btn('−', t('graph.zoomOut'), () => svg.transition().duration(180).call(zoom.scaleBy, 1 / 1.4)),
    btn('⤢', t('graph.fit'), fitAll),
    btn('⟲', t('graph.resetView'), resetView)
  );
}

function resetView() {
  svg.transition().duration(260).call(zoom.transform, d3.zoomIdentity);
}

function fitAll() {
  const { width, height } = stage.getBoundingClientRect();
  const k = Math.min(width / baseWidth, height / baseHeight, 1);
  svg.transition().duration(300).call(
    zoom.transform,
    d3.zoomIdentity.translate((width - baseWidth * k) / 2, 6).scale(k)
  );
}

/* -------------------------------------------------------------------- draw */

let resizeTimer;
function debouncedResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (store.get().view === 'graph') build();
  }, 160);
}

export function build() {
  const state = store.get();
  if (!state.genres.length || !stage) return;
  const rect = stage.getBoundingClientRect();
  if (!rect.width) return;

  baseWidth = rect.width;
  layout = computeLayout(state.genres, state.lineage, {
    present: state.present, rowHeight: ROW_H, capsuleHeight: CAP_H, laneGap: LANE_GAP,
  });
  baseHeight = layout.totalHeight + MARGIN.top + MARGIN.bottom + 8;

  svg.attr('viewBox', null).attr('width', rect.width).attr('height', rect.height);

  x = d3.scaleTime()
    .domain([new Date(START_YEAR, 0, 1), new Date(state.present, 0, 1)])
    .range([MARGIN.left, baseWidth - MARGIN.right]);
  const xy = (year) => x(new Date(year, 0, 1));

  fillLegendFamilies();
  drawBands(xy, state);
  drawEdges(xy);
  drawNodes(xy, state);
  drawAxis();
  applyAspectFilter();
  applyYear();
  applySelection(state.selectedGenre);
}

function drawBands(xy, state) {
  gBands.selectAll('*').remove();
  const bottom = MARGIN.top + layout.totalHeight;

  state.eras.forEach((era, i) => {
    const x0 = xy(Math.max(era.start, START_YEAR));
    const x1 = xy(Math.min(era.end, state.present));
    gBands.append('rect')
      .attr('class', 'era-band').attr('x', x0).attr('y', BAND_TOP)
      .attr('width', Math.max(0, x1 - x0)).attr('height', bottom - BAND_TOP + 14)
      .style('opacity', i % 2 ? 0.055 : 0.025);
    // Drop the label when its band is too narrow for it — at 375px the era names
    // otherwise collide into an unreadable run of letters.
    const label = gBands.append('text')
      .attr('class', 'era-label').attr('x', x0 + 6).attr('y', ERA_TOP + 8)
      .text(eraName(era));
    const needed = label.node().getComputedTextLength?.() ?? 0;
    if (needed + 12 > x1 - x0) label.remove();
  });

  for (let year = 1890; year <= state.present; year += 10) {
    gBands.append('line')
      .attr('class', 'decade-line' + (year % 50 === 0 ? ' decade-line--century' : ''))
      .attr('x1', xy(year)).attr('x2', xy(year))
      .attr('y1', BAND_TOP).attr('y2', bottom + 8);
  }

  layout.laneBands.forEach((band) => {
    const fam = state.families.find((f) => f.id === band.family);
    const ruleY = MARGIN.top + band.top - 16;
    gBands.append('line')
      .attr('class', 'lane-rule')
      .attr('x1', MARGIN.left).attr('x2', baseWidth - MARGIN.right)
      .attr('y1', ruleY).attr('y2', ruleY);
    gBands.append('text')
      .attr('class', 'lane-label')
      .attr('x', MARGIN.left).attr('y', ruleY - 6)
      .attr('fill', `var(--fam-${band.family})`)
      .text(fam ? familyName(fam) : band.family);
  });
}

function strokeWidth(strength) {
  return strength === 'strong' ? 2.2 : strength === 'moderate' ? 1.5 : 1;
}

function drawEdges(xy) {
  gEdges.selectAll('*').remove();
  gLabels.selectAll('*').remove();

  const scale = (year) => xy(year);
  for (const e of layout.edges) {
    const d = edgePath({ ...e, sy: e.sy + MARGIN.top, ty: e.ty + MARGIN.top }, scale);
    const g = gEdges.append('g').attr('class', 'edge-group').attr('data-key', e.key);

    g.append('path')
      .attr('class', `edge edge--${e.type}`)
      .attr('data-key', e.key)
      .attr('d', d)
      .attr('stroke-width', strokeWidth(e.strength) * (e.type === 'fusion-of' ? 1.55 : 1));

    if (e.type === 'fusion-of' || e.type === 'revival-of') {
      const path = g.select('path').node();
      const mid = path.getPointAtLength(path.getTotalLength() * 0.55);
      g.append(e.type === 'fusion-of' ? 'rect' : 'circle')
        .attr('class', `edge-cap edge-cap--${e.type}`)
        .attr(e.type === 'fusion-of' ? 'x' : 'cx', e.type === 'fusion-of' ? mid.x - 2.6 : mid.x)
        .attr(e.type === 'fusion-of' ? 'y' : 'cy', e.type === 'fusion-of' ? mid.y - 2.6 : mid.y)
        .attr(e.type === 'fusion-of' ? 'width' : 'r', e.type === 'fusion-of' ? 5.2 : 2.8)
        .attr('height', 5.2)
        .attr('transform', e.type === 'fusion-of' ? `rotate(45 ${mid.x} ${mid.y})` : null);
    }

    g.append('path')
      .attr('class', 'edge-hit')
      .attr('d', d)
      .attr('tabindex', -1)
      .attr('aria-label', t('graph.edgeAria', { from: genreName(e.from.genre), to: genreName(e.to.genre), type: edgeTypeLabel(e.type) }))
      .on('click', (ev) => { ev.stopPropagation(); openPop(e, ev); })
      .on('mouseenter', () => showEdgeLabel(e, scale))
      .on('mouseleave', () => { if (!store.get().hoverGenre) gLabels.selectAll('*').remove(); });
  }
}

function showEdgeLabel(e, scale) {
  gLabels.selectAll('*').remove();
  const midX = (scale(e.sxYear) + scale(e.txYear)) / 2;
  const midY = (e.sy + e.ty) / 2 + MARGIN.top;
  gLabels.append('text')
    .attr('class', 'edge-label')
    .attr('x', midX).attr('y', midY - 5)
    .attr('text-anchor', 'middle')
    .text(e.aspects.map(aspectLabel).join(' · '));
}

function drawNodes(xy, state) {
  gNodes.selectAll('*').remove();

  for (const n of layout.nodes) {
    const x0 = xy(n.startYear);
    const x1 = xy(n.endYear);
    const w = Math.max(6, x1 - x0);
    const y = n.y + MARGIN.top;

    const g = gNodes.append('g')
      .attr('class', 'node')
      .attr('data-id', n.id)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label',
        `${genreName(n.genre)}, ${eraSpanLabel(n.genre, state.present)}, ${(() => { const fam = state.families.find((f) => f.id === n.family); return fam ? familyName(fam) : n.family; })()}. ${genreOneLine(n.genre)}`)
      .style('--fam', `var(--fam-${n.family})`);

    g.append('rect').attr('class', 'node__focus')
      .attr('x', x0 - 3).attr('y', y - 3).attr('width', w + 6).attr('height', CAP_H + 6)
      .attr('fill', 'none');

    g.append('rect').attr('class', 'node__cap')
      .attr('x', x0).attr('y', y).attr('width', w).attr('height', CAP_H)
      .attr('data-x0', x0).attr('data-x1', x1);

    // Peak years as a solid inner block — a second, non-colour signal of intensity.
    const [p0, p1] = n.peak;
    g.append('rect').attr('class', 'node__peak')
      .attr('x', xy(p0)).attr('y', y + CAP_H - 4)
      .attr('width', Math.max(2, xy(Math.min(p1, n.endYear)) - xy(p0))).attr('height', 3)
      .attr('data-px0', xy(p0));

    const label = g.append('text').attr('class', 'node__label')
      .attr('x', x1 + LABEL_PAD).attr('y', y + CAP_H / 2)
      .text(genreName(n.genre));
    // Long-lived genres get their name inside the capsule; short ones outside it.
    if (w > 150) {
      label.attr('x', x0 + LABEL_PAD).attr('text-anchor', 'start');
      g.append('text').attr('class', 'node__years')
        .attr('x', x1 - 4).attr('y', y + CAP_H / 2).attr('text-anchor', 'end')
        .text(n.genre.era.end == null ? '→' : String(n.genre.era.end));
    }

    g.on('click', () => store.set({ selectedGenre: n.id, selectedEdge: null }))
      .on('mouseenter', () => store.set({ hoverGenre: n.id }))
      .on('mouseleave', () => store.set({ hoverGenre: null }))
      .on('focus', () => store.set({ hoverGenre: n.id }))
      .on('blur', () => store.set({ hoverGenre: null }))
      .on('keydown', (ev) => onNodeKey(ev, n));
  }
}

function onNodeKey(ev, n) {
  const order = layout.nodes;
  const i = order.indexOf(n);
  let next = null;
  if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    store.set({ selectedGenre: n.id });
    return;
  }
  if (ev.key === 'ArrowDown') next = order[Math.min(order.length - 1, i + 1)];
  if (ev.key === 'ArrowUp') next = order[Math.max(0, i - 1)];
  if (ev.key === 'ArrowRight') {
    const kids = store.get().lineage.filter((e) => e.from === n.id);
    next = kids.length ? layout.nodeById.get(kids[0].to) : null;
  }
  if (ev.key === 'ArrowLeft') {
    const parents = store.get().lineage.filter((e) => e.to === n.id);
    next = parents.length ? layout.nodeById.get(parents[0].from) : null;
  }
  if (next) {
    ev.preventDefault();
    const node = gNodes.select(`[data-id="${next.id}"]`).node();
    node?.focus();
    announce(genreName(next.genre));
  }
}

function drawAxis() {
  const state = store.get();
  if (!x) return;
  const rescaled = currentTransform.rescaleX(x);
  const axis = d3.axisTop(rescaled)
    .ticks(Math.max(4, Math.round(baseWidth / 110)))
    .tickFormat(d3.timeFormat('%Y'))
    .tickSizeOuter(0);
  gAxis.attr('transform', `translate(0, ${AXIS_Y})`).call(axis);
  gAxis.selectAll('text').attr('aria-hidden', 'true');
  void state;
}

/* ----------------------------------------------------------- interactions */

function toggleAspect(a) {
  const cur = store.get().aspects;
  store.set({ aspects: cur.includes(a) ? cur.filter((v) => v !== a) : [...cur, a] });
}

function syncAspectButtons() {
  const active = store.get().aspects;
  document.querySelectorAll('#aspect-btns .aspect[data-aspect]').forEach((b) => {
    b.setAttribute('aria-pressed', active.includes(b.dataset.aspect) ? 'true' : 'false');
  });
  const clear = document.getElementById('aspect-clear');
  if (clear) clear.setAttribute('aria-pressed', active.length ? 'false' : 'true');
}

function applyAspectFilter() {
  if (!layout) return;
  const active = store.get().aspects;
  const visible = new Set();
  gEdges.selectAll('.edge-group').each(function (_, i) {
    const key = this.getAttribute('data-key');
    const e = layout.edges.find((x2) => x2.key === key);
    const show = !active.length || e.aspects.some((a) => active.includes(a));
    this.style.display = show ? '' : 'none';
    if (show) { visible.add(e.from.id); visible.add(e.to.id); }
    void i;
  });
  // With a filter on, genres left with no matching edge fade back but stay present.
  gNodes.selectAll('.node').each(function () {
    const id = this.getAttribute('data-id');
    this.style.opacity = !active.length || visible.has(id) ? '' : '0.28';
  });
  if (active.length) {
    announce(t('graph.filtered', { aspects: active.map(aspectLabel).join(', ') }));
  }
}

function applyYear() {
  if (!layout || !x) return;
  const year = store.get().year;
  const xy = (y) => x(new Date(y, 0, 1));
  gNodes.selectAll('.node').each(function () {
    const n = layout.nodeById.get(this.getAttribute('data-id'));
    if (!n) return;
    const unborn = n.startYear > year;
    this.classList.toggle('is-unborn', unborn);
    const cap = this.querySelector('.node__cap');
    const x0 = +cap.getAttribute('data-x0');
    const x1 = +cap.getAttribute('data-x1');
    const clipped = Math.min(x1, xy(Math.min(n.endYear, Math.max(year, n.startYear))));
    cap.setAttribute('width', Math.max(6, (unborn ? x1 : clipped) - x0));
    const peak = this.querySelector('.node__peak');
    if (peak) peak.style.display = n.peak[0] > year ? 'none' : '';
  });
  gEdges.selectAll('.edge-group').each(function () {
    const e = layout.edges.find((x2) => x2.key === this.getAttribute('data-key'));
    this.style.opacity = e && e.year > year ? '0.05' : '';
  });
  syncScrub();
}

function syncScrub() {
  const r = document.getElementById('year-scrub');
  const o = document.getElementById('year-out');
  const { year, present } = store.get();
  if (r && +r.value !== year) r.value = String(year);
  if (o) o.textContent = year >= present ? t('graph.now') : String(year);
}

function applyHover(id) {
  if (!layout) return;
  const nodesG = gNodes.node();
  const edgesG = gEdges.node();
  gLabels.selectAll('*').remove();

  if (!id) {
    nodesG.classList.remove('is-dimmed');
    edgesG.classList.remove('is-dimmed');
    gNodes.selectAll('.node').classed('is-lit', false).classed('is-related', false);
    gEdges.selectAll('.edge, .edge-cap').classed('is-lit', false).classed('is-related', false);
    return;
  }

  // Three tiers, not two. Full transitive closure lights 32 of 39 genres for a
  // node like hard bop, which tells you nothing; immediate neighbours are the
  // useful signal, with the wider lineage kept visible but subordinate.
  const lineage = store.get().lineage;
  const { all } = relatives(id, lineage);
  const near = new Set([id]);
  for (const e of lineage) {
    if (e.from === id) near.add(e.to);
    if (e.to === id) near.add(e.from);
  }
  nodesG.classList.add('is-dimmed');
  edgesG.classList.add('is-dimmed');
  gNodes.selectAll('.node').each(function () {
    const nid = this.getAttribute('data-id');
    this.classList.toggle('is-lit', near.has(nid));
    this.classList.toggle('is-related', !near.has(nid) && all.has(nid));
  });
  gEdges.selectAll('.edge-group').each(function () {
    const e = layout.edges.find((x2) => x2.key === this.getAttribute('data-key'));
    const lit = e && (e.from.id === id || e.to.id === id);
    const related = e && !lit && all.has(e.from.id) && all.has(e.to.id);
    this.querySelectorAll('.edge, .edge-cap').forEach((p) => {
      p.classList.toggle('is-lit', !!lit);
      p.classList.toggle('is-related', !!related);
    });
  });

  // Aspect labels on the edges that touch the hovered genre directly.
  const xy = (y) => x(new Date(y, 0, 1));
  for (const e of layout.edges) {
    if (e.from.id !== id && e.to.id !== id) continue;
    if (store.get().aspects.length && !e.aspects.some((a) => store.get().aspects.includes(a))) continue;
    const midX = (xy(e.sxYear) + xy(e.txYear)) / 2;
    const midY = (e.sy + e.ty) / 2 + MARGIN.top;
    gLabels.append('text')
      .attr('class', 'edge-label')
      .attr('x', midX).attr('y', midY - 5)
      .attr('text-anchor', 'middle')
      .text(e.aspects.map(aspectLabel).join(' · '));
  }
}

function applySelection(id) {
  if (!layout) return;
  gNodes.selectAll('.node').classed('is-selected', function () {
    return this.getAttribute('data-id') === id;
  });
}

function openPop(e, ev) {
  const state = store.get();
  const hinge = e.hingeAlbum ? state.albums.find((a) => a.id === e.hingeAlbum) : null;
  pop.replaceChildren(
    el('button', { class: 'icon-btn edge-pop__close', text: '✕', 'aria-label': t('graph.close'), onclick: closePop }),
    el('div', { class: 'edge-pop__head' },
      el('span', { class: 'edge-pop__type', text: edgeTypeLabel(e.type) }),
      el('span', { class: 'edge-pop__route' },
        genreName(e.from.genre), el('i', { text: ' → ' }), genreName(e.to.genre),
        el('i', { text: `  ${e.year}` })
      )
    ),
    el('div', { class: 'edge-pop__aspects' },
      e.aspects.map((a) => el('span', { class: 'aspect', text: aspectLabel(a) })),
      el('span', { class: 'aspect', text: t('graph.strength', { strength: e.strength }) })
    ),
    el('p', { text: e.explanation }),
    hinge
      ? el('button', {
          class: 'edge-pop__hinge',
          onclick: () => { closePop(); store.set({ selectedGenre: e.to.id }); },
          title: t('graph.openHinge'),
        },
          el('b', { text: t('graph.hearHinge') }),
          `${hinge.artist} — ${hinge.title} (${hinge.released ?? hinge.recorded})`
        )
      : null
  );
  pop.hidden = false;

  const r = stage.getBoundingClientRect();
  const px = Math.min(Math.max(8, ev.clientX - r.left - 40), r.width - pop.offsetWidth - 8);
  const py = Math.min(Math.max(8, ev.clientY - r.top + 14), r.height - pop.offsetHeight - 8);
  pop.style.left = `${px}px`;
  pop.style.top = `${py}px`;
  pop.querySelector('.edge-pop__close')?.focus();
}

function closePop() {
  pop.hidden = true;
}
