// The game simulation. No UI code here, so it can be unit tested.
// Started as a port of legacy/core/*.py (v1.3.2). v2 added storage, growth,
// cycles (each node works in its own loop) and pace. v3 adds fading resources,
// fire temperatures, a Field split between crops, Health, tool wear and
// automatic rules bought with Insight.

import type { ChangeDef, ConverterDef, GameData, HealthDef, RecipeDef, ResourceDef, Skill, UpgradeDef } from './defs.ts';
import { DATA } from './content/index.ts';

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

// ---------------------------------------------------------------- Wear

/** Output of a worn tool: 100% when new, 70% just before it breaks, 40% when broken. */
export function wearFactor(condition: number): number {
  return condition > EPS ? 0.7 + (0.3 * condition) / 100 : 0.4;
}

/** Tools are sharpened automatically (Maintenance) at this condition. */
export const AUTO_SHARPEN_AT = 30;

export interface Growth {
  resource: Resource;
  shape: 'linear' | 'logistic';
  base: number;
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
  /**
   * What each `makes` line gives when the cycle ends (before pace efficiency).
   * Fixed when the cycle starts: growth, Health, wear, shares and fuel at that moment.
   */
  out: number[];
  /** What each `needs` line took when the cycle started. */
  took: number[];
  /** Extra outputs from optional inputs (fertilizer → Soil): resource id → amount. */
  extra: Record<string, number>;
}

// ---------------------------------------------------------------- Resource

