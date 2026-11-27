// Simple automated players for the simulator. They only use what a real player
// can do: start/stop discovered nodes, set the fuel / field shares / thermostat,
// sharpen tools and buy upgrades.

import { TICKS_PER_SECOND, type Converter, type Game, type Recipe, type Resource } from '../game/engine.ts';
import type { Skill } from '../game/defs.ts';
import type { Bot } from './simulate.ts';

const TWIDDLE = 'twiddling_thumbs';

/** Skills the bots know how to use (the pace slider isn't used by any bot). */
const SKILLS: Skill[] = ['thermostat', 'maintenance'];

/** Buys the final upgrade when possible, otherwise any other affordable upgrade. */
function buyEverything(game: Game) {
  const final = game.upgrades.find((u) => u.def.final && u.isBuyable());
  if (final) {
    game.buy(final.id);
    return;
  }
  for (const u of game.upgrades) {
    if (u.def.final || !u.isBuyable()) continue;
    if (u.def.unlocks && !SKILLS.includes(u.def.unlocks)) continue;
    game.buy(u.id);
  }
}

function setRunning(c: Converter, on: boolean) {
  if (on && c.stopped) c.start();
  else if (!on && !c.stopped) c.stop();
}

const has = (game: Game, id: string) => game.hasConverter(id) && game.discovered.has(id);

/** Burn leftover Stamina (to fall asleep) when nothing else is using it. */
function twiddleIfIdle(game: Game) {
  if (!has(game, TWIDDLE)) return;
  const twiddle = game.converter(TWIDDLE);
  const stamina = game.resource('stamina');
  const used = game.converters.some(
    (c) => c !== twiddle && c.state === 'ok' && c.needs.some((n) => n.resource === stamina && n.amount > 0),
  );
  setRunning(twiddle, !used && stamina.amount >= 1);
}

/** Idle player: turns on every discovered node and never changes a setting; buys upgrades. */
export const idle: Bot = {
  name: 'idle',
  description: 'Idle player: everything on (Twiddling thumbs too), default settings, buys upgrades as soon as possible.',
  act(game) {
    for (const c of game.converters) {
      if (game.discovered.has(c.id) && !c.unstoppable) setRunning(c, true);
    }
    buyEverything(game);
  },
};

/** Resources each game has had in stock at least once (what a player has "seen"). */
const seenResources = new WeakMap<Game, Set<string>>();
/** Until when a bot works towards every upgrade, not just the closest few. */
const broadUntil = new WeakMap<Game, number>();
/** The temperatures a bot keeps its fires at. */
const fireTargets = new WeakMap<Game, number[]>();
/** When a node that needs a fire last had one in its range. */
const lastWarm = new WeakMap<Converter, number>();

/**
 * Does this node keep itself going? It needs a minimum stock of something, uses
 * some of it and makes more of it than it uses (Forest: Plant ≥ 50, uses 1,
 * makes 2. Starter: ≥ 5, uses 1, makes 2).
 */
function isLoopFor(c: Converter, r: Resource): boolean {
  const need = c.needs.find((n) => n.resource === r && n.atLeast > 0 && n.amount > 0);
  const make = c.makes.find((m) => m.resource === r);
  return !!need && !!make && make.amount > need.amount;
}

// ------------------------------------------------ fires

/** The temperature range a node needs, if any. */
const heatLine = (c: Converter): Recipe | undefined => c.needs.find((n) => n.heat);

/** Fireplaces (nodes with fuel that make a temperature), built and discovered. */
const fireplaces = (game: Game) => game.converters.filter((c) => game.discovered.has(c.id) && !c.locked && game.fireOf(c));

/** Fuel that holds a fire at a temperature (plus a push towards it when `push`). */
function fuelFor(game: Game, c: Converter, temp: number, push: boolean): number {
  const fire = game.fireOf(c)!;
  const perUnit = fire.amount / c.cycleSeconds(1);
  const hold = (temp * fire.resource.fadeRate) / perUnit;
  const extra = push ? ((temp - fire.resource.amount) * 0.05) / perUnit : 0.01;
  return hold + extra;
}

/** A temperature range some work needs, and how much that work is needed now (0..1). */
type HeatNeed = { lo: number; hi: number; w: number };

/**
 * Picks temperatures for the fires: the one that serves the most needed work
 * (staying above the cold, which makes you sick, counts too), sticking to the current one unless
 * another is clearly better (a fire takes minutes to heat up or cool down).
 * With two fires, the second one covers what the first one can't.
 */
