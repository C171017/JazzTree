/**
 * Deterministic layered layout for the lineage DAG.
 *
 * X is time and comes straight from a d3-scaleTime-equivalent year scale, so a
 * genre's capsule spans its actual active years and horizontal position is
 * meaningful. Y is assigned by the layered (Sugiyama-style) pass below.
 *
 * There is no physics anywhere. Given the same data this returns byte-identical
 * coordinates on every load — that is the point: a force layout would scatter
 * nodes off their years and destroy the time axis.
 *
 * The pass, per family swimlane:
 *   1. seed an order (by era start, then by id, so ties never depend on input order)
 *   2. repeat N times:
 *        a. compute each genre's barycentre — the mean row of everything it
 *           connects to, across the whole graph, not just this lane
 *        b. re-sort the lane by barycentre (stable, ties broken by era start then id)
 *        c. first-fit pack the lane into rows so no two capsules that overlap in
 *           time share a row — this is what keeps the picture readable
 *   3. keep the arrangement with the fewest edge crossings seen
 *   4. refine: for each genre, try every row in its lane that has clear space at
 *      those years, and keep the move if it reduces crossings. This is what
 *      actually does the work — the barycentre sweep alone converges almost
 *      immediately here, because nearly every capsule overlaps nearly every other
 *      one in time and the packing constraint dominates the ordering.
 *
 * Step 2c is the constraint that makes this not quite textbook Sugiyama: rows are
 * an interval-packing problem because capsules have width.
 */

const ITERATIONS = 12;
const REFINE_PASSES = 6;
/** Minimum clear years between two capsules sharing a row (label breathing room). */
const ROW_GAP_YEARS = 3;

/**
 * Swimlane order for the DAG. Chosen empirically: of the 24 possible orders this
 * one produced the fewest edge crossings (533 vs 694 for the "narrative" order
 * that leads with the mainstream). The mainstream sits in the middle because
 * nearly everything connects to it; putting it at an edge forces long edges to
 * jump the whole picture. Readability beat reading order here.
 */
export const FAMILY_ORDER = ['avant', 'trad-mainstream', 'global', 'electric'];

/** Timeline and grid have no edges, so they can use the narrative order instead. */
export const NARRATIVE_FAMILY_ORDER = ['trad-mainstream', 'global', 'avant', 'electric'];

