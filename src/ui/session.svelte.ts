// The running game session: the Game instance, UI state, the tick loop,
// playtime, autosave and player actions. Components import from here.

import { Game, TICK_MS, TICKS_PER_SECOND } from '../game/engine';
import { duration, rate } from './format';
import { clearSave, loadSave, serialize, writeSave, type KeyValueStore } from '../game/save';

export const APP_VERSION = __APP_VERSION__;
export const DEV = new URLSearchParams(location.search).has('dev');
const AUTOSAVE_SECONDS = 60;
const RATE_WINDOW = 10; // ticks averaged for the "+x/s" display

export const game = new Game();

export type ModalKind = 'howto' | 'ending' | 'reset' | null;

export const ui = $state({
  /**
   * Bumped after every change to the game. The engine objects are plain classes
   * (not reactive), so components read `ui.frame` to know when to re-read them.
   */
  frame: 0,
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

const history: number[][] = []; // last RATE_WINDOW ticks of per-resource deltas

/** Net change per second of a resource, averaged over the last few ticks. */
export function ratePerSecond(index: number): number {
  if (history.length === 0) return 0;
  let sum = 0;
  for (const h of history) sum += h[index];
  return (sum / history.length) * TICKS_PER_SECOND;
}

export interface Trend {
  perSecond: number;
  /** "+1.2/s", or '' when not changing. */
  text: string;
  direction: 'up' | 'down' | '';
  /** "full in 12s", "empty in 3m 05s", "full" or ''. */
  eta: string;
}

export function resourceTrend(index: number): Trend {
  const r = game.resources[index];
  const perSecond = ratePerSecond(index);
  let eta = '';
  if (perSecond > 0.005 && r.amount < r.max - 1e-9) eta = `full in ${duration((r.max - r.amount) / perSecond)}`;
  else if (perSecond < -0.005 && r.amount > 1e-9) eta = `empty in ${duration(r.amount / -perSecond)}`;
  else if (r.amount >= r.max - 1e-9) eta = 'full';
  return {
    perSecond,
    text: rate(perSecond),
    direction: perSecond > 0.005 ? 'up' : perSecond < -0.005 ? 'down' : '',
    eta,
  };
}

// ------------------------------------------------------------ loop

let tickTimer: ReturnType<typeof setInterval> | undefined;

function step() {
  const found = game.tick();
  history.push(game.resources.map((r) => r.lastDelta));
  if (history.length > RATE_WINDOW) history.shift();
  for (const id of found) toast(`Discovered: ${game.converter(id).name}`);
  refresh();
}

function scheduleTicks() {
  clearInterval(tickTimer);
  tickTimer = setInterval(step, ui.fast ? TICK_MS / 10 : TICK_MS);
}

export function setFast(fast: boolean) {
  ui.fast = fast;
  scheduleTicks();
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

export function buyUpgrade(id: string) {
  const u = game.upgrade(id);
  if (!game.buy(id)) return;
  refresh();
  if (u.def.final) ui.modal = 'ending';
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
}

/** Shows a resource's details: who makes it, who uses it. Selecting it again closes them. */
export function selectResource(id: string) {
  ui.selectedResource = ui.selectedResource === id ? null : id;
  ui.selected = null;
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
    ui.autosaveIn -= 1;
    if (ui.autosaveIn <= 0) save();
  }, 1000);

  // Save when the tab is closed or hidden, so little progress is lost.
  window.addEventListener('pagehide', () => {
    if (!resetting) save();
  });
}
