// A small made-up game for testing the engine's rules, independent of the real
// content (so balancing the real numbers never breaks these tests).
import type { ConverterDef, GameData, ResourceDef, UpgradeDef } from '../defs.ts';
import { DEFAULT_CYCLE_SECONDS, Game, TICKS_PER_SECOND } from '../engine.ts';

const res = (id: string, max: number, extra: Partial<ResourceDef> = {}): ResourceDef => ({
  id, name: id[0].toUpperCase() + id.slice(1), max, icon: '•', color: '#888', group: 'Test', ...extra,
});

const node = (id: string, def: Partial<ConverterDef>): ConverterDef => ({
  id, name: id, region: 'test', x: 0, y: 0, needs: [], makes: [], ...def,
});

export const FIXTURE: GameData = {
  resources: [
    res('stamina', 100, { start: 100, awake: true }),
    res('dreaming', 100, { dream: true }),
    res('health', 100, { start: 100 }),
    res('food', 100, { fade: { rate: 0.1 } }),
    res('apple', 100, { fade: { rate: 0.05, into: 'compost', yield: 0.5 } }),
    res('compost', 100),
    res('memory', 100, { fade: { rate: 0.1, awakeOnly: true } }),
    res('soil', 100, { regen: 1 }),
    res('wood', 100),
    res('fire', 100, { heat: true, fade: { rate: 0.01 } }),
    res('kiln', 100, { heat: true, fade: { rate: 0.01 } }),
    res('clay', 100),
    res('brick', 100),
    res('wheat', 100),
    res('hay', 100),
    res('ash', 100),
    res('fish', 40),
    res('tool', 10),
  ],
  regions: [{ id: 'test', name: 'Test', color: '#888' }],
  converters: [
    node('wake_up', {
      unstoppable: true,
      needs: [{ res: 'dreaming', amount: 100, atLeast: 100 }],
      makes: [{ res: 'stamina', amount: 100 }, { res: 'memory', amount: 5, byproduct: true }],
    }),
    node('sleep', {
      unstoppable: true,
      needs: [{ res: 'stamina', amount: 0, atMost: 0.99 }, { res: 'dreaming', amount: 0 }],
      makes: [{ res: 'dreaming', amount: 50 }],
    }),
    node('spawn', {
      nature: true,
      growth: { res: 'fish', shape: 'logistic' },
      needs: [{ res: 'fish', amount: 0, atLeast: 1 }],
      makes: [{ res: 'fish', amount: 1 }],
    }),
    node('fireplace', {
      throttle: { label: 'Wood', min: 0, max: 1, step: 0.01, start: 0.5 },
      needs: [{ res: 'wood', amount: 1 }, { res: 'fire', amount: 0, atLeast: 5 }],
      makes: [{ res: 'fire', amount: 2 }, { res: 'ash', amount: 0.2 }],
    }),
    node('kiln_fire', {
      requires: 'build_kiln',
      throttle: { label: 'Wood', min: 0, max: 1, step: 0.01, start: 0.5 },
      needs: [{ res: 'wood', amount: 1 }],
      makes: [{ res: 'kiln', amount: 2 }],
    }),
    node('chop', {
      wear: { perCycle: 10, sharpen: [{ res: 'stamina', amount: 5 }], repair: [{ res: 'tool', amount: 1 }] },
      needs: [{ res: 'stamina', amount: 10 }],
      makes: [{ res: 'wood', amount: 1 }],
    }),
    node('gather', {
      needs: [{ res: 'stamina', amount: 5 }],
      makes: [{ res: 'apple', amount: 3 }],
    }),
    node('bake', {
      heat: [60, 90],
      needs: [{ res: 'clay', amount: 2 }],
      makes: [{ res: 'brick', amount: 1 }],
    }),
    node('field', {
      growth: { res: 'soil', base: 0.5, perUnit: 0.005, maxFactor: 1 },
      needs: [{ res: 'ash', amount: 0.5, optional: true, yields: { res: 'soil', amount: 4 } }],
      makes: [],
      parts: [
        { id: 'wheat', name: 'Wheat', icon: '•', color: '#888', start: 1, needs: [{ res: 'soil', amount: 1, optional: true }], makes: [{ res: 'wheat', amount: 2 }] },
        { id: 'clover', name: 'Clover', icon: '•', color: '#888', start: 0, makes: [{ res: 'hay', amount: 2 }, { res: 'soil', amount: 1, byproduct: true }] },
      ],
    }),
    node('fishing', {
      needs: [{ res: 'fish', amount: 1 }],
      makes: [{ res: 'food', amount: 1 }],
    }),
    node('eat', {
      needs: [{ res: 'food', amount: 1 }, { res: 'stamina', amount: 0, atMost: 0.5, ofMax: true }],
      makes: [{ res: 'stamina', amount: 10 }],
    }),
  ],
  upgrades: [
    { id: 'steady_pace', name: 'Steady pace', unlocks: 'pace', section: 'mind', costs: [], changes: [] },
    { id: 'overtime', name: 'Overtime', unlocks: 'overclock', requires: ['steady_pace'], section: 'mind', costs: [], changes: [] },
    { id: 'thermostat', name: 'Thermostat', unlocks: 'thermostat', section: 'mind', costs: [], changes: [] },
    { id: 'maintenance', name: 'Maintenance', unlocks: 'maintenance', section: 'mind', costs: [], changes: [] },
    {
      id: 'warden', name: 'Warden', section: 'mind', costs: [], changes: [],
      guard: { converter: 'fishing', res: 'fish', atLeast: 0.5, ofMax: true, label: 'half full' },
    },
    { id: 'build_kiln', name: 'Kiln', section: 'home', costs: [{ res: 'brick', amount: 5 }], changes: [] },
    { id: 'cellar', name: 'Cellar', section: 'home', costs: [], changes: [], fade: [{ res: 'apple', factor: 0.5 }] },
    { id: 'hut', name: 'Hut', section: 'home', costs: [], changes: [], home: 20 },
    { id: 'axe', name: 'Axe', tool: true, costs: [], changes: [{ converter: 'chop', mode: 'by', makes: [{ res: 'wood', amount: 1 }] }] },
    { id: 'big_field', name: 'Big field', costs: [], changes: [{ converter: 'field', mode: 'by', makes: [{ res: 'wheat', amount: 2 }] }] },
  ] satisfies UpgradeDef[],
  sections: [{ id: 'home', name: 'Home' }, { id: 'mind', name: 'Mind' }],
};

/** The same game with Health (sources: food stock 30 points, warmth 20, home 20; base 40). */
export const FIXTURE_HEALTH: GameData = {
  ...FIXTURE,
  health: {
    res: 'health',
    base: 40,
    sources: [
      { kind: 'stock', name: 'Food', res: 'food', points: 30, full: 50 },
      { kind: 'heat', name: 'Warmth', points: 20, full: 30 },
      { kind: 'home', name: 'Home', points: 20 },
    ],
    rate: 0.5,
    staminaRes: 'stamina',
    staminaMin: 0.5,
    workMin: 0.5,
  },
};

/** Ticks in one cycle at 100% pace (10). */
export const CYCLE = DEFAULT_CYCLE_SECONDS * TICKS_PER_SECOND;

export function run(g: Game, ticks: number) {
  for (let i = 0; i < ticks; i++) g.tick();
}

export const testGame = (data: GameData = FIXTURE) => new Game(data);