export function computeLayout(genres, lineage, opts = {}) {
  const {
    present = 2027,
    rowHeight = 34,
    capsuleHeight = 22,
    laneGap = 34,
    topPad = 0,
  } = opts;

  const byId = new Map(genres.map((g) => [g.id, g]));
  const span = (g) => [g.era.start, g.era.end ?? present];

  // Neighbours in both directions — the barycentre uses the full graph so lanes
  // arrange themselves relative to each other, not just internally.
  const neighbours = new Map(genres.map((g) => [g.id, []]));
  for (const e of lineage) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    const w = e.strength === 'strong' ? 3 : e.strength === 'moderate' ? 2 : 1;
    neighbours.get(e.from).push({ id: e.to, w });
    neighbours.get(e.to).push({ id: e.from, w });
  }

  const lanes = FAMILY_ORDER.map((fid) => ({
    family: fid,
    members: genres
      .filter((g) => g.family === fid)
      .sort((a, b) => a.era.start - b.era.start || (a.id < b.id ? -1 : 1)),
  })).filter((l) => l.members.length);

  // Any genre whose family is not in FAMILY_ORDER still gets a lane, so the
  // layout never silently drops a node.
  const known = new Set(FAMILY_ORDER);
  const strays = genres.filter((g) => !known.has(g.family));
  if (strays.length) lanes.push({ family: 'other', members: strays });

  /** First-fit interval packing: returns Map(id -> row within the lane). */
  function pack(members) {
    const rows = []; // rows[i] = latest occupied year on that row
    const assign = new Map();
    for (const g of members) {
      const [s, e] = span(g);
      let row = rows.findIndex((last) => s - last >= ROW_GAP_YEARS);
      if (row === -1) {
        row = rows.length;
        rows.push(-Infinity);
      }
      rows[row] = e;
      assign.set(g.id, row);
    }
    return assign;
  }

  /** Global y index (0-based, across all lanes) for the current arrangement. */
  function globalIndex(laneAssigns) {
    const out = new Map();
    let cursor = 0;
    laneAssigns.forEach(({ assign, height }) => {
      for (const [id, row] of assign) out.set(id, cursor + row);
      cursor += height;
    });
    return out;
  }

  function buildArrangement(orders) {
    const laneAssigns = lanes.map((lane, i) => {
      const assign = pack(orders[i]);
      const height = Math.max(...assign.values()) + 1;
      return { assign, height };
    });
    return { laneAssigns, index: globalIndex(laneAssigns) };
  }

  /**
   * Crossing count, approximated the way it matters visually: two edges cross
   * when their y-order is opposite to their x-order at the child end.
   */
  function crossings(index) {
    const es = lineage
      .filter((e) => index.has(e.from) && index.has(e.to))
      .map((e) => ({
        x1: span(byId.get(e.from))[0],
        y1: index.get(e.from),
        x2: Math.max(byId.get(e.to).era.start, e.year),
        y2: index.get(e.to),
      }));
    let n = 0;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i];
        const b = es[j];
        // Only count pairs whose horizontal extents actually overlap.
        if (Math.max(a.x1, b.x1) > Math.min(a.x2, b.x2)) continue;
        if ((a.y1 - b.y1) * (a.y2 - b.y2) < 0) n++;
      }
    }
    return n;
  }

  let orders = lanes.map((l) => [...l.members]);
  let best = buildArrangement(orders);
  let bestScore = crossings(best.index);
  let bestOrders = orders.map((o) => [...o]);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const { index } = buildArrangement(orders);
    const next = orders.map((members) => {
      const scored = members.map((g) => {
        const ns = neighbours.get(g.id).filter((n) => index.has(n.id));
        const totalW = ns.reduce((s, n) => s + n.w, 0);
        const bary = totalW
          ? ns.reduce((s, n) => s + index.get(n.id) * n.w, 0) / totalW
          : index.get(g.id);
        return { g, bary };
      });
      // Downward on even passes, upward on odd — the standard alternating sweep.
      scored.sort(
        (a, b) =>
          (iter % 2 === 0 ? a.bary - b.bary : b.bary - a.bary) ||
          a.g.era.start - b.g.era.start ||
          (a.g.id < b.g.id ? -1 : 1)
      );
      if (iter % 2 === 1) scored.reverse();
      return scored.map((s) => s.g);
    });
    orders = next;
    const arrangement = buildArrangement(orders);
    const score = crossings(arrangement.index);
    if (score < bestScore) {
      bestScore = score;
      best = arrangement;
      bestOrders = orders.map((o) => [...o]);
    }
  }

  best = buildArrangement(bestOrders);

  // --- Refinement: move individual genres between rows within their own lane. --
  // Rows come from packing, so this is the only step that can break a tie the
  // ordering pass cannot reach. Deterministic: fixed lane order, fixed member
  // order, first improvement wins, ties keep the incumbent.
  {
    const laneOf = new Map();
    lanes.forEach((lane, i) => lane.members.forEach((g) => laneOf.set(g.id, i)));
    const assigns = best.laneAssigns.map(({ assign }) => new Map(assign));
    const heights = best.laneAssigns.map(({ height }) => height);

    const indexFrom = () => {
      const out = new Map();
      let cursor = 0;
      assigns.forEach((assign, i) => {
        for (const [id, row] of assign) out.set(id, cursor + row);
        cursor += heights[i];
      });
      return out;
    };

    const fits = (laneIdx, gid, row) => {
      const [s, e] = span(byId.get(gid));
      for (const [otherId, otherRow] of assigns[laneIdx]) {
        if (otherId === gid || otherRow !== row) continue;
        const [os, oe] = span(byId.get(otherId));
        if (s - ROW_GAP_YEARS < oe && os - ROW_GAP_YEARS < e) return false;
      }
      return true;
    };

    let score = crossings(indexFrom());
    for (let pass = 0; pass < REFINE_PASSES; pass++) {
      let improved = false;
      for (const lane of lanes) {
        const li = lanes.indexOf(lane);
        for (const g of lane.members) {
          const current = assigns[li].get(g.id);
          for (let row = 0; row < heights[li]; row++) {
            if (row === current || !fits(li, g.id, row)) continue;
            assigns[li].set(g.id, row);
            const next = crossings(indexFrom());
            if (next < score) {
              score = next;
              improved = true;
              break;
            }
            assigns[li].set(g.id, current);
          }
        }
      }
      if (!improved) break;
    }
    bestScore = score;
    best = {
      laneAssigns: assigns.map((assign, i) => ({ assign, height: heights[i] })),
      index: indexFrom(),
    };
  }

  // Materialise coordinates.
  const nodes = [];
  const laneBands = [];
  let y = topPad;
  best.laneAssigns.forEach(({ assign, height }, i) => {
    const lane = lanes[i];
    const bandTop = y;
    for (const g of lane.members) {
      const row = assign.get(g.id);
      const [s, e] = span(g);
      nodes.push({
        id: g.id,
        genre: g,
        family: lane.family,
        row,
        startYear: s,
        endYear: e,
        peak: g.era.peak,
        y: y + row * rowHeight,
        height: capsuleHeight,
        cy: y + row * rowHeight + capsuleHeight / 2,
      });
    }
    y += height * rowHeight;
    laneBands.push({ family: lane.family, top: bandTop, bottom: y - (rowHeight - capsuleHeight), rows: height });
    y += laneGap;
  });

  const totalHeight = Math.max(0, y - laneGap) + capsuleHeight;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const edges = lineage
    .filter((e) => nodeById.has(e.from) && nodeById.has(e.to))
    .map((e) => {
      const from = nodeById.get(e.from);
      const to = nodeById.get(e.to);
      // Source: where on the parent's active span the influence took hold.
      const sxYear = Math.min(Math.max(e.year, from.startYear), from.endYear);
      // Target: the child's start, unless the influence is dated later than that.
      const txYear = Math.min(Math.max(e.year, to.startYear), to.endYear);
      return {
        ...e,
        key: `${e.from}->${e.to}`,
        from,
        to,
        sxYear,
        txYear,
        sy: from.cy,
        ty: to.cy,
      };
    });

  return { nodes, nodeById, edges, laneBands, totalHeight, crossings: bestScore };
}

