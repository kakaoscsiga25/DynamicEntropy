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
  test('eating fruit gives Stamina (only while awake)', () => {
    const g = new Game();
    const stamina = g.resource('stamina');
    g.resource('fruit').amount = 10;
    stamina.amount = 50;
    g.converter('eat_fruit').start();
    g.tick();
    expect(stamina.amount).toBe(51);
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
