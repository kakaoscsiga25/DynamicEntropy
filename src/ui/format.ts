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

/** Whole units, for stock lists where numbers must not change length all the time. */
export function whole(x: number): string {
  return String(Math.max(0, Math.floor(x + 1e-9)));
}

/** Always one decimal ("+1.2/s", "−15.0/s", "0.0/s"), so the decimal point stays in place. */
export function rate(perSecond: number): string {
  const a = Math.abs(perSecond);
  if (a < 0.05) return '0.0/s';
  const sign = perSecond > 0 ? '+' : '−';
  return `${sign}${a >= 100 ? a.toFixed(0) : a.toFixed(1)}/s`;
}

export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
