import type { Converter, Game } from '../game/engine';

/**
 * The temperature a fireplace settles at with its current fuel: the fire cools
 * by a share every second, so it settles where the heat it gets = what it loses.
 */
export function settleTemp(game: Game, c: Converter, fuel = c.throttle ?? 0): number {
  const fire = game.fireOf(c);
  if (!fire || fire.resource.fadeRate <= 0) return 0;
  const perSecond = (fire.amount * fuel) / c.cycleSeconds(1);
  return Math.min(fire.resource.max, perSecond / fire.resource.fadeRate);
}
