// Simple automated players for the simulator. They only use what a real player
// can do: start/stop discovered nodes and buy upgrades.

import { TICKS_PER_SECOND, type Converter, type Game, type Resource } from '../game/engine.ts';
import type { Bot } from './simulate.ts';

const TWIDDLE = 'twiddling_thumbs';

/** Buys the final upgrade when possible, otherwise any other affordable upgrade. */
function buyEverything(game: Game) {
  const final = game.upgrades.find((u) => u.def.final && u.isBuyable());
  if (final) {
    game.buy(final.id);
    return;
  }
  for (const u of game.upgrades) if (!u.def.final && u.isBuyable()) game.buy(u.id);
}

function setRunning(c: Converter, on: boolean) {
  if (on && c.stopped) c.start();
  else if (!on && !c.stopped) c.stop();
}

/** Burn leftover Stamina (to fall asleep) when nothing else is using it. */
function twiddleIfIdle(game: Game) {
  const twiddle = game.converters.find((c) => c.id === TWIDDLE);
  if (!twiddle || !game.discovered.has(twiddle.id)) return;
  const stamina = game.resource('stamina');
  const used = game.converters.some(
    (c) => c !== twiddle && c.state === 'ok' && c.needs.some((n) => n.resource === stamina && n.amount > 0),
  );
  setRunning(twiddle, !used && stamina.amount >= 1);
}

export const allOn: Bot = {
  name: 'all-on',
  description: 'Starts every discovered node, buys every upgrade as soon as possible.',
  act(game) {
    for (const c of game.converters) {
      if (game.discovered.has(c.id) && !c.unstoppable && c.id !== TWIDDLE) setRunning(c, true);
    }
    buyEverything(game);
  },
};

/**
 * Idle player: turns on every discovered node (Twiddling thumbs too, so it can't
 * get stuck awake) and leaves it like that; buys upgrades whenever possible.
 */
export const idle: Bot = {
  name: 'idle',
  description: 'Idle player: everything on (Twiddling thumbs too), buys upgrades as soon as possible.',
  act(game) {
    for (const c of game.converters) {
      if (game.discovered.has(c.id) && !c.unstoppable) setRunning(c, true);
    }
    buyEverything(game);
  },
};

/** Resources each game has had in stock at least once (what a player has "seen"). */
const seenResources = new WeakMap<Game, Set<string>>();

/**
 * Does this node keep itself going? It needs a minimum stock of something, uses
 * some of it and makes more of it than it uses (Forest: Plant ≥ 50, uses 1,
 * makes 2. Fireplace: Fire ≥ 25, uses 1, makes 3).
 */
function isLoopFor(c: Converter, r: Resource): boolean {
  const need = c.needs.find((n) => n.resource === r && n.atLeast > 0 && n.amount > 0);
  const make = c.makes.find((m) => m.resource === r);
  return !!need && !!make && make.amount > need.amount;
}

/**
 * Works backwards from the upgrades it can buy next: runs only the nodes whose
 * output is still needed (plus their supply chain), tries out nodes that make
 * something it has never seen (that's how new nodes get discovered), and
 * twiddles its thumbs to fall asleep when its Stamina is useless.
 *
 * With `micro`, it also protects self-sustaining loops: it never lets other
 * nodes take a resource below the minimum a loop needs (e.g. keeps Plant ≥ 50
 * so the Forest regrows), and uses the "starter" node (Garden) only to get the
 * loop going.
 */
