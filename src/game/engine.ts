// The game simulation. No UI code here, so it can be unit tested.
// Rules are a 1:1 port of legacy/core/*.py (v1.3.2); see the golden test.

import type { ChangeDef, ConverterDef, GameData, RecipeDef, ResourceDef, UpgradeDef } from './defs';
import { DATA } from './data';

/** One tick (production cycle) lasts this long in real time. */
export const TICK_MS = 500;
export const TICKS_PER_SECOND = 1000 / TICK_MS;

const EPS = 1e-10;

// ---------------------------------------------------------------- Resource

export class Resource {
  amount: number;
  /** Produced during the current tick; added at the end of the tick (see flush). */
  pending = 0;
  /** Net change during the last tick (for rate display). */
  lastDelta = 0;

  constructor(readonly def: ResourceDef) {
    this.amount = def.start ?? 0;
  }

  get id() { return this.def.id; }
  get name() { return this.def.name; }
  get max() { return this.def.max; }

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
  constructor(
    public resource: Resource,
    public amount = 0,
    public atLeast = 0,
    public atMost = Infinity,
    public byproduct = false,
  ) {}

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

export type ConverterState =
  | 'ok'       // running
  | 'stopped'  // switched off by the player
  | 'noInput'  // not enough input (or a condition is not met)
  | 'full';    // every output is at max

export class Converter {
  name: string;
  needs: Recipe[];
  makes: Recipe[];
  state: ConverterState;
  upgrades: Upgrade[] = [];

  constructor(readonly def: ConverterDef, game: Game) {
    this.name = def.name;
    this.needs = def.needs.map((r) => game.recipe(r));
    this.makes = def.makes.map((r) => game.recipe(r));
    this.state = def.unstoppable ? 'noInput' : 'stopped';
  }

  get id() { return this.def.id; }
  get unstoppable() { return !!this.def.unstoppable; }
  get stopped() { return this.state === 'stopped'; }

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

  /** Not discovered yet while any consumed input has never been in stock. */
  staysHidden(): boolean {
    if (this.unstoppable) return false;
    return this.needs.some((r) => r.resource.amount <= 0 && r.amount !== 0);
  }

  /** Recipe lines that currently block this converter. */
  blockingNeeds(): Recipe[] {
    return this.needs.filter((r) => !r.resource.satisfies(r));
  }

  update(): void {
    if (this.state === 'stopped') return;
    let ok = this.makes.length === 0;
    for (const r of this.makes) {
      if (r.resource.amount < r.resource.max) ok = true;
    }
    if (!ok) {
      this.state = 'full';
      return;
    }
    for (const r of this.needs) {
      if (!r.resource.satisfies(r)) {
        this.state = 'noInput';
        return;
      }
    }
    this.state = 'ok';
    for (const r of this.needs) r.resource.take(r.amount);
    for (const r of this.makes) r.resource.give(r.amount);
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

export interface UpgradeEffects {
  converter: Converter;
  recipes: RecipeEffect[];
  rename?: string;
}

interface Change {
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
  bought = false;
  costs: Cost[];
  requires: Upgrade[] = [];
  /** The converter whose panel lists this upgrade (null if it changes several). */
  host: Converter | null;
  private changes: Change[];

  constructor(readonly def: UpgradeDef, game: Game) {
    this.costs = def.costs.map((c) => ({ resource: game.resource(c.res), amount: c.amount }));
    this.changes = def.changes.map((c: ChangeDef) => ({
      converter: game.converter(c.converter),
      mode: c.mode,
      needs: (c.needs ?? []).map((r) => game.recipe(r)),
      makes: (c.makes ?? []).map((r) => game.recipe(r)),
      rename: c.rename,
    }));
    this.host = this.changes.length === 1 ? this.changes[0].converter : null;
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
    }
    this.bought = true;
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
  /** Converters the player has seen (once discovered, they stay visible). */
  readonly discovered = new Set<string>();
  /** Bought upgrade ids, in buying order (saved, replayed on load). */
  readonly boughtOrder: string[] = [];
  ticks = 0;

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

  /** One production cycle. Returns the ids of newly discovered converters. */
  tick(): string[] {
    const before = this.resources.map((r) => r.amount);
    for (const c of this.converters) c.update();
    for (const r of this.resources) r.flush();
    this.resources.forEach((r, i) => (r.lastDelta = r.amount - before[i]));
    this.ticks++;
    return this.updateDiscovery();
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
