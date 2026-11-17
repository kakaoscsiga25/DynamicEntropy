// Save / load. Saves use stable ids (not display names), so renaming things in
// data.ts doesn't break saves. Old v1.x (Brython) saves are migrated automatically.

import type { Game } from './engine';

export const SAVE_KEY = 'dynamic-entropy-save';
const LEGACY_KEYS = ['save_version', 'save_resources', 'save_upgrades', 'save_playtime'];

export interface SaveData {
  format: 2;
  appVersion: string;
  savedAt: number;
  /** Seconds played. */
  playtime: number;
  resources: Record<string, number>;
  /** Upgrade ids in buying order. */
  upgrades: string[];
  /** Converters switched on by the player. */
  running: string[];
  discovered: string[];
}

/** Minimal localStorage-like interface (lets tests use a plain object). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serialize(game: Game, playtime: number, appVersion: string): SaveData {
  return {
    format: 2,
    appVersion,
    savedAt: Date.now(),
    playtime: Math.floor(playtime),
    resources: Object.fromEntries(game.resources.map((r) => [r.id, r.amount])),
    upgrades: [...game.boughtOrder],
    running: game.converters.filter((c) => !c.unstoppable && !c.stopped).map((c) => c.id),
    discovered: [...game.discovered],
  };
}

/** Applies a save to a fresh game. Unknown ids (from older content) are skipped. */
export function restore(game: Game, save: SaveData): void {
  for (const id of save.upgrades) {
    if (!game.hasUpgrade(id)) continue;
    const u = game.upgrade(id);
    if (u.bought) continue;
    u.apply();
    game.boughtOrder.push(id);
  }
  for (const [id, amount] of Object.entries(save.resources)) {
    if (game.hasResource(id) && Number.isFinite(amount)) game.resource(id).amount = amount;
  }
  for (const id of save.running) {
    if (game.hasConverter(id)) game.converter(id).start();
  }
  for (const id of save.discovered) {
    if (game.hasConverter(id)) game.discovered.add(id);
  }
  game.updateDiscovery();
}

/** Converts a v1.x save (names, "|"-separated strings) to the current format. */
export function fromLegacy(store: KeyValueStore, game: Game): SaveData | null {
  const resources = store.getItem('save_resources');
  if (resources === null) return null;

  const resByName = new Map(game.resources.map((r) => [r.name, r.id]));
  const upgByName = new Map(game.upgrades.map((u) => [u.name, u.id]));

  const save: SaveData = {
    format: 2,
    appVersion: store.getItem('save_version') ?? 'v1',
    savedAt: Date.now(),
    playtime: Number(store.getItem('save_playtime')) || 0,
    resources: {},
    upgrades: [],
    running: [],
    discovered: [],
  };
  for (const part of resources.split('|')) {
    const [name, amount] = part.split(':');
    const id = resByName.get(name);
    if (id !== undefined) save.resources[id] = Number(amount);
  }
  for (const name of (store.getItem('save_upgrades') ?? '').split('|')) {
    const id = upgByName.get(name);
    if (id !== undefined) save.upgrades.push(id);
  }
  return save;
}

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'loaded'; save: SaveData }
  | { kind: 'migrated'; save: SaveData }
  | { kind: 'error' };

export function loadSave(store: KeyValueStore, game: Game): LoadResult {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw !== null) {
      const save = JSON.parse(raw) as SaveData;
      if (save.format !== 2) return { kind: 'error' };
      restore(game, save);
      return { kind: 'loaded', save };
    }
    const legacy = fromLegacy(store, game);
    if (legacy) {
      restore(game, legacy);
      return { kind: 'migrated', save: legacy };
    }
    return { kind: 'none' };
  } catch {
    return { kind: 'error' };
  }
}

export function writeSave(store: KeyValueStore, save: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
    // Once saved in the new format, the old keys are no longer needed.
    for (const k of LEGACY_KEYS) store.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function clearSave(store: KeyValueStore): void {
  try {
    store.removeItem(SAVE_KEY);
    for (const k of LEGACY_KEYS) store.removeItem(k);
  } catch {
    // Storage blocked: nothing to clear.
  }
}
