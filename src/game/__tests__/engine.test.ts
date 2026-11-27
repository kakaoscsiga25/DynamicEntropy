// Tests for the engine's rules, on a small made-up game (fixture.ts).
import { describe, expect, test } from 'vitest';
import { paceEfficiency, paceOutput, wearFactor } from '../engine.ts';
import { CYCLE, FIXTURE_PRODUCTIVITY, run, testGame } from './fixture.ts';

describe('cycles', () => {
  test('a cycle lasts 1 s (10 ticks): inputs when it starts, outputs when it ends', () => {
    expect(CYCLE).toBe(10);
    const g = testGame();
    const c = g.converter('chop');
    c.start();
    g.tick();
    expect(g.resource('stamina').amount).toBe(90);
    expect(g.resource('wood').amount).toBe(0);
    expect(c.cycle?.progress).toBeCloseTo(0.1);
    run(g, CYCLE - 1);
    expect(g.resource('wood').amount).toBe(1);
    expect(c.cycle).toBeNull();
    g.tick();
    expect(g.resource('stamina').amount).toBe(80);
  });

  test('rates spread a cycle evenly over its ticks, so the display does not jump', () => {
    const g = testGame();
    g.converter('chop').start();
    for (let i = 0; i < 2 * CYCLE; i++) {
      g.tick();
      expect(g.resource('wood').lastFlow).toBeCloseTo(1 / CYCLE);
      expect(g.resource('stamina').lastFlow).toBeCloseTo(-10 / CYCLE);
    }
  });

  test('a finished cycle waits (Output full) until its output fits; nothing is lost', () => {
    const g = testGame();
    const chop = g.converter('chop');
    const wood = g.resource('wood');
    wood.amount = 99.5;
    chop.start();
    run(g, CYCLE);
    expect(chop.state).toBe('full');
    expect(chop.blockedOutputs().map((r) => r.resource.id)).toEqual(['wood']);
    run(g, CYCLE);
    expect(g.resource('stamina').amount).toBe(90); // only one cycle was started
    wood.amount = 95;
    g.tick();
    expect(wood.amount).toBe(96);
    expect(chop.state).toBe('ok');
  });
});

describe('pace', () => {
  test('curve: output per second is 1.3p − 0.3p², inputs per second follow the pace', () => {
    expect(paceOutput(1)).toBe(1);
    expect(paceOutput(0.5)).toBeCloseTo(0.575);
    expect(paceEfficiency(0.5)).toBeCloseTo(1.15);
    expect(paceOutput(2)).toBeCloseTo(1.4);
  });

  test('locked until Steady pace, above 100% only with Overtime; not on fireplaces', () => {
    const g = testGame();
    expect(g.setPace('chop', 0.5)).toBe(false);
    g.buy('steady_pace');
    expect(g.setPace('chop', 0.5)).toBe(true);
    expect(g.setPace('chop', 1.7)).toBe(true);
    expect(g.converter('chop').pace).toBe(1);
    g.buy('overtime');
    g.setPace('chop', 1.7);
    expect(g.converter('chop').pace).toBe(1.7);
    expect(g.setPace('fireplace', 0.5)).toBe(false);
    expect(g.setPace('sleep', 0.5)).toBe(false);
  });

  test('slower: the cycle takes longer and gives more per input', () => {
    const g = testGame();
    g.buy('steady_pace');
    g.setPace('chop', 0.5);
    g.converter('chop').start();
    run(g, 2 * CYCLE);
    expect(g.resource('wood').amount).toBeCloseTo(1.15);
    expect(g.resource('stamina').amount).toBe(90);
  });
});

