// The game simulation. No UI code here, so it can be unit tested.
// Started as a port of legacy/core/*.py (v1.3.2). v2 adds storage, growth,
// cycles (each node works in its own loop) and pace.

import type { ChangeDef, ConverterDef, GameData, RecipeDef, ResourceDef, UpgradeDef } from './defs.ts';
import { DATA } from './data.ts';

/** The game clock: everything advances once per tick. */
export const TICK_MS = 100;
export const TICKS_PER_SECOND = 1000 / TICK_MS;
/** A node's cycle at 100% pace, unless its data says otherwise. */
export const DEFAULT_CYCLE_SECONDS = 1;

const EPS = 1e-10;

// ---------------------------------------------------------------- Pace

/** The pace slider goes from 10% to 100% (200% with overclocking), in 1% steps. */
export const PACE_MIN = 0.1;
export const PACE_STEP = 0.01;
export const PACE_MAX = 1;
export const OVERCLOCK_MAX = 2;

/**
 * Output per cycle at a pace, relative to 100% (inputs per cycle don't change).
 * Slower is more efficient (50% → ×1.15), faster is wasteful (200% → ×0.7).
 */
export function paceEfficiency(pace: number): number {
  return 1 + 0.3 * (1 - pace);
}

/** Output per second at a pace, relative to 100%: 1.3·p − 0.3·p². (Inputs per second: p.) */
export function paceOutput(pace: number): number {
  return pace * paceEfficiency(pace);
}

export interface Growth {
  resource: Resource;
  perUnit: number;
  maxFactor: number;
}

/** A cycle in progress: its inputs are already taken, its outputs come when it ends. */
export interface Cycle {
  /** 0..1 */
  progress: number;
  /** Pace it runs at now (a slider change applies at once). */
  pace: number;
  /**
   * The pace whose efficiency the outputs get: the fastest pace this cycle ran at.
   * Slowing down mid-cycle doesn't make it more efficient (no cheating); the new
   * pace's efficiency applies from the next cycle.
   */
  outPace: number;
  /** Growth factor measured when it started. */
  growth: number;
}

// ---------------------------------------------------------------- Resource

export class Resource {
  readonly def: ResourceDef;
  amount: number;
  /** Storage limit; buildings can raise it. */
  max: number;
  /** Produced during the current tick; added at the end of the tick (see flush). */
  pending = 0;
  /** Net change during the last tick. */
  lastDelta = 0;
  /**
   * Production minus use during the current tick, with every cycle's inputs and
   * outputs spread evenly over the cycle (so slow cycles don't make it jump).
   */
  flow = 0;
  /** `flow` of the last tick (for rate display). */
  lastFlow = 0;

  constructor(def: ResourceDef) {
    this.def = def;
    this.amount = def.start ?? 0;
    this.max = def.max;
  }

  get id() { return this.def.id; }
  get name() { return this.def.name; }

  canTake(amount: number): boolean {
    return this.amount >= amount - EPS;
  }

  /** Can a converter use this recipe line right now? */
  satisfies(r: Recipe): boolean {
    return (
      this.canTake(r.amount) &&
      this.amount >= r.atLeast - EPS &&
      this.amount + this.pending <= r.atMost + EPS
    );
  }

  /**
   * Can a cycle that already took its inputs keep going? Same limits as
   * `satisfies`, but the cycle's own use doesn't count against the minimum.
   */
  holds(r: Recipe): boolean {
    return this.amount + r.amount >= r.atLeast - EPS && this.amount + this.pending <= r.atMost + EPS;
  }

  take(amount: number): void {
    if (this.canTake(amount)) this.amount -= amount;
  }

  give(amount: number): void {
    this.pending += amount;
  }

  flush(): void {
    this.amount = Math.min(this.max, this.amount + this.pending);
    this.pending = 0;
  }
}

// ---------------------------------------------------------------- Recipe

export type RecipeKind =
  | 'consume'   // amount > 0: used up every cycle
  | 'catalyst'  // amount 0, needs a minimum stock that is not used up
  | 'condition' // amount 0, only runs while stock is at most X
  | 'none';     // amount 0, no limits: has no effect

