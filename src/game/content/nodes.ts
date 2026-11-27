import type { ConverterDef } from '../defs.ts';

// Every node (converter) of the game: what it uses (needs) and makes per cycle.
// - amount: used up / made per cycle (default cycle: 1 s, `cycle` changes it)
// - atLeast / atMost: only runs while the stock is at least / at most this
//   (amount 0 = only a condition, nothing is used). ofMax: as a share of the limit.
// - optional: takes what's there, up to the amount (never blocks).
// - byproduct: not changed by growth / pace / Productivity / wear, never waits for room.
// - Nodes that use Stamina (manual work) make output × Productivity / 100.
// - heat: [min, max] temperature a fire (any of them) must be in.
// - x / y: where the card sits on the map (world px), region: its island.
// The order is the priority: earlier nodes get shared inputs first.

/** The Forest regrows while it has at least this much Plant (the Forester rule keeps it). */
export const FOREST_MIN = 50;

export const NODES: ConverterDef[] = [
  // ======================================================== Home: sleeping, eating
  {
    id: 'wake_up', name: 'Wake up', region: 'home', x: -940, y: 710, unstoppable: true,
    needs: [{ res: 'dreaming', amount: 100, atLeast: 100 }],
    // You remember some of your dreams: write them down before they fade.
    makes: [{ res: 'stamina', amount: 100 }, { res: 'fragment', amount: 3, byproduct: true }],
  },
  {
    id: 'sleep', name: 'Sleep', region: 'home', x: -940, y: 560, unstoppable: true,
    // You fall asleep when you have at most 1 Stamina left.
    needs: [
      { res: 'stamina', amount: 0, atMost: 1 },
      { res: 'dreaming', amount: 0 },
    ],
    makes: [{ res: 'dreaming', amount: 5 }],
  },

  // ======================================================== Nature: runs by itself
  {
    // Fish multiply fastest when the pond is half full.
    id: 'spawning', name: 'Spawning', region: 'pond', x: -640, y: 1310, nature: true, cycle: 2,
    growth: { res: 'fish', shape: 'logistic' },
    needs: [{ res: 'fish', amount: 0, atLeast: 1 }],
    makes: [{ res: 'fish', amount: 0.6 }],
  },
  {
    // Sheep eat hay; a flock grows fastest when the pasture is half full.
    id: 'flock', name: 'Flock', region: 'pasture', x: 660, y: 1210, nature: true, cycle: 4,
    growth: { res: 'sheep', shape: 'logistic' },
    needs: [
      { res: 'hay', amount: 0.5 },
      { res: 'sheep', amount: 0, atLeast: 2 },
    ],
    makes: [{ res: 'sheep', amount: 0.3 }, { res: 'manure', amount: 0.5, byproduct: true }],
  },
  {
    // Dirt makes you sick: wash before your Hygiene drops to 20.
    id: 'germs', name: 'Germs', region: 'care', x: -940, y: 0, nature: true,
    needs: [{ res: 'hygiene', amount: 0, atMost: 20 }],
    makes: [{ res: 'disease', amount: 0.06 }],
  },
  {
    // So do cold nights: keep a fire (any of them) above 10° while you sleep.
    id: 'cold', name: 'Cold night', region: 'care', x: -940, y: 150, nature: true,
    needs: [
      { res: 'dreaming', amount: 0, atLeast: 1 },
      { res: 'fire', amount: 0, atMost: 10 },
      { res: 'furnace', amount: 0, atMost: 10 },
    ],
    makes: [{ res: 'disease', amount: 0.06 }],
  },
  {
    // The deeper the mine, the more water seeps in.
    id: 'seepage', name: 'Seepage', region: 'forge', x: 1990, y: 990, nature: true,
    growth: { res: 'depth', perUnit: 0.05, maxFactor: 6 },
    needs: [{ res: 'depth', amount: 0, atLeast: 1 }],
    makes: [{ res: 'mine_water', amount: 0.02 }],
  },

  // ======================================================== Fire & Clay: fires first
  {
    // Lights the fire when it's out (or almost).
    id: 'start_fire', name: 'Start a fire', region: 'fire_clay', x: 1390, y: 0,
    needs: [
      { res: 'wood', amount: 2 },
      { res: 'stamina', amount: 5 },
      { res: 'fire', amount: 0, atMost: 10 },
    ],
    makes: [{ res: 'fire', amount: 15 }],
  },
  {
    // More wood = hotter. The fire cools by 1.5% a second, so it settles at
    // about 67° × wood per cycle (0.6 → 40°: baking). Needs embers (5°) to burn.
    // It can get hot enough for bricks, but that takes a lot of wood.
    id: 'fireplace', name: 'Fireplace', region: 'fire_clay', x: 1390, y: 180, cycle: 5,
    throttle: { label: 'Wood per cycle', min: 0, max: 1.3, step: 0.01, start: 0.6 },
    needs: [
      { res: 'wood', amount: 1 },
      { res: 'fire', amount: 0, atLeast: 5 },
    ],
    makes: [{ res: 'fire', amount: 5 }, { res: 'ash', amount: 0.5 }],
  },
  {
    // A second fire (built in the Build panel), made for heat: the same wood
    // makes it much hotter (about 107° × wood per cycle), so it's the forge's fire.
    id: 'furnace', name: 'Furnace', region: 'fire_clay', x: 1390, y: 340, cycle: 5, requires: 'build_furnace',
    throttle: { label: 'Wood per cycle', min: 0, max: 1, step: 0.01, start: 0.8 },
    needs: [{ res: 'wood', amount: 1 }],
    makes: [{ res: 'furnace', amount: 8 }, { res: 'ash', amount: 0.5 }],
  },

  // ======================================================== Home: eating, washing, writing
  {
    // Any time you're awake. Leftover seeds are worth keeping.
    id: 'eat_fruit', name: 'Eat fruit', region: 'home', x: -340, y: 720,
    needs: [
      { res: 'fruit', amount: 1 },
      { res: 'dreaming', amount: 0, atMost: 0 },
    ],
    makes: [{ res: 'vitamins', amount: 8, byproduct: true }, { res: 'seed', amount: 0.2, byproduct: true }],
  },
  {
    // Only while awake, and only when the Stamina isn't wasted (at most 80% of the limit).
    id: 'eat_bread', name: 'Eat bread', region: 'home', x: -340, y: 880,
    needs: [
      { res: 'bread', amount: 1 },
      { res: 'dreaming', amount: 0, atMost: 0 },
      { res: 'stamina', amount: 0, atMost: 0.8, ofMax: true },
    ],
    makes: [{ res: 'stamina', amount: 15, byproduct: true }, { res: 'grains', amount: 25, byproduct: true }],
  },
  {
    id: 'eat_fish', name: 'Eat fish', region: 'home', x: -640, y: 850,
    needs: [
      { res: 'catch', amount: 1 },
      { res: 'dreaming', amount: 0, atMost: 0 },
      { res: 'protein', amount: 0, atMost: 80 },
    ],
    makes: [{ res: 'protein', amount: 25, byproduct: true }, { res: 'stamina', amount: 8, byproduct: true }],
  },
  {
    // Water alone helps a little; with soap (when there is some) much more.
    id: 'wash', name: 'Wash', region: 'home', x: -640, y: 640, cycle: 2,
    needs: [
      { res: 'water', amount: 3 },
      { res: 'soap', amount: 0.25, optional: true, yields: { res: 'hygiene', amount: 40 } },
      { res: 'stamina', amount: 1 },
      { res: 'hygiene', amount: 0, atMost: 90 },
    ],
    makes: [{ res: 'hygiene', amount: 8, byproduct: true }],
  },
  {
    // Dream fragments fade fast while you're awake: write them down right after waking.
    id: 'journal', name: 'Journal', region: 'home', x: -340, y: 540,
    needs: [
      { res: 'fragment', amount: 1 },
      { res: 'paper', amount: 0.5 },
      { res: 'stamina', amount: 0.5 },
    ],
    makes: [{ res: 'insight', amount: 0.4 }],
  },

  // ======================================================== Care: getting well
  {
    id: 'take_medicine', name: 'Take medicine', region: 'care', x: -640, y: 70, cycle: 2,
    needs: [
      { res: 'medicine', amount: 1 },
      { res: 'disease', amount: 10, atLeast: 10 },
    ],
    makes: [],
  },
  {
    // Herbs from the forest, simmered on a gentle fire.
    id: 'brew_remedy', name: 'Brew remedy', region: 'care', x: -340, y: 0, cycle: 5, heat: [30, 70],
    needs: [
      { res: 'plant', amount: 2 },
      { res: 'water', amount: 1 },
    ],
    makes: [{ res: 'medicine', amount: 1 }],
  },
  {
    id: 'make_bandages', name: 'Make bandages', region: 'care', x: -340, y: 210, cycle: 3,
    needs: [{ res: 'fabric', amount: 1 }],
    makes: [{ res: 'bandage', amount: 3 }],
  },
  {
    id: 'dress_wounds', name: 'Dress wounds', region: 'care', x: -640, y: 260, cycle: 2,
    needs: [
      { res: 'bandage', amount: 1 },
      { res: 'injury', amount: 8, atLeast: 8 },
    ],
    makes: [],
  },

  // ======================================================== Wilds
  {
    id: 'gather_fruit', name: 'Gather fruit', region: 'wilds', x: 60, y: 290,
    needs: [{ res: 'stamina', amount: 4 }],
    makes: [{ res: 'fruit', amount: 3 }],
  },
  {
    id: 'water_source', name: 'Water source', region: 'wilds', x: 60, y: 140,
    needs: [{ res: 'stamina', amount: 5 }],
    makes: [{ res: 'water', amount: 1 }],
  },
  {
    // Only to get the Forest going: a living Forest regrows by itself.
    // It uses seeds whenever it can: switch it off when the Forest is alive.
    id: 'garden', name: 'Garden', region: 'wilds', x: 360, y: 85,
    needs: [
      { res: 'seed', amount: 5 },
      { res: 'water', amount: 3 },
    ],
    makes: [{ res: 'plant', amount: 5 }],
  },
  {
    // Regrows while Plant ≥ 50: ×1 at 50, ×2 at 75 (cap). Don't cut it below 50!
    // A dead Forest can only be started again with the Garden.
    id: 'forest', name: 'Forest', region: 'wilds', x: 660, y: 0, cycle: 3,
    growth: { res: 'plant', perUnit: 0.04, maxFactor: 2 },
    needs: [
      { res: 'water', amount: 0.1 },
      { res: 'plant', amount: 1, atLeast: FOREST_MIN },
    ],
    makes: [{ res: 'plant', amount: 2 }],
  },
  {
    id: 'wood_cutting', name: 'Wood cutting', region: 'wilds', x: 960, y: 85,
    wear: { perCycle: 0.4, sharpen: [{ res: 'stamina', amount: 10 }], repair: [{ res: 'tool', amount: 1 }, { res: 'stamina', amount: 10 }] },
    needs: [
      { res: 'plant', amount: 5 },
      { res: 'stamina', amount: 6 },
    ],
    // Hard work hurts: Injuries (bandages heal them).
    makes: [{ res: 'wood', amount: 1 }, { res: 'injury', amount: 1, byproduct: true }],
  },
  {
    id: 'paper_maker', name: 'Paper maker', region: 'wilds', x: 660, y: 210, cycle: 2,
    needs: [
      { res: 'plant', amount: 2 },
      { res: 'water', amount: 1 },
      { res: 'stamina', amount: 1 },
    ],
    makes: [{ res: 'paper', amount: 1 }],
  },

  // ======================================================== Fire & Clay
  {
    id: 'dig_clay', name: 'Dig clay', region: 'fire_clay', x: 1690, y: 40,
    wear: { perCycle: 0.4, sharpen: [{ res: 'stamina', amount: 10 }], repair: [{ res: 'tool', amount: 1 }, { res: 'stamina', amount: 10 }] },
    needs: [
      { res: 'stamina', amount: 5 },
      { res: 'water', amount: 0.1, atLeast: 50 },
    ],
    makes: [{ res: 'clay', amount: 1 }, { res: 'injury', amount: 0.8, byproduct: true }],
  },
  {
    id: 'brick_kiln', name: 'Brick kiln', region: 'fire_clay', x: 1690, y: 230, cycle: 2, heat: [60, 90],
    needs: [{ res: 'clay', amount: 2 }],
    makes: [{ res: 'brick', amount: 1 }],
  },
  {
    id: 'soap_maker', name: 'Soap maker', region: 'fire_clay', x: 1690, y: 400, cycle: 4, heat: [20, 60],
    needs: [
      { res: 'ash', amount: 2 },
      { res: 'water', amount: 1 },
    ],
    makes: [{ res: 'soap', amount: 1 }],
  },

  // ======================================================== Fields
  {
    // One big field split between crops (the player sets the shares). Wheat and
    // cotton use up the Soil, clover gives it back (and makes Hay); fertilizer
    // is taken whenever there is some (ash: what's above 3) and the Soil has room. The harvest follows the Soil:
    // ×0.4 on worn-out soil, ×1 on soil at 100.
    id: 'field', name: 'Field', region: 'fields', x: 960, y: 570, cycle: 3,
    growth: { res: 'soil', base: 0.4, perUnit: 0.006, maxFactor: 1 },
    needs: [
      { res: 'water', amount: 0.3 },
      { res: 'seed', amount: 0, atLeast: 10 },
      { res: 'ash', amount: 0.05, atLeast: 3, optional: true, yields: { res: 'soil', amount: 4 } },
      { res: 'manure', amount: 0.1, optional: true, yields: { res: 'soil', amount: 3 } },
      { res: 'compost', amount: 0.1, optional: true, yields: { res: 'soil', amount: 2 } },
    ],
    makes: [{ res: 'seed', amount: 0.1, byproduct: true }],
    parts: [
      {
        id: 'wheat', name: 'Wheat', icon: '🌾', color: '#e8c547', start: 0.5,
        needs: [{ res: 'soil', amount: 0.4, optional: true }],
        makes: [{ res: 'wheat', amount: 2 }],
      },
      {
        id: 'cotton', name: 'Cotton', icon: '☁️', color: '#e9ecf5', start: 0.5,
        needs: [{ res: 'soil', amount: 0.4, optional: true }],
        makes: [{ res: 'cotton', amount: 2 }],
      },
      {
        id: 'clover', name: 'Clover', icon: '🍀', color: '#8fd16a', start: 0,
        makes: [{ res: 'hay', amount: 2 }, { res: 'soil', amount: 0.6, byproduct: true }],
      },
      {
        // Fruit without picking it by hand (it rots if nobody eats it).
        id: 'orchard', name: 'Fruit', icon: '🍎', color: '#ff6b81', start: 0,
        needs: [{ res: 'soil', amount: 0.2, optional: true }],
        makes: [{ res: 'fruit', amount: 2 }],
      },
    ],
  },
  {
    id: 'mill', name: 'Mill', region: 'fields', x: 660, y: 630,
    needs: [
      { res: 'wheat', amount: 2 },
      { res: 'stamina', amount: 1 },
    ],
    makes: [{ res: 'flour', amount: 1 }],
  },
  {
    // Only to get a Starter going (slow): a fed Starter keeps itself alive.
    id: 'wild_fermentation', name: 'Wild fermentation', region: 'fields', x: 360, y: 760, cycle: 20,
    needs: [
      { res: 'fruit', amount: 3 },
      { res: 'flour', amount: 1 },
    ],
    makes: [{ res: 'starter', amount: 6 }],
  },
  {
    // Doubles itself while there's at least 5. Unfed Starter dies (fades 1%/s).
    id: 'feed_starter', name: 'Feed starter', region: 'fields', x: 360, y: 535, cycle: 2,
    needs: [
      { res: 'flour', amount: 0.5 },
      { res: 'water', amount: 0.5 },
      { res: 'starter', amount: 1, atLeast: 5 },
    ],
    makes: [{ res: 'starter', amount: 2 }],
  },
  {
    id: 'baking', name: 'Baking', region: 'fields', x: 60, y: 660, cycle: 2, heat: [30, 70],
    needs: [
      { res: 'flour', amount: 1 },
      { res: 'water', amount: 0.3 },
      { res: 'starter', amount: 0.3 },
      { res: 'stamina', amount: 0.5 },
    ],
    makes: [{ res: 'bread', amount: 1 }],
  },
  {
    id: 'loom', name: 'Loom', region: 'fields', x: 660, y: 830, cycle: 2,
    needs: [
      { res: 'cotton', amount: 3 },
      { res: 'stamina', amount: 2 },
    ],
    makes: [{ res: 'fabric', amount: 1 }],
  },
  {
    // Clothes wear out: keep some in the wardrobe (Productivity).
    id: 'sew_clothes', name: 'Sew clothes', region: 'fields', x: 360, y: 930, cycle: 4,
    needs: [
      { res: 'fabric', amount: 2 },
      { res: 'stamina', amount: 2 },
    ],
    makes: [{ res: 'clothes', amount: 1 }],
  },

  // ======================================================== Pasture
  {
    // Only to get a flock going: two sheep breed by themselves.
    id: 'tame_sheep', name: 'Tame a wild sheep', region: 'pasture', x: 960, y: 1290, cycle: 15,
    needs: [
      { res: 'hay', amount: 5 },
      { res: 'stamina', amount: 8 },
    ],
    makes: [{ res: 'sheep', amount: 1 }],
  },
  {
    // More sheep, more wool (×1 at 4 sheep, up to ×2.6 at 20).
    id: 'shearing', name: 'Shearing', region: 'pasture', x: 660, y: 1370, cycle: 3,
    growth: { res: 'sheep', perUnit: 0.1, maxFactor: 2.6 },
    needs: [
      { res: 'sheep', amount: 0, atLeast: 4 },
      { res: 'stamina', amount: 2 },
    ],
    makes: [{ res: 'wool', amount: 1 }],
  },
  {
    id: 'spinning', name: 'Spinning', region: 'pasture', x: 360, y: 1290, cycle: 2,
    needs: [
      { res: 'wool', amount: 2 },
      { res: 'stamina', amount: 1 },
    ],
    makes: [{ res: 'fabric', amount: 1 }],
  },

  // ======================================================== Pond
  {
    // Only to get the pond going (slow, needs a net).
    id: 'catch_fry', name: 'Catch fry', region: 'pond', x: -340, y: 1240, cycle: 8,
    needs: [
      { res: 'stamina', amount: 4 },
      { res: 'fabric', amount: 0.05 },
    ],
    makes: [{ res: 'fish', amount: 1 }],
  },
  {
    // Takes fish out of the pond: keep it about half full and it refills fastest.
    id: 'fishing', name: 'Fishing', region: 'pond', x: -640, y: 1160,
    needs: [
      { res: 'fish', amount: 1 },
      { res: 'stamina', amount: 2 },
    ],
    makes: [{ res: 'catch', amount: 1 }],
  },

  // ======================================================== Forge
  {
    // Pumped-out mine water is good water.
    id: 'pump', name: 'Pump', region: 'forge', x: 1690, y: 900,
    needs: [
      { res: 'mine_water', amount: 1 },
      { res: 'stamina', amount: 1 },
    ],
    makes: [{ res: 'water', amount: 1 }],
  },
  {
    // Digs deeper as it goes: more ore down there (×3 at 100 m), but more water
    // seeps in, and the mine floods above 20.
    id: 'iron_mine', name: 'Iron mine', region: 'forge', x: 1990, y: 760,
    growth: { res: 'depth', perUnit: 0.02, maxFactor: 3 },
    wear: { perCycle: 0.3, sharpen: [{ res: 'stamina', amount: 10 }], repair: [{ res: 'tool', amount: 1 }, { res: 'stamina', amount: 10 }] },
    needs: [
      { res: 'stamina', amount: 5 },
      { res: 'wood', amount: 0.2 },
      { res: 'mine_water', amount: 0, atMost: 20 },
    ],
    makes: [
      { res: 'iron_ore', amount: 0.3 },
      { res: 'depth', amount: 0.05, byproduct: true },
      { res: 'injury', amount: 0.8, byproduct: true },
    ],
  },
  {
    id: 'iron_smelter', name: 'Iron smelter', region: 'forge', x: 1690, y: 700, cycle: 3, heat: [80, 100],
    needs: [{ res: 'iron_ore', amount: 2 }],
    makes: [{ res: 'iron', amount: 1 }],
  },
  {
    id: 'tool_maker', name: 'Tool maker', region: 'forge', x: 1390, y: 760, cycle: 5, heat: [50, 80],
    needs: [
      { res: 'iron', amount: 2 },
      { res: 'wood', amount: 5 },
      { res: 'stamina', amount: 3 },
    ],
    makes: [{ res: 'tool', amount: 1 }, { res: 'injury', amount: 1.5, byproduct: true }],
  },

  // Last: only uses Stamina nothing else wants (to fall asleep when nothing works).
  {
    id: 'twiddling_thumbs', name: 'Twiddling thumbs', region: 'home', x: -940, y: 870,
    needs: [{ res: 'stamina', amount: 1 }],
    makes: [],
  },
];