/**
 * Edge path generator. `x` is the year->pixel scale.
 * revival-of hooks backwards before turning forward, so a retrospective
 * influence reads differently from a forward one at a glance.
 */
export function edgePath(edge, x) {
  const sx = x(edge.sxYear);
  const tx = x(edge.txYear);
  const { sy, ty } = edge;
  const dx = tx - sx;

  if (edge.type === 'revival-of') {
    const hook = Math.max(28, Math.min(70, Math.abs(dx) * 0.18));
    return [
      `M${sx},${sy}`,
      `C${sx - hook},${sy + (ty > sy ? 10 : -10)}`,
      `${sx - hook * 0.4},${(sy + ty) / 2}`,
      `${sx + Math.abs(dx) * 0.18},${(sy + ty) / 2}`,
      `S${tx - Math.abs(dx) * 0.3},${ty} ${tx},${ty}`,
    ].join(' ');
  }

  // Near-vertical connectors (influence dated at or after the child's start)
  // get a gentle S rather than a flat line, so they stay traceable.
  const bend = Math.max(26, Math.abs(dx) * 0.45);
  return `M${sx},${sy} C${sx + bend},${sy} ${tx - bend},${ty} ${tx},${ty}`;
}

/** Ancestors and descendants of a genre, for the hover-dimming behaviour. */
export function relatives(genreId, lineage) {
  const up = new Set();
  const down = new Set();
  const parents = new Map();
  const children = new Map();
  for (const e of lineage) {
    if (!children.has(e.from)) children.set(e.from, []);
    if (!parents.has(e.to)) parents.set(e.to, []);
    children.get(e.from).push(e.to);
    parents.get(e.to).push(e.from);
  }
  const walk = (id, map, out) => {
    for (const next of map.get(id) ?? []) {
      if (out.has(next)) continue;
      out.add(next);
      walk(next, map, out);
    }
  };
  walk(genreId, parents, up);
  walk(genreId, children, down);
  return { ancestors: up, descendants: down, all: new Set([genreId, ...up, ...down]) };
}