export class Recipe {
  resource: Resource;
  amount: number;
  atLeast: number;
  atMost: number;
  byproduct: boolean;

  constructor(resource: Resource, amount = 0, atLeast = 0, atMost = Infinity, byproduct = false) {
    this.resource = resource;
    this.amount = amount;
    this.atLeast = atLeast;
    this.atMost = atMost;
    this.byproduct = byproduct;
  }

  clone(): Recipe {
    return new Recipe(this.resource, this.amount, this.atLeast, this.atMost, this.byproduct);
  }

  get kind(): RecipeKind {
    if (this.amount > 0) return 'consume';
    if (this.atMost < Infinity) return 'condition';
    if (this.atLeast > 0) return 'catalyst';
    return 'none';
  }
}

// ---------------------------------------------------------------- Converter

/**
 * Where a node is in its cycle (loop):
 * start (take the inputs) → run → end (put out the outputs) → start again.
 */
export type ConverterState =
  | 'noInput'      // can't start a cycle: not enough input (or a condition fails, or it needs Stamina while you sleep)
  | 'ok'           // a cycle is running
  | 'interrupted'  // the running cycle had to stop for now (you fell asleep, a condition broke); it goes on later
  | 'full'         // the cycle is done, but its outputs don't fit in storage yet: it waits for room
  | 'stopped';     // switched off by the player (a cycle in progress is kept)

export class Converter {
  readonly def: ConverterDef;
  private readonly game: Game;
  name: string;
  needs: Recipe[];
  makes: Recipe[];
  state: ConverterState;
  upgrades: Upgrade[] = [];
  /** Output grows with a stock above the minimum (see GrowthDef). */
  growth: Growth | null;
  /** Length of one cycle at 100% pace, in ticks (at least 1). */
  readonly cycleTicks: number;
  /** Pace set by the player. Its speed applies at once, its efficiency from the next cycle. */
  pace = 1;
  /** The cycle in progress, or null between cycles. */
  cycle: Cycle | null = null;

  constructor(def: ConverterDef, game: Game) {
    this.def = def;
    this.game = game;
    this.name = def.name;
    this.needs = def.needs.map((r) => game.recipe(r));
    this.makes = def.makes.map((r) => game.recipe(r));
    this.cycleTicks = Math.max(1, (def.cycle ?? DEFAULT_CYCLE_SECONDS) * TICKS_PER_SECOND);
    this.state = def.unstoppable ? 'noInput' : 'stopped';
    this.growth = def.growth
      ? { resource: game.resource(def.growth.res), perUnit: def.growth.perUnit, maxFactor: def.growth.maxFactor }
      : null;
  }

  get id() { return this.def.id; }
  get unstoppable() { return !!this.def.unstoppable; }
  get stopped() { return this.state === 'stopped'; }

  start(): void {
    this.state = 'ok';
  }

  /** The minimum stock of the growth resource (this node's atLeast for it). */
  growthThreshold(): number {
    if (!this.growth) return 0;
    const g = this.growth;
    return this.needs.find((n) => n.resource === g.resource)?.atLeast ?? 0;
  }

  /** Output multiplier right now: 1 at the minimum, growing with the stock above it, up to the cap. */
  growthFactor(): number {
    if (!this.growth) return 1;
    const excess = Math.max(0, this.growth.resource.amount - this.growthThreshold());
    return Math.min(this.growth.maxFactor, 1 + this.growth.perUnit * excess);
  }

  /** Stock of the growth resource at which the output reaches its cap. */
  growthFullAt(): number {
    if (!this.growth) return 0;
    return this.growthThreshold() + (this.growth.maxFactor - 1) / this.growth.perUnit;
  }

  /**
   * How much of this output line a cycle makes (now, at the set pace).
   * Growth and pace change the main outputs only, not byproducts.
   */
  output(r: Recipe, growth = this.growthFactor(), pace = this.pace): number {
    if (r.byproduct) return r.amount;
    return r.amount * (this.growth ? growth : 1) * paceEfficiency(pace);
  }

