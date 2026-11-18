// The running game session: the Game instance, UI state, the tick loop,
// playtime, autosave and player actions. Components import from here.

import { Game, TICK_MS, TICKS_PER_SECOND } from '../game/engine';
import { rate } from './format';
import { clearSave, loadSave, serialize, writeSave, type KeyValueStore } from '../game/save';

export const APP_VERSION = __APP_VERSION__;
export const DEV = new URLSearchParams(location.search).has('dev');
const AUTOSAVE_SECONDS = 60;
/** The "+x/s" rate shows the change over the last second (10 ticks): things change fast. */
const RATE_WINDOW_TICKS = TICKS_PER_SECOND;
/** Dev "10×" mode runs this many ticks per real tick. */
const FAST_TICKS = 10;

export const game = new Game();

export type ModalKind = 'howto' | 'ending' | 'reset' | null;

export const ui = $state({
  /**
   * Bumped after every change to the game. The engine objects are plain classes
   * (not reactive), so components read `ui.frame` to know when to re-read them.
   */
  frame: 0,
  /** Bumped once per second. Text that would flicker if updated every tick (rates, ETAs) uses this. */
  second: 0,
  /** Selected node (converter) id: its details are shown in the side panel. */
  selected: null as string | null,
  /** Selected resource id: its details are shown in the side panel. */
  selectedResource: null as string | null,
  hoverNode: null as string | null,
  hoverResource: null as string | null,
  modal: null as ModalKind,
  toasts: [] as { id: number; text: string }[],
  fast: false,
  autosaveIn: AUTOSAVE_SECONDS,
  playtime: 0,
  /** Mobile only: resource drawer open. */
  showResources: false,
  /** The Build panel (buildings, not tied to a node) is open. */
  showBuildings: false,
});

function refresh() {
  ui.frame++;
}

// ------------------------------------------------------------ toasts

let toastId = 0;
export function toast(text: string) {
  const id = ++toastId;
  ui.toasts.push({ id, text });
  setTimeout(() => {
    ui.toasts = ui.toasts.filter((t) => t.id !== id);
  }, 2600);
}

// ------------------------------------------------------------ rates

// Per tick: net production of every resource, with slow cycles spread evenly
// (Resource.lastFlow), so a node that delivers every few seconds doesn't make it jump.
const recentDeltas: number[][] = [];

/** Net production per second of a resource during the last second. */
export function ratePerSecond(index: number): number {
  if (recentDeltas.length === 0) return 0;
  let sum = 0;
  for (const d of recentDeltas) sum += d[index];
  return (sum / recentDeltas.length) * TICKS_PER_SECOND;
}

export interface Trend {
  perSecond: number;
  /** "+1.2/s", or '' when not changing. */
  text: string;
  direction: 'up' | 'down' | '';
}

export function resourceTrend(index: number): Trend {
  const perSecond = ratePerSecond(index);
  const direction = perSecond >= 0.05 ? 'up' : perSecond <= -0.05 ? 'down' : '';
  return { perSecond, text: rate(perSecond), direction };
}

// ------------------------------------------------------------ loop

let tickTimer: ReturnType<typeof setInterval> | undefined;

function step() {
  for (let i = 0; i < (ui.fast ? FAST_TICKS : 1); i++) {
    const found = game.tick();
    recentDeltas.push(game.resources.map((r) => r.lastFlow));
    if (recentDeltas.length > RATE_WINDOW_TICKS) recentDeltas.shift();
    for (const id of found) toast(`Discovered: ${game.converter(id).name}`);
  }
  refresh(); // once per real tick, even in fast mode
}

function scheduleTicks() {
  clearInterval(tickTimer);
  tickTimer = setInterval(step, TICK_MS);
}

export function setFast(fast: boolean) {
  ui.fast = fast;
}

// ------------------------------------------------------------ playtime & saving

let playtimeBase = 0;
let sessionStart = performance.now();
let resetting = false;

function playtime(): number {
  return playtimeBase + (performance.now() - sessionStart) / 1000;
}

function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function save(manual = false) {
  const store = storage();
  const ok = store !== null && writeSave(store, serialize(game, playtime(), APP_VERSION));
  ui.autosaveIn = AUTOSAVE_SECONDS;
  if (manual) toast(ok ? 'Game saved' : 'Saving failed: browser storage is blocked');
}

export function resetGame() {
  resetting = true;
  const store = storage();
  if (store) clearSave(store);
  location.reload();
}

// ------------------------------------------------------------ player actions

export function toggleConverter(id: string) {
  game.converter(id).toggle();
  refresh();
}

/** Sets a node's pace (0.1–1, up to 2 with Overtime). It applies when its next cycle starts. */
export function setPace(id: string, pace: number) {
  if (game.setPace(id, pace)) refresh();
}

export function buyUpgrade(id: string) {
  const u = game.upgrade(id);
  if (!game.buy(id)) return;
  refresh();
  if (u.def.final) ui.modal = 'ending';
  else if (u.def.unlocks === 'pace') toast('Pace unlocked: select a node to set how hard it works');
  else if (u.def.unlocks === 'overclock') toast('Overtime: a node\'s pace can now go up to 200%');
  else toast(`Bought: ${u.name}`);
}

/** Starts or stops every discovered node of an island (unstoppable ones are skipped). */
export function setRegionRunning(region: string, on: boolean) {
  for (const c of game.converters) {
    if (c.def.region !== region || c.unstoppable || !game.discovered.has(c.id)) continue;
    if (on && c.stopped) c.start();
    else if (!on) c.stop();
  }
  refresh();
}

/** Shows a node's details. Selecting the same node again (or null) closes the side panel. */
export function select(id: string | null) {
  ui.selected = id !== null && ui.selected === id ? null : id;
  ui.selectedResource = null;
  ui.showBuildings = false;
}

/** Opens (or closes) the Build panel. */
export function toggleBuildings() {
  const open = !ui.showBuildings;
  select(null);
  ui.showBuildings = open;
}

/** Shows a resource's details: who makes it, who uses it. Selecting it again closes them. */
export function selectResource(id: string) {
  ui.selectedResource = ui.selectedResource === id ? null : id;
  ui.selected = null;
  ui.showBuildings = false;
  ui.showResources = false;
}

// ------------------------------------------------------------ start

let started = false;

export function start() {
  if (started) return;
  started = true;

  const store = storage();
  const loaded = store ? loadSave(store, game) : { kind: 'none' as const };
  if (loaded.kind === 'loaded' || loaded.kind === 'migrated') {
    playtimeBase = loaded.save.playtime;
    toast(loaded.kind === 'migrated' ? 'Your v1 save was imported' : 'Welcome back');
  } else if (loaded.kind === 'error') {
    toast('Could not read the saved game, starting fresh');
  } else {
    ui.modal = 'howto';
  }
  sessionStart = performance.now();
  refresh();

  scheduleTicks();
  setInterval(() => {
    ui.playtime = playtime();
    ui.second++;
    ui.autosaveIn -= 1;
    if (ui.autosaveIn <= 0) save();
  }, 1000);

  // Save when the tab is closed or hidden, so little progress is lost.
  window.addEventListener('pagehide', () => {
    if (!resetting) save();
  });
}