describe('sleep (Stamina only works while you are awake)', () => {
  test('a node that uses Stamina is interrupted while you dream and goes on after', () => {
    const g = testGame();
    const c = g.converter('chop');
    c.start();
    run(g, CYCLE / 2);
    g.resource('dreaming').amount = 5;
    run(g, CYCLE);
    expect(c.state).toBe('interrupted');
    expect(c.cycle?.progress).toBeCloseTo(0.5);
    g.resource('dreaming').amount = 0;
    run(g, CYCLE / 2);
    expect(g.resource('wood').amount).toBe(1);
  });

  test("while asleep a node that uses Stamina can't start", () => {
    const g = testGame();
    const c = g.converter('chop');
    c.start();
    g.resource('dreaming').amount = 5;
    g.tick();
    expect(c.state).toBe('noInput');
    expect(c.blockingNeeds().map((r) => r.resource.id)).toEqual(['stamina']);
  });

  test('a condition can be a share of the limit (eat only while Stamina ≤ 50%)', () => {
    const g = testGame();
    const eat = g.converter('eat');
    eat.start();
    g.resource('food').amount = 10;
    g.resource('stamina').amount = 60;
    g.tick();
    expect(eat.state).toBe('noInput');
    g.resource('stamina').amount = 40;
    run(g, CYCLE);
    expect(g.resource('stamina').amount).toBe(50);
  });
});

describe('fading (entropy)', () => {
  test('a fading stock loses its share every second, proportionally', () => {
    const g = testGame();
    g.resource('food').amount = 100;
    run(g, CYCLE);
    expect(g.resource('food').amount).toBeCloseTo(100 * Math.exp(-0.1), 3);
  });

  test('rotting turns into something else; a cellar makes it slower', () => {
    const g = testGame();
    g.resource('apple').amount = 100;
    run(g, CYCLE);
    const lost = 100 - 100 * Math.exp(-0.05);
    expect(g.resource('apple').amount).toBeCloseTo(100 - lost, 3);
    expect(g.resource('compost').amount).toBeCloseTo(lost * 0.5, 3);
    g.buy('cellar');
    expect(g.resource('apple').fadeRate).toBeCloseTo(0.025);
  });

  test('dream memories only fade while awake', () => {
    const g = testGame();
    g.resource('memory').amount = 50;
    g.resource('dreaming').amount = 10;
    run(g, CYCLE);
    expect(g.resource('memory').amount).toBe(50);
    g.resource('dreaming').amount = 0;
    run(g, CYCLE);
    expect(g.resource('memory').amount).toBeCloseTo(50 * Math.exp(-0.1), 3);
  });

  test('a regrowing stock recovers by itself up to its limit', () => {
    const g = testGame();
    g.resource('soil').amount = 50;
    run(g, CYCLE);
    expect(g.resource('soil').amount).toBeCloseTo(51);
    g.resource('soil').amount = 99.95;
    g.tick();
    expect(g.resource('soil').amount).toBe(100);
  });
});

describe('fires: temperature ranges, fuel, thermostat', () => {
  test('a node with a heat range works while ANY fire is in it', () => {
    const g = testGame();
    const bake = g.converter('bake');
    bake.start();
    g.resource('clay').amount = 10;
    g.resource('fire').amount = 50;
    g.tick();
    expect(bake.state).toBe('noInput');
    expect(bake.blockingNeeds().map((r) => r.kind)).toEqual(['heat']);
    g.resource('fire').amount = 95; // too hot
    g.tick();
    expect(bake.state).toBe('noInput');
    g.resource('kiln').amount = 75; // the other fire is right
    g.tick();
    expect(bake.state).toBe('ok');
  });

  test('more wood = hotter: the fire settles at heat per second / cooling', () => {
    const g = testGame();
    const fp = g.converter('fireplace');
    fp.start();
    g.resource('wood').amount = 100;
    g.resource('fire').amount = 10;
    run(g, CYCLE);
    expect(g.resource('wood').amount).toBeCloseTo(99.5); // 0.5 wood per cycle
    expect(g.resource('fire').amount).toBeCloseTo(10 * Math.exp(-0.01) + 1, 2);
    expect(g.resource('ash').amount).toBeCloseTo(0.1);
    expect(g.setThrottle('fireplace', 0.254)).toBe(true);
    expect(fp.throttle).toBe(0.25);
    for (let i = 0; i < 6000; i++) {
      g.resource('wood').amount = 100;
      g.resource('ash').amount = 0;
      g.tick();
    }
    expect(g.resource('fire').amount).toBeGreaterThan(48);
    expect(g.resource('fire').amount).toBeLessThan(51);
  });

  test('the thermostat sets the fuel to keep a temperature; setting fuel by hand turns it off', () => {
    const g = testGame();
    const fp = g.converter('fireplace');
    fp.start();
    g.resource('fire').amount = 10;
    expect(g.setTarget('fireplace', 70)).toBe(false);
    g.buy('thermostat');
    expect(g.setTarget('fireplace', 70)).toBe(true);
    for (let i = 0; i < 3000; i++) {
      g.resource('wood').amount = 100;
      g.resource('ash').amount = 0;
      g.tick();
    }
    expect(Math.abs(g.resource('fire').amount - 70)).toBeLessThan(2);
    g.setThrottle('fireplace', 0.1);
    expect(fp.target).toBeNull();
  });

  test("a node that needs an upgrade isn't there until it's bought", () => {
    const g = testGame();
    g.resource('wood').amount = 10;
    g.updateDiscovery();
    expect(g.discovered.has('kiln_fire')).toBe(false);
    g.converter('kiln_fire').start();
    g.tick();
    expect(g.resource('wood').amount).toBe(10);
    g.resource('brick').amount = 5;
    g.buy('build_kiln');
    g.tick();
    expect(g.discovered.has('kiln_fire')).toBe(true);
    expect(g.resource('wood').amount).toBe(9.5);
  });
});

