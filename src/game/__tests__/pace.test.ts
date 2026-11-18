// Tests for cycles (each node works in its own loop) and the pace slider.
import { describe, expect, test } from 'vitest';
import { DEFAULT_CYCLE_SECONDS, Game, TICKS_PER_SECOND, paceEfficiency, paceOutput } from '../engine.ts';
import { restore, serialize } from '../save.ts';

const fill = (g: Game) => g.resources.forEach((r) => (r.amount = r.max));
/** Ticks in one cycle at 100% pace (10). */
const CYCLE = DEFAULT_CYCLE_SECONDS * TICKS_PER_SECOND;
const run = (g: Game, ticks: number) => {
  for (let i = 0; i < ticks; i++) g.tick();
};

/** A game where the pace slider (and optionally overclocking) is unlocked, stocks reset to 0. */
function paced(overclock = false): Game {
  const g = new Game();
  fill(g);
  expect(g.buy('steady_pace')).toBe(true);
  if (overclock) {
    fill(g);
    expect(g.buy('overtime')).toBe(true);
  }
  g.resources.forEach((r) => (r.amount = 0));
  return g;
}

/** Wood cutting with plenty of Plant and Stamina. */
function woodCutting(g: Game) {
  g.resource('plant').amount = 100;
  g.resource('stamina').amount = 100;
  const c = g.converter('wood_cutting');
  c.start();
  return c;
}

describe('cycles', () => {
  test('a cycle lasts 1 s (10 ticks): inputs when it starts, outputs when it ends', () => {
    expect(CYCLE).toBe(10);
    const g = new Game();
    const c = woodCutting(g);
    g.tick();
    expect(g.resource('plant').amount).toBe(95);
    expect(g.resource('stamina').amount).toBe(90);
    expect(g.resource('wood').amount).toBe(0);
    expect(c.cycle?.progress).toBeCloseTo(0.1);
    run(g, CYCLE - 1);
    expect(g.resource('wood').amount).toBe(1);
    expect(c.cycle).toBeNull();
    expect(g.resource('plant').amount).toBe(95); // the next cycle starts next tick
    g.tick();
    expect(g.resource('plant').amount).toBe(90);
  });

  test('rates spread a cycle evenly over its ticks, so the display does not jump', () => {
    const g = new Game();
    woodCutting(g);
    for (let i = 0; i < 2 * CYCLE; i++) {
      g.tick();
      expect(g.resource('wood').lastFlow).toBeCloseTo(1 / CYCLE);
      expect(g.resource('plant').lastFlow).toBeCloseTo(-5 / CYCLE);
    }
  });
});