function pickTemperatures(needs: HeatNeed[], current: (number | null)[]): number[] {
  const all: HeatNeed[] = [...needs, { lo: 12, hi: 100, w: 0.5 }];
  const score = (t: number, list: HeatNeed[]) => list.reduce((s, r) => s + (t >= r.lo && t <= r.hi ? r.w : 0), 0);
  const candidates = all.flatMap((r) => [r.lo + 4, Math.min(r.hi - 4, r.lo + 10)]).filter((t) => t > 0 && t <= 96);
  const best = (list: HeatNeed[], keep: number | null) => {
    let b = candidates[0];
    for (const t of candidates) if (score(t, list) > score(b, list) || (score(t, list) === score(b, list) && t < b)) b = t;
    if (keep !== null && score(keep, list) * 1.2 >= score(b, list) && score(keep, list) > 0) return keep;
    return b;
  };
  const temps: number[] = [];
  let left = all;
  for (let i = 0; i < current.length; i++) {
    const t = best(left, current[i]);
    temps.push(t);
    const rest = left.filter((r) => !(t >= r.lo && t <= r.hi));
    if (rest.every((r) => r.w < 0.05)) break;
    left = rest;
  }
  return temps;
}

// ------------------------------------------------ the planner

interface Style {
  /** Protects loops, fine-tunes fires, the field, fish and the starter. */
  micro: boolean;
  /** How many upgrades (besides the final one) it works towards at a time. */
  focus: number;
  /** Sharpens tools below this condition (%). */
  sharpenBelow: number;
  /**
   * Leaving for a while (visitors): wants the upgrades' resources full, not just
   * enough, so their makers keep working until the next visit.
   */
  leaving?: boolean;
}

/**
 * Works backwards from the upgrades it can buy next: runs only the nodes whose
 * output is still needed (plus their supply chain), tries out nodes that make
 * something it has never seen (that's how new nodes get discovered), keeps
 * itself productive (food, clothes, warmth, washing, medicine, bandages), and
 * twiddles its thumbs to fall asleep when its Stamina is useless.
 *
 * With `micro`, it also protects self-sustaining loops (never lets other nodes
 * take Plant below the Forest's minimum), keeps the Soil up with clover, the
 * pond half full, and the Starter just alive.
 */