  /** Seconds one cycle takes at a pace. */
  cycleSeconds(pace = this.pace): number {
    return this.cycleTicks / pace / TICKS_PER_SECOND;
  }

  /** Uses up something that only works while awake (Stamina), so it pauses while you sleep. */
  get needsAwake(): boolean {
    return this.needs.some((r) => r.amount > 0 && r.resource.def.awake);
  }

  /** Makes or uses the dream resource (Sleep, Wake up): while it works, you're asleep. */
  get dreams(): boolean {
    return [...this.needs, ...this.makes].some((r) => r.amount > 0 && r.resource.def.dream);
  }

  /** The running cycle's output uses another (faster) pace's efficiency than the slider's. */
  get pacePending(): boolean {
    return !!this.cycle && Math.abs(this.cycle.outPace - this.pace) > 1e-9;
  }

  /** Changes the pace (already checked and rounded): the running cycle speeds up / slows down at once. */
  setPace(pace: number): void {
    this.pace = pace;
    if (this.cycle) {
      this.cycle.pace = pace;
      this.cycle.outPace = Math.max(this.cycle.outPace, pace);
    }
  }

  stop(): void {
    if (!this.unstoppable) this.state = 'stopped';
  }

  toggle(): void {
    if (this.stopped) this.start();
    else this.stop();
  }

  /** Not discovered yet while any consumed input has never been in stock. */
  staysHidden(): boolean {
    if (this.unstoppable) return false;
    return this.needs.some((r) => r.resource.amount <= 0 && r.amount !== 0);
  }

  /** Can't use its Stamina now: you're asleep. */
  get sleeping(): boolean {
    return this.needsAwake && this.game.asleep();
  }

  /** Recipe lines that keep a new cycle from starting. */
  blockingNeeds(): Recipe[] {
    const sleeping = this.sleeping;
    return this.needs.filter((r) => !r.resource.satisfies(r) || (sleeping && r.amount > 0 && r.resource.def.awake));
  }

  /** Recipe lines that interrupt the running cycle (Stamina while you sleep, broken conditions). */
  interruptingNeeds(): Recipe[] {
    const sleeping = this.sleeping;
    return this.needs.filter((r) => !r.resource.holds(r) || (sleeping && r.amount > 0 && r.resource.def.awake));
  }

  /** Outputs that don't fit in storage right now (what a finished cycle waits for). */
  blockedOutputs(): Recipe[] {
    if (this.unstoppable) return [];
    const c = this.cycle;
    return this.makes.filter(
      (r) => !r.byproduct && r.resource.amount + r.resource.pending + this.output(r, c?.growth, c?.outPace) > r.resource.max + EPS,
    );
  }

  /**
   * One tick of work. A node works in its own loop (a cycle):
   * 1. start: take the inputs. If they aren't there: 'noInput', try again next tick.
   * 2. run: the cycle advances every tick (faster or slower with the pace).
   *    Conditions (minimum / maximum stocks) are checked every tick, and nodes
   *    that use Stamina can't work while you sleep: then it's 'interrupted' and
   *    goes on later. (A cycle that took nothing, like Sleep, is simply dropped.)
   * 3. end: put out the outputs if they fit in storage, else wait ('full').
   *    Byproducts, and Sleep / Wake up, never wait: they fill up to the limit.
   * Leftover time starts the next cycle, so a fast pace can do several per tick.
   */
  update(): void {
    if (this.state === 'stopped') return;
    let time = 1; // ticks of work left in this tick
    for (let guard = 0; guard < 1000; guard++) {
      if (!this.cycle) {
        if (time <= EPS || !this.startCycle()) return;
      }
      const cycle = this.cycle!;
      if (cycle.progress < 1) {
        if (time <= EPS) return;
        if (this.interruptingNeeds().length > 0) {
          if (this.needs.every((r) => r.amount <= 0)) {
            this.cycle = null; // nothing was taken: nothing to keep
            this.state = 'noInput';
          } else {
            this.state = 'interrupted';
          }
          return;
        }
        this.state = 'ok';
        const perTick = cycle.pace / this.cycleTicks; // share of the cycle done per tick
        const step = Math.min(1 - cycle.progress, time * perTick);
        cycle.progress += step;
        time -= step / perTick;
        this.addFlow(cycle, step);
        if (cycle.progress < 1 - EPS) return;
        cycle.progress = 1;
      }
      if (this.blockedOutputs().length > 0) {
        this.state = 'full';
        return;
      }
      this.finishCycle();
    }
  }

