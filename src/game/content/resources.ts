import type { HealthDef, RegionDef, ResourceDef } from '../defs.ts';

// Every resource of the game, grouped like the resource panel on the left.
// max = storage limit at the start (buildings raise it). fade = loses that share
// of its stock every second (0.01 = 1%/s): it settles where refilling = fading.

export const RESOURCES: ResourceDef[] = [
  // ---- Body: you, the dreamer
  { id: 'stamina', name: 'Stamina', start: 100, max: 100, icon: '⚡', color: '#f5c542', group: 'Body', hub: true, awake: true },
  { id: 'dreaming', name: 'Dreaming', max: 100, icon: '💤', color: '#b48cff', group: 'Body', dream: true },
  { id: 'health', name: 'Health', start: 50, max: 100, unit: '%', icon: '❤️', color: '#ff6b8b', group: 'Body' },
  { id: 'grains', name: 'Grains', max: 100, icon: '🥖', color: '#e0a458', group: 'Body', fade: { rate: 0.005 } },
  { id: 'vitamins', name: 'Vitamins', max: 100, icon: '🍊', color: '#ff9f43', group: 'Body', fade: { rate: 0.005 } },
  { id: 'protein', name: 'Protein', max: 100, icon: '🍗', color: '#d98c6a', group: 'Body', fade: { rate: 0.005 } },
  { id: 'hygiene', name: 'Hygiene', max: 100, icon: '✨', color: '#9fe7ff', group: 'Body', fade: { rate: 0.003 } },

  // ---- Mind: what you take with you from your dreams
  { id: 'fragment', name: 'Dream fragment', max: 20, icon: '🌙', color: '#c9a6ff', group: 'Mind', fade: { rate: 0.03, awakeOnly: true } },
  { id: 'paper', name: 'Paper', max: 50, icon: '📜', color: '#f1e3c2', group: 'Mind' },
  { id: 'insight', name: 'Insight', max: 50, icon: '💡', color: '#ffe066', group: 'Mind' },

  // ---- Wilds
  { id: 'water', name: 'Water', max: 100, icon: '💧', color: '#4aa8ff', group: 'Wilds', hub: true },
  { id: 'fruit', name: 'Fruit', max: 100, icon: '🍎', color: '#ff6b81', group: 'Wilds', fade: { rate: 0.01, into: 'compost', yield: 0.5 } },
  { id: 'seed', name: 'Seed', max: 100, icon: '🌰', color: '#d2a66a', group: 'Wilds' },
  { id: 'plant', name: 'Plant', max: 100, icon: '🌿', color: '#4cd06d', group: 'Wilds' },
  { id: 'wood', name: 'Wood', max: 100, icon: '🪵', color: '#c08552', group: 'Wilds' },
  { id: 'compost', name: 'Compost', max: 50, icon: '🪱', color: '#a0785a', group: 'Wilds' },

  // ---- Fire & Clay: fires are temperatures (°), they cool down by 0.5% a second
  { id: 'fire', name: 'Fire', max: 100, unit: '°', icon: '🔥', color: '#ff8a3d', group: 'Fire & Clay', hub: true, heat: true, fade: { rate: 0.005 } },
  { id: 'furnace', name: 'Furnace', max: 100, unit: '°', icon: '♨️', color: '#ff5d3d', group: 'Fire & Clay', hub: true, heat: true, fade: { rate: 0.005 } },
  // Ash blows away slowly; a hot fire makes more than that, and a full ash heap stops the fire.
  { id: 'ash', name: 'Ash', max: 30, icon: '🌫️', color: '#a9a9b8', group: 'Fire & Clay', fade: { rate: 0.003 } },
  { id: 'clay', name: 'Clay', max: 100, icon: '🏺', color: '#c99a6e', group: 'Fire & Clay' },
  { id: 'brick', name: 'Brick', max: 100, icon: '🧱', color: '#e0604a', group: 'Fire & Clay' },
  { id: 'soap', name: 'Soap', max: 20, icon: '🧼', color: '#c6f0e0', group: 'Fire & Clay' },

  // ---- Fields
  { id: 'soil', name: 'Soil', start: 70, max: 100, icon: '🟫', color: '#9b6b43', group: 'Fields', regen: 0.02 },
  { id: 'wheat', name: 'Wheat', max: 100, icon: '🌾', color: '#e8c547', group: 'Fields' },
  { id: 'cotton', name: 'Cotton', max: 100, icon: '☁️', color: '#e9ecf5', group: 'Fields' },
  { id: 'hay', name: 'Hay', max: 100, icon: '🍀', color: '#8fd16a', group: 'Fields' },
  { id: 'flour', name: 'Flour', max: 100, icon: '🥣', color: '#efe3c8', group: 'Fields' },
  { id: 'starter', name: 'Starter', max: 30, icon: '🫙', color: '#f3d9a4', group: 'Fields', fade: { rate: 0.01 } },
  { id: 'bread', name: 'Bread', max: 50, icon: '🍞', color: '#e0a458', group: 'Fields', fade: { rate: 0.003 } },
  { id: 'fabric', name: 'Fabric', max: 50, icon: '🧵', color: '#e58fd8', group: 'Fields' },

  // ---- Pasture
  { id: 'sheep', name: 'Sheep', max: 20, icon: '🐑', color: '#eef0f7', group: 'Pasture' },
  { id: 'wool', name: 'Wool', max: 50, icon: '🧶', color: '#d9b8f0', group: 'Pasture' },
  { id: 'manure', name: 'Manure', max: 30, icon: '💩', color: '#8a5a3c', group: 'Pasture' },

  // ---- Pond
  { id: 'fish', name: 'Fish', max: 40, icon: '🐟', color: '#5fb8e8', group: 'Pond' },
  { id: 'catch', name: 'Fresh fish', max: 30, icon: '🐠', color: '#7fd0f0', group: 'Pond', fade: { rate: 0.02 } },

  // ---- Forge
  { id: 'depth', name: 'Mine depth', max: 100, unit: 'm', icon: '⛏️', color: '#8b8fa3', group: 'Forge' },
  { id: 'mine_water', name: 'Mine water', max: 50, icon: '🫧', color: '#3f7fbf', group: 'Forge' },
  { id: 'iron_ore', name: 'Iron ore', max: 100, icon: '🪨', color: '#9aa1ad', group: 'Forge' },
  { id: 'iron', name: 'Iron', max: 50, icon: '🔩', color: '#bcc8dc', group: 'Forge' },
  { id: 'tool', name: 'Tool', max: 10, icon: '🔨', color: '#8fd3f0', group: 'Forge' },
];

