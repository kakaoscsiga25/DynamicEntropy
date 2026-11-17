// Graph geometry: node size, connection lines and region (island) boxes.

import type { Converter, Game, Resource } from '../game/engine';

export const NODE_W = 230;
export const NODE_H = 74;
const REGION_PAD = 26;
const REGION_LABEL = 26;

export interface Edge {
  id: string;
  from: Converter;
  to: Converter;
  resource: Resource;
  /** The target only needs a minimum stock, it doesn't consume it. */
  catalyst: boolean;
  /** SVG path in world coordinates. */
  d: string;
  /** Path end points, for the small port dots. */
  start: [number, number];
  end: [number, number];
}

/**
 * Lines are drawn only for "chain" resources. Hub resources (used by many nodes)
 * and byproducts are shown as chips on the nodes instead, which removes most of
 * the clutter (46 lines in v1 → 17).
 */
export function buildEdges(game: Game): Edge[] {
  const edges: Edge[] = [];
  for (const from of game.converters) {
    for (const make of from.makes) {
      if (make.byproduct || make.resource.def.hub) continue;
      for (const to of game.converters) {
        if (to === from) continue;
        const need = to.needs.find((n) => n.resource === make.resource);
        // atMost < 1 means "only while (almost) empty": a control condition, not a flow.
        if (!need || need.atMost < 1) continue;
        const { d, start, end } = edgePath(from, to);
        edges.push({
          id: `${from.id}>${to.id}:${make.resource.id}`,
          from,
          to,
          resource: make.resource,
          catalyst: need.amount === 0,
          d,
          start,
          end,
        });
      }
    }
  }
  return edges;
}

/** Smooth curve between two nodes, leaving/entering on the sides facing each other. */
function edgePath(a: Converter, b: Converter) {
  const ax = a.def.x, ay = a.def.y, bx = b.def.x, by = b.def.y;
  const dx = bx - ax;
  const dy = by - ay;
  let x1: number, y1: number, x2: number, y2: number, c1: string, c2: string;
  if (Math.abs(dx) >= NODE_W * 0.75) {
    // Mostly horizontal
    const s = Math.sign(dx);
    x1 = s > 0 ? ax + NODE_W : ax;
    x2 = s > 0 ? bx : bx + NODE_W;
    y1 = ay + NODE_H / 2;
    y2 = by + NODE_H / 2;
    const off = Math.max(40, Math.abs(x2 - x1) / 2);
    c1 = `${x1 + s * off} ${y1}`;
    c2 = `${x2 - s * off} ${y2}`;
  } else {
    // Mostly vertical
    const s = Math.sign(dy) || 1;
    x1 = ax + NODE_W / 2;
    x2 = bx + NODE_W / 2;
    y1 = s > 0 ? ay + NODE_H : ay;
    y2 = s > 0 ? by : by + NODE_H;
    const off = Math.max(30, Math.abs(y2 - y1) / 2);
    c1 = `${x1} ${y1 + s * off}`;
    c2 = `${x2} ${y2 - s * off}`;
  }
  return {
    d: `M ${x1} ${y1} C ${c1} ${c2} ${x2} ${y2}`,
    start: [x1, y1] as [number, number],
    end: [x2, y2] as [number, number],
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

function bounds(nodes: Converter[]): Box {
  const xs = nodes.map((n) => n.def.x);
  const ys = nodes.map((n) => n.def.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) + NODE_W - x, h: Math.max(...ys) + NODE_H - y };
}

/** Islands grow as their nodes are discovered; empty ones are not shown. */
export function regionBoxes(game: Game, discovered: Converter[]): RegionBox[] {
  const boxes: RegionBox[] = [];
  for (const region of game.data.regions) {
    const nodes = discovered.filter((c) => c.def.region === region.id);
    if (nodes.length === 0) continue;
    const b = bounds(nodes);
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
export function worldBounds(discovered: Converter[]): Box {
  if (discovered.length === 0) return { x: 0, y: 0, w: NODE_W, h: NODE_H };
  const b = bounds(discovered);
  return {
    x: b.x - REGION_PAD,
    y: b.y - REGION_PAD - REGION_LABEL,
    w: b.w + REGION_PAD * 2,
    h: b.h + REGION_PAD * 2 + REGION_LABEL,
  };
}
