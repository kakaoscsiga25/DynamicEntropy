// Number and time formatting for display.

/** Up to 2 decimals, no trailing zeros: 5 → "5", 0.1 → "0.1", 5.1 → "5.1". */
export function num(x: number): string {
  return String(Number(x.toFixed(2)));
}

/** Stock amounts: whole numbers, but keep one decimal for small fractional values. */
export function stock(x: number): string {
  if (Math.abs(x) < 10 && Math.abs(x - Math.round(x)) > 0.05) return x.toFixed(1);
  return String(Math.floor(x + 1e-9));
}

export function rate(perSecond: number): string {
  if (Math.abs(perSecond) < 0.005) return '';
  const sign = perSecond > 0 ? '+' : '−';
  return `${sign}${num(Math.abs(perSecond))}/s`;
}

export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