export const REGIONS: RegionDef[] = [
  { id: 'home', name: 'Home', color: '#b48cff' },
  { id: 'wilds', name: 'Wilds', color: '#4cd06d' },
  { id: 'fire_clay', name: 'Fire & Clay', color: '#ff8a3d' },
  { id: 'fields', name: 'Fields', color: '#e8c547' },
  { id: 'pasture', name: 'Pasture', color: '#c9d6a0' },
  { id: 'pond', name: 'Pond', color: '#5fb8e8' },
  { id: 'forge', name: 'Forge', color: '#8fb3d9' },
];

/**
 * Health slowly follows the sum of where it comes from. Everything together is
 * 110, so you can miss a little and still be at 100%.
 * It sets your Stamina limit (50% of it at 0 Health) and how much manual work
 * (nodes that use Stamina) makes (60% at 0 Health). It never drops below the base (40).
 */
export const HEALTH: HealthDef = {
  res: 'health',
  base: 40,
  sources: [
    { kind: 'stock', name: 'Grains', res: 'grains', points: 10, full: 50 },
    { kind: 'stock', name: 'Vitamins', res: 'vitamins', points: 10, full: 50 },
    { kind: 'stock', name: 'Protein', res: 'protein', points: 10, full: 50 },
    { kind: 'heat', name: 'Warmth', points: 15, full: 30 },
    { kind: 'home', name: 'Home', points: 15 },
    { kind: 'stock', name: 'Hygiene', res: 'hygiene', points: 10, full: 50 },
  ],
  rate: 0.005,
  staminaRes: 'stamina',
  staminaMin: 0.5,
  workMin: 0.6,
};