  private startCycle(): boolean {
    if (this.sleeping || !this.needs.every((r) => r.resource.satisfies(r))) {
      this.state = 'noInput';
      return false;
    }
    // The growth factor is measured before this cycle's inputs are taken.
    const growth = this.growthFactor();
    for (const r of this.needs) r.resource.take(r.amount);
    this.cycle = { progress: 0, pace: this.pace, outPace: this.pace, growth };
    return true;
  }

  private finishCycle(): void {
    const c = this.cycle!;
    for (const r of this.makes) r.resource.give(this.output(r, c.growth, c.outPace));
    this.cycle = null;
  }

  private addFlow(c: Cycle, share: number): void {
    for (const r of this.needs) if (r.amount > 0) r.resource.flow -= r.amount * share;
    for (const r of this.makes) r.resource.flow += this.output(r, c.growth, c.outPace) * share;
  }
}

// ---------------------------------------------------------------- Upgrade

export interface Cost {
  resource: Resource;
  amount: number;
}

export interface RecipeEffect {
  kind: 'need' | 'make';
  resource: Resource;
  before: { amount: number; atLeast: number };
  after: { amount: number; atLeast: number };
}

export interface CapacityEffect {
  resource: Resource;
  before: number;
  after: number;
}

export interface UpgradeEffects {
  converter: Converter;
  recipes: RecipeEffect[];
  rename?: string;
  growthMax?: { before: number; after: number };
}

interface Change {
  growthMax?: number;
  converter: Converter;
  mode: 'by' | 'to';
  needs: Recipe[];
  makes: Recipe[];
  rename?: string;
}

/** Applies one change to a recipe list (mutates the list). */
function applyRecipes(mode: 'by' | 'to', current: Recipe[], changes: Recipe[]): void {
  for (const ch of changes) {
    for (let i = 0; i < current.length; i++) {
      if (current[i].resource !== ch.resource) continue;
      if (mode === 'to') {
        current[i] = ch.clone();
      } else {
        const r = current[i];
        r.amount += ch.amount;
        r.atLeast += ch.atLeast;
        // Legacy overwrote atMost with the delta's (usually Infinity), silently dropping
        // conditions. Fixed: keep it unless the delta sets one. No current upgrade is affected.
        if (ch.atMost !== Infinity) r.atMost = ch.atMost;
        if (r.amount < 0) r.amount = 0;
      }
    }
  }
}

export class Upgrade {
  readonly def: UpgradeDef;
  bought = false;
  costs: Cost[];
  /** Storage limit increases. */
  capacity: Cost[];
  requires: Upgrade[] = [];
  /** The converter whose panel lists this upgrade (null if it changes several). */
  host: Converter | null;
  private changes: Change[];

  constructor(def: UpgradeDef, game: Game) {
    this.def = def;
    this.costs = def.costs.map((c) => ({ resource: game.resource(c.res), amount: c.amount }));
    this.capacity = (def.capacity ?? []).map((c) => ({ resource: game.resource(c.res), amount: c.amount }));
    this.changes = def.changes.map((c: ChangeDef) => ({
      converter: game.converter(c.converter),
      mode: c.mode,
      needs: (c.needs ?? []).map((r) => game.recipe(r)),
      makes: (c.makes ?? []).map((r) => game.recipe(r)),
      rename: c.rename,
      growthMax: c.growthMax,
    }));
    this.host = !def.building && this.changes.length === 1 ? this.changes[0].converter : null;
  }

