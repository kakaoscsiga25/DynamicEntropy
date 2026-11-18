// Tests for the v2 rules: storage buildings, Build-panel upgrades, food, growth, sleep.
import { describe, expect, test } from 'vitest';
import { DEFAULT_CYCLE_SECONDS, Game, TICKS_PER_SECOND } from '../engine.ts';

const fill = (g: Game) => g.resources.forEach((r) => (r.amount = r.max));
/** Ticks in one cycle at 100% pace. */
const CYCLE = DEFAULT_CYCLE_SECONDS * TICKS_PER_SECOND;
const run = (g: Game, ticks: number) => {
  for (let i = 0; i < ticks; i++) g.tick();
};

describe('buildings', () => {
  test('house upgrades and storage live in the Build panel, not on a node', () => {
    const g = new Game();
    const ids = g.buildings.map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining(['shack', 'bed', 'small_house', 'house', 'woodshed', 'toolshed']));
    expect(g.converter('sleep').upgrades).toEqual([]);
    for (const u of g.buildings) expect(u.host).toBeNull();
  });

  test('storage buildings raise the limit and production can fill it', () => {
    const g = new Game();
    fill(g);
    expect(g.resource('wood').max).toBe(100);
    expect(g.upgrade('woodshed').capacityEffects()).toEqual([
      { resource: g.resource('wood'), before: 100, after: 200 },
    ]);
    expect(g.buy('woodshed')).toBe(true);
    expect(g.resource('wood').max).toBe(200);
    g.resource('wood').amount = 199.5;
    g.resource('wood').give(5);
    g.resource('wood').flush();
    expect(g.resource('wood').amount).toBe(200);
  });

  test('house upgrades still speed up Sleep', () => {
    const g = new Game();
    fill(g);
    expect(g.buy('shack')).toBe(true);
    expect(g.converter('sleep').makes[0].amount).toBe(10);
  });
});

describe('food', () => {
  test('eating fruit makes seeds but no Stamina (so it never keeps you awake)', () => {
    const g = new Game();
    const stamina = g.resource('stamina');
    g.resource('fruit').amount = 10;
    stamina.amount = 50;
    g.converter('eat_fruit').start();
    run(g, CYCLE);
    expect(stamina.amount).toBe(50);
    expect(g.resource('seed').amount).toBeCloseTo(0.2);
    g.resource('dreaming').amount = 5; // asleep
    run(g, CYCLE);
    expect(g.converter('eat_fruit').state).toBe('noInput');
  });

  test('eating bread gives 20 Stamina, but not when it would be wasted', () => {
    const g = new Game();
    const stamina = g.resource('stamina');
    g.resource('bread').amount = 5;
    g.updateDiscovery();
    expect(g.discovered.has('eat_bread')).toBe(true);
    const eat = g.converter('eat_bread');
    eat.start();
    stamina.amount = 90;
    g.tick();
    expect(eat.state).toBe('noInput');
    expect(g.resource('bread').amount).toBe(5);
    stamina.amount = 40;
    run(g, CYCLE);
    expect(stamina.amount).toBe(60);
    expect(g.resource('bread').amount).toBe(4);
  });
});

describe('growth (output grows with the stock above the minimum)', () => {
  test('wheat field: ×1 at 10 seeds, ×2 at 20, capped at ×3; byproduct and inputs stay fixed', () => {
    const g = new Game();
    const field = g.converter('wheat_field');
    const seed = g.resource('seed');
    const wheat = g.resource('wheat');
    const water = g.resource('water');
    field.start();
    for (const [seeds, expected] of [[10, 1], [20, 2], [25, 2.5], [60, 3]] as const) {
      seed.amount = seeds;
      water.amount = 50;
      wheat.amount = 0;
      expect(field.growthFactor()).toBeCloseTo(expected);
      run(g, CYCLE);
      expect(wheat.amount).toBeCloseTo(expected);
      expect(seed.amount).toBeCloseTo(Math.min(seed.max, seeds + 0.1)); // byproduct not scaled
      expect(water.amount).toBeCloseTo(49); // input not scaled
    }
  });

  test('forest grows faster with more Plant; its own use is measured before the cycle', () => {
    const g = new Game();
    const forest = g.converter('forest');
    const plant = g.resource('plant');
    g.resource('water').amount = 10;
    forest.start();
    plant.amount = 75; // ×2 → makes 4, uses 1
    run(g, CYCLE);
    expect(plant.amount).toBeCloseTo(78);
    plant.amount = 50; // ×1 → makes 2, uses 1
    run(g, CYCLE);
    expect(plant.amount).toBeCloseTo(51);
  });

  test('size upgrades raise the cap, and survive save/load (replayed)', () => {
    const g = new Game();
    fill(g);
    const field = g.converter('cotton_field');
    expect(g.upgrade('bigger_cotton_field').effects()[0].growthMax).toEqual({ before: 3, after: 5 });
    expect(g.buy('bigger_cotton_field')).toBe(true);
    expect(field.growth?.maxFactor).toBe(5);
    expect(field.growthFullAt()).toBeCloseTo(50);
    g.resource('seed').amount = 100;
    expect(field.growthFactor()).toBe(5);
    const g2 = new Game();
    g2.upgrade('bigger_cotton_field').apply();
    expect(g2.converter('cotton_field').growth?.maxFactor).toBe(5);
  });
});

