import { describe, expect, test } from 'vitest';
import { Game } from '../engine.ts';
import { SAVE_KEY, clearSave, loadSave, serialize, writeSave, type KeyValueStore } from '../save.ts';

function memoryStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

/** Plays a bit so the save has upgrades, running converters and discoveries. */
function playedGame(): Game {
  const g = new Game();
  const fill = () => g.resources.forEach((r) => (r.amount = r.max));
  g.converter('water_source').start();
  g.converter('gather_fruit').start();
  for (const id of ['dig_groundwater', 'built_road', 'build_well']) {
    fill();
    expect(g.buy(id)).toBe(true);
  }
  for (let i = 0; i < 20; i++) g.tick();
  return g;
}

describe('save / load', () => {
  test('round trip restores amounts, upgrades, renames, running state and discoveries', () => {
    const g = playedGame();
    const store = memoryStore();
    expect(writeSave(store, serialize(g, 123.7, 'test'))).toBe(true);

    const g2 = new Game();
    const res = loadSave(store, g2);
    expect(res.kind).toBe('loaded');
    if (res.kind === 'loaded') expect(res.save.playtime).toBe(123);
    expect(g2.resources.map((r) => r.amount)).toEqual(g.resources.map((r) => r.amount));
    expect(g2.boughtOrder).toEqual(['dig_groundwater', 'built_road', 'build_well']);
    expect(g2.converter('water_source').name).toBe('Well');
    expect(g2.converter('water_source').needs[0].amount).toBe(1);
    expect(g2.converter('water_source').stopped).toBe(false);
    expect(g2.converter('iron_mine').stopped).toBe(true);
    expect([...g2.discovered].sort()).toEqual([...g.discovered].sort());
  });

  test('migrates a v1.x save (names) and removes the old keys after saving', () => {
    const store = memoryStore({
      save_version: 'v1.3.2',
      save_resources: 'Stamina:42.5|Water:7|Wood:3.25|Unknown thing:9',
      save_upgrades: 'Built road|Dig down to ground-water|Build well',
      save_playtime: '600',
    });
    const g = new Game();
    const res = loadSave(store, g);
    expect(res.kind).toBe('migrated');
    expect(g.resource('stamina').amount).toBe(42.5);
    expect(g.resource('water').amount).toBe(7);
    expect(g.resource('wood').amount).toBe(3.25);
    expect(g.converter('water_source').name).toBe('Well');

    writeSave(store, serialize(g, 600, 'test'));
    expect(Object.keys(store.data)).toEqual([SAVE_KEY]);
  });

  test('empty v1.x upgrade list and reset', () => {
    const store = memoryStore({ save_resources: 'Stamina:10', save_upgrades: '' });
    const g = new Game();
    expect(loadSave(store, g).kind).toBe('migrated');
    expect(g.boughtOrder).toEqual([]);
    clearSave(store);
    expect(store.data).toEqual({});
    expect(loadSave(store, new Game()).kind).toBe('none');
  });

  test('corrupt save is reported, not thrown', () => {
    const store = memoryStore({ [SAVE_KEY]: '{not json' });
    expect(loadSave(store, new Game()).kind).toBe('error');
  });
});