  get id() { return this.def.id; }
  get name() { return this.def.name; }

  requirementsMet(): boolean {
    return this.requires.every((u) => u.bought);
  }

  canAfford(): boolean {
    return this.costs.every((c) => c.resource.canTake(c.amount));
  }

  isBuyable(): boolean {
    return !this.bought && this.requirementsMet() && this.canAfford();
  }

  /** Pays the costs and applies the effects. Returns false if not buyable. */
  buy(): boolean {
    if (!this.isBuyable()) return false;
    for (const c of this.costs) c.resource.take(c.amount);
    this.apply();
    return true;
  }

  /** Applies the effects without paying (also used when loading a save). */
  apply(): void {
    for (const ch of this.changes) {
      applyRecipes(ch.mode, ch.converter.needs, ch.needs);
      applyRecipes(ch.mode, ch.converter.makes, ch.makes);
      if (ch.rename) ch.converter.name = ch.rename;
      if (ch.growthMax !== undefined && ch.converter.growth) {
        ch.converter.growth.maxFactor = ch.mode === 'by' ? ch.converter.growth.maxFactor + ch.growthMax : ch.growthMax;
      }
    }
    for (const c of this.capacity) c.resource.max += c.amount;
    this.bought = true;
  }

  capacityEffects(): CapacityEffect[] {
    return this.capacity.map((c) => ({ resource: c.resource, before: c.resource.max, after: c.resource.max + c.amount }));
  }

  /** What would change if bought now (computed on copies, nothing is modified). */
  effects(): UpgradeEffects[] {
    return this.changes.map((ch) => {
      const result: UpgradeEffects = { converter: ch.converter, recipes: [] };
      for (const [kind, current, changes] of [
        ['need', ch.converter.needs, ch.needs],
        ['make', ch.converter.makes, ch.makes],
      ] as const) {
        const after = current.map((r) => r.clone());
        applyRecipes(ch.mode, after, changes);
        current.forEach((r, i) => {
          const a = after[i];
          if (a.amount !== r.amount || a.atLeast !== r.atLeast) {
            result.recipes.push({
              kind,
              resource: r.resource,
              before: { amount: r.amount, atLeast: r.atLeast },
              after: { amount: a.amount, atLeast: a.atLeast },
            });
          }
        });
      }
      if (ch.rename && ch.rename !== ch.converter.name) result.rename = ch.rename;
      const g = ch.converter.growth;
      if (ch.growthMax !== undefined && g) {
        result.growthMax = { before: g.maxFactor, after: ch.mode === 'by' ? g.maxFactor + ch.growthMax : ch.growthMax };
      }
      return result;
    });
  }
}

// ---------------------------------------------------------------- Game

export class Game {
  readonly data: GameData;
  readonly resources: Resource[];
  readonly converters: Converter[];
  readonly upgrades: Upgrade[];
  /** Upgrades shown in the Build panel (not on a node). */
  readonly buildings: Upgrade[];
  /** Converters the player has seen (once discovered, they stay visible). */
  readonly discovered = new Set<string>();
  /** Bought upgrade ids, in buying order (saved, replayed on load). */
  readonly boughtOrder: string[] = [];
  ticks = 0;
  /** What tells whether you're asleep (see asleep()). */
  private readonly dreamResources: Resource[];
  private readonly dreamNodes: Converter[];

  private resourceMap = new Map<string, Resource>();
  private converterMap = new Map<string, Converter>();
  private upgradeMap = new Map<string, Upgrade>();