describe('sleep (Stamina only works while you are awake)', () => {
  /** Wood cutting with plenty of Plant. */
  function woodCutting(g: Game, stamina: number) {
    g.resource('plant').amount = 100;
    g.resource('stamina').amount = stamina;
    const c = g.converter('wood_cutting');
    c.start();
    return c;
  }

  test('a node that uses Stamina is interrupted while you dream, and goes on when you wake up', () => {
    const g = new Game();
    const c = woodCutting(g, 100);
    run(g, CYCLE / 2);
    g.resource('dreaming').amount = 5; // asleep
    run(g, CYCLE);
    expect(c.state).toBe('interrupted');
    expect(c.cycle?.progress).toBeCloseTo(0.5);
    expect(g.resource('wood').amount).toBe(0);
    g.resource('dreaming').amount = 0; // awake
    run(g, CYCLE / 2);
    expect(g.resource('wood').amount).toBe(1);
  });

  test('a cycle started just before falling asleep finishes after waking up', () => {
    const g = new Game();
    const c = woodCutting(g, 10); // exactly one cycle of Stamina
    g.tick();
    expect(g.resource('stamina').amount).toBe(0);
    run(g, 5 * CYCLE);
    expect(g.converter('sleep').state).toBe('ok');
    expect(c.state).toBe('interrupted');
    expect(c.cycle?.progress).toBeCloseTo(1 / CYCLE);
    expect(g.resource('wood').amount).toBe(0);
    let t = 0;
    while (g.resource('stamina').amount < 1 && t++ < 1000) g.tick(); // Wake up delivered
    g.tick(); // first tick awake: the cycle continues
    expect(g.asleep()).toBe(false);
    expect(c.state).toBe('ok');
    run(g, CYCLE);
    expect(g.resource('wood').amount).toBe(1);
  });

  test("while asleep, a node that uses Stamina can't start a cycle (it waits for Stamina)", () => {
    const g = new Game();
    const c = woodCutting(g, 100);
    g.resource('dreaming').amount = 5;
    run(g, CYCLE);
    expect(c.state).toBe('noInput');
    expect(c.cycle).toBeNull();
    expect(c.blockingNeeds().map((r) => r.resource.id)).toEqual(['stamina']);
    expect(g.resource('stamina').amount).toBe(100);
  });

  test('Sleep and nodes that need no Stamina keep working while you dream', () => {
    const g = new Game();
    g.resource('stamina').amount = 0;
    g.resource('plant').amount = 60;
    g.resource('water').amount = 10;
    const forest = g.converter('forest');
    forest.start();
    run(g, CYCLE + 1);
    expect(g.asleep()).toBe(true);
    expect(forest.state).toBe('ok');
    expect(g.resource('plant').amount).toBeGreaterThan(60);
    expect(g.resource('dreaming').amount).toBe(5);
  });
});

describe('cycle end: outputs wait for room in storage', () => {
  test('a finished cycle waits (Output full) until all of its output fits, nothing is lost', () => {
    const g = new Game();
    const gather = g.converter('gather_fruit');
    const fruit = g.resource('fruit');
    fruit.amount = 99;
    g.resource('stamina').amount = 100;
    gather.start();
    run(g, CYCLE);
    expect(gather.state).toBe('full');
    expect(gather.cycle?.progress).toBe(1);
    expect(gather.blockedOutputs().map((r) => r.resource.id)).toEqual(['fruit']);
    expect(fruit.amount).toBe(99);
    expect(g.resource('stamina').amount).toBe(95); // only one cycle was started
    run(g, CYCLE);
    expect(fruit.amount).toBe(99);
    fruit.amount = 90;
    g.tick();
    expect(fruit.amount).toBe(93);
    expect(gather.state).toBe('ok'); // and the next cycle has started
  });

  test("byproducts don't block: a full seed store doesn't stop the wheat", () => {
    const g = new Game();
    const field = g.converter('wheat_field');
    g.resource('seed').amount = 100;
    g.resource('water').amount = 50;
    field.start();
    run(g, CYCLE);
    expect(field.state).toBe('ok');
    expect(g.resource('wheat').amount).toBe(3);
    expect(g.resource('seed').amount).toBe(100);
  });

  test('Sleep fills Dreaming up to the limit, so you always wake up', () => {
    const g = new Game();
    fill(g);
    for (const id of ['shack', 'bed', 'small_house', 'house']) {
      fill(g);
      expect(g.buy(id)).toBe(true);
    }
    expect(g.converter('sleep').makes[0].amount).toBe(50);
    g.resource('stamina').amount = 0;
    g.resource('dreaming').amount = 90;
    let t = 0;
    while (g.resource('stamina').amount < 1 && t++ < 100) g.tick();
    expect(g.resource('stamina').amount).toBe(100);
  });

  test("Sleep's cycle is dropped (not left interrupted) when you wake up", () => {
    const g = new Game();
    g.resource('stamina').amount = 0;
    g.resource('dreaming').amount = 95;
    let t = 0;
    while (g.resource('stamina').amount < 1 && t++ < 100) g.tick();
    g.tick();
    expect(g.converter('sleep').state).toBe('noInput');
    expect(g.converter('sleep').cycle).toBeNull();
    expect(g.resource('dreaming').amount).toBe(0);
    expect(g.asleep()).toBe(false);
  });
});
