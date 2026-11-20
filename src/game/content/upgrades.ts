import type { SectionDef, UpgradeDef } from '../defs.ts';

// Upgrades in the Build panel (not tied to one node), in sections.
// - changes: how nodes change (same as node upgrades, but name the node)
// - capacity: raises storage limits
// - home: points for the Home part of Health
// - fade: makes resources fade slower (factor 0.5 = half as fast)
// - guard: an automatic rule on a node (the player can switch it off)
// - unlocks: a skill (pace, overclock, thermostat, maintenance)

type SectionUpgrade = Omit<UpgradeDef, 'section'>;

export const SECTIONS: (SectionDef & { upgrades: SectionUpgrade[] })[] = [
  {
    id: 'home', name: 'Home',
    intro: 'A better place to sleep: shorter nights, and a healthier you.',
    upgrades: [
      {
        id: 'shack', name: 'Shack', home: 3,
        costs: [{ res: 'wood', amount: 25 }, { res: 'stamina', amount: 40 }],
        changes: [{ converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 5 }] }],
      },
      {
        id: 'bed', name: 'Bed', home: 3, text: 'Sweeter dreams: one more Dream fragment every morning.',
        costs: [{ res: 'wood', amount: 10 }, { res: 'fabric', amount: 15 }],
        changes: [
          { converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 5 }] },
          { converter: 'wake_up', mode: 'by', makes: [{ res: 'fragment', amount: 1 }] },
        ],
      },
      {
        id: 'small_house', name: 'Small house', home: 4,
        costs: [{ res: 'brick', amount: 25 }, { res: 'wood', amount: 50 }, { res: 'stamina', amount: 50 }],
        requires: ['shack', 'bed'],
        changes: [{ converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 10 }] }],
      },
      {
        id: 'house', name: 'House', home: 5,
        costs: [{ res: 'brick', amount: 50 }, { res: 'wood', amount: 80 }, { res: 'stamina', amount: 55 }],
        requires: ['small_house'],
        changes: [{ converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 15 }] }],
      },
    ],
  },
  {
    id: 'workshops', name: 'Workshops',
    intro: 'New places to work.',
    upgrades: [
      {
        id: 'build_furnace', name: 'Furnace', text: 'A second fire: keep one cool for baking and one hot for smelting.',
        costs: [{ res: 'brick', amount: 30 }, { res: 'clay', amount: 20 }, { res: 'stamina', amount: 40 }],
        changes: [],
      },
    ],
  },
  {
    id: 'storage', name: 'Storage',
    intro: 'Room for more of a resource.',
    upgrades: [
      { id: 'woodshed', name: 'Woodshed', costs: [{ res: 'wood', amount: 40 }, { res: 'stamina', amount: 20 }], changes: [], capacity: [{ res: 'wood', amount: 100 }] },
      { id: 'cistern', name: 'Cistern', costs: [{ res: 'brick', amount: 20 }, { res: 'stamina', amount: 30 }], changes: [], capacity: [{ res: 'water', amount: 100 }] },
      { id: 'ash_pit', name: 'Ash pit', costs: [{ res: 'brick', amount: 10 }], changes: [], capacity: [{ res: 'ash', amount: 30 }] },
      { id: 'brick_yard', name: 'Brick yard', costs: [{ res: 'brick', amount: 30 }, { res: 'wood', amount: 20 }], changes: [], capacity: [{ res: 'brick', amount: 100 }, { res: 'clay', amount: 100 }] },
      { id: 'manure_pit', name: 'Manure pit', costs: [{ res: 'wood', amount: 15 }], changes: [], capacity: [{ res: 'manure', amount: 30 }, { res: 'compost', amount: 50 }] },
      { id: 'granary', name: 'Granary', costs: [{ res: 'wood', amount: 30 }, { res: 'brick', amount: 20 }], changes: [], capacity: [{ res: 'seed', amount: 100 }, { res: 'wheat', amount: 100 }, { res: 'flour', amount: 50 }, { res: 'hay', amount: 100 }] },
      { id: 'pantry', name: 'Pantry', costs: [{ res: 'wood', amount: 25 }, { res: 'brick', amount: 15 }], changes: [], capacity: [{ res: 'fruit', amount: 100 }, { res: 'bread', amount: 50 }, { res: 'catch', amount: 30 }] },
      { id: 'weaving_room', name: 'Weaving room', costs: [{ res: 'wood', amount: 30 }, { res: 'fabric', amount: 10 }], changes: [], capacity: [{ res: 'cotton', amount: 100 }, { res: 'fabric', amount: 50 }, { res: 'wool', amount: 50 }] },
      { id: 'bookshelf', name: 'Bookshelf', costs: [{ res: 'wood', amount: 30 }, { res: 'paper', amount: 10 }], changes: [], capacity: [{ res: 'paper', amount: 50 }, { res: 'insight', amount: 50 }] },
      { id: 'toolshed', name: 'Toolshed', costs: [{ res: 'wood', amount: 40 }, { res: 'iron', amount: 5 }], changes: [], capacity: [{ res: 'tool', amount: 10 }, { res: 'iron', amount: 50 }, { res: 'iron_ore', amount: 100 }] },
      { id: 'bigger_pond', name: 'Bigger pond', text: 'A bigger pond holds more fish (and refills faster).', costs: [{ res: 'stamina', amount: 50 }, { res: 'tool', amount: 1 }], changes: [], capacity: [{ res: 'fish', amount: 40 }] },
      { id: 'fenced_pasture', name: 'Fenced pasture', text: 'Room for a bigger flock.', costs: [{ res: 'wood', amount: 40 }, { res: 'tool', amount: 1 }], changes: [], capacity: [{ res: 'sheep', amount: 20 }] },
    ],
  },
  {
    id: 'preservation', name: 'Preservation',
    intro: 'Food keeps longer. Not a must: making just what you need works too.',
    upgrades: [
      {
        id: 'cellar', name: 'Cellar', text: 'Fruit, bread and fish keep twice as long.',
        costs: [{ res: 'brick', amount: 30 }, { res: 'wood', amount: 20 }],
        changes: [],
        fade: [{ res: 'fruit', factor: 0.5 }, { res: 'bread', factor: 0.5 }, { res: 'catch', factor: 0.5 }],
      },
      {
        id: 'starter_crock', name: 'Starter crock', text: 'The Starter dies twice as slowly.',
        costs: [{ res: 'clay', amount: 10 }, { res: 'brick', amount: 5 }],
        changes: [],
        fade: [{ res: 'starter', factor: 0.5 }],
      },
    ],
  },
  {
    id: 'mind', name: 'Mind',
    intro: 'Paid with Insight from your dream journal: better ways to work, and things that run themselves.',
    upgrades: [
      { id: 'steady_pace', name: 'Steady pace', unlocks: 'pace', costs: [{ res: 'insight', amount: 5 }], changes: [] },
      { id: 'overtime', name: 'Overtime', unlocks: 'overclock', requires: ['steady_pace'], costs: [{ res: 'insight', amount: 15 }], changes: [] },
      {
        id: 'forester', name: 'Forester', text: 'Wood cutting leaves the Forest enough to regrow.',
        costs: [{ res: 'insight', amount: 6 }], changes: [],
        guard: { converter: 'wood_cutting', res: 'plant', atLeast: 55, label: 'Only while Plant ≥ 55 (the Forest keeps regrowing)' },
      },
      {
        id: 'starter_keeper', name: 'Starter keeper', text: 'The Starter is only fed when it runs low.',
        costs: [{ res: 'insight', amount: 4 }], changes: [],
        guard: { converter: 'feed_starter', res: 'starter', atMost: 12, label: 'Only while Starter ≤ 12' },
      },
      {
        id: 'fish_warden', name: 'Fish warden', text: 'Fishing stops before the pond gets too empty.',
        costs: [{ res: 'insight', amount: 6 }], changes: [],
        guard: { converter: 'fishing', res: 'fish', atLeast: 0.5, ofMax: true, label: 'Only while the pond is at least half full' },
      },
      { id: 'thermostat', name: 'Thermostat', text: 'Fires keep a temperature you set: the wood is added by itself.', unlocks: 'thermostat', costs: [{ res: 'insight', amount: 10 }], changes: [] },
      { id: 'maintenance', name: 'Maintenance', text: 'Tools are sharpened by themselves when they are worn down to 30%.', unlocks: 'maintenance', costs: [{ res: 'insight', amount: 10 }], changes: [] },
      {
        id: 'lucid_dreams', name: 'Lucid dreams', text: 'Two more Dream fragments every morning.',
        costs: [{ res: 'insight', amount: 8 }],
        changes: [{ converter: 'wake_up', mode: 'by', makes: [{ res: 'fragment', amount: 2 }] }],
      },
    ],
  },
];
