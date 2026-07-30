/**
 * Denser Gantt view: every genre as one bar, no edges, grouped by family.
 * Good for scanning eras and comparing spans without the graph's edge traffic.
 */

import * as store from '../store.js?v=2';
import { el, eraSpanLabel } from '../lib/utils.js?v=2';
import { NARRATIVE_FAMILY_ORDER as FAMILY_ORDER } from '../lib/layout.js';
import { eraName, familyName, genreName, genreOneLine, t } from '../i18n.js?v=2';

const ROW = 22;
const LABEL_W = 210;
const PAD = { top: 52, right: 22, bottom: 26, left: 12 };
const START = 1890;

let wrap, scroller;

export function mount(container) {
  wrap = el('div', { class: 'timeline-wrap' },
    el('div', { class: 'intro is-compact' },
      el('h2', { class: 'intro__title', text: t('timeline.title') }),
      el('p', { class: 'intro__lede', text: t('timeline.lede') })
    )
  );
  scroller = el('div', { class: 'timeline-scroll' });
  wrap.append(scroller);
  container.append(wrap);

  store.subscribe((state, changed) => {
    if (changed.includes('genres')) build();
    if (changed.includes('view') && state.view === 'timeline') requestAnimationFrame(build);
    if (changed.includes('selectedGenre')) mark(state.selectedGenre);
    if (changed.includes('theme')) build();
  });
  window.addEventListener('resize', () => {
    if (store.get().view === 'timeline') build();
  });
}

export function build() {
  const state = store.get();
  if (!state.genres.length || !scroller) return;

  const avail = scroller.clientWidth || 900;
  const width = Math.max(760, avail);
  const groups = FAMILY_ORDER
    .map((fid) => ({
      family: state.families.find((f) => f.id === fid) ?? { id: fid, name: fid },
      members: state.genres
        .filter((g) => g.family === fid)
        .sort((a, b) => a.era.start - b.era.start || a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.members.length);

  const rows = groups.reduce((n, g) => n + g.members.length, 0);
  const height = PAD.top + PAD.bottom + rows * ROW + groups.length * 20;

  const x = d3.scaleTime()
    .domain([new Date(START, 0, 1), new Date(state.present, 0, 1)])
    .range([LABEL_W, width - PAD.right]);
  const xy = (year) => x(new Date(year, 0, 1));

  const svg = d3.create('svg')
    .attr('width', width).attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', t('timeline.aria', { count: state.genres.length, start: START }));

  // era bands
  state.eras.forEach((era, i) => {
    const x0 = xy(Math.max(era.start, START));
    const x1 = xy(Math.min(era.end, state.present));
    svg.append('rect').attr('class', 'tl-band')
      .attr('x', x0).attr('y', PAD.top - 30)
      .attr('width', Math.max(0, x1 - x0)).attr('height', height - PAD.top - PAD.bottom + 38)
      .style('opacity', i % 2 ? 0.06 : 0.028);
    const label = svg.append('text').attr('class', 'era-label')
      .attr('x', x0 + 5).attr('y', PAD.top - 18).text(eraName(era));
    if ((label.node().getComputedTextLength?.() ?? 0) + 10 > x1 - x0) label.remove();
  });

  for (let year = 1890; year <= state.present; year += 10) {
    svg.append('line').attr('class', 'decade-line' + (year % 50 === 0 ? ' decade-line--century' : ''))
      .attr('x1', xy(year)).attr('x2', xy(year))
      .attr('y1', PAD.top - 30).attr('y2', height - PAD.bottom + 4);
  }

  svg.append('g').attr('class', 'axis')
    .attr('transform', `translate(0, ${PAD.top - 34})`)
    .call(d3.axisTop(x).ticks(Math.round(width / 110)).tickFormat(d3.timeFormat('%Y')).tickSizeOuter(0));

  let y = PAD.top;
  for (const group of groups) {
    svg.append('text').attr('class', 'tl-fam-label')
      .attr('x', PAD.left).attr('y', y + 4)
      .attr('fill', `var(--fam-${group.family.id})`)
      .text(familyName(group.family));
    y += 16;

    for (const g of group.members) {
      const x0 = xy(g.era.start);
      const x1 = xy(g.era.end ?? state.present);
      const row = svg.append('g')
        .attr('class', 'tl-row')
        .attr('data-id', g.id)
        .attr('tabindex', 0)
        .attr('role', 'button')
        .attr('aria-label', `${genreName(g)}, ${eraSpanLabel(g, state.present)}. ${genreOneLine(g)}`)
        .style('cursor', 'pointer')
        .on('click', () => store.set({ selectedGenre: g.id }))
        .on('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); store.set({ selectedGenre: g.id }); }
        });

      row.append('rect')
        .attr('x', 0).attr('y', y - ROW / 2).attr('width', width).attr('height', ROW)
        .attr('fill', 'transparent');

      row.append('text').attr('class', 'tl-name')
        .attr('x', LABEL_W - 10).attr('y', y).attr('text-anchor', 'end')
        .text(genreName(g));

      row.append('rect').attr('class', 'tl-bar')
        .attr('x', x0).attr('y', y - 6).attr('width', Math.max(3, x1 - x0)).attr('height', 12)
        .attr('fill', `var(--fam-${g.family})`).attr('fill-opacity', 0.28)
        .attr('stroke', `var(--fam-${g.family})`).attr('stroke-width', 1);

      const [p0, p1] = g.era.peak;
      row.append('rect').attr('class', 'tl-bar')
        .attr('x', xy(p0)).attr('y', y - 6)
        .attr('width', Math.max(2, xy(Math.min(p1, g.era.end ?? state.present)) - xy(p0))).attr('height', 12)
        .attr('fill', `var(--fam-${g.family})`).attr('fill-opacity', 0.62);

      if (g.era.end == null) {
        row.append('text').attr('class', 'node__years')
          .attr('x', x1 + 5).attr('y', y).text('→');
      }
      y += ROW;
    }
    y += 4;
  }

  scroller.replaceChildren(svg.node());
  mark(state.selectedGenre);
}

function mark(id) {
  scroller?.querySelectorAll('.tl-row').forEach((r) => {
    r.classList.toggle('is-selected', r.getAttribute('data-id') === id);
  });
}
