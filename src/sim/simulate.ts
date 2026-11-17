// Headless game simulator: lets a bot play the game as fast as possible and
// collects statistics (finish time, bottlenecks, idle nodes...) for balancing.

import { Game, TICKS_PER_SECOND, type ConverterState } from '../game/engine.ts';

export interface Bot {
  name: string;
  description: string;
  /** Called before every tick; may start/stop converters and buy upgrades. */
  act(game: Game): void;
}

export interface SimOptions {
  /** Stop after this much game time. */
  maxHours: number;
  /** Give up when nothing was bought or discovered for this long. */
  stuckHours?: number;
  /** Start from a prepared game (default: a fresh one). */
  game?: Game;
}

export interface NodeStats {
  name: string;
  /** Ticks spent in each state, counted from discovery on. */
  states: Record<ConverterState, number>;
  /** Ticks this node waited for each resource. */
  blockedBy: Map<string, number>;
}

export interface ResourceStats {
  name: string;
  ticksFull: number;
  ticksEmpty: number;
  sum: number;
}

export interface SimResult {
  bot: Bot;
  ticks: number;
  finishTick: number | null;
  stuck: boolean;
  events: { tick: number; text: string }[];
  nodes: Map<string, NodeStats>;
  resources: Map<string, ResourceStats>;
  sleeps: number;
  game: Game;
}

export function simulate(bot: Bot, opts: SimOptions): SimResult {
  const game = opts.game ?? new Game();
  const hoursToTicks = (h: number) => Math.round(h * 3600 * TICKS_PER_SECOND);
  const maxTicks = hoursToTicks(opts.maxHours);
  const stuckTicks = hoursToTicks(opts.stuckHours ?? 2);
  const final = game.upgrades.find((u) => u.def.final);
  const wakeUp = game.converters.find((c) => c.id === 'wake_up');

  const events: SimResult['events'] = [];
  const nodes = new Map<string, NodeStats>();
  const resources = new Map<string, ResourceStats>(
    game.resources.map((r) => [r.id, { name: r.name, ticksFull: 0, ticksEmpty: 0, sum: 0 }]),
  );
  for (const id of game.discovered) events.push({ tick: 0, text: `discovered ${game.converter(id).name}` });

  let lastProgress = 0;
  let finishTick: number | null = null;
  let stuck = false;
  let sleeps = 0;
  let t = 0;

  for (; t < maxTicks; t++) {
    const bought = game.boughtOrder.length;
    bot.act(game);
    for (const id of game.boughtOrder.slice(bought)) {
      events.push({ tick: t, text: `bought ${game.upgrade(id).name}` });
      lastProgress = t;
    }

    for (const id of game.tick()) {
      events.push({ tick: t, text: `discovered ${game.converter(id).name}` });
      lastProgress = t;
    }

    if (wakeUp?.state === 'ok') sleeps++;
    for (const c of game.converters) {
      if (!game.discovered.has(c.id)) continue;
      let s = nodes.get(c.id);
      if (!s) {
        s = { name: c.name, states: { ok: 0, stopped: 0, noInput: 0, full: 0 }, blockedBy: new Map() };
        nodes.set(c.id, s);
      }
      s.name = c.name;
      s.states[c.state]++;
      if (c.state === 'noInput') {
        for (const r of c.blockingNeeds()) s.blockedBy.set(r.resource.name, (s.blockedBy.get(r.resource.name) ?? 0) + 1);
      }
    }
    for (const r of game.resources) {
      const s = resources.get(r.id)!;
      s.sum += r.amount;
      if (r.amount >= r.max - 1e-9) s.ticksFull++;
      if (r.amount <= 1e-9) s.ticksEmpty++;
    }

    if (final?.bought) {
      finishTick = t + 1;
      break;
    }
    if (t - lastProgress > stuckTicks) {
      stuck = true;
      break;
    }
  }

  return { bot, ticks: Math.min(t + 1, maxTicks), finishTick, stuck, events, nodes, resources, sleeps, game };
}