function plan(game: Game, style: Style) {
  buyEverything(game);
  const { micro } = style;

  let seen = seenResources.get(game);
  if (!seen) seenResources.set(game, (seen = new Set()));
  for (const r of game.resources) if (r.amount > 0) seen.add(r.id);

  const candidates = game.converters.filter((c) => game.discovered.has(c.id) && !c.unstoppable && !c.locked && c.id !== TWIDDLE);
  const res = (id: string) => game.resource(id);

  // Stocks that keep loops alive (micro only).
  const protect = new Map<Resource, number>();
  if (micro) {
    for (const c of candidates) {
      for (const n of c.needs) {
        if (!isLoopFor(c, n.resource)) continue;
        const level = c.growth?.resource === n.resource ? Math.max(n.atLeast, c.growthFullAt()) : n.atLeast;
        const biggestUse = Math.max(
          0,
          ...candidates.filter((o) => o !== c).flatMap((o) => o.needs.filter((m) => m.resource === n.resource).map((m) => o.inAmount(m))),
        );
        const loopOutput = Math.max(0, ...c.makes.filter((m) => m.resource === n.resource).map((m) => m.amount * (c.growth?.maxFactor ?? 1)));
        const room = n.resource.max - 2 * biggestUse - loopOutput - 1;
        protect.set(n.resource, Math.max(protect.get(n.resource) ?? 0, Math.max(n.atLeast, Math.min(level, room))));
      }
    }
  }

  // Focus: the final upgrade and the few upgrades closest to affordable (a real
  // player works towards a couple of things at a time, not all of them at once).
  // When that leaves Stamina unused (it twiddled its thumbs lately), everything.
  const open = game.upgrades.filter(
    (u) => !u.bought && u.requirementsMet() && !(u.def.unlocks && !SKILLS.includes(u.def.unlocks)),
  );
  const distance = (u: (typeof open)[number]) =>
    u.costs.reduce((sum, c) => sum + Math.max(0, c.amount - c.resource.amount) / Math.max(1, c.amount), 0);
  const finals = open.filter((u) => u.def.final);
  const others = open.filter((u) => !u.def.final).sort((a, b) => distance(a) - distance(b));
  if (has(game, TWIDDLE) && game.converter(TWIDDLE).state === 'ok') broadUntil.set(game, game.ticks + 600);
  const broad = (broadUntil.get(game) ?? 0) > game.ticks;
  const targets = [...finals, ...(broad ? others : others.slice(0, style.focus))];
  // Work that needs fires too far apart for one fire: build a second one.
  const ranges = candidates.map(heatLine).filter((h): h is Recipe => !!h);
  const conflict = ranges.some((a) => ranges.some((b) => a.atMost < b.atLeast));
  const second = open.find((u) => u.id === 'build_furnace');
  if (conflict && second && !targets.includes(second)) targets.push(second);

  // How much of each resource we would like to have.
  const want = new Map<Resource, number>();
  const raise = (r: Resource, amount: number) => {
    const v = Math.min(r.max, amount);
    if (v > (want.get(r) ?? 0)) want.set(r, v);
  };
  for (const u of targets) for (const c of u.costs) raise(c.resource, style.leaving ? c.resource.max : c.amount);
  /** What the upgrades need (food eaten from this would be missed). */
  const goal = new Map(want);
  // Staying productive: some of every food, clothes, soap, medicine and
  // bandages, and the nutrition / hygiene bars up.
  for (const [id, amount] of [
    ['grains', 50], ['vitamins', 50], ['protein', 50], ['hygiene', 60], ['clothes', 10],
    ['bread', 6], ['fruit', 8], ['soap', 2], ['catch', 2],
  ] as const) {
    raise(res(id), amount);
  }
  if (res('disease').amount > 5) raise(res('medicine'), 2);
  if (res('injury').amount > 5) raise(res('bandage'), 3);

  // Walk the supply chain backwards until nothing changes.
  const useful = new Set<Converter>();
  const heatNeeds: HeatNeed[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of candidates) {
      if (useful.has(c)) continue;
      // (Stamina outputs don't count: eating is decided by the nutrition bars.)
      const needed = c.makes.some((m) => {
        if (m.amount <= 0 || m.resource.id === 'stamina') return false;
        if (m.byproduct && !c.id.startsWith('eat_')) return false;
        // Something that fades and an upgrade needs: keep making it, or it's
        // gone by the time the rest is there (bread for the final upgrade).
        const keepsFading = m.resource.fadeRate > 0 && (goal.get(m.resource) ?? 0) > 0;
        if (!keepsFading && (want.get(m.resource) ?? 0) <= m.resource.amount + 1e-9) return false;
        // A running loop makes this by itself: the starter node isn't needed.
        const min = protect.get(m.resource);
        if (min !== undefined && !isLoopFor(c, m.resource) && m.resource.amount >= min) return false;
        return true;
      });
      const explores = c.makes.some((m) => m.amount > 0 && !seen.has(m.resource.id));
      if (!needed && !explores) continue;
      useful.add(c);
      changed = true;
      if (c.growth && c.growth.shape === 'linear') raise(c.growth.resource, Math.min(c.growthFullAt(), c.growth.resource.max));
      const h = heatLine(c);
      if (h) {
        // How badly its output is needed now.
        const w = Math.max(
          0.05,
          ...c.makes.map((m) => {
            const wanted = want.get(m.resource) ?? 0;
            return wanted > 0 ? Math.min(1, Math.max(0, (wanted - m.resource.amount) / wanted)) : 0;
          }),
        );
        // Work that has waited for its fire for long gets more important.
        const waited = (game.ticks - (lastWarm.get(c) ?? game.ticks)) / (60 * TICKS_PER_SECOND);
        heatNeeds.push({ lo: h.atLeast, hi: h.atMost, w: w * (1 + Math.min(3, waited / 5)) });
      }
      for (const n of c.needs) {
        if (n.kind !== 'consume' && n.kind !== 'catalyst') continue;
        if (n.resource.id === 'stamina') continue; // comes from sleeping
        const per = c.inAmount(n) || n.amount;
        raise(n.resource, Math.max(n.atLeast + per * 10, per * 20));
      }
    }
  }

  for (const c of candidates) {
    const h = heatLine(c);
    if (h && (h.heatOk() || !lastWarm.has(c))) lastWarm.set(c, game.ticks);
  }

  const on = new Set<Converter>(useful);
  const node = (id: string) => (has(game, id) ? game.converter(id) : null);

  // ---- fires: keep the house warm, and the temperatures the work needs
  const fps = fireplaces(game);
  if (fps.length) {
    const kept = fireTargets.get(game) ?? [];
    const temps = pickTemperatures(heatNeeds, fps.map((_, i) => kept[i] ?? null));
    fireTargets.set(game, temps);
    fps.forEach((fp, i) => {
      const t = temps[i];
      if (t === undefined) {
        on.delete(fp);
        return;
      }
      on.add(fp);
      if (game.has('thermostat')) {
        if (fp.target !== t) game.setTarget(fp.id, t);
      } else {
        game.setThrottle(fp.id, fuelFor(game, fp, t, micro));
      }
      raise(res('wood'), 30);
    });
    const start = node('start_fire');
    if (start) {
      if (res('fire').amount < 8) on.add(start);
      else on.delete(start);
    }
  }

  // ---- eating and washing: the eat nodes only eat when it helps, and never
  // the food an upgrade needs (unless the nutrition bar is running low)
  const eat = (id: string, food: string, bar: string) => {
    const c = node(id);
    if (!c) return;
    const spare = res(food).amount > (goal.get(res(food)) ?? 0) + 1;
    if (spare || res(bar).amount < 40) on.add(c);
    else on.delete(c);
  };
  eat('eat_fruit', 'fruit', 'vitamins');
  eat('eat_bread', 'bread', 'grains');
  eat('eat_fish', 'catch', 'protein');
  const fruit = res('fruit');
  const eatFruit = node('eat_fruit');
  if (eatFruit && micro && res('vitamins').amount > 70 && (want.get(fruit) ?? 0) > fruit.amount && !useful.has(eatFruit)) on.delete(eatFruit);
  const wash = node('wash');
  if (wash) {
    if (res('hygiene').amount < 70) on.add(wash);
    else on.delete(wash);
  }
  // ---- care: medicine and bandages are only used when they help (the nodes
  // wait for at least 10 Disease / 8 Injuries by themselves)
  for (const id of ['take_medicine', 'dress_wounds']) {
    const c = node(id);
    if (c) on.add(c);
  }
  const sew = node('sew_clothes');
  if (sew) {
    if (res('clothes').amount < 10) on.add(sew);
    else on.delete(sew);
  }

  // ---- the field: crops by what's needed; micro keeps the soil up with clover
  const field = node('field');
  if (field) {
    const wants = (id: string) => (want.get(res(id)) ?? 0) > res(id).amount;
    const crop = (id: string, user: string) => {
      const r = res(id);
      if (r.amount >= r.max - 5) return 0; // full: the rest would be lost
      const u = node(user);
      return (u && useful.has(u)) || wants(id) ? 1 : 0.15;
    };
    const part = (id: string) => field.parts.findIndex((p) => p.id === id);
    const weights = new Map<string, number>([
      ['wheat', crop('wheat', 'mill')],
      ['cotton', crop('cotton', 'loom')],
      // Fruit from the field instead of picking it by hand.
      ['orchard', wants('fruit') ? 0.6 : 0.05],
    ]);
    const hayNeeded = !!node('tame_sheep') || !!node('flock');
    // Try some clover once, to see what it's good for.
    let clover = (hayNeeded && res('hay').amount < 40) || !seen.has('hay') ? 0.25 : 0;
    if (micro) {
      const soil = res('soil').amount;
      const prev = field.shares[part('clover')] ?? 0;
      const step = soil < 75 ? 0.1 : soil < 85 ? 0.02 : soil > 95 ? -0.05 : 0;
      clover = Math.max(clover, Math.min(0.7, Math.max(0, prev + (game.ticks % 20 === 0 ? step : 0))));
    }
    const rest = 1 - clover;
    const total = [...weights.values()].reduce((a, b) => a + b, 0);
    const shares = field.parts.map((p) => (p.id === 'clover' ? (total > 0 ? clover : 1) : total > 0 ? (rest * (weights.get(p.id) ?? 0)) / total : 0));
    game.setShares(field.id, shares);
    if (useful.has(node('mill')!) || (node('loom') && useful.has(node('loom')!)) || hayNeeded || wants('fruit')) on.add(field);
    // The field makes the fruit now: no picking by hand unless it's not enough.
    const gather = node('gather_fruit');
    if (gather && field.shares[part('orchard')] > 0.1 && res('fruit').amount > 3) on.delete(gather);
  }

  // ---- the starter: feed it, but micro only as much as needed
  const feed = node('feed_starter');
  const wild = node('wild_fermentation');
  const starter = res('starter');
  const baking = node('baking');
  // (Baking only shows up once there's Starter: get some to find it.)
  const baker = !baking || useful.has(baking);
  if (feed) {
    if (baker && (!micro || style.leaving || starter.amount < 12)) on.add(feed);
    else on.delete(feed);
  }
  if (wild) {
    if (baker && starter.amount < 5) on.add(wild);
    else on.delete(wild);
  }

  // ---- the pond: micro keeps it half full
  const fish = res('fish');
  const fishing = node('fishing');
  if (fishing) {
    const hungry = res('protein').amount < 60 || res('catch').amount < 2;
    if (hungry && (!micro || fish.amount >= fish.max / 2)) on.add(fishing);
    else on.delete(fishing);
  }
  const fry = node('catch_fry');
  if (fry) {
    if (fish.amount < 2) on.add(fry);
    else on.delete(fry);
  }

  // ---- sheep: tame two, they breed by themselves
  const tame = node('tame_sheep');
  if (tame) {
    if (res('sheep').amount < 2) on.add(tame);
    else on.delete(tame);
  }

  // ---- ash: make soap from it before it stops the fires
  const soapMaker = node('soap_maker');
  if (soapMaker && res('ash').amount > res('ash').max * 0.7) on.add(soapMaker);

  // ---- the mine: pump while it's in use
  const mine = node('iron_mine');
  const pump = node('pump');
  if (pump && mine) {
    if (on.has(mine) || res('mine_water').amount > 15) on.add(pump);
    else on.delete(pump);
  }

  // ---- tools: sharpen in time
  for (const c of candidates) {
    if (c.wears && c.condition < style.sharpenBelow) game.sharpen(c.id);
  }

  // Micro: don't let a node eat into a loop's minimum stock.
  const safe = (c: Converter) =>
    c.needs.every((n) => {
      const min = protect.get(n.resource);
      if (min === undefined || n.amount <= 0 || isLoopFor(c, n.resource)) return true;
      return n.resource.amount - c.inAmount(n) >= min + 1;
    });

  for (const c of candidates) setRunning(c, on.has(c) && safe(c));
}

