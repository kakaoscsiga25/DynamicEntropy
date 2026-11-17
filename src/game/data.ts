import type { GameData } from './defs.ts';

// Game content. Started as a 1:1 copy of legacy/core/data.py (v1.3.2).
// v2 additions: storage buildings, house upgrades moved to the Build panel,
// food gives Stamina (Eat fruit, Eat bread).
// Visual-only fields: icon, color, group, hub, byproduct, region, x, y.
// Balance check: `npm run sim` plays the game with bots and reports timings.

export const DATA: GameData = {
  resources: [
    { id: 'stamina', name: 'Stamina', start: 100, max: 100, icon: '⚡', color: '#f5c542', group: 'Body', hub: true },
    { id: 'dreaming', name: 'Dreaming', max: 100, icon: '💤', color: '#b48cff', group: 'Body' },
    { id: 'seed', name: 'Seed', max: 100, icon: '🌰', color: '#d2a66a', group: 'Wilds' },
    { id: 'fruit', name: 'Fruit', max: 100, icon: '🍎', color: '#ff6b81', group: 'Wilds' },
    { id: 'plant', name: 'Plant', max: 100, icon: '🌿', color: '#4cd06d', group: 'Wilds' },
    { id: 'water', name: 'Water', max: 100, icon: '💧', color: '#4aa8ff', group: 'Wilds', hub: true },
    { id: 'wood', name: 'Wood', max: 100, icon: '🪵', color: '#c08552', group: 'Wilds' },
    { id: 'fire', name: 'Fire', max: 100, icon: '🔥', color: '#ff8a3d', group: 'Fire & Clay', hub: true },
    { id: 'brick', name: 'Brick', max: 100, icon: '🧱', color: '#e0604a', group: 'Fire & Clay' },
    { id: 'clay', name: 'Clay', max: 100, icon: '🏺', color: '#c99a6e', group: 'Fire & Clay' },
    { id: 'cotton', name: 'Cotton', max: 100, icon: '☁️', color: '#e9ecf5', group: 'Fields' },
    { id: 'fabric', name: 'Fabric', max: 50, icon: '🧵', color: '#e58fd8', group: 'Fields' },
    { id: 'wheat', name: 'Wheat', max: 100, icon: '🌾', color: '#e8c547', group: 'Fields' },
    { id: 'flour', name: 'Flour', max: 100, icon: '🥣', color: '#efe3c8', group: 'Fields' },
    { id: 'bread', name: 'Bread', max: 50, icon: '🍞', color: '#e0a458', group: 'Fields' },
    { id: 'iron_ore', name: 'Iron ore', max: 100, icon: '🪨', color: '#9aa1ad', group: 'Forge' },
    { id: 'iron', name: 'Iron', max: 50, icon: '🔩', color: '#bcc8dc', group: 'Forge' },
    { id: 'tool', name: 'Tool', max: 10, icon: '🔨', color: '#8fd3f0', group: 'Forge' },
  ],

  regions: [
    { id: 'home', name: 'Home', color: '#b48cff' },
    { id: 'wilds', name: 'Wilds', color: '#4cd06d' },
    { id: 'fire_clay', name: 'Fire & Clay', color: '#ff8a3d' },
    { id: 'fields', name: 'Fields', color: '#e8c547' },
    { id: 'forge', name: 'Forge', color: '#8fb3d9' },
  ],

  converters: [
    {
      id: 'wake_up', name: 'Wake up', region: 'home', x: -40, y: 110, unstoppable: true,
      needs: [{ res: 'dreaming', amount: 100, atLeast: 100 }],
      makes: [{ res: 'stamina', amount: 100 }],
    },
    {
      id: 'sleep', name: 'Sleep', region: 'home', x: -40, y: 0, unstoppable: true,
      needs: [
        { res: 'stamina', amount: 0, atMost: 0.99 },
        { res: 'dreaming', amount: 0 },
      ],
      makes: [{ res: 'dreaming', amount: 5 }],
    },
    {
      id: 'twiddling_thumbs', name: 'Twiddling thumbs', region: 'home', x: -40, y: 220,
      needs: [{ res: 'stamina', amount: 1 }],
      makes: [],
    },
    {
      id: 'water_source', name: 'Water source', region: 'wilds', x: 270, y: 110,
      needs: [{ res: 'stamina', amount: 5 }],
      makes: [{ res: 'water', amount: 1, atLeast: 0 }],
    },
    {
      id: 'forest', name: 'Forest', region: 'wilds', x: 810, y: 110,
      needs: [
        { res: 'water', amount: 0.1, atLeast: 0 },
        { res: 'plant', amount: 1, atLeast: 50 },
      ],
      makes: [{ res: 'plant', amount: 2, atLeast: 0 }],
    },
    {
      id: 'wood_cutting', name: 'Wood cutting', region: 'wilds', x: 1080, y: 55,
      needs: [
        { res: 'plant', amount: 5, atLeast: 0 },
        { res: 'stamina', amount: 10, atLeast: 0 },
      ],
      makes: [{ res: 'wood', amount: 1, atLeast: 0 }],
    },
    {
      id: 'gather_fruit', name: 'Gather fruit', region: 'wilds', x: 270, y: 0,
      needs: [{ res: 'stamina', amount: 5, atLeast: 0 }],
      makes: [{ res: 'fruit', amount: 3, atLeast: 0 }],
    },
    {
      id: 'eat_fruit', name: 'Eat fruit', region: 'wilds', x: 540, y: 0,
      needs: [
        { res: 'fruit', amount: 1 },
        { res: 'dreaming', amount: 0, atMost: 0 },
      ],
      makes: [
        { res: 'seed', amount: 0.2 },
        { res: 'stamina', amount: 1 },
      ],
    },
    {
      id: 'garden', name: 'Garden', region: 'wilds', x: 810, y: 0,
      needs: [
        { res: 'seed', amount: 5, atLeast: 0 },
        { res: 'water', amount: 5, atLeast: 0 },
      ],
      makes: [{ res: 'plant', amount: 5, atLeast: 0 }],
    },
    {
      id: 'start_fire', name: 'Start a fire', region: 'fire_clay', x: 1380, y: 0,
      needs: [
        { res: 'wood', amount: 1, atLeast: 50 },
        { res: 'stamina', amount: 5, atLeast: 50 },
      ],
      makes: [{ res: 'fire', amount: 1, atLeast: 0 }],
    },
    {
      id: 'fireplace', name: 'Fireplace', region: 'fire_clay', x: 1380, y: 110,
      needs: [
        { res: 'wood', amount: 1, atLeast: 10 },
        { res: 'fire', amount: 1, atLeast: 25 },
      ],
      makes: [{ res: 'fire', amount: 3, atLeast: 0 }],
    },
    {
      id: 'dig_clay', name: 'Dig clay', region: 'fire_clay', x: 1650, y: 0,
      needs: [
        { res: 'stamina', amount: 5, atLeast: 0 },
        { res: 'water', amount: 0.1, atLeast: 50 },
      ],
      makes: [{ res: 'clay', amount: 1, atLeast: 0 }],
    },
    {
      id: 'clay_furnace', name: 'Clay furnace', region: 'fire_clay', x: 1650, y: 110,
      needs: [
        { res: 'clay', amount: 2, atLeast: 0 },
        { res: 'fire', amount: 1, atLeast: 50 },
      ],
      makes: [{ res: 'brick', amount: 1, atLeast: 0 }],
    },
    {
      id: 'cotton_field', name: 'Cotton field', region: 'fields', x: 540, y: 330,
      needs: [
        { res: 'water', amount: 1, atLeast: 0 },
        { res: 'seed', amount: 0, atLeast: 10 },
      ],
      makes: [
        { res: 'cotton', amount: 1 },
        { res: 'seed', amount: 0.1, byproduct: true },
      ],
    },
    {
      id: 'loom', name: 'Loom', region: 'fields', x: 810, y: 330,
      needs: [
        { res: 'cotton', amount: 5, atLeast: 0 },
        { res: 'stamina', amount: 3, atLeast: 0 },
      ],
      makes: [{ res: 'fabric', amount: 1 }],
    },
    {
      id: 'wheat_field', name: 'Wheat field', region: 'fields', x: 270, y: 440,
      needs: [
        { res: 'water', amount: 1, atLeast: 0 },
        { res: 'seed', amount: 0, atLeast: 10 },
      ],
      makes: [
        { res: 'wheat', amount: 1 },
        { res: 'seed', amount: 0.1, byproduct: true },
      ],
    },
    {
      id: 'mill', name: 'Mill', region: 'fields', x: 540, y: 440,
      needs: [
        { res: 'wheat', amount: 1, atLeast: 0 },
        { res: 'stamina', amount: 1 },
      ],
      makes: [{ res: 'flour', amount: 0.1 }],
    },
    {
      id: 'baking', name: 'Baking', region: 'fields', x: 810, y: 440,
      needs: [
        { res: 'flour', amount: 1 },
        { res: 'water', amount: 0.3 },
        { res: 'fire', amount: 1, atLeast: 20 },
        { res: 'stamina', amount: 0.5 },
      ],
      makes: [{ res: 'bread', amount: 1 }],
    },
    {
      id: 'iron_mine', name: 'Iron mine', region: 'forge', x: 1650, y: 330,
      needs: [{ res: 'stamina', amount: 5 }],
      makes: [{ res: 'iron_ore', amount: 0.1 }],
    },
    {
      id: 'iron_smelter', name: 'Iron smelter', region: 'forge', x: 1380, y: 330,
      needs: [
        { res: 'iron_ore', amount: 1 },
        { res: 'fire', amount: 5, atLeast: 30 },
      ],
      makes: [{ res: 'iron', amount: 0.1 }],
    },
    {
      id: 'tool_maker', name: 'Tool maker', region: 'forge', x: 1110, y: 330,
      needs: [
        { res: 'iron', amount: 5 },
        { res: 'wood', amount: 15 },
        { res: 'fire', amount: 1, atLeast: 30 },
      ],
      makes: [{ res: 'tool', amount: 1 }],
    },
    {
      // Only while awake, and only when it won't be wasted (Stamina ≤ 80).
      id: 'eat_bread', name: 'Eat bread', region: 'home', x: -40, y: 330,
      needs: [
        { res: 'bread', amount: 1 },
        { res: 'dreaming', amount: 0, atMost: 0 },
        { res: 'stamina', amount: 0, atMost: 80 },
      ],
      makes: [{ res: 'stamina', amount: 20 }],
    },
  ],

  upgrades: [
    {
      id: 'wake_up_for_real', name: 'Literally wake up...', final: true,
      costs: [
        { res: 'wood', amount: 100 },
        { res: 'brick', amount: 100 },
        { res: 'fabric', amount: 50 },
        { res: 'bread', amount: 50 },
        { res: 'tool', amount: 10 },
      ],
      changes: [{ converter: 'wake_up', mode: 'by', needs: [], makes: [] }],
    },
    {
      id: 'shack', name: 'Shack', building: true,
      costs: [{ res: 'wood', amount: 25 }, { res: 'stamina', amount: 50 }],
      changes: [{ converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 5 }] }],
    },
    {
      id: 'bed', name: 'Bed', building: true,
      costs: [{ res: 'wood', amount: 10 }, { res: 'fabric', amount: 25 }],
      changes: [{ converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 5 }] }],
    },
    {
      id: 'small_house', name: 'Small house', building: true,
      costs: [{ res: 'brick', amount: 25 }, { res: 'wood', amount: 50 }, { res: 'stamina', amount: 50 }],
      requires: ['shack', 'bed'],
      changes: [{ converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 15 }] }],
    },
    {
      id: 'house', name: 'House', building: true,
      costs: [{ res: 'brick', amount: 50 }, { res: 'wood', amount: 100 }, { res: 'stamina', amount: 80 }],
      requires: ['small_house'],
      changes: [{ converter: 'sleep', mode: 'by', makes: [{ res: 'dreaming', amount: 20 }] }],
    },

    // ---- Storage buildings (Build panel): raise storage limits
    {
      id: 'woodshed', name: 'Woodshed', building: true,
      costs: [{ res: 'wood', amount: 40 }, { res: 'stamina', amount: 20 }],
      changes: [],
      capacity: [{ res: 'wood', amount: 100 }],
    },
    {
      id: 'cistern', name: 'Cistern', building: true,
      costs: [{ res: 'brick', amount: 20 }, { res: 'stamina', amount: 30 }],
      changes: [],
      capacity: [{ res: 'water', amount: 100 }],
    },
    {
      id: 'brick_yard', name: 'Brick yard', building: true,
      costs: [{ res: 'brick', amount: 30 }, { res: 'wood', amount: 20 }],
      changes: [],
      capacity: [{ res: 'brick', amount: 100 }, { res: 'clay', amount: 100 }],
    },
    {
      id: 'pantry', name: 'Pantry', building: true,
      costs: [{ res: 'wood', amount: 25 }, { res: 'brick', amount: 15 }],
      changes: [],
      capacity: [{ res: 'fruit', amount: 100 }, { res: 'bread', amount: 50 }],
    },
    {
      id: 'granary', name: 'Granary', building: true,
      costs: [{ res: 'wood', amount: 30 }, { res: 'brick', amount: 20 }],
      changes: [],
      capacity: [{ res: 'seed', amount: 100 }, { res: 'wheat', amount: 100 }, { res: 'flour', amount: 50 }],
    },
    {
      id: 'weaving_room', name: 'Weaving room', building: true,
      costs: [{ res: 'wood', amount: 30 }, { res: 'fabric', amount: 10 }],
      changes: [],
      capacity: [{ res: 'cotton', amount: 100 }, { res: 'fabric', amount: 50 }],
    },
    {
      id: 'toolshed', name: 'Toolshed', building: true,
      costs: [{ res: 'wood', amount: 40 }, { res: 'iron', amount: 5 }],
      changes: [],
      capacity: [{ res: 'tool', amount: 10 }, { res: 'iron', amount: 50 }, { res: 'iron_ore', amount: 100 }],
    },
    {
      id: 'built_road', name: 'Built road',
      costs: [{ res: 'brick', amount: 10 }],
      changes: [{ converter: 'water_source', mode: 'by', needs: [{ res: 'stamina', amount: -3 }] }],
    },
    {
      id: 'dig_groundwater', name: 'Dig down to ground-water',
      costs: [{ res: 'stamina', amount: 100 }],
      changes: [{
        converter: 'water_source', mode: 'by',
        needs: [{ res: 'stamina', amount: 5.1 }],
        makes: [{ res: 'water', amount: 1 }],
      }],
    },
    {
      id: 'build_well', name: 'Build well',
      costs: [{ res: 'stamina', amount: 50 }, { res: 'brick', amount: 25 }],
      requires: ['built_road', 'dig_groundwater'],
      changes: [{
        converter: 'water_source', mode: 'to', rename: 'Well',
        needs: [{ res: 'stamina', amount: 1 }],
        makes: [{ res: 'water', amount: 1 }],
      }],
    },
    {
      id: 'use_bucket', name: 'Use bucket',
      costs: [{ res: 'tool', amount: 1 }, { res: 'wood', amount: 15 }],
      requires: ['build_well'],
      changes: [{ converter: 'water_source', mode: 'by', makes: [{ res: 'water', amount: 1 }] }],
    },
    {
      id: 'dig_channel', name: 'Dig a channel',
      costs: [{ res: 'stamina', amount: 25 }, { res: 'tool', amount: 2 }],
      changes: [{
        converter: 'forest', mode: 'by',
        needs: [{ res: 'water', amount: 0.4 }],
        makes: [{ res: 'plant', amount: 3 }],
      }],
    },
    {
      id: 'advanced_handle', name: 'Advanced handle',
      costs: [{ res: 'fabric', amount: 10 }],
      changes: [{ converter: 'wood_cutting', mode: 'by', needs: [{ res: 'stamina', amount: -5 }] }],
    },
    {
      id: 'iron_axe_head', name: 'Iron axe head',
      costs: [{ res: 'iron', amount: 3 }],
      changes: [{ converter: 'wood_cutting', mode: 'by', makes: [{ res: 'wood', amount: 3 }] }],
    },
    {
      id: 'advanced_axe', name: 'Advanced axe',
      costs: [{ res: 'tool', amount: 1 }],
      requires: ['advanced_handle', 'iron_axe_head'],
      changes: [{
        converter: 'wood_cutting', mode: 'to',
        needs: [{ res: 'stamina', amount: 3 }, { res: 'plant', amount: 11 }],
        makes: [{ res: 'wood', amount: 10 }],
      }],
    },
    {
      id: 'use_digger', name: 'Use digger',
      costs: [{ res: 'tool', amount: 1 }],
      changes: [{
        converter: 'dig_clay', mode: 'to',
        needs: [{ res: 'stamina', amount: 1 }],
        makes: [{ res: 'clay', amount: 3 }],
      }],
    },
    {
      id: 'use_pickaxe', name: 'Use pickaxe',
      costs: [{ res: 'tool', amount: 1 }],
      changes: [{ converter: 'iron_mine', mode: 'by', needs: [{ res: 'stamina', amount: -4 }] }],
    },
    {
      id: 'build_minecart', name: 'Build minecart',
      costs: [{ res: 'tool', amount: 1 }],
      changes: [{ converter: 'iron_mine', mode: 'by', makes: [{ res: 'iron_ore', amount: 0.4 }] }],
    },
    {
      id: 'well_fed', name: 'Well fed',
      costs: [{ res: 'bread', amount: 25 }],
      changes: [{
        converter: 'iron_mine', mode: 'by',
        needs: [{ res: 'stamina', amount: 1 }],
        makes: [{ res: 'iron_ore', amount: 0.15 }],
      }],
    },
  ],
};
