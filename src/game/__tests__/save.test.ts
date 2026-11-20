import { describe, expect, test } from 'vitest';
import { Game } from '../engine.ts';
import { SAVE_KEY, clearSave, loadSave, serialize, writeSave, type KeyValueStore } from '../save.ts';
import { CYCLE, FIXTURE, run } from './fixture.ts';

function memoryStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

/** Plays a bit so the save has upgrades, settings, running nodes and a cycle in progress. */
function playedGame(): Game {
  const g = new Game(FIXTURE);
  for (const id of ['axe', 'thermostat', 'warden', 'steady_pace', 'big_field']) expect(g.buy(id)).toBe(true);
  g.converter('chop').start();
  g.converter('field').start();
  g.converter('fireplace').start();
  g.resource('wood').amount = 50;
  g.resource('fire').amount = 20;
  g.resource('ash').amount = 5;
  g.setPace('chop', 0.5);
  g.setShares('field', [0.3, 0.7]);
  g.setTarget('fireplace', 60);
  g.setGuard('fishing', 0, false);
  run(g, CYCLE + 3);
  return g;
}

describe('save / load', () => {
  test('round trip restores amounts, upgrades, settings, running state and cycles', () => {
    const g = playedGame();
    const store = memoryStore();
    expect(writeSave(store, serialize(g, 123.7, 'test'))).toBe(true);

    const g2 = new Game(FIXTURE);
    const res = loadSave(store, g2);
    expect(res.kind).toBe('loaded');
    if (res.kind === 'loaded') expect(res.save.playtime).toBe(123);
    expect(g2.resources.map((r) => r.amount)).toEqual(g.resources.map((r) => r.amount));
    expect(g2.boughtOrder).toEqual(g.boughtOrder);
    const [a, b] = [g.converter('chop'), g2.converter('chop')];
    expect(b.pace).toBe(0.5);
    expect(b.condition).toBe(a.condition);
    expect(b.cycle).toEqual(a.cycle);
    expect(b.stopped).toBe(false);
    expect(g2.converter('field').shares).toEqual([0.3, 0.7]);
    expect(g2.converter('field').cycle).toEqual(g.converter('field').cycle);
    expect(g2.converter('fireplace').target).toBe(60);
    expect(g2.converter('fishing').guards[0].guard?.enabled).toBe(false);
    expect(g2.converter('gather').stopped).toBe(true);
    expect([...g2.discovered].sort()).toEqual([...g.discovered].sort());

    // and it keeps running the same way
    run(g, 20);
    run(g2, 20);
    expect(g2.resources.map((r) => r.amount)).toEqual(g.resources.map((r) => r.amount));
  });

  test('saves from before the v3 rework are not loaded (the game starts fresh)', () => {
    const old = memoryStore({ [SAVE_KEY]: JSON.stringify({ format: 2, resources: {} }) });
    expect(loadSave(old, new Game(FIXTURE)).kind).toBe('outdated');
    const v1 = memoryStore({ save_resources: 'Stamina:10', save_upgrades: '' });
    expect(loadSave(v1, new Game(FIXTURE)).kind).toBe('outdated');
    writeSave(v1, serialize(new Game(FIXTURE), 0, 'test'));
    expect(Object.keys(v1.data)).toEqual([SAVE_KEY]);
  });

  test('reset and a corrupt save', () => {
    const store = memoryStore({ [SAVE_KEY]: '{not json' });
    expect(loadSave(store, new Game(FIXTURE)).kind).toBe('error');
    clearSave(store);
    expect(store.data).toEqual({});
    expect(loadSave(store, new Game(FIXTURE)).kind).toBe('none');
  });
});
