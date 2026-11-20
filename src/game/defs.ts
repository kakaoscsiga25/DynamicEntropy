// Plain data shapes used to describe the game content (see content/).
// The engine (engine.ts) turns these into live objects.

/** One line of a node's recipe. Amounts are per cycle (see ConverterDef.cycle). */
export interface RecipeDef {
  res: string;
  /** Used up (needs) or made (makes) per cycle. 0 = only a condition, nothing is used. */
  amount?: number;
  /** The node only runs while the stock is at least this much. */
  atLeast?: number;
  /** The node only runs while the stock (incl. this tick's incoming) is at most this much. */
  atMost?: number;
  /** atLeast / atMost are shares of the storage limit (0.8 = 80% full) instead of numbers. */
  ofMax?: boolean;
  /**
   * A side product: not changed by growth / pace / health / wear, never waits for
   * room (fills up to the limit). No connection line is drawn from it by default.
   */
  byproduct?: boolean;
  /**
   * Needs only: "takes what's there, up to `amount`" (only what's above `atLeast`,
   * and with `yields`, only what its result has room for). Never blocks the node.
   * (Fertilizer on the Field, soil the crops use up.)
   */
  optional?: boolean;
  /** Optional needs only: every unit taken gives this much of another resource when the cycle ends. */
  yields?: { res: string; amount: number };
}

/** A resource loses a share of its stock every second ("fades", the game's entropy). */
export interface FadeDef {
  /** Share lost per second: 0.01 = 1%/s. The stock settles where refilling = fading. */
  rate: number;
  /** What the lost part turns into (Fruit rots into Compost). */
  into?: string;
  /** How much of `into` one lost unit gives (default 1). */
  yield?: number;
  /** Only fades while you're awake (dream memories). */
  awakeOnly?: boolean;
}

export interface ResourceDef {
  id: string;
  name: string;
  start?: number;
  max: number;
  icon: string;
  color: string;
  /** Resource panel group label. */
  group: string;
  /** Shown after the number ('°' for temperatures, '%' for Health). */
  unit?: string;
  /** Visual only: used by many nodes, so its connection lines are only drawn on demand. */
  hub?: boolean;
  /** Only usable while awake: nodes that use it up pause while you're asleep (Stamina). */
  awake?: boolean;
  /**
   * The dream resource: you're asleep while you have any of it, and while a node
   * that makes or uses it is working (Sleep, Wake up).
   */
  dream?: boolean;
  /** A fire's temperature: nodes with a `heat` range work when ANY fire is in it. */
  heat?: boolean;
  fade?: FadeDef;
  /** Recovers by itself: this much per second, up to the limit (Soil). */
  regen?: number;
}

export interface RegionDef {
  id: string;
  name: string;
  color: string;
}

/**
 * Output grows with the stock of a resource.
 * - linear: base + perUnit × (stock above this node's minimum), up to maxFactor.
 * - logistic: a living stock (fish, sheep) grows fastest when it's half full:
 *   output × 4·x·(1−x), where x = stock / storage limit.
 */
export interface GrowthDef {
  res: string;
  shape?: 'linear' | 'logistic';
  /** Linear: the factor at the minimum stock (default 1). Below 1 = a poor stock makes less. */
  base?: number;
  /** Linear: extra output per unit of stock above the minimum (0.1 = +10% of the base output). */
  perUnit?: number;
  /** Linear: the output is at most this many times the base ("size"). */
  maxFactor?: number;
}

/** A player-set amount on a node (wood per cycle on a fireplace): scales every line. */
export interface ThrottleDef {
  label: string;
  min: number;
  max: number;
  step: number;
  start: number;
}

/**
 * One part of a node that is split between several uses (the Field's crops).
 * The player sets the shares (they add up to 100%); every line of a part is
 * multiplied by its share.
 */
export interface PartDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Share at the start of the game (0..1). */
  start: number;
  needs?: RecipeDef[];
  makes?: RecipeDef[];
}

/** Tools wear out with every cycle once the node uses one (after a `tool` upgrade). */
export interface WearDef {
  /** Condition lost per finished cycle, in % (100 = new). */
  perCycle: number;
  /** Sharpening (any time before it breaks): back to 100%. */
  sharpen: CostDef[];
  /** Repairing a broken tool (condition 0): back to 100%. */
  repair: CostDef[];
}

