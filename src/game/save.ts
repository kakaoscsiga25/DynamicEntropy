// Save / load. Saves use stable ids (not display names), so renaming things in
// the content files doesn't break saves. Saves of an older format (before the
// Productivity rework: format 3 and older, v1.x) don't fit the game and are not loaded.

import type { Cycle, Game } from './engine.ts';

export const SAVE_KEY = 'dynamic-entropy-save';
const LEGACY_KEYS = ['save_version', 'save_resources', 'save_upgrades', 'save_playtime'];
export const SAVE_FORMAT = 4;

/** Per-node settings and state that aren't the defaults. */
export interface NodeSave {
  pace?: number;
  /** Fuel (or other player-set amount). */
  throttle?: number;
  /** Thermostat temperature. */
  target?: number;
  shares?: number[];
  condition?: number;
  /** Indexes of automatic rules switched off by the player. */
  guardsOff?: number[];
  /** Cycle in progress (its inputs are already paid). */
  cycle?: Cycle;
}

export interface SaveData {
  format: typeof SAVE_FORMAT;
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
  nodes: Record<string, NodeSave>;
}

/** Minimal localStorage-like interface (lets tests use a plain object). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serialize(game: Game, playtime: number, appVersion: string): SaveData {
  const nodes: Record<string, NodeSave> = {};
  for (const c of game.converters) {
    const n: NodeSave = {};
    if (c.pace !== 1) n.pace = c.pace;
    if (c.throttle !== null && c.throttle !== c.def.throttle?.start) n.throttle = c.throttle;
    if (c.target !== null) n.target = c.target;
    if (c.parts.length && c.shares.some((s, i) => s !== c.def.parts![i].start)) n.shares = [...c.shares];
    if (c.condition < 100) n.condition = c.condition;
    const off = c.guards.flatMap((g, i) => (g.guard?.enabled ? [] : [i]));
    if (off.length) n.guardsOff = off;
    if (c.cycle) n.cycle = { ...c.cycle, out: [...c.cycle.out], took: [...c.cycle.took], extra: { ...c.cycle.extra } };
    if (Object.keys(n).length) nodes[c.id] = n;
  }
  return {
    format: SAVE_FORMAT,
    appVersion,
    savedAt: Date.now(),
    playtime: Math.floor(playtime),
    resources: Object.fromEntries(game.resources.map((r) => [r.id, r.amount])),
    upgrades: [...game.boughtOrder],
    running: game.converters.filter((c) => !c.unstoppable && !c.stopped).map((c) => c.id),
    discovered: [...game.discovered],
    nodes,
  };
}

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Applies a save to a fresh game. Unknown ids (from older content) are skipped. */
export function restore(game: Game, save: SaveData): void {
  for (const id of save.upgrades) {
    if (!game.hasUpgrade(id)) continue;
    const u = game.upgrade(id);
    if (u.bought || !u.requirementsMet()) continue;
    u.apply();
    game.boughtOrder.push(id);
  }
  for (const [id, amount] of Object.entries(save.resources)) {
    if (game.hasResource(id) && finite(amount)) game.resource(id).amount = Math.max(0, Math.min(game.resource(id).max, amount));
  }
  for (const id of save.running) {
    if (game.hasConverter(id) && !game.converter(id).unstoppable) game.converter(id).start();
  }
  for (const id of save.discovered) {
    if (game.hasConverter(id)) game.discovered.add(id);
  }
  for (const [id, n] of Object.entries(save.nodes ?? {})) {
    if (!game.hasConverter(id)) continue;
    const c = game.converter(id);
    if (finite(n.pace)) game.setPace(id, n.pace);
    if (finite(n.throttle)) game.setThrottle(id, n.throttle);
    if (finite(n.target)) game.setTarget(id, n.target);
    if (Array.isArray(n.shares) && n.shares.every(finite)) game.setShares(id, n.shares);
    if (finite(n.condition)) c.condition = Math.max(0, Math.min(100, n.condition));
    for (const i of n.guardsOff ?? []) game.setGuard(id, i, false);
    const cy = n.cycle;
    if (
      cy && [cy.progress, cy.pace, cy.outPace].every(finite) &&
      Array.isArray(cy.out) && cy.out.length === c.makes.length && cy.out.every(finite) &&
      Array.isArray(cy.took) && cy.took.length === c.needs.length && cy.took.every(finite)
    ) {
      const extra = Object.fromEntries(Object.entries(cy.extra ?? {}).filter(([k, v]) => game.hasResource(k) && finite(v)));
      c.cycle = { progress: Math.min(1, Math.max(0, cy.progress)), pace: cy.pace, outPace: cy.outPace, out: cy.out, took: cy.took, extra };
    }
  }
  game.updateDiscovery();
}

export type LoadResult =
  | { kind: 'none' }
  | { kind: 'loaded'; save: SaveData }
  /** A save of an older format: the game starts fresh. */
  | { kind: 'outdated' }
  | { kind: 'error' };

export function loadSave(store: KeyValueStore, game: Game): LoadResult {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw !== null) {
      const save = JSON.parse(raw) as SaveData;
      if (save.format !== SAVE_FORMAT) return { kind: 'outdated' };
      restore(game, save);
      return { kind: 'loaded', save };
    }
    if (store.getItem('save_resources') !== null) return { kind: 'outdated' };
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
