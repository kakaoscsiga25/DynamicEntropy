// Sanity checks on the real game content (content/*.ts): typos, unreachable
// resources, costs that can never be paid, overlapping cards.
import { describe, expect, test } from 'vitest';
import { Game } from '../engine.ts';
import { DATA } from '../content/index.ts';
import { NODE_W, nodeHeight, regionBoxes } from '../../ui/layout.ts';

const game = new Game();

/** Everything that can be made, starting from what you have at the start. */
function reachable() {
  const have = new Set(game.resources.filter((r) => r.amount > 0).map((r) => r.id));
  const nodes = new Set<string>();
  const bought = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    const add = (id: string) => {
      if (!have.has(id)) {
        have.add(id);
        changed = true;
      }
    };
    for (const u of game.upgrades) {
      if (!bought.has(u.id) && u.costs.every((c) => have.has(c.resource.id)) && (u.def.requires ?? []).every((r) => bought.has(r))) {
        bought.add(u.id);
        changed = true;
      }
    }
    for (const c of game.converters) {
      if (nodes.has(c.id) || (c.def.requires && !bought.has(c.def.requires))) continue;
      const ok = c.needs.every((n) => {
        if (n.heat) return n.heat.some((r) => have.has(r.id));
        if (n.optional || n.kind === 'condition' || n.kind === 'none') return true;
        return have.has(n.resource.id);
      });
      if (!ok) continue;
      nodes.add(c.id);
      changed = true;
      for (const m of c.makes) add(m.resource.id);
      for (const n of c.needs) if (n.yields) add(n.yields.resource.id);
    }
    for (const r of game.resources) if (have.has(r.id) && r.def.fade?.into) add(r.def.fade.into);
  }
  return { have, nodes, bought };
}

describe('content', () => {
  test('loads (every id it refers to exists) and has exactly one final upgrade, on Wake up', () => {
    const finals = game.upgrades.filter((u) => u.def.final);
    expect(finals.map((u) => u.host?.id)).toEqual(['wake_up']);
    for (const u of [...game.buildings, ...game.research]) expect(DATA.sections.map((s) => s.id)).toContain(u.def.section);
    // Research is paid with Insight only (and every Insight upgrade is in Research).
    expect(game.research.length).toBeGreaterThan(0);
    for (const u of game.buildings) expect(u.costs.map((c) => c.resource.id), u.id).not.toContain('insight');
    for (const u of game.research) expect(u.costs.map((c) => c.resource.id), u.id).toEqual(['insight']);
  });

  test('every resource, node and upgrade can be reached from the start', () => {
    const { have, nodes, bought } = reachable();
    expect(game.resources.map((r) => r.id).filter((id) => !have.has(id))).toEqual([]);
    expect(game.converters.map((c) => c.id).filter((id) => !nodes.has(id))).toEqual([]);
    expect(game.upgrades.map((u) => u.id).filter((id) => !bought.has(id))).toEqual([]);
  });

  test('every cost fits in storage (with all storage built)', () => {
    const max = new Map(game.resources.map((r) => [r.id, r.max]));
    for (const u of game.upgrades) for (const c of u.capacity) max.set(c.resource.id, max.get(c.resource.id)! + c.amount);
    for (const u of game.upgrades) {
      for (const c of u.costs) {
        expect(c.amount, `${u.id}: ${c.resource.id}`).toBeLessThanOrEqual(max.get(c.resource.id)!);
      }
    }
  });

  test("Productivity's good sources add up to 110, the Home points of all buildings fill the Home source", () => {
    const p = DATA.productivity!;
    const good = p.sources.filter((s) => s.kind !== 'penalty');
    expect(p.base + good.reduce((s, x) => s + x.points, 0)).toBe(110);
    const home = good.find((s) => s.kind === 'home')!;
    expect(game.upgrades.reduce((s, u) => s + (u.def.home ?? 0), 0)).toBe(home.points);
  });

  test("cards on the map don't overlap at their biggest (every upgrade, pace slider), with room for lines", () => {
    const g = new Game();
    for (let i = 0; i < 5; i++) for (const u of g.upgrades) if (!u.def.final && !u.bought && u.requirementsMet()) u.apply();
    expect(g.paceMax()).toBeGreaterThan(0); // the slider makes cards taller
    const GAP_X = 50; // between columns: room for arrows and their icons
    const GAP_Y = 30; // between a card's bottom and the next card's top
    const nodes = g.converters;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const [a, b] = [nodes[i], nodes[j]];
        const sideBySide = Math.abs(a.def.x - b.def.x) < NODE_W + GAP_X;
        const [top, below] = a.def.y <= b.def.y ? [a, b] : [b, a];
        const apart = below.def.y >= top.def.y + nodeHeight(top, g) + GAP_Y;
        expect(!sideBySide || apart, `${a.id} / ${b.id}`).toBe(true);
      }
    }
  });

  test("islands don't overlap, even with every node shown and every upgrade bought", () => {
    const g = new Game();
    for (const u of g.upgrades) if (!u.def.final) u.apply();
    const boxes = regionBoxes(g, g.converters);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${a.id} / ${b.id}`).toBe(false);
      }
    }
  });
});
