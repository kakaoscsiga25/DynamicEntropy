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

export function buildEdges(game: Game): Edge[] {
  const edges: Edge[] = [];
  for (const from of game.converters) {
    for (const make of from.makes) {
      if (make.amount <= 0) continue;
      for (const to of game.converters) {
        if (to === from) continue;
        const need = to.needs.find((n) => n.resource === make.resource);
        // Conditions ("only while almost empty") and no-op needs are not flows.
        if (!need || need.kind === 'none' || need.kind === 'condition' || need.atMost < 1) continue;
        edges.push({
          id: `${from.id}>${to.id}:${make.resource.id}`,
          from,
          to,
          resource: make.resource,
          catalyst: need.kind === 'catalyst',
          onDemand: make.byproduct || !!make.resource.def.hub,
          ...edgeGeometry(from, to),
        });
      }
    }
  }
  return edges;
}

/** Smooth curve between two nodes, leaving/entering on the sides facing each other. */
function edgeGeometry(a: Converter, b: Converter) {
  const ax = a.def.x, ay = a.def.y, bx = b.def.x, by = b.def.y;
  const dx = bx - ax;
  const dy = by - ay;
  let x1: number, y1: number, x2: number, y2: number;
  let c1x: number, c1y: number, c2x: number, c2y: number;
  if (Math.abs(dx) >= NODE_W * 0.75 && Math.abs(dx) >= Math.abs(dy) * 0.8) {
    // Mostly horizontal
    const s = Math.sign(dx);
    x1 = s > 0 ? ax + NODE_W : ax;
    x2 = s > 0 ? bx : bx + NODE_W;
    y1 = ay + NODE_H / 2;
    y2 = by + NODE_H / 2;
    const off = Math.max(40, Math.abs(x2 - x1) / 2);
    [c1x, c1y, c2x, c2y] = [x1 + s * off, y1, x2 - s * off, y2];
  } else {
    // Mostly vertical
    const s = Math.sign(dy) || 1;
    x1 = ax + NODE_W / 2;
    x2 = bx + NODE_W / 2;
    y1 = s > 0 ? ay + NODE_H : ay;
    y2 = s > 0 ? by : by + NODE_H;
    const off = Math.max(30, Math.abs(y2 - y1) / 2);
    [c1x, c1y, c2x, c2y] = [x1, y1 + s * off, x2, y2 - s * off];
  }

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
