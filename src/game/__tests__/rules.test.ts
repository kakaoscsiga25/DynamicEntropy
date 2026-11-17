// Tests for the v2 rules: storage buildings, Build-panel upgrades, food.
import { describe, expect, test } from 'vitest';
import { Game } from '../engine.ts';

const fill = (g: Game) => g.resources.forEach((r) => (r.amount = r.max));

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
    g.tick();
    expect(stamina.amount).toBe(50);
    expect(g.resource('seed').amount).toBeCloseTo(0.2);
    g.resource('dreaming').amount = 5; // asleep
    g.tick();
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
    g.tick();
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
      g.tick();
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
    g.tick();
    expect(plant.amount).toBeCloseTo(78);
    plant.amount = 50; // ×1 → makes 2, uses 1
    g.tick();
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
