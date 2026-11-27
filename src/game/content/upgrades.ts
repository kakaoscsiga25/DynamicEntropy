import type { SectionDef, UpgradeDef } from '../defs.ts';
import { FOREST_MIN } from './nodes.ts';

// Upgrades in the Build and Research panels (not tied to one node), in sections.
// A section with panel: 'research' is listed in the Research panel.
// - changes: how nodes change (same as node upgrades, but name the node)
// - capacity: raises storage limits
// - home: points for the Home part of Productivity
// - fade: makes resources fade slower (factor 0.5 = half as fast)
// - guard: an automatic rule on a node (the player can switch it off)
// - unlocks: a skill (pace, overclock, thermostat, maintenance)

type SectionUpgrade = Omit<UpgradeDef, 'section'>;

export const SECTIONS: (SectionDef & { upgrades: SectionUpgrade[] })[] = [
  {
    id: 'home', name: 'Home',
    intro: 'A better place to sleep: shorter nights, and more done during the day.',
    upgrades: [
      {
        id: 'shack', name: 'Shack', home: 4,
        costs: [{ res: 'wood', amount: 25 }, { res: 'stamina', amount: 40 }],
        changes: [{ converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 5 }] }],
      },
      {
        id: 'bed', name: 'Bed', home: 4, text: 'Sweeter dreams: one more Dream fragment every morning.',
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
        id: 'house', name: 'House', home: 6,
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
        id: 'build_furnace', name: 'Furnace', text: 'A second fire, built for heat: keep the Fireplace for baking and the Furnace hot for the forge.',
        costs: [{ res: 'brick', amount: 30 }, { res: 'clay', amount: 20 }, { res: 'stamina', amount: 40 }],
        changes: [],
      },
    ],
  },
  {
    id: 'gear', name: 'Gear',
    intro: 'What you wear to work: fewer injuries, clothes that last.',
    upgrades: [
      {
        id: 'work_gloves', name: 'Work gloves', text: 'Half the injuries from cutting wood, digging, mining and smithing.',
        costs: [{ res: 'fabric', amount: 12 }, { res: 'wool', amount: 5 }],
        changes: [
          { converter: 'wood_cutting', mode: 'by', makes: [{ res: 'injury', amount: -0.5 }] },
          { converter: 'dig_clay', mode: 'by', makes: [{ res: 'injury', amount: -0.4 }] },
          { converter: 'iron_mine', mode: 'by', makes: [{ res: 'injury', amount: -0.4 }] },
          { converter: 'tool_maker', mode: 'by', makes: [{ res: 'injury', amount: -0.75 }] },
        ],
      },
      {
        id: 'sturdy_clothes', name: 'Sturdy clothes', text: 'Clothes wear out half as fast.',
        costs: [{ res: 'fabric', amount: 15 }, { res: 'wool', amount: 10 }],
        changes: [],
        fade: [{ res: 'clothes', factor: 0.5 }],
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
      { id: 'medicine_chest', name: 'Medicine chest', costs: [{ res: 'wood', amount: 15 }, { res: 'fabric', amount: 5 }], changes: [], capacity: [{ res: 'medicine', amount: 20 }, { res: 'bandage', amount: 30 }] },
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
    id: 'mind', name: 'Mind', panel: 'research',
    intro: 'Paid with Insight from your dream journal: better ways to work, and things that run themselves.',
    upgrades: [
      { id: 'steady_pace', name: 'Steady pace', unlocks: 'pace', costs: [{ res: 'insight', amount: 2 }], changes: [] },
      {
        id: 'lucid_dreams', name: 'Lucid dreams', text: 'Two more Dream fragments every morning.',
        costs: [{ res: 'insight', amount: 10 }],
        changes: [{ converter: 'wake_up', mode: 'by', makes: [{ res: 'fragment', amount: 2 }] }],
      },
      { id: 'overtime', name: 'Overtime', unlocks: 'overclock', requires: ['steady_pace'], costs: [{ res: 'insight', amount: 25 }], changes: [] },
      { id: 'thermostat', name: 'Thermostat', text: 'Fires keep a temperature you set: the wood is added by itself.', unlocks: 'thermostat', costs: [{ res: 'insight', amount: 20 }], changes: [] },
      { id: 'maintenance', name: 'Maintenance', text: 'Tools are sharpened by themselves when they are worn down to 30%.', unlocks: 'maintenance', costs: [{ res: 'insight', amount: 20 }], changes: [] },
    ],
  },
  {
    id: 'rules', name: 'Habits', panel: 'research',
    intro: 'Rules a node follows by itself (you can switch them off in its details).',
    upgrades: [
      {
        id: 'forester', name: 'Forester', text: 'Wood cutting leaves the Forest enough to regrow.',
        costs: [{ res: 'insight', amount: 12 }], changes: [],
        guard: {
          converter: 'wood_cutting', res: 'plant', atLeast: FOREST_MIN,
          label: `Never cuts the Plant below ${FOREST_MIN} (the Forest keeps regrowing)`,
        },
      },
      {
        id: 'tailor', name: 'Tailor', text: 'Clothes are only sewn when they run low.',
        costs: [{ res: 'insight', amount: 6 }], changes: [],
        guard: { converter: 'sew_clothes', res: 'clothes', atMost: 8, label: 'Only while Clothes ≤ 8' },
      },
      {
        id: 'rationing', name: 'Rationing', text: 'Bread is only eaten when you need the grains: more is left for building.',
        costs: [{ res: 'insight', amount: 6 }], changes: [],
        guard: { converter: 'eat_bread', res: 'grains', atMost: 30, label: 'Only while Grains ≤ 30' },
      },
      {
        id: 'starter_keeper', name: 'Starter keeper', text: 'The Starter is only fed when it runs low.',
        costs: [{ res: 'insight', amount: 8 }], changes: [],
        guard: { converter: 'feed_starter', res: 'starter', atMost: 12, label: 'Only while Starter ≤ 12' },
      },
      {
        id: 'fish_warden', name: 'Fish warden', text: 'Fishing stops before the pond gets too empty.',
        costs: [{ res: 'insight', amount: 12 }], changes: [],
        guard: { converter: 'fishing', res: 'fish', atLeast: 0.5, ofMax: true, label: 'Never fishes the pond below half full' },
      },
    ],
  },
  {
    id: 'lore', name: 'Lore', panel: 'research',
    intro: 'Knowing how things work: less waste, less decay.',
    upgrades: [
      {
        id: 'fire_keeping', name: 'Fire keeping', text: 'Both fires cool down slower.',
        costs: [{ res: 'insight', amount: 12 }], changes: [],
        fade: [{ res: 'fire', factor: 0.8 }, { res: 'furnace', factor: 0.8 }],
      },
      {
        id: 'herbal_lore', name: 'Herbal lore', text: 'Stronger remedies from the same herbs.',
        costs: [{ res: 'insight', amount: 10 }],
        changes: [{ converter: 'brew_remedy', mode: 'by', makes: [{ res: 'medicine', amount: 1 }] }],
      },
      {
        id: 'first_aid', name: 'First aid', text: 'One bandage heals more.',
        costs: [{ res: 'insight', amount: 8 }],
        changes: [{ converter: 'dress_wounds', mode: 'by', needs: [{ res: 'injury', amount: 6, atLeast: 6 }] }],
      },
    ],
  },
];
