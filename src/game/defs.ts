// Plain data shapes used to describe the game content (see data.ts).
// The engine (engine.ts) turns these into live objects.

/** One line of a converter recipe. Amounts are per cycle (one tick). */
export interface RecipeDef {
  res: string;
  /** Consumed (needs) or produced (makes) per cycle. 0 = only a condition, nothing is consumed. */
  amount?: number;
  /** The converter only runs while the stock is at least this much. */
  atLeast?: number;
  /** The converter only runs while the stock (incl. this tick's incoming) is at most this much. */
  atMost?: number;
  /** Visual only: a side product. No connection line is drawn from it. */
  byproduct?: boolean;
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
  /** Visual only: used by many nodes, so it's shown as chips instead of connection lines. */
  hub?: boolean;
}

export interface RegionDef {
  id: string;
  name: string;
  color: string;
}

export interface ConverterDef {
  id: string;
  name: string;
  /** Visual only: which island it belongs to and where it sits (world px, top-left corner). */
  region: string;
  x: number;
  y: number;
  /** Can't be stopped, starts running on its own. */
  unstoppable?: boolean;
  /**
   * Output grows with the stock of a resource above this node's minimum
   * (its `atLeast` for that resource), up to a cap ("size").
   * Byproducts and inputs don't change.
   */
  growth?: GrowthDef;
  needs: RecipeDef[];
  makes: RecipeDef[];
}

/**
 * Modifies an existing converter's recipe lines (matched by resource).
 * mode 'by' adds the numbers (delta), mode 'to' replaces the line.
 * A change can't add or remove recipe lines.
 */
export interface ChangeDef {
  converter: string;
  mode: 'by' | 'to';
  needs?: RecipeDef[];
  makes?: RecipeDef[];
  rename?: string;
  /** Changes the growth cap (size) of the converter: added for 'by', set for 'to'. */
  growthMax?: number;
}

export interface GrowthDef {
  /** The resource whose stock drives the output (e.g. Seed for fields, Plant for the Forest). */
  res: string;
  /** Extra output per unit of stock above the minimum, as a fraction of the base (0.1 = +10%). */
  perUnit: number;
  /** The output is at most this many times the base ("field size"). */
  maxFactor: number;
}

export interface CostDef {
  res: string;
  amount: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  costs: CostDef[];
  requires?: string[];
  changes: ChangeDef[];
  /** Raises resource storage limits (max) by these amounts. */
  capacity?: CostDef[];
  /**
   * Shown in the Build panel instead of on a node: home and storage upgrades
   * that aren't really about one node.
   */
  building?: boolean;
  /** Buying it ends the game. Its effect is kept secret in the UI. */
  final?: boolean;
}

export interface GameData {
  resources: ResourceDef[];
  regions: RegionDef[];
  /** Order matters: converters run in this order every tick (earlier = priority on shared inputs). */
  converters: ConverterDef[];
  upgrades: UpgradeDef[];
}
