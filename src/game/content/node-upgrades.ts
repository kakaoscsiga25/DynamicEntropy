import type { NodeUpgradeDef } from '../defs.ts';

// Upgrades shown on a node, grouped by the node's id. `change` says how the
// node's recipe changes (matched by resource):
//   mode 'by': adds the numbers (stamina: -2 → uses 2 less)
//   mode 'to': replaces the lines
// tool: true → the node now uses a tool, which wears out (sharpen it in time).
// fade: makes a resource fade slower (factor 0.5 = half as fast), e.g. a fire.
// requires: other upgrades that must be bought first.

export const NODE_UPGRADES: Record<string, NodeUpgradeDef[]> = {
  wake_up: [
    {
      id: 'wake_up_for_real', name: 'Literally wake up...', final: true,
      costs: [
        { res: 'wood', amount: 100 },
        { res: 'brick', amount: 100 },
        { res: 'fabric', amount: 50 },
        { res: 'bread', amount: 40 },
        { res: 'tool', amount: 10 },
        { res: 'insight', amount: 30 },
      ],
    },
  ],

  // ------------------------------------------------ Home
  journal: [
    {
      id: 'bound_journal', name: 'Bound journal', text: 'Small handwriting.',
      costs: [{ res: 'paper', amount: 10 }, { res: 'fabric', amount: 5 }],
      change: { mode: 'by', needs: [{ res: 'paper', amount: -0.25 }] },
    },
  ],
  wash: [
    {
      id: 'tub', name: 'Wooden tub',
      costs: [{ res: 'wood', amount: 20 }, { res: 'brick', amount: 10 }],
      change: { mode: 'by', makes: [{ res: 'hygiene', amount: 10 }] },
    },
  ],

  // ------------------------------------------------ Wilds
  gather_fruit: [
    {
      id: 'basket', name: 'Basket',
      costs: [{ res: 'fabric', amount: 5 }],
      change: { mode: 'by', makes: [{ res: 'fruit', amount: 2 }] },
    },
  ],
  water_source: [
    {
      id: 'built_road', name: 'Built road',
      costs: [{ res: 'brick', amount: 10 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -2 }] },
    },
    {
      id: 'dig_groundwater', name: 'Dig down to ground-water',
      costs: [{ res: 'stamina', amount: 40 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: 1 }], makes: [{ res: 'water', amount: 1 }] },
    },
    {
      id: 'build_well', name: 'Build well',
      costs: [{ res: 'stamina', amount: 40 }, { res: 'brick', amount: 25 }],
      requires: ['built_road', 'dig_groundwater'],
      change: { mode: 'to', rename: 'Well', needs: [{ res: 'stamina', amount: 1 }], makes: [{ res: 'water', amount: 2 }] },
    },
    {
      id: 'use_bucket', name: 'Use bucket',
      costs: [{ res: 'tool', amount: 1 }, { res: 'wood', amount: 15 }],
      requires: ['build_well'],
      change: { mode: 'by', makes: [{ res: 'water', amount: 1 }] },
    },
  ],
  forest: [
    {
      id: 'dig_channel', name: 'Dig a channel',
      costs: [{ res: 'stamina', amount: 25 }, { res: 'tool', amount: 1 }],
      change: { mode: 'by', needs: [{ res: 'water', amount: 0.4 }], makes: [{ res: 'plant', amount: 1 }] },
    },
    {
      id: 'plant_more_trees', name: 'Plant more trees',
      costs: [{ res: 'seed', amount: 15 }, { res: 'stamina', amount: 40 }],
      change: { mode: 'by', growthMax: 1 },
    },
  ],
  wood_cutting: [
    {
      id: 'advanced_handle', name: 'Advanced handle',
      costs: [{ res: 'fabric', amount: 10 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -4 }] },
    },
    {
      id: 'iron_axe_head', name: 'Iron axe head', tool: true,
      costs: [{ res: 'iron', amount: 3 }],
      change: { mode: 'by', makes: [{ res: 'wood', amount: 2 }] },
    },
    {
      id: 'advanced_axe', name: 'Advanced axe', tool: true,
      costs: [{ res: 'tool', amount: 1 }],
      requires: ['advanced_handle', 'iron_axe_head'],
      change: { mode: 'to', needs: [{ res: 'stamina', amount: 3 }, { res: 'plant', amount: 10 }], makes: [{ res: 'wood', amount: 8 }] },
    },
  ],
  paper_maker: [
    {
      id: 'paper_mould', name: 'Paper mould',
      costs: [{ res: 'wood', amount: 20 }, { res: 'fabric', amount: 5 }],
      change: { mode: 'by', makes: [{ res: 'paper', amount: 1 }] },
    },
  ],

  // ------------------------------------------------ Fire & Clay
  start_fire: [
    {
      id: 'tinderbox', name: 'Tinderbox',
      costs: [{ res: 'iron', amount: 1 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -4 }] },
    },
  ],
  fireplace: [
    {
      id: 'stone_hearth', name: 'Stone hearth', text: 'Warm stones keep the heat: the fire cools down slower.',
      costs: [{ res: 'clay', amount: 15 }, { res: 'stamina', amount: 20 }],
      fade: [{ res: 'fire', factor: 0.75 }],
    },
    {
      id: 'chimney', name: 'Chimney', text: 'Hotter fire from the same wood.',
      costs: [{ res: 'brick', amount: 20 }, { res: 'clay', amount: 10 }],
      change: { mode: 'by', makes: [{ res: 'fire', amount: 2 }] },
    },
  ],
  furnace: [
    {
      id: 'insulation', name: 'Insulated walls', text: 'The furnace cools down half as fast: hot with little wood.',
      costs: [{ res: 'brick', amount: 25 }, { res: 'clay', amount: 25 }],
      fade: [{ res: 'furnace', factor: 0.5 }],
    },
    {
      id: 'bellows', name: 'Bellows', text: 'Hotter fire from the same wood.',
      costs: [{ res: 'fabric', amount: 10 }, { res: 'wood', amount: 15 }],
      change: { mode: 'by', makes: [{ res: 'furnace', amount: 3 }] },
    },
  ],
  dig_clay: [
    {
      id: 'use_digger', name: 'Use digger', tool: true,
      costs: [{ res: 'tool', amount: 1 }],
      change: { mode: 'to', needs: [{ res: 'stamina', amount: 1 }], makes: [{ res: 'clay', amount: 3 }] },
    },
  ],
  brick_kiln: [
    {
      id: 'bigger_kiln', name: 'Bigger kiln',
      costs: [{ res: 'brick', amount: 20 }],
      change: { mode: 'by', needs: [{ res: 'clay', amount: 2 }], makes: [{ res: 'brick', amount: 1 }] },
    },
  ],
  soap_maker: [
    {
      id: 'soap_moulds', name: 'Soap moulds',
      costs: [{ res: 'wood', amount: 15 }],
      change: { mode: 'by', makes: [{ res: 'soap', amount: 1 }] },
    },
  ],

  // ------------------------------------------------ Fields
  field: [
    {
      id: 'bigger_field', name: 'Bigger field',
      costs: [{ res: 'wood', amount: 30 }, { res: 'tool', amount: 1 }],
      change: {
        mode: 'by',
        needs: [{ res: 'water', amount: 0.5 }, { res: 'soil', amount: 0.2 }],
        makes: [{ res: 'wheat', amount: 1 }, { res: 'cotton', amount: 1 }, { res: 'hay', amount: 1 }, { res: 'fruit', amount: 1 }, { res: 'soil', amount: 0.3 }],
      },
    },
    {
      id: 'huge_field', name: 'Even bigger field',
      costs: [{ res: 'wood', amount: 60 }, { res: 'brick', amount: 20 }, { res: 'tool', amount: 2 }],
      requires: ['bigger_field'],
      change: {
        mode: 'by',
        needs: [{ res: 'water', amount: 0.5 }, { res: 'soil', amount: 0.2 }],
        makes: [{ res: 'wheat', amount: 1 }, { res: 'cotton', amount: 1 }, { res: 'hay', amount: 1 }, { res: 'fruit', amount: 1 }, { res: 'soil', amount: 0.3 }],
      },
    },
  ],
  mill: [
    {
      id: 'millstone', name: 'Millstone',
      costs: [{ res: 'brick', amount: 15 }],
      change: { mode: 'by', makes: [{ res: 'flour', amount: 0.5 }] },
    },
  ],
  baking: [
    {
      id: 'bread_oven', name: 'Bread oven',
      costs: [{ res: 'brick', amount: 20 }, { res: 'clay', amount: 10 }],
      change: { mode: 'by', needs: [{ res: 'flour', amount: 0.5 }], makes: [{ res: 'bread', amount: 1 }] },
    },
  ],
  loom: [
    {
      id: 'flying_shuttle', name: 'Flying shuttle',
      costs: [{ res: 'wood', amount: 15 }, { res: 'iron', amount: 2 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -1.5 }] },
    },
  ],
  sew_clothes: [
    {
      id: 'iron_needle', name: 'Iron needle',
      costs: [{ res: 'iron', amount: 1 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -1 }] },
    },
  ],

  // ------------------------------------------------ Care
  brew_remedy: [
    {
      id: 'mortar', name: 'Mortar and pestle',
      costs: [{ res: 'clay', amount: 10 }, { res: 'brick', amount: 5 }],
      change: { mode: 'by', makes: [{ res: 'medicine', amount: 1 }] },
    },
  ],
  make_bandages: [
    {
      id: 'scissors', name: 'Scissors',
      costs: [{ res: 'iron', amount: 1 }],
      change: { mode: 'by', makes: [{ res: 'bandage', amount: 1 }] },
    },
  ],

  // ------------------------------------------------ Pasture
  shearing: [
    {
      id: 'shears', name: 'Iron shears',
      costs: [{ res: 'iron', amount: 2 }],
      change: { mode: 'by', makes: [{ res: 'wool', amount: 1 }] },
    },
  ],
  spinning: [
    {
      id: 'spinning_wheel', name: 'Spinning wheel',
      costs: [{ res: 'wood', amount: 20 }, { res: 'iron', amount: 1 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -0.8 }] },
    },
  ],

  // ------------------------------------------------ Pond
  fishing: [
    {
      id: 'fishing_net', name: 'Fishing net',
      costs: [{ res: 'fabric', amount: 10 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -1 }] },
    },
  ],

  // ------------------------------------------------ Forge
  iron_mine: [
    {
      id: 'use_pickaxe', name: 'Use pickaxe', tool: true,
      costs: [{ res: 'tool', amount: 1 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -3 }] },
    },
    {
      id: 'build_minecart', name: 'Build minecart',
      costs: [{ res: 'tool', amount: 1 }, { res: 'wood', amount: 20 }],
      change: { mode: 'by', makes: [{ res: 'iron_ore', amount: 0.2 }] },
    },
    {
      id: 'well_fed', name: 'Well fed',
      costs: [{ res: 'bread', amount: 20 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: 1 }], makes: [{ res: 'iron_ore', amount: 0.1 }] },
    },
  ],
  pump: [
    {
      id: 'water_wheel', name: 'Water wheel', text: 'Pumps without you.',
      costs: [{ res: 'wood', amount: 30 }, { res: 'iron', amount: 4 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -1 }] },
    },
  ],
  iron_smelter: [
    {
      id: 'crucible', name: 'Bigger crucible',
      costs: [{ res: 'brick', amount: 25 }],
      change: { mode: 'by', needs: [{ res: 'iron_ore', amount: 2 }], makes: [{ res: 'iron', amount: 1 }] },
    },
  ],
  tool_maker: [
    {
      id: 'anvil', name: 'Anvil',
      costs: [{ res: 'iron', amount: 5 }],
      change: { mode: 'by', needs: [{ res: 'stamina', amount: -2 }] },
    },
  ],
};