  constructor(data: GameData = DATA) {
    this.data = data;
    this.resources = data.resources.map((d) => new Resource(d));
    for (const r of this.resources) this.resourceMap.set(r.id, r);

    this.converters = data.converters.map((d) => {
      const c = new Converter(d, this);
      this.converterMap.set(c.id, c);
      return c;
    });

    this.upgrades = data.upgrades.map((d) => {
      const u = new Upgrade(d, this);
      this.upgradeMap.set(u.id, u);
      return u;
    });
    for (const u of this.upgrades) {
      u.requires = (u.def.requires ?? []).map((id) => this.upgrade(id));
      u.host?.upgrades.push(u);
    }
    this.buildings = this.upgrades.filter((u) => u.def.building);
    this.dreamResources = this.resources.filter((r) => r.def.dream);
    this.dreamNodes = this.converters.filter((c) => c.dreams);

    this.updateDiscovery();
  }

  resource(id: string): Resource {
    const r = this.resourceMap.get(id);
    if (!r) throw new Error(`Unknown resource: ${id}`);
    return r;
  }

  converter(id: string): Converter {
    const c = this.converterMap.get(id);
    if (!c) throw new Error(`Unknown converter: ${id}`);
    return c;
  }

  upgrade(id: string): Upgrade {
    const u = this.upgradeMap.get(id);
    if (!u) throw new Error(`Unknown upgrade: ${id}`);
    return u;
  }

  hasResource(id: string) { return this.resourceMap.has(id); }
  hasConverter(id: string) { return this.converterMap.has(id); }
  hasUpgrade(id: string) { return this.upgradeMap.has(id); }

  recipe(def: RecipeDef): Recipe {
    return new Recipe(this.resource(def.res), def.amount ?? 0, def.atLeast ?? 0, def.atMost ?? Infinity, !!def.byproduct);
  }

  /** One tick of the game clock. Returns the ids of newly discovered converters. */
  tick(): string[] {
    const before = this.resources.map((r) => r.amount);
    for (const r of this.resources) r.flow = 0;
    for (const c of this.converters) c.update();
    for (const r of this.resources) r.flush();
    this.resources.forEach((r, i) => {
      r.lastDelta = r.amount - before[i];
      // At the storage limit the surplus is lost: show the real change then.
      r.lastFlow = r.amount >= r.max - EPS ? Math.min(r.flow, r.lastDelta) : r.flow;
    });
    this.ticks++;
    return this.updateDiscovery();
  }

  /**
   * You're asleep while you have any Dreaming, or while Sleep or Wake up is
   * working. (They run first every tick, so the other nodes see their current state.)
   */
  asleep(): boolean {
    return this.dreamResources.some((r) => r.amount > 0) || this.dreamNodes.some((c) => c.state === 'ok');
  }

  /** Highest pace the player can set: 0 while the slider is locked, 1, or 2 with overclocking. */
  paceMax(): number {
    const has = (what: string) => this.upgrades.some((u) => u.bought && u.def.unlocks === what);
    if (has('overclock')) return OVERCLOCK_MAX;
    return has('pace') ? PACE_MAX : 0;
  }

  /**
   * Sets a node's pace (1% steps, within the unlocked range). The speed changes at
   * once; a running cycle's output gets the faster pace's efficiency (see Cycle.outPace).
   */
  setPace(id: string, pace: number): boolean {
    const c = this.converter(id);
    const max = this.paceMax();
    if (c.unstoppable || max === 0 || !Number.isFinite(pace)) return false;
    const steps = Math.round(1 / PACE_STEP); // round to whole steps without float noise (0.33, not 0.33000000000000002)
    c.setPace(Math.min(max, Math.max(PACE_MIN, Math.round(pace * steps) / steps)));
    return true;
  }

  buy(id: string): boolean {
    const u = this.upgrade(id);
    if (!u.buy()) return false;
    this.boughtOrder.push(u.id);
    return true;
  }

  updateDiscovery(): string[] {
    const found: string[] = [];
    for (const c of this.converters) {
      if (!this.discovered.has(c.id) && !c.staysHidden()) {
        this.discovered.add(c.id);
        found.push(c.id);
      }
    }
    return found;
  }

  /** A resource is shown once a discovered converter makes it. */
  isResourceVisible(r: Resource): boolean {
    return this.converters.some((c) => this.discovered.has(c.id) && c.makes.some((m) => m.resource === r));
  }
}