describe('a node split between parts (Field)', () => {
  test('every part scales with its share; optional inputs take what is there and never block', () => {
    const g = testGame();
    const f = g.converter('field');
    f.start();
    g.resource('soil').amount = 50;
    g.tick();
    // Soil 50 → growth 0.5 + 0.005 × 50 = 0.75
    expect(f.cycle?.out).toEqual([1.5, 0, 0]);
    expect(f.cycle?.took).toEqual([0, 1]); // no ash, 1 soil
    run(g, CYCLE - 1);
    expect(g.resource('wheat').amount).toBeCloseTo(1.5);

    expect(g.setShares('field', [2, 2])).toBe(true);
    expect(f.shares).toEqual([0.5, 0.5]);
    expect(g.setShares('field', [0, 0])).toBe(false);
    g.resource('soil').amount = 0.3;
    g.resource('ash').amount = 10;
    g.tick();
    expect(f.state).toBe('ok');
    expect(f.cycle?.took).toEqual([0.5, 0.3]);
    expect(f.cycle?.extra).toEqual({ soil: 2 }); // 0.5 ash × 4
  });

  test("a part's byproduct never blocks (clover's soil into full storage)", () => {
    const g = testGame();
    const f = g.converter('field');
    g.setShares('field', [0, 1]);
    f.start();
    g.resource('soil').amount = 100;
    run(g, CYCLE);
    expect(g.resource('hay').amount).toBeCloseTo(2);
    expect(f.state).not.toBe('full');
  });

  test('upgrades change part lines too', () => {
    const g = testGame();
    g.buy('big_field');
    expect(g.converter('field').makes.find((m) => m.resource.id === 'wheat')?.amount).toBe(4);
  });
});

describe('growth', () => {
  test('a living stock grows fastest when half full (logistic), nature runs by itself', () => {
    const g = testGame();
    const spawn = g.converter('spawn');
    expect(g.discovered.has('spawn')).toBe(false);
    const fish = g.resource('fish');
    for (const [n, f] of [[20, 1], [10, 0.75], [40, 0]] as const) {
      fish.amount = n;
      expect(spawn.growthFactor()).toBeCloseTo(f);
    }
    fish.amount = 20;
    run(g, CYCLE);
    expect(fish.amount).toBeCloseTo(21);
    expect(g.discovered.has('spawn')).toBe(true);
    spawn.stop();
    expect(spawn.stopped).toBe(false);
    expect(spawn.growthFullAt()).toBe(20);
  });
});

describe('tool wear', () => {
  test('only after a tool upgrade; output drops as it wears, broken = 40%', () => {
    const g = testGame();
    const c = g.converter('chop');
    expect(c.wears).toBe(false);
    g.buy('axe');
    expect(c.wears).toBe(true);
    c.start();
    run(g, CYCLE);
    expect(g.resource('wood').amount).toBeCloseTo(2);
    expect(c.condition).toBe(90);
    expect(wearFactor(90)).toBeCloseTo(0.97);
    expect(wearFactor(0)).toBe(0.4);
  });

  test('sharpen before it breaks (cheap), repair after (a Tool); Maintenance does it by itself', () => {
    const g = testGame();
    const c = g.converter('chop');
    g.buy('axe');
    c.condition = 40;
    expect(g.sharpenCost(c).map((k) => k.resource.id)).toEqual(['stamina']);
    expect(g.sharpen('chop')).toBe(true);
    expect(c.condition).toBe(100);
    expect(g.resource('stamina').amount).toBe(95);
    c.condition = 0;
    expect(g.sharpen('chop')).toBe(false); // no tool
    g.resource('tool').amount = 1;
    expect(g.sharpen('chop')).toBe(true);
    expect(g.resource('tool').amount).toBe(0);

    g.buy('maintenance');
    c.condition = 31;
    g.tick();
    expect(c.condition).toBe(31);
    c.condition = 30;
    g.tick();
    expect(c.condition).toBe(100);
  });
});

