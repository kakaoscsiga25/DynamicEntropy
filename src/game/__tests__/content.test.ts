// Sanity checks on the real game content (content/*.ts): typos, unreachable
// resources, costs that can never be paid, overlapping cards.
import { describe, expect, test } from 'vitest';
import { Game } from '../engine.ts';
import { DATA } from '../content/index.ts';

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
    for (const u of game.buildings) expect(DATA.sections.map((s) => s.id)).toContain(u.def.section);
  });

  test('every resource, node and upgrade can be reached from the start', () => {
    const { have, nodes, bought } = reachable();
    expect(game.resources.map((r) => r.id).filter((id) => !have.has(id))).toEqual([]);
    expect(game.converters.map((c) => c.id).filter((id) => !nodes.has(id))).toEqual([]);
    expect(game.upgrades.map((u) => u.id).filter((id) => !bought.has(id))).toEqual([]);
  });

  test('every cost fits in storage (with all storage built), Stamina costs fit even at the lowest Health', () => {
    const max = new Map(game.resources.map((r) => [r.id, r.max]));
    for (const u of game.upgrades) for (const c of u.capacity) max.set(c.resource.id, max.get(c.resource.id)! + c.amount);
    const h = DATA.health!;
    const lowestStamina = 100 * (h.staminaMin + ((1 - h.staminaMin) * h.base) / 100);
    for (const u of game.upgrades) {
      for (const c of u.costs) {
        expect(c.amount, `${u.id}: ${c.resource.id}`).toBeLessThanOrEqual(max.get(c.resource.id)!);
        if (c.resource.id === 'stamina') expect(c.amount, u.id).toBeLessThanOrEqual(lowestStamina);
      }
    }
  });

  test("Health's sources add up to 110", () => {
    const h = DATA.health!;
    expect(h.base + h.sources.reduce((s, x) => s + x.points, 0)).toBe(110);
  });

  test("cards on the map don't overlap", () => {
    const W = 230;
    const H = 110;
    const nodes = DATA.converters;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const [a, b] = [nodes[i], nodes[j]];
        const overlap = Math.abs(a.x - b.x) < W + 20 && Math.abs(a.y - b.y) < H;
        expect(overlap, `${a.id} / ${b.id}`).toBe(false);
      }
    }
  });
});
