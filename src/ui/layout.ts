// Graph geometry: node size, connection lines and region (island) boxes.

import type { Converter, Game, Recipe, RecipeKind, Resource } from '../game/engine';

export const NODE_W = 230;
/** Card height with up to two input / output rows (most nodes); lines attach relative to it. */
export const NODE_H = 86;
const REGION_PAD = 26;
const REGION_LABEL = 26;

/** One row of a card's input or output table: lines of the same resource added up (the Field's crops). */
export interface DisplayLine {
  recipe: Recipe;
  kind: RecipeKind | 'out';
  /** Per cycle with the current settings (shares, fuel, growth, Productivity, wear, pace). */
  amount: number;
  /** The plain recipe amount (without settings and factors), to tell whether it differs. */
  base: number;
}

export function displayLines(c: Converter, side: 'in' | 'out'): DisplayLine[] {
  const out: DisplayLine[] = [];
  for (const r of side === 'in' ? c.needs : c.makes) {
    const kind = side === 'out' ? 'out' : r.kind;
    if (kind === 'none') continue;
    const amount = side === 'in' ? c.inAmount(r) : c.output(r);
    const same = out.find((d) => d.recipe.resource === r.resource && d.kind === kind && kind !== 'heat' && d.recipe.byproduct === r.byproduct);
    if (same) {
      same.amount += amount;
      same.base += r.amount;
    } else {
      out.push({ recipe: r, kind, amount, base: r.amount });
    }
  }
  return out;
}

/**
 * How tall a node's card is, at most a couple of pixels off (islands make room
 * for it, lines attach to its bottom).
 */
export function nodeHeight(c: Converter, game: Game): number {
  const rows = Math.max(1, displayLines(c, 'in').length, displayLines(c, 'out').length);
  let h = 40 + rows * 22;
  if (c.throttle !== null) h += 26;
  if (c.parts.length) h += 26;
  if (c.def.wear) h += 22;
  if (c.pacable && game.paceMax() > 0) h += 22;
  return Math.max(NODE_H, h);
}

export interface Edge {
  id: string;
  from: Converter;
  to: Converter;
  resource: Resource;
  /** The target's recipe line this flows into. */
  need: Recipe;
  /** The target only needs a minimum stock, it doesn't consume it. */
  catalyst: boolean;
  /**
   * Hub resources (Stamina, Water, Fire: used by many nodes) and byproducts would
   * clutter the map, so their lines are only drawn on demand: while one of the two
   * nodes or the resource is hovered / selected. This keeps 17 lines always visible
   * instead of 46, without hiding where things come from.
   */
  onDemand: boolean;
  /** SVG path in world coordinates. */
  d: string;
  start: [number, number];
  /** Middle of the curve: where the resource icon sits. */
  mid: [number, number];
  /** Arrow head at the target end (SVG polygon points). */
  arrow: string;
}

type Side = 'left' | 'right' | 'top' | 'bottom';

/** A line before its geometry is known. */
interface RawEdge extends Omit<Edge, 'd' | 'start' | 'mid' | 'arrow'> {
  fromSide: Side;
  toSide: Side;
}