describe('automatic rules (guards)', () => {
  test('a rule stops the node outside its range; the player can switch it off', () => {
    const g = testGame();
    const c = g.converter('fishing');
    c.start();
    g.resource('fish').amount = 10;
    g.tick();
    expect(c.state).toBe('ok');
    run(g, CYCLE);
    g.buy('warden');
    g.resource('fish').amount = 10; // below half of 40
    g.tick();
    expect(c.state).not.toBe('ok');
    expect(c.blockingNeeds()[0].guard?.label).toBe('half full');
    expect(g.setGuard('fishing', 0, false)).toBe(true);
    g.tick();
    expect(c.state).toBe('ok');
  });

  test("a rule's minimum counts after the node's own use (never takes the stock below it)", () => {
    const g = testGame();
    const c = g.converter('fishing'); // uses 1 fish a cycle
    g.buy('warden'); // at least half of 40 = 20
    c.start();
    g.resource('fish').amount = 20.5; // 19.5 would be left: too little
    g.tick();
    expect(c.state).toBe('noInput');
    g.resource('fish').amount = 21; // 20 left: fine
    g.tick();
    expect(c.state).toBe('ok');
    expect(g.resource('fish').amount).toBeGreaterThanOrEqual(20 - 1e-9);
  });
});

describe('productivity', () => {
  test('follows the sum of its sources (capped at 100) and scales manual work only', () => {
    const g = testGame(FIXTURE_PRODUCTIVITY);
    expect(g.productivity()).toBe(100); // starts full
    expect(g.productivityTarget()).toBe(40);
    run(g, 200);
    expect(g.productivity()).toBeCloseTo(40, 0);
    expect(g.workFactor()).toBeCloseTo(0.4, 2);
    expect(g.resource('stamina').max).toBe(100); // the Stamina limit doesn't change
    const chop = g.converter('chop');
    expect(chop.workFactor()).toBeCloseTo(0.4, 2);
    expect(chop.output(chop.makes[0])).toBeCloseTo(0.4, 2);
    expect(g.converter('fishing').workFactor()).toBe(1); // no Stamina: not manual work

    g.buy('hut');
    g.resource('fire').amount = 60;
    g.resource('food').amount = 100;
    expect(g.productivityParts().map((p) => [p.name, Math.round(p.points)])).toEqual([
      ['Base', 40], ['Food', 30], ['Warmth', 20], ['Home', 20], ['Sickness', 0],
    ]);
    expect(g.productivityTarget()).toBe(110);
    for (let i = 0; i < 300; i++) {
      g.resource('food').amount = 100;
      g.resource('fire').amount = 60;
      g.tick();
    }
    expect(g.productivity()).toBeCloseTo(100, 0);
  });

  test('penalties take points away; it never drops below the minimum', () => {
    const g = testGame(FIXTURE_PRODUCTIVITY);
    g.resource('sickness').amount = 50;
    expect(g.productivityParts().at(-1)).toEqual({ name: 'Sickness', points: -40, max: 80, penalty: true });
    expect(g.productivityTarget()).toBe(0);
    g.resource('sickness').amount = 100; // target 40 - 80 = -40
    run(g, 400);
    expect(g.productivity()).toBeCloseTo(1, 3);
    expect(g.workFactor()).toBeCloseTo(0.01, 4);
  });
});

describe('discovery', () => {
  test('a resource that only comes from rotting shows up with what rots', () => {
    const g = testGame();
    expect(g.isResourceVisible(g.resource('compost'))).toBe(true); // gather (stamina only) is discovered at once
    expect(g.isResourceVisible(g.resource('brick'))).toBe(false);
  });
});