export interface ConverterDef {
  id: string;
  name: string;
  /** Visual only: which island it belongs to and where it sits (world px, top-left corner). */
  region: string;
  x: number;
  y: number;
  /** Can't be stopped, starts running on its own. Its pace can't be changed either. */
  unstoppable?: boolean;
  /**
   * Nature: runs by itself and can't be stopped (fish spawning, water seeping into
   * the mine). Shown once all of its resources have been seen.
   */
  nature?: boolean;
  /** Not there until this upgrade is bought (e.g. the second fireplace). */
  requires?: string;
  /**
   * How long one cycle takes at 100% pace, in seconds (default 1 s = 10 ticks).
   * Inputs are taken when a cycle starts, outputs are given when it ends.
   */
  cycle?: number;
  /** Needs a fire whose temperature is in this range (any fireplace will do): [min, max]. */
  heat?: [number, number];
  growth?: GrowthDef;
  throttle?: ThrottleDef;
  parts?: PartDef[];
  wear?: WearDef;
  needs: RecipeDef[];
  makes: RecipeDef[];
}

/**
 * Modifies an existing node's recipe lines (matched by resource).
 * mode 'by' adds the numbers (delta), mode 'to' replaces the line.
 * A change can't add or remove recipe lines.
 */
export interface ChangeDef {
  converter: string;
  mode: 'by' | 'to';
  needs?: RecipeDef[];
  makes?: RecipeDef[];
  rename?: string;
  /** Changes the growth cap (size) of the node: added for 'by', set for 'to'. */
  growthMax?: number;
}

export interface CostDef {
  res: string;
  amount: number;
}

/**
 * An automatic rule a Mind upgrade adds to a node: it only runs while the
 * condition holds (the player can switch the rule off in the node's details).
 */
export interface GuardDef {
  converter: string;
  res: string;
  /** Runs only while the stock is at least this much... */
  atLeast?: number;
  /** ...or at most this much. */
  atMost?: number;
  /** Measured as a share of the storage limit (0.5 = half full) instead of a number. */
  ofMax?: boolean;
  /** Shown in the node's details. */
  label: string;
}

export type Skill = 'pace' | 'overclock' | 'thermostat' | 'maintenance';

export interface UpgradeDef {
  id: string;
  name: string;
  /** Shown on the upgrade card (what it's for), optional. */
  text?: string;
  costs: CostDef[];
  requires?: string[];
  changes: ChangeDef[];
  /** Raises resource storage limits (max) by these amounts. */
  capacity?: CostDef[];
  /** Multiplies how fast these resources fade (0.5 = half as fast). */
  fade?: { res: string; factor: number }[];
  /** A better home: adds this many points to the Home part of Health. */
  home?: number;
  /** The node now uses a tool: it starts to wear out (see WearDef). */
  tool?: boolean;
  /** An automatic rule on a node (see GuardDef). */
  guard?: GuardDef;
  /**
   * Skills: 'pace' unlocks the pace slider on every node (10–100%), 'overclock'
   * lets it go above 100%, 'thermostat' lets fireplaces keep a set temperature,
   * 'maintenance' sharpens tools automatically.
   */
  unlocks?: Skill;
  /** Listed in the Build panel under this section instead of on a node. */
  section?: string;
  /** Buying it ends the game. Its effect is kept secret in the UI. */
  final?: boolean;
}

/** An upgrade listed on one node (content/node-upgrades.ts): its change applies to that node. */
export interface NodeUpgradeDef extends Omit<UpgradeDef, 'changes' | 'section'> {
  change?: Omit<ChangeDef, 'converter'>;
}

/** A group of upgrades in the Build panel. */
export interface SectionDef {
  id: string;
  name: string;
  /** One sentence under the section title. */
  intro?: string;
}

/** Where Health comes from. Each source gives up to `points`; all of them add up to 110. */
export type HealthSourceDef =
  /** A stock (nutrition, hygiene): full points at `full` or more. */
  | { kind: 'stock'; name: string; res: string; points: number; full: number }
  /** Warmth: full points while the warmest fire is at least `full` degrees. */
  | { kind: 'heat'; name: string; points: number; full: number }
  /** Home: the `home` points of the bought buildings, up to `points`. */
  | { kind: 'home'; name: string; points: number };

export interface HealthDef {
  res: string;
  /** Always there. */
  base: number;
  sources: HealthSourceDef[];
  /** Share of the gap to the target closed per second (Health follows its target slowly). */
  rate: number;
  /** The resource whose limit Health scales (Stamina) and the limit at 0 Health, as a share of the full limit. */
  staminaRes: string;
  staminaMin: number;
  /** Output of nodes that use Stamina (manual work) at 0 Health, as a share of the output at 100. */
  workMin: number;
}

export interface GameData {
  resources: ResourceDef[];
  regions: RegionDef[];
  /** Order matters: nodes run in this order every tick (earlier = priority on shared inputs). */
  converters: ConverterDef[];
  upgrades: UpgradeDef[];
  sections: SectionDef[];
  health?: HealthDef;
}
