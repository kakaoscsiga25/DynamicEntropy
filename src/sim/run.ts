// Command line entry point:  npm run sim [-- --bot planner --hours 24 --all]
//   --bot NAME     which bot plays (planner, all-on). Default: every bot.
//   --hours N      maximum game time to simulate (default 24)
//   --stuck N      give up after N hours without any purchase/discovery (default 2)
//   --full         also print node / resource statistics

import { TICKS_PER_SECOND } from '../game/engine.ts';
import { BOTS } from './bots.ts';
import { simulate, type SimResult } from './simulate.ts';

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const hours = Number(arg('hours') ?? 24);
const stuckHours = Number(arg('stuck') ?? 2);
const full = args.includes('--full');
const botNames = arg('bot') ? [arg('bot')!] : Object.keys(BOTS);

function time(ticks: number): string {
  const s = Math.floor(ticks / TICKS_PER_SECOND);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const pct = (part: number, total: number) => `${total ? Math.round((part / total) * 100) : 0}%`.padStart(4);

function report(r: SimResult) {
  const out: string[] = [];
  out.push(`=== Bot "${r.bot.name}": ${r.bot.description}`);
  if (r.finishTick !== null) out.push(`FINISHED in ${time(r.finishTick)} game time.`);
  else if (r.stuck) out.push(`STUCK: no progress for a long time, gave up at ${time(r.ticks)}.`);
  else out.push(`NOT FINISHED after ${time(r.ticks)}.`);
  out.push(`Slept ${r.sleeps} times (one sleep per ${time(r.ticks / Math.max(1, r.sleeps))} on average).`);
  const bought = r.game.upgrades.filter((u) => u.bought).length;
  out.push(`Upgrades bought: ${bought} / ${r.game.upgrades.length}`);
  const final = r.game.upgrades.find((u) => u.def.final);
  if (final && !final.bought) {
    const costs = final.costs.map((c) => `${c.resource.name} ${Math.floor(c.resource.amount)}/${c.amount}`);
    out.push(`Final upgrade at the end: ${costs.join(', ')}`);
  }

  out.push('', 'Timeline:');
  for (const e of r.events) out.push(`  ${time(e.tick).padStart(8)}  ${e.text}`);

  if (full) {
    out.push('', 'Nodes (share of time since discovered):   run  wait  full   off   int   mostly waiting for');
    for (const n of r.nodes.values()) {
      const s = n.states;
      const total = s.ok + s.stopped + s.noInput + s.full + s.interrupted;
      const top = [...n.blockedBy.entries()].sort((a, b) => b[1] - a[1])[0];
      out.push(
        `  ${n.name.padEnd(38)} ${pct(s.ok, total)}  ${pct(s.noInput, total)}  ${pct(s.full, total)}  ${pct(s.stopped, total)}  ${pct(s.interrupted, total)}   ${top ? `${top[0]} (${pct(top[1], total).trim()})` : ''}`,
      );
    }
    out.push('', 'Resources:                 avg   full  empty');
    for (const s of r.resources.values()) {
      out.push(`  ${s.name.padEnd(22)} ${(s.sum / r.ticks).toFixed(1).padStart(6)}  ${pct(s.ticksFull, r.ticks)}  ${pct(s.ticksEmpty, r.ticks)}`);
    }
  }
  console.log(out.join('\n') + '\n');
}

for (const name of botNames) {
  const bot = BOTS[name];
  if (!bot) {
    console.error(`Unknown bot "${name}". Available: ${Object.keys(BOTS).join(', ')}`);
    process.exit(1);
  }
  const started = performance.now();
  const result = simulate(bot, { maxHours: hours, stuckHours });
  report(result);
  console.log(`(simulated in ${((performance.now() - started) / 1000).toFixed(1)}s)\n`);
}