function makePlanner(name: string, micro: boolean, description: string): Bot {
  return {
    name,
    description,
    act(game) {
      buyEverything(game);

      let seen = seenResources.get(game);
      if (!seen) seenResources.set(game, (seen = new Set()));
      for (const r of game.resources) if (r.amount > 0) seen.add(r.id);

      const candidates = game.converters.filter((c) => game.discovered.has(c.id) && !c.unstoppable && c.id !== TWIDDLE);

      // Stocks that keep loops alive (only cared about in micro mode). A loop that
      // grows with its stock (Forest) is kept at the level where it grows fastest.
      const protect = new Map<Resource, number>();
      if (micro) {
        for (const c of candidates) {
          for (const n of c.needs) {
            if (!isLoopFor(c, n.resource)) continue;
            const level = c.growth?.resource === n.resource ? Math.max(n.atLeast, c.growthFullAt()) : n.atLeast;
            // Leave room below the storage limit to actually harvest (e.g. Wood cutting takes 5 Plant).
            const biggestUse = Math.max(
              0,
              ...candidates.filter((o) => o !== c).flatMap((o) => o.needs.filter((m) => m.resource === n.resource).map((m) => m.amount)),
            );
            const room = n.resource.max - 2 * biggestUse - 1;
            protect.set(n.resource, Math.max(protect.get(n.resource) ?? 0, Math.max(n.atLeast, Math.min(level, room))));
          }
        }
      }

      // How much of each resource we would like to have.
      const want = new Map<Resource, number>();
      const raise = (r: Resource, amount: number) => {
        const v = Math.min(r.max, amount);
        if (v > (want.get(r) ?? 0)) want.set(r, v);
      };
      for (const u of game.upgrades) {
        if (u.bought || !u.requirementsMet()) continue;
        for (const c of u.costs) raise(c.resource, c.amount);
      }

      // Walk the supply chain backwards until nothing changes.
      const useful = new Set<Converter>();
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of candidates) {
          if (useful.has(c)) continue;
          // (Stamina outputs don't count: eating is decided separately below.)
          const needed = c.makes.some((m) => {
            if (m.byproduct || m.amount <= 0 || m.resource.id === 'stamina') return false;
            if ((want.get(m.resource) ?? 0) <= m.resource.amount + 1e-9) return false;
            // A running loop makes this by itself: the starter node isn't needed.
            const min = protect.get(m.resource);
            if (min !== undefined && !isLoopFor(c, m.resource) && m.resource.amount >= min) return false;
            return true;
          });
          const explores = c.makes.some((m) => m.amount > 0 && !seen.has(m.resource.id));
          if (!needed && !explores) continue;
          useful.add(c);
          changed = true;
          // Growing nodes work best with their growth stock at the cap.
          if (c.growth) raise(c.growth.resource, c.growthFullAt());
          for (const n of c.needs) {
            if (n.kind !== 'consume' && n.kind !== 'catalyst') continue;
            if (n.resource.id === 'stamina') continue; // comes from sleeping
            raise(n.resource, Math.max(n.atLeast + n.amount * 10, n.amount * 20));
          }
        }
      }

      // Eat (make Stamina from food) only from surplus: food an upgrade needs is kept.
      for (const c of candidates) {
        if (useful.has(c) || !c.makes.some((m) => m.resource.id === 'stamina')) continue;
        const surplus = c.needs
          .filter((n) => n.kind === 'consume')
          .every((n) => n.resource.amount > (want.get(n.resource) ?? 0) + n.amount);
        if (surplus) useful.add(c);
      }

      // Micro: don't let a node eat into a loop's minimum stock.
      const safe = (c: Converter) =>
        c.needs.every((n) => {
          const min = protect.get(n.resource);
          if (min === undefined || n.amount <= 0 || isLoopFor(c, n.resource)) return true;
          return n.resource.amount - n.amount >= min + 1;
        });

      for (const c of candidates) setRunning(c, useful.has(c) && safe(c));
      twiddleIfIdle(game);
    },
  };
}

export const planner = makePlanner(
  'planner',
  false,
  'Runs nodes needed for the next upgrades (and their supply chain), explores, sleeps when stuck. Does not protect loops.',
);

export const micro = makePlanner(
  'micro',
  true,
  'Like planner, but micromanages: keeps loops alive (Plant ≥ 50 for the Forest, Fire ≥ 25 for the Fireplace).',
);

/**
 * Occasional player: checks in every few minutes (game time), then sets up the
 * nodes like the planner (no micromanagement) and leaves Twiddling thumbs on so
 * it can't get stuck awake in between. Nothing changes between visits.
 */
export function visitor(minutes: number): Bot {
  const every = Math.max(1, Math.round(minutes * 60 * TICKS_PER_SECOND));
  return {
    name: `visit-${minutes}m`,
    description: `Checks in every ${minutes} minutes: sets nodes like the planner, Twiddling thumbs always on.`,
    act(game) {
      if (game.ticks % every !== 0) return;
      planner.act(game);
      const twiddle = game.converters.find((c) => c.id === TWIDDLE);
      if (twiddle && game.discovered.has(twiddle.id)) setRunning(twiddle, true);
    },
  };
}

export const BOTS: Record<string, Bot> = Object.fromEntries(
  [allOn, idle, visitor(30), visitor(10), planner, micro].map((b) => [b.name, b]),
);