export const planner: Bot = {
  name: 'planner',
  description: 'Runs what the next upgrades need (and their supply chain), stays healthy, explores. No micromanagement.',
  act(game) {
    plan(game, { micro: false, focus: 3, sharpenBelow: 50 });
    twiddleIfIdle(game);
    sleepForDreams(game);
  },
};

/**
 * Insight comes from dreams: when the journal has nothing to write and Insight
 * is needed, go to sleep (twiddle away the Stamina, don't eat).
 */
function sleepForDreams(game: Game) {
  if (!has(game, 'journal') || !has(game, TWIDDLE) || game.asleep()) return;
  const insightWanted = game.upgrades.some((u) => !u.bought && u.requirementsMet() && u.costs.some((c) => c.resource.id === 'insight' && c.amount > c.resource.amount));
  if (!insightWanted || game.resource('fragment').amount >= 1 || game.resource('paper').amount < 0.5) return;
  setRunning(game.converter(TWIDDLE), true);
  for (const id of ['eat_bread', 'eat_fish']) if (has(game, id)) setRunning(game.converter(id), false);
}

export const micro: Bot = {
  name: 'micro',
  description: 'Planner that micromanages every tick: keeps loops alive, fires at the right heat, soil up, pond half full, starter just alive.',
  act(game) {
    plan(game, { micro: true, focus: 3, sharpenBelow: 40 });
    twiddleIfIdle(game);
    sleepForDreams(game);
  },
};

