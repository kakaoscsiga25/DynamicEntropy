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

/** Countdown as m:ss (or h:mm:ss): fixed length, unlike "45s" → "1m 05s". */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s >= 100 * 3600) return '99h+';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function clock(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