/** Which sides of the two cards a line leaves and enters: the sides facing each other. */
function facingSides(a: Converter, b: Converter): [Side, Side] {
  const dx = b.def.x - a.def.x;
  const dy = b.def.y - a.def.y;
  if (Math.abs(dx) >= NODE_W * 0.75 && Math.abs(dx) >= Math.abs(dy) * 0.8) return dx > 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

/** Gap between the ends of lines sharing one side of a card (px). */
const PORT_GAP_SIDE = 14;
const PORT_GAP_TOP = 26;

export function buildEdges(game: Game): Edge[] {
  const raw = new Map<string, RawEdge>();
  for (const from of game.converters) {
    for (const make of from.makes) {
      if (make.amount <= 0) continue;
      for (const to of game.converters) {
        if (to === from) continue;
        // A fire's heat goes to every node that needs that temperature (from fireplaces only).
        const need =
          to.needs.find((n) => n.resource === make.resource && !n.heat) ??
          (game.fireOf(from) ? to.needs.find((n) => n.heat?.includes(make.resource)) : undefined);
        // Conditions ("only while almost empty") and no-op needs are not flows.
        if (!need || need.kind === 'none' || need.kind === 'condition' || need.atMost < 1) continue;
        const id = `${from.id}>${to.id}:${make.resource.id}`;
        if (raw.has(id)) continue;
        const [fromSide, toSide] = facingSides(from, to);
        raw.set(id, {
          id,
          from,
          to,
          resource: make.resource,
          need,
          catalyst: need.kind === 'catalyst' || need.kind === 'heat',
          onDemand: make.byproduct || !!make.resource.def.hub,
          fromSide,
          toSide,
        });
      }
    }
  }

  // Lines that share a side of a card don't start (or end) at the same point:
  // they're spread along it, in the order of where their other end is, so
  // they don't cross right at the card and their arrows don't pile up.
  const ports = new Map<string, number>(); // `${edge id}|from` → offset along the side
  const groups = new Map<string, { key: string; other: Converter; side: Side }[]>();
  for (const e of raw.values()) {
    for (const [node, side, other, end] of [[e.from, e.fromSide, e.to, 'from'], [e.to, e.toSide, e.from, 'to']] as const) {
      const g = `${node.id}|${side}`;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push({ key: `${e.id}|${end}`, other, side });
    }
  }
  for (const list of groups.values()) {
    const vertical = list[0].side === 'left' || list[0].side === 'right';
    list.sort((a, b) => (vertical ? a.other.def.y - b.other.def.y : a.other.def.x - b.other.def.x) || a.key.localeCompare(b.key));
    const gap = vertical ? PORT_GAP_SIDE : PORT_GAP_TOP;
    const limit = vertical ? NODE_H / 2 - 12 : NODE_W / 2 - 20;
    list.forEach((p, i) => ports.set(p.key, Math.max(-limit, Math.min(limit, (i - (list.length - 1) / 2) * gap))));
  }

  return [...raw.values()].map(({ fromSide, toSide, ...e }) => ({
    ...e,
    ...edgeGeometry(
      anchor(e.from, fromSide, ports.get(`${e.id}|from`) ?? 0, game),
      anchor(e.to, toSide, ports.get(`${e.id}|to`) ?? 0, game),
    ),
  }));
}

interface Anchor {
  x: number;
  y: number;
  /** Direction the line leaves (or enters) the card: unit vector pointing away from it. */
  nx: number;
  ny: number;
}

/** A point on a card's side, `offset` px from the middle of that side. */
function anchor(c: Converter, side: Side, offset: number, game: Game): Anchor {
  const { x, y } = c.def;
  switch (side) {
    case 'left': return { x, y: y + NODE_H / 2 + offset, nx: -1, ny: 0 };
    case 'right': return { x: x + NODE_W, y: y + NODE_H / 2 + offset, nx: 1, ny: 0 };
    case 'top': return { x: x + NODE_W / 2 + offset, y, nx: 0, ny: -1 };
    case 'bottom': return { x: x + NODE_W / 2 + offset, y: y + nodeHeight(c, game), nx: 0, ny: 1 };
  }
}

/** Smooth curve between two cards, leaving and entering straight out of the sides. */
function edgeGeometry(a: Anchor, b: Anchor) {
  const { x: x1, y: y1 } = a;
  const { x: x2, y: y2 } = b;
  const horizontal = a.nx !== 0;
  const off = horizontal ? Math.max(40, Math.abs(x2 - x1) / 2) : Math.max(30, Math.abs(y2 - y1) / 2);
  const [c1x, c1y, c2x, c2y] = [x1 + a.nx * off, y1 + a.ny * off, x2 + b.nx * off, y2 + b.ny * off];
  // Bezier point at t = 0.5
  const mid: [number, number] = [(x1 + 3 * c1x + 3 * c2x + x2) / 8, (y1 + 3 * c1y + 3 * c2y + y2) / 8];

  // Arrow head pointing along the curve's direction at the end
  let ux = x2 - c2x;
  let uy = y2 - c2y;
  const len = Math.hypot(ux, uy) || 1;
  ux /= len;
  uy /= len;
  const L = 10;
  const W = 5.5;
  const bx0 = x2 - ux * L;
  const by0 = y2 - uy * L;
  const arrow = `${x2},${y2} ${bx0 - uy * W},${by0 + ux * W} ${bx0 + uy * W},${by0 - ux * W}`;

  return {
    // The line stops at the arrow's base so it doesn't poke through the tip.
    d: `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${bx0} ${by0}`,
    start: [x1, y1] as [number, number],
    mid,
    arrow,
  };
}

/** Which nodes are connected by a line to each node. */
export function neighborMap(edges: Edge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const e of edges) {
    add(e.from.id, e.to.id);
    add(e.to.id, e.from.id);
  }
  return map;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RegionBox extends Box {
  id: string;
  name: string;
  color: string;
}

function bounds(nodes: Converter[], game: Game): Box {
  const xs = nodes.map((n) => n.def.x);
  const ys = nodes.map((n) => n.def.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  // Room for the card growing a little (a pace slider, a tool row).
  const bottom = Math.max(...nodes.map((n) => n.def.y + nodeHeight(n, game) + 22));
  return { x, y, w: Math.max(...xs) + NODE_W - x, h: bottom - y };
}

/** Islands grow as their nodes are discovered; empty ones are not shown. */
export function regionBoxes(game: Game, discovered: Converter[]): RegionBox[] {
  const boxes: RegionBox[] = [];
  for (const region of game.data.regions) {
    const nodes = discovered.filter((c) => c.def.region === region.id);
    if (nodes.length === 0) continue;
    const b = bounds(nodes, game);
    boxes.push({
      id: region.id,
      name: region.name,
      color: region.color,
      x: b.x - REGION_PAD,
      y: b.y - REGION_PAD - REGION_LABEL,
      w: b.w + REGION_PAD * 2,
      h: b.h + REGION_PAD * 2 + REGION_LABEL,
    });
  }
  return boxes;
}

/** Bounding box of the discovered world (for "fit to screen"). */
export function worldBounds(discovered: Converter[], game: Game): Box {
  if (discovered.length === 0) return { x: 0, y: 0, w: NODE_W, h: NODE_H };
  const b = bounds(discovered, game);
  return {
    x: b.x - REGION_PAD,
    y: b.y - REGION_PAD - REGION_LABEL,
    w: b.w + REGION_PAD * 2,
    h: b.h + REGION_PAD * 2 + REGION_LABEL,
  };
}
