// Replays the reference runs recorded from the legacy Python game (tools/golden.py)
// and checks that the TypeScript engine produces exactly the same numbers.
import { describe, expect, test } from 'vitest';
import { Game, type ConverterState } from '../engine';
import golden from './golden.json';

/** ['start' | 'stop', converterIndex] | ['buy', upgradeName] | ['fill'] */
type Action = [string, (string | number)?];
interface Tick {
  actions: Action[];
  amounts?: number[];
  states?: number[];
}

const stateNames = golden.stateNames as ConverterState[];
const inf = (x: number | null) => (x === null ? Infinity : x);

describe('legacy parity', () => {
  test('same resources, converters and upgrades in the same order', () => {
    const game = new Game();
    expect(game.resources.map((r) => r.name)).toEqual(golden.resources);
    expect(game.converters.map((c) => c.def.name)).toEqual(golden.converters);
    expect(game.converters.flatMap((c) => c.upgrades.map((u) => u.name))).toEqual(golden.upgrades);
  });

  for (const run of golden.runs) {
    test(`run "${run.name}"`, () => {
      const game = new Game();
      const byName = new Map(game.upgrades.map((u) => [u.name, u.id]));
      if (run.initial === 'full') for (const r of game.resources) r.amount = r.max;

      (run.ticks as Tick[]).forEach((t, i) => {
        for (const [kind, arg] of t.actions) {
          if (kind === 'fill') for (const r of game.resources) r.amount = r.max;
          else if (kind === 'start') game.converters[Number(arg)].start();
          else if (kind === 'stop') game.converters[Number(arg)].stop();
          else expect(game.buy(byName.get(String(arg))!), `tick ${i}: buy ${arg}`).toBe(true);
        }
        game.tick();
        if (t.amounts) {
          expect(game.resources.map((r) => r.amount), `amounts after tick ${i}`).toEqual(t.amounts);
          expect(game.converters.map((c) => c.state), `states after tick ${i}`).toEqual(
            t.states!.map((s) => stateNames[s]),
          );
        }
      });

      expect(
        game.converters.map((c) => ({
          name: c.name,
          needs: c.needs.map((r) => [r.resource.name, r.amount, r.atLeast, r.atMost]),
          makes: c.makes.map((r) => [r.resource.name, r.amount, r.atLeast, r.atMost]),
        })),
      ).toEqual(
        run.final.converters.map((c) => ({
          name: c.name,
          needs: c.needs.map((r) => [r[0], r[1], r[2], inf(r[3] as number | null)]),
          makes: c.makes.map((r) => [r[0], r[1], r[2], inf(r[3] as number | null)]),
        })),
      );
      expect(game.upgrades.filter((u) => u.bought).map((u) => u.name).sort()).toEqual(
        [...run.final.bought].sort(),
      );
    });
  }
});