describe('pace', () => {
  test('curve: output per second is 1.3p − 0.3p², inputs per second follow the pace', () => {
    expect(paceOutput(1)).toBe(1);
    expect(paceEfficiency(1)).toBe(1);
    expect(paceOutput(0.5)).toBeCloseTo(0.575);
    expect(paceEfficiency(0.5)).toBeCloseTo(1.15);
    expect(paceOutput(2)).toBeCloseTo(1.4);
    expect(paceEfficiency(2)).toBeCloseTo(0.7);
  });

  test('the slider is locked until Steady pace, and only goes above 100% with Overtime', () => {
    const g = new Game();
    expect(g.paceMax()).toBe(0);
    expect(g.setPace('wood_cutting', 0.5)).toBe(false);
    expect(g.converter('wood_cutting').pace).toBe(1);

    fill(g);
    expect(g.upgrade('overtime').requirementsMet()).toBe(false);
    g.buy('steady_pace');
    expect(g.paceMax()).toBe(1);
    g.setPace('wood_cutting', 0.333);
    expect(g.converter('wood_cutting').pace).toBe(0.33); // 1% steps
    g.setPace('wood_cutting', 0.05);
    expect(g.converter('wood_cutting').pace).toBe(0.1); // at least 10%
    g.setPace('wood_cutting', 1.7);
    expect(g.converter('wood_cutting').pace).toBe(1);
    g.setPace('wood_cutting', 0);
    expect(g.converter('wood_cutting').pace).toBe(0.1);
    expect(g.setPace('sleep', 0.5)).toBe(false); // unstoppable nodes keep their pace

    fill(g);
    g.buy('overtime');
    expect(g.paceMax()).toBe(2);
    g.setPace('wood_cutting', 1.7);
    expect(g.converter('wood_cutting').pace).toBe(1.7);
    g.setPace('wood_cutting', 9);
    expect(g.converter('wood_cutting').pace).toBe(2);
  });

  test('at 50% a cycle takes twice as long and makes 15% more', () => {
    const g = paced();
    const c = woodCutting(g);
    g.setPace(c.id, 0.5);
    run(g, CYCLE);
    expect(g.resource('plant').amount).toBe(95);
    expect(g.resource('stamina').amount).toBe(90);
    expect(g.resource('wood').amount).toBe(0);
    expect(c.cycle?.progress).toBeCloseTo(0.5);
    run(g, CYCLE);
    expect(g.resource('wood').amount).toBeCloseTo(1.15);
    expect(g.resource('plant').amount).toBe(95);
    g.tick();
    expect(g.resource('plant').amount).toBe(90);
  });

  test('at 200% a cycle takes half as long and makes 30% less', () => {
    const g = paced(true);
    const c = woodCutting(g);
    g.setPace(c.id, 2);
    run(g, CYCLE);
    expect(g.resource('plant').amount).toBe(90);
    expect(g.resource('stamina').amount).toBe(80);
    expect(g.resource('wood').amount).toBeCloseTo(1.4);
  });

  test('speeding up mid-cycle applies at once, and the cycle gets the faster pace\'s output', () => {
    const g = paced();
    const c = woodCutting(g);
    g.setPace(c.id, 0.5);
    expect(c.pacePending).toBe(false); // no cycle running yet
    g.tick(); // a cycle starts at 50%: 5% done
    g.setPace(c.id, 1);
    expect(c.pacePending).toBe(false);
    run(g, 9); // 95% left at 10% per tick: not done yet
    expect(g.resource('wood').amount).toBe(0);
    g.tick();
    expect(g.resource('wood').amount).toBeCloseTo(1); // 100%'s output, not 50%'s 1.15
  });

  test("slowing down mid-cycle applies at once, but this cycle keeps the faster pace's output", () => {
    const g = paced();
    const c = woodCutting(g);
    run(g, CYCLE / 2); // half a cycle at 100%
    g.setPace(c.id, 0.5);
    expect(c.pacePending).toBe(true);
    expect(c.cycle?.pace).toBe(0.5);
    expect(c.cycle?.outPace).toBe(1);
    run(g, CYCLE - 1); // the second half takes twice as long
    expect(g.resource('wood').amount).toBe(0);
    g.tick();
    expect(g.resource('wood').amount).toBeCloseTo(1); // not 1.15: no cheating
    g.tick(); // the next cycle runs fully at 50%
    expect(c.pacePending).toBe(false);
    run(g, 2 * CYCLE - 1);
    expect(g.resource('wood').amount).toBeCloseTo(1 + 1.15);
  });

  test('stopping keeps the cycle in progress, starting again continues it', () => {
    const g = paced();
    const c = woodCutting(g);
    g.setPace(c.id, 0.5);
    run(g, CYCLE);
    c.stop();
    run(g, 2 * CYCLE);
    expect(c.cycle?.progress).toBeCloseTo(0.5);
    expect(g.resource('wood').amount).toBe(0);
    c.start();
    run(g, CYCLE);
    expect(g.resource('wood').amount).toBeCloseTo(1.15);
    expect(g.resource('plant').amount).toBe(95);
  });

  test('conditions are checked every tick: the cycle is interrupted while one fails', () => {
    const g = paced();
    const eat = g.converter('eat_bread');
    g.resource('bread').amount = 5;
    g.resource('stamina').amount = 40;
    eat.start();
    g.setPace(eat.id, 0.5);
    g.tick();
    expect(g.resource('bread').amount).toBe(4);
    g.resource('dreaming').amount = 5; // fell asleep: "only while awake"
    run(g, 2 * CYCLE);
    expect(eat.state).toBe('interrupted');
    expect(eat.cycle?.progress).toBeCloseTo(0.05);
    expect(g.resource('stamina').amount).toBe(40);
    g.resource('dreaming').amount = 0;
    run(g, 2 * CYCLE - 1);
    expect(g.resource('stamina').amount).toBeCloseTo(40 + 20 * 1.15);
  });

  test("a cycle's own use doesn't count against its minimum (Forest at 50 Plant)", () => {
    const g = paced();
    const forest = g.converter('forest');
    g.resource('plant').amount = 50;
    g.resource('water').amount = 10;
    forest.start();
    g.setPace(forest.id, 0.5);
    g.tick();
    expect(g.resource('plant').amount).toBe(49);
    run(g, 2 * CYCLE - 1);
    expect(forest.state).toBe('ok');
    expect(g.resource('plant').amount).toBeCloseTo(49 + 2 * 1.15);
  });

  test('saves keep the pace and the cycle in progress', () => {
    const g = paced();
    const c = woodCutting(g);
    g.setPace(c.id, 0.5);
    run(g, CYCLE);
    g.setPace(c.id, 0.3);
    const save = JSON.parse(JSON.stringify(serialize(g, 0, 'test')));

    const g2 = new Game();
    restore(g2, save);
    const c2 = g2.converter('wood_cutting');
    expect(c2.pace).toBe(0.3);
    expect(c2.cycle).toMatchObject({ pace: 0.3, outPace: 0.5, growth: 1 });
    expect(c2.cycle?.progress).toBeCloseTo(0.5);
    expect(c2.pacePending).toBe(true);
    run(g2, 17); // the other half at 30%: 3% per tick
    expect(g2.resource('wood').amount).toBeCloseTo(1.15);
  });
});