export class Resource {
  readonly def: ResourceDef;
  amount: number;
  /** Storage limit; buildings can raise it (Stamina's also follows Health). */
  max: number;
  /** The limit without the Health effect. */
  baseMax: number;
  /** Fading speed multiplier (preservation buildings lower it). */
  fadeMult = 1;
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
    this.baseMax = def.max;
  }

  get id() { return this.def.id; }
  get name() { return this.def.name; }

  /** Share lost per second right now (0 if it doesn't fade). */
  get fadeRate(): number {
    return (this.def.fade?.rate ?? 0) * this.fadeMult;
  }

  canTake(amount: number): boolean {
    return this.amount >= amount - EPS;
  }

  take(amount: number): void {
    if (this.canTake(amount)) this.amount = Math.max(0, this.amount - amount);
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
  | 'optional'  // takes what's there, up to the amount; never blocks
  | 'catalyst'  // amount 0, needs a minimum stock that is not used up
  | 'condition' // amount 0, only runs while stock is at most X
  | 'heat'      // a fire (any of them) must be in a temperature range
  | 'none';     // amount 0, no limits: has no effect

/** An automatic rule from a Mind upgrade (see GuardDef). */
export interface Guard {
  label: string;
  enabled: boolean;
}

export class Recipe {
  resource: Resource;
  amount: number;
  atLeast: number;
  atMost: number;
  byproduct: boolean;
  optional: boolean;
  yields: { resource: Resource; amount: number } | null;
  /** Index of the node part (Field crop) this line belongs to, or null. */
  part: number | null = null;
  /** Heat lines: every fire it can use (resource is the first one). */
  heat: Resource[] | null = null;
  guard: Guard | null = null;
  /** atLeast / atMost are shares of the storage limit. */
  ofMax = false;

  constructor(resource: Resource, amount = 0, atLeast = 0, atMost = Infinity, byproduct = false, optional = false, yields: Recipe['yields'] = null) {
    this.resource = resource;
    this.amount = amount;
    this.atLeast = atLeast;
    this.atMost = atMost;
    this.byproduct = byproduct;
    this.optional = optional;
    this.yields = yields;
  }

  clone(): Recipe {
    const r = new Recipe(this.resource, this.amount, this.atLeast, this.atMost, this.byproduct, this.optional, this.yields);
    r.part = this.part;
    r.heat = this.heat;
    r.guard = this.guard ? { ...this.guard } : null;
    r.ofMax = this.ofMax;
    return r;
  }

  get kind(): RecipeKind {
    if (this.heat) return 'heat';
    if (this.optional) return 'optional';
    if (this.amount > 0) return 'consume';
    if (this.atMost < Infinity) return 'condition';
    if (this.atLeast > 0) return 'catalyst';
    return 'none';
  }

  /** The minimum stock right now (it can be a share of the limit). */
  get minStock(): number {
    return this.ofMax ? this.atLeast * this.resource.max : this.atLeast;
  }

  /** The maximum stock right now (it can be a share of the limit). */
  get maxStock(): number {
    return this.ofMax ? this.atMost * this.resource.max : this.atMost;
  }

  /** Is a fire in range? (heat lines) */
  heatOk(): boolean {
    return !!this.heat?.some((r) => r.amount >= this.atLeast - EPS && r.amount <= this.atMost + EPS);
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

export interface Part {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export class Converter {
  readonly def: ConverterDef;
  private readonly game: Game;
  name: string;
  needs: Recipe[];
  makes: Recipe[];
  state: ConverterState;
  upgrades: Upgrade[] = [];
  /** Output grows with a stock (see GrowthDef). */
  growth: Growth | null;
  /** Length of one cycle at 100% pace, in ticks (at least 1). */
  readonly cycleTicks: number;
  /** Pace set by the player. Its speed applies at once, its efficiency from the next cycle. */
  pace = 1;
  /** The cycle in progress, or null between cycles. */
  cycle: Cycle | null = null;
  /** Player-set amount (fuel), or null if the node has none. */
  throttle: number | null;
  /** Thermostat: the temperature the fuel is set for automatically, or null. */
  target: number | null = null;
  /** The node's parts (Field crops) and their shares (add up to 1). */
  readonly parts: Part[];
  shares: number[];
  /** Tool condition in % (only matters once the node uses a tool). */
  condition = 100;
  /** Automatic rules added by Mind upgrades. */
  guards: Recipe[] = [];

  constructor(def: ConverterDef, game: Game) {
    this.def = def;
    this.game = game;
    this.name = def.name;
    this.needs = def.needs.map((r) => game.recipe(r));
    this.makes = def.makes.map((r) => game.recipe(r));
    this.parts = (def.parts ?? []).map((p) => ({ id: p.id, name: p.name, icon: p.icon, color: p.color }));
    this.shares = (def.parts ?? []).map((p) => p.start);
    (def.parts ?? []).forEach((p, i) => {
      for (const [list, defs] of [[this.needs, p.needs], [this.makes, p.makes]] as const) {
        for (const d of defs ?? []) {
          const r = game.recipe(d);
          r.part = i;
          list.push(r);
        }
      }
    });
    if (def.heat) {
      const fires = game.resources.filter((r) => r.def.heat);
      const r = new Recipe(fires[0], 0, def.heat[0], def.heat[1]);
      r.heat = fires;
      this.needs.push(r);
    }
    this.cycleTicks = Math.max(1, (def.cycle ?? DEFAULT_CYCLE_SECONDS) * TICKS_PER_SECOND);
    this.state = this.unstoppable ? 'noInput' : 'stopped';
    this.throttle = def.throttle ? def.throttle.start : null;
    const g = def.growth;
    this.growth = g
      ? {
          resource: game.resource(g.res),
          shape: g.shape ?? 'linear',
          base: g.base ?? 1,
          perUnit: g.perUnit ?? 0,
          maxFactor: g.maxFactor ?? 1,
        }
      : null;
  }

  get id() { return this.def.id; }
  /** Can't be switched off: Sleep, Wake up and nature. */
  get unstoppable() { return !!this.def.unstoppable || !!this.def.nature; }
  get nature() { return !!this.def.nature; }
  get stopped() { return this.state === 'stopped'; }
  /** Not built yet (its upgrade isn't bought). */
  get locked() { return !!this.def.requires && !this.game.upgrade(this.def.requires).bought; }

  start(): void {
    this.state = 'ok';
  }

  stop(): void {
    if (!this.unstoppable) this.state = 'stopped';
  }

  toggle(): void {
    if (this.stopped) this.start();
    else this.stop();
  }

  // ------------------------------------------------ amounts

  /** How much a line is scaled by the player's settings: its part's share and the fuel amount. */
  lineScale(r: Recipe): number {
    return (r.part !== null ? this.shares[r.part] : 1) * (this.throttle ?? 1);
  }

  /** What a need line uses per cycle with the current settings. */
  inAmount(r: Recipe): number {
    return r.amount * this.lineScale(r);
  }

  /** The minimum stock of the growth resource (this node's atLeast for it). */
  growthThreshold(): number {
    if (!this.growth) return 0;
    const g = this.growth;
    return this.needs.find((n) => n.resource === g.resource && !n.guard)?.atLeast ?? 0;
  }

  /** Growth multiplier right now (see GrowthDef). */
  growthFactor(): number {
    const g = this.growth;
    if (!g) return 1;
    if (g.shape === 'logistic') {
      const x = Math.max(0, Math.min(1, g.resource.amount / g.resource.max));
      return 4 * x * (1 - x);
    }
    const excess = Math.max(0, g.resource.amount - this.growthThreshold());
    return Math.min(g.maxFactor, g.base + g.perUnit * excess);
  }

  /** Stock of the growth resource at which the output is the highest. */
  growthFullAt(): number {
    const g = this.growth;
    if (!g) return 0;
    if (g.shape === 'logistic') return g.resource.max / 2;
    return this.growthThreshold() + (g.maxFactor - g.base) / Math.max(EPS, g.perUnit);
  }

  /** Uses up something that only works while awake (Stamina): manual work. */
  get needsAwake(): boolean {
    return this.needs.some((r) => r.amount > 0 && !r.optional && r.resource.def.awake);
  }

  /** Makes or uses the dream resource (Sleep, Wake up): while it works, you're asleep. */
  get dreams(): boolean {
    return [...this.needs, ...this.makes].some((r) => r.amount > 0 && r.resource.def.dream);
  }

  /** The node now uses a tool, which wears out. */
  get wears(): boolean {
    return !!this.def.wear && this.upgrades.some((u) => u.bought && u.def.tool);
  }

  /** Health (manual work) × tool condition. */
  workFactor(): number {
    return (this.needsAwake ? this.game.workFactor() : 1) * (this.wears ? wearFactor(this.condition) : 1);
  }

  /** Everything that multiplies the main outputs right now, except pace. */
  outputFactor(): number {
    return this.growthFactor() * this.workFactor();
  }

  /**
   * How much of this output line a cycle makes (now, at the set pace).
   * Growth, Health, wear and pace change the main outputs only, not byproducts.
   */
  output(r: Recipe, pace = this.pace): number {
    const base = r.amount * this.lineScale(r);
    if (r.byproduct) return base;
    return base * this.outputFactor() * paceEfficiency(pace);
  }

  /** Seconds one cycle takes at a pace. */
  cycleSeconds(pace = this.pace): number {
    return this.cycleTicks / pace / TICKS_PER_SECOND;
  }

  /** Can the player change the pace of this node? (Fireplaces have a fuel setting instead.) */
  get pacable(): boolean {
    return !this.unstoppable && this.throttle === null;
  }

  /** The pace slider's running cycle uses another (faster) pace's efficiency. */
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

  // ------------------------------------------------ conditions

  /** Can this line start a new cycle now? */
  lineOk(r: Recipe): boolean {
    if (r.guard && !r.guard.enabled) return true;
    if (r.heat) return r.heatOk();
    if (r.optional) return true;
    const res = r.resource;
    return (
      res.canTake(this.inAmount(r)) &&
      res.amount >= r.minStock - EPS &&
      res.amount + res.pending <= r.maxStock + EPS
    );
  }

  /** Can a running cycle (inputs already taken) go on? Its own use doesn't count against the minimum. */
  lineHolds(r: Recipe, took = 0): boolean {
    if (r.guard && !r.guard.enabled) return true;
    if (r.heat) return r.heatOk();
    if (r.optional) return true;
    const res = r.resource;
    return res.amount + took >= r.minStock - EPS && res.amount + res.pending <= r.maxStock + EPS;
  }

  /** Not discovered yet: some input has never been in stock (or it isn't built). */
  staysHidden(): boolean {
    if (this.locked) return true;
    if (this.def.unstoppable) return false;
    const inputs = this.needs.filter((r) => !r.heat && !r.optional && (r.amount > 0 || r.atLeast > 0));
    return inputs.some((r) => r.resource.amount <= 0);
  }

  /** Can't use its Stamina now: you're asleep. */
  get sleeping(): boolean {
    return this.needsAwake && this.game.asleep();
  }

  private sleepBlocks(r: Recipe, sleeping: boolean): boolean {
    return sleeping && r.amount > 0 && !r.optional && !!r.resource.def.awake;
  }

  /** Recipe lines (and rules) that keep a new cycle from starting. */
  blockingNeeds(): Recipe[] {
    const sleeping = this.sleeping;
    return [...this.needs, ...this.guards].filter((r) => !this.lineOk(r) || this.sleepBlocks(r, sleeping));
  }

  /** Recipe lines (and rules) that interrupt the running cycle (Stamina while you sleep, broken conditions). */
  interruptingNeeds(): Recipe[] {
    const sleeping = this.sleeping;
    const took = this.cycle?.took ?? [];
    return [
      ...this.needs.filter((r, i) => !this.lineHolds(r, took[i] ?? 0) || this.sleepBlocks(r, sleeping)),
      ...this.guards.filter((r) => !this.lineHolds(r)),
    ];
  }

  /**
   * Outputs that don't fit in storage right now (what a finished cycle waits for).
   * A part's output (one crop of the Field) doesn't hold up the others: it fills
   * up to the limit and the rest is lost.
   */
  blockedOutputs(): Recipe[] {
    if (this.unstoppable) return [];
    const c = this.cycle;
    return this.makes.filter((r, i) => {
      if (r.byproduct || r.part !== null) return false;
      const amount = c ? c.out[i] * paceEfficiency(c.outPace) : this.output(r);
      return amount > EPS && r.resource.amount + r.resource.pending + amount > r.resource.max + EPS;
    });
  }

  /**
   * While you sleep, only Sleep / Wake up may give Stamina: a finished cycle that
   * makes some (a meal) waits until you're awake. (Otherwise you could get stuck
   * half asleep: too much Stamina to sleep on, too little Dreaming to wake up.)
   */
  private holdsAwakeOutput(): boolean {
    const c = this.cycle;
    if (!c || this.dreams || !this.game.asleep()) return false;
    return this.makes.some((r, i) => r.resource.def.awake && c.out[i] > 0);
  }

  // ------------------------------------------------ the loop

  /**
   * One tick of work. A node works in its own loop (a cycle):
   * 1. start: take the inputs. If they aren't there: 'noInput', try again next tick.
   * 2. run: the cycle advances every tick (faster or slower with the pace).
   *    Conditions (minimum / maximum stocks, fire range) are checked every tick,
   *    and nodes that use Stamina can't work while you sleep: then it's
   *    'interrupted' and goes on later. (A cycle that took nothing is dropped.)
   * 3. end: put out the outputs if they fit in storage, else wait ('full').
   *    Byproducts, and Sleep / Wake up / nature, never wait: they fill up to the limit.
   * Leftover time starts the next cycle, so a fast pace can do several per tick.
   */
  update(): void {
    if (this.state === 'stopped' || this.locked) return;
    let time = 1; // ticks of work left in this tick
    for (let guard = 0; guard < 1000; guard++) {
      if (!this.cycle) {
        if (time <= EPS || !this.startCycle()) return;
      }
      const cycle = this.cycle!;
      if (cycle.progress < 1) {
        if (time <= EPS) return;
        if (this.interruptingNeeds().length > 0) {
          if (cycle.took.every((t) => t <= 0)) {
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
      if (this.holdsAwakeOutput()) {
        this.state = 'interrupted'; // e.g. a meal's Stamina waits until you wake up
        return;
      }
      if (this.blockedOutputs().length > 0) {
        this.state = 'full';
        return;
      }
      this.finishCycle();
    }
  }

  private startCycle(): boolean {
    if (this.sleeping || this.blockingNeeds().length > 0) {
      this.state = 'noInput';
      return false;
    }
    // Outputs are fixed now, measured before this cycle's inputs are taken.
    const factor = this.outputFactor();
    const out = this.makes.map((r) => r.amount * this.lineScale(r) * (r.byproduct ? 1 : factor));
    const took = this.needs.map((r) => (r.heat || r.amount <= 0 ? 0 : r.optional ? this.optionalTake(r) : this.inAmount(r)));
    const extra: Record<string, number> = {};
    this.needs.forEach((r, i) => {
      if (took[i] <= 0) return;
      r.resource.take(took[i]);
      if (r.yields) extra[r.yields.resource.id] = (extra[r.yields.resource.id] ?? 0) + took[i] * r.yields.amount;
    });
    this.cycle = { progress: 0, pace: this.pace, outPace: this.pace, out, took, extra };
    return true;
  }

  /**
   * How much an optional input takes: up to its amount, only what's above its
   * minimum (a reserve left for others), and no more than what its result has
   * room for (no fertilizer wasted on soil that's already full).
   */
  optionalTake(r: Recipe): number {
    let take = Math.min(this.inAmount(r), r.resource.amount - r.minStock);
    if (r.yields) {
      const y = r.yields.resource;
      take = Math.min(take, (y.max - y.amount - y.pending) / r.yields.amount);
    }
    return Math.max(0, take);
  }

  private finishCycle(): void {
    const c = this.cycle!;
    this.makes.forEach((r, i) => r.resource.give(c.out[i] * (r.byproduct ? 1 : paceEfficiency(c.outPace))));
    for (const [id, amount] of Object.entries(c.extra)) this.game.resource(id).give(amount);
    if (this.wears && this.def.wear) this.condition = Math.max(0, this.condition - this.def.wear.perCycle);
    this.cycle = null;
  }

  private addFlow(c: Cycle, share: number): void {
    this.needs.forEach((r, i) => (r.resource.flow -= c.took[i] * share));
    this.makes.forEach((r, i) => (r.resource.flow += c.out[i] * (r.byproduct ? 1 : paceEfficiency(c.outPace)) * share));
    for (const [id, amount] of Object.entries(c.extra)) this.game.resource(id).flow += amount * share;
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

/** Applies one change to a recipe list (mutates the list). Heat lines are never changed. */
function applyRecipes(mode: 'by' | 'to', current: Recipe[], changes: Recipe[]): void {
  for (const ch of changes) {
    for (let i = 0; i < current.length; i++) {
      const r = current[i];
      if (r.resource !== ch.resource || r.heat) continue;
      if (mode === 'to') {
        const next = ch.clone();
        next.part = r.part;
        current[i] = next;
      } else {
        r.amount += ch.amount;
        r.atLeast += ch.atLeast;
        // Keep atMost unless the delta sets one.
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
  /** The node whose panel lists this upgrade (null for Build panel upgrades). */
  host: Converter | null;
  private changes: Change[];
  private readonly game: Game;

  constructor(def: UpgradeDef, game: Game) {
    this.def = def;
    this.game = game;
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
    this.host = !def.section && this.changes.length === 1 ? this.changes[0].converter : null;
    if (!def.section && def.guard) this.host = game.converter(def.guard.converter);
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
    for (const c of this.capacity) {
      c.resource.max += c.amount;
      c.resource.baseMax += c.amount;
    }
    for (const f of this.def.fade ?? []) this.game.resource(f.res).fadeMult *= f.factor;
    const g = this.def.guard;
    if (g) {
      const r = new Recipe(this.game.resource(g.res), 0, g.atLeast ?? 0, g.atMost ?? Infinity);
      r.guard = { label: g.label, enabled: true };
      r.ofMax = !!g.ofMax;
      this.game.converter(g.converter).guards.push(r);
    }
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

// ---------------------------------------------------------------- Health

export interface HealthPart {
  name: string;
  /** Points it gives now. */
  points: number;
  /** Points it can give at most. */
  max: number;
}

// ---------------------------------------------------------------- Game

export class Game {
  readonly data: GameData;
  readonly resources: Resource[];
  readonly converters: Converter[];
  readonly upgrades: Upgrade[];
  /** Upgrades shown in the Build panel (not on a node). */
  readonly buildings: Upgrade[];
  /** Fire temperatures. */
  readonly fires: Resource[];
  /** Converters the player has seen (once discovered, they stay visible). */
  readonly discovered = new Set<string>();
  /** Bought upgrade ids, in buying order (saved, replayed on load). */
  readonly boughtOrder: string[] = [];
  ticks = 0;
  readonly healthDef: HealthDef | null;
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
    this.fires = this.resources.filter((r) => r.def.heat);
    this.healthDef = data.health ?? null;

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
    this.buildings = this.upgrades.filter((u) => u.def.section);
    this.dreamResources = this.resources.filter((r) => r.def.dream);
    this.dreamNodes = this.converters.filter((c) => c.dreams);

    this.syncHealth();
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
    const yields = def.yields ? { resource: this.resource(def.yields.res), amount: def.yields.amount } : null;
    const r = new Recipe(
      this.resource(def.res), def.amount ?? 0, def.atLeast ?? 0, def.atMost ?? Infinity,
      !!def.byproduct, !!def.optional, yields,
    );
    r.ofMax = !!def.ofMax;
    return r;
  }

  /** One tick of the game clock. Returns the ids of newly discovered converters. */
  tick(): string[] {
    const before = this.resources.map((r) => r.amount);
    for (const r of this.resources) r.flow = 0;
    this.runThermostats();
    for (const c of this.converters) c.update();
    this.fadeAndRegen();
    for (const r of this.resources) r.flush();
    this.updateHealth();
    this.resources.forEach((r, i) => {
      r.lastDelta = r.amount - before[i];
      // At the storage limit the surplus is lost: show the real change then.
      r.lastFlow = r.amount >= r.max - EPS ? Math.min(r.flow, r.lastDelta) : r.flow;
    });
    this.runMaintenance();
    this.ticks++;
    return this.updateDiscovery();
  }

  /** Resources fade (rot, cool down, are forgotten); some recover by themselves (Soil). */
  private fadeAndRegen(): void {
    const asleep = this.asleep();
    for (const r of this.resources) {
      const f = r.def.fade;
      if (f && r.amount > 0 && !(f.awakeOnly && asleep)) {
        const lost = r.amount * (1 - Math.exp(-r.fadeRate / TICKS_PER_SECOND));
        r.amount -= lost;
        r.flow -= lost;
        if (f.into) {
          const into = this.resource(f.into);
          const gained = lost * (f.yield ?? 1);
          into.give(gained);
          into.flow += gained;
        }
      }
      if (r.def.regen && r.amount < r.max) {
        const add = Math.min(r.def.regen / TICKS_PER_SECOND, r.max - r.amount);
        r.amount += add;
        r.flow += add;
      }
    }
  }

  // ------------------------------------------------ sleep & health

  /**
   * You're asleep while you have any Dreaming, or while Sleep or Wake up is
   * working. (They run first every tick, so the other nodes see their current state.)
   */
  asleep(): boolean {
    return this.dreamResources.some((r) => r.amount > 0) || this.dreamNodes.some((c) => c.state === 'ok');
  }

  /** Current Health, 0..100 (100 if the game has no Health). */
  health(): number {
    return this.healthDef ? this.resource(this.healthDef.res).amount : 100;
  }

  /** Where Health comes from now: every source with its points. */
  healthParts(): HealthPart[] {
    const h = this.healthDef;
    if (!h) return [];
    const warmest = Math.max(0, ...this.fires.map((r) => r.amount));
    const home = this.upgrades.reduce((sum, u) => sum + (u.bought ? (u.def.home ?? 0) : 0), 0);
    return [
      { name: 'Base', points: h.base, max: h.base },
      ...h.sources.map((s) => {
        let share = 0;
        if (s.kind === 'stock') share = this.resource(s.res).amount / s.full;
        else if (s.kind === 'heat') share = warmest / s.full;
        else share = home / s.points;
        return { name: s.name, points: s.points * Math.max(0, Math.min(1, share)), max: s.points };
      }),
    ];
  }

  /** Where Health is heading: the sum of its sources (can be above 100, Health stops at 100). */
  healthTarget(): number {
    return this.healthParts().reduce((sum, p) => sum + p.points, 0);
  }

  /** Output of manual work (nodes that use Stamina) at the current Health. */
  workFactor(): number {
    const h = this.healthDef;
    if (!h) return 1;
    return h.workMin + ((1 - h.workMin) * this.health()) / 100;
  }

  private updateHealth(): void {
    const h = this.healthDef;
    if (!h) return;
    const r = this.resource(h.res);
    const target = Math.min(r.max, this.healthTarget());
    r.amount += (target - r.amount) * (1 - Math.exp(-h.rate / TICKS_PER_SECOND));
    this.syncHealth();
  }

  /** Health sets the Stamina limit: a healthier you wakes up with more energy. */
  syncHealth(): void {
    const h = this.healthDef;
    if (!h) return;
    const stamina = this.resource(h.staminaRes);
    stamina.max = stamina.baseMax * (h.staminaMin + ((1 - h.staminaMin) * this.health()) / 100);
    if (stamina.amount > stamina.max) stamina.amount = stamina.max;
  }

  // ------------------------------------------------ skills

  has(skill: Skill): boolean {
    return this.upgrades.some((u) => u.bought && u.def.unlocks === skill);
  }

  /** Highest pace the player can set: 0 while the slider is locked, 1, or 2 with overclocking. */
  paceMax(): number {
    if (this.has('overclock')) return OVERCLOCK_MAX;
    return this.has('pace') ? PACE_MAX : 0;
  }

  /**
   * Sets a node's pace (1% steps, within the unlocked range). The speed changes at
   * once; a running cycle's output gets the faster pace's efficiency (see Cycle.outPace).
   */
  setPace(id: string, pace: number): boolean {
    const c = this.converter(id);
    const max = this.paceMax();
    if (!c.pacable || max === 0 || !Number.isFinite(pace)) return false;
    const steps = Math.round(1 / PACE_STEP); // round to whole steps without float noise
    c.setPace(Math.min(max, Math.max(PACE_MIN, Math.round(pace * steps) / steps)));
    return true;
  }

  /** Sets a node's fuel (or other player-set amount), rounded to its steps. Applies from the next cycle. */
  setThrottle(id: string, value: number): boolean {
    const c = this.converter(id);
    const t = c.def.throttle;
    if (!t || !Number.isFinite(value)) return false;
    const v = Math.round(Math.min(t.max, Math.max(t.min, value)) / t.step) * t.step;
    c.throttle = Number(v.toFixed(6));
    c.target = null; // set by hand: the thermostat lets go
    return true;
  }

  /** The fire a fireplace heats (the heat resource it makes), or null. */
  fireOf(c: Converter): Recipe | null {
    return c.throttle !== null ? (c.makes.find((m) => m.resource.def.heat) ?? null) : null;
  }

  /** Thermostat: a fireplace keeps this temperature by itself (null: off). */
  setTarget(id: string, target: number | null): boolean {
    const c = this.converter(id);
    if (!this.has('thermostat') || !this.fireOf(c)) return false;
    c.target = target === null || !Number.isFinite(target) ? null : Math.max(0, Math.min(100, Math.round(target)));
    return true;
  }

  /** Fuel that keeps a fire at a temperature, plus extra to get there quicker. */
  private runThermostats(): void {
    for (const c of this.converters) {
      if (c.target === null || !c.def.throttle) continue;
      const fire = this.fireOf(c);
      if (!fire || fire.amount <= 0) continue;
      const res = fire.resource;
      const perUnit = fire.amount / c.cycleSeconds(1); // heat per second per unit of fuel
      const hold = (c.target * res.fadeRate) / perUnit;
      const push = ((c.target - res.amount) * 0.05) / perUnit;
      const t = c.def.throttle;
      c.throttle = Math.min(t.max, Math.max(t.min, hold + push));
    }
  }

  /** Splits a node between its parts (Field crops). Shares are made to add up to 1. */
  setShares(id: string, shares: number[]): boolean {
    const c = this.converter(id);
    if (shares.length !== c.parts.length || !shares.every((s) => Number.isFinite(s))) return false;
    const clean = shares.map((s) => Math.max(0, s));
    const sum = clean.reduce((a, b) => a + b, 0);
    if (sum <= 0) return false;
    c.shares = clean.map((s) => Number((s / sum).toFixed(4)));
    return true;
  }

  /** Switches an automatic rule (guard) of a node on or off. */
  setGuard(id: string, index: number, enabled: boolean): boolean {
    const g = this.converter(id).guards[index]?.guard;
    if (!g) return false;
    g.enabled = enabled;
    return true;
  }

  /** What sharpening (or, if broken, repairing) a node's tool costs now. */
  sharpenCost(c: Converter): Cost[] {
    const w = c.def.wear;
    if (!w) return [];
    return (c.condition > EPS ? w.sharpen : w.repair).map((k) => ({ resource: this.resource(k.res), amount: k.amount }));
  }

  /** Sharpens (or repairs) a node's tool: back to 100%. */
  sharpen(id: string): boolean {
    const c = this.converter(id);
    if (!c.wears || c.condition >= 100 - EPS) return false;
    const cost = this.sharpenCost(c);
    if (!cost.every((k) => k.resource.canTake(k.amount))) return false;
    for (const k of cost) k.resource.take(k.amount);
    c.condition = 100;
    return true;
  }

  /** Maintenance: tools are sharpened as soon as they're worn down to 30% (if you can pay). */
  private runMaintenance(): void {
    if (!this.has('maintenance')) return;
    for (const c of this.converters) {
      if (c.wears && c.condition <= AUTO_SHARPEN_AT) this.sharpen(c.id);
    }
  }

  buy(id: string): boolean {
    const u = this.upgrade(id);
    if (!u.buy()) return false;
    this.boughtOrder.push(u.id);
    this.syncHealth();
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

  /** A resource is shown once a discovered node makes it (or it rots out of one that's shown). */
  isResourceVisible(r: Resource): boolean {
    if (this.healthDef && r.id === this.healthDef.res) return true;
    const madeBy = (c: Converter) =>
      c.makes.some((m) => m.resource === r) || c.needs.some((n) => n.yields?.resource === r);
    if (this.converters.some((c) => this.discovered.has(c.id) && madeBy(c))) return true;
    return this.resources.some((src) => src !== r && src.def.fade?.into === r.id && this.isResourceVisible(src));
  }
}