/** How long an occasional player stays when they check in: one minute of game time. */
const VISIT_SECONDS = 60;

/**
 * Occasional player: checks in every few minutes (game time) and then plays
 * like the micro bot for a minute (protects loops, sets fires, eats, buys...).
 * When leaving, it leaves on whatever fills up what the next upgrades need (not
 * just "enough for now"), and switches Twiddling thumbs on so it can't get
 * stuck awake.
 * Nothing changes between visits.
 */
export function visitor(minutes: number): Bot {
  const every = Math.max(1, Math.round(minutes * 60 * TICKS_PER_SECOND));
  const stay = VISIT_SECONDS * TICKS_PER_SECOND;
  return {
    name: `visit-${minutes}m`,
    description: `Checks in every ${minutes} minutes and plays like the micro bot for ${VISIT_SECONDS} s, Twiddling thumbs on when leaving.`,
    act(game) {
      const t = game.ticks % every;
      if (t >= stay) return;
      const leaving = t === stay - 1;
      plan(game, { micro: true, focus: 3, sharpenBelow: 70, leaving });
      twiddleIfIdle(game);
      sleepForDreams(game);
      if (leaving && has(game, TWIDDLE)) setRunning(game.converter(TWIDDLE), true);
    },
  };
}

export const BOTS: Record<string, Bot> = Object.fromEntries(
  [micro, planner, visitor(10), visitor(30), idle].map((b) => [b.name, b]),
);
