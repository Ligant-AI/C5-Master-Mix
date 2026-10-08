// Display rounding (C7-UN-04 to C7-UN-09; in C5, C5-UN-04 to C5-UN-06).
// Typed numbers are read by units.parseTyped, not here.
//
// Every displayed number is rounded ONCE, from the exact decimal expansion of
// its own unrounded double, half away from zero (C7-UN-06). The decimal layer
// is C3's (src/engine/decimal.js), copied whole so the two tools round
// identically.
import * as Dec from './decimal.js';

/** Round a double to n significant figures; returns the exact decimal kept. */
export function roundDec(x, n) {
  return Dec.roundSig(Dec.fromNumberExact(x), n);
}

/** Display string of a double at n significant figures. */
export function sig(x, n) {
  return Dec.toString(roundDec(x, n));
}

/** A fraction displayed as a percentage at 3 sf: rounded on the fraction, then shifted exactly. */
export function pct(f, n = 3) {
  if (f === 0) return '0';
  return Dec.toString(Dec.shift(roundDec(f, n), 2));
}

/** A signed percentage (for a departure), with an explicit sign. */
export function signedPct(f, n = 3) {
  const s = pct(f, n);
  return f > 0 ? `+${s}` : s;
}

/**
 * C7-FX-12: the distance from a value to the nearest decimal tie at n
 * significant figures, as an exact decimal string. The nearest tie to x is
 * always trunc_n(x) + half a step at x's own leading place.
 */
export function tieDistance(x, n) {
  const d = Dec.abs(Dec.fromNumberExact(x));
  if (Dec.isZero(d)) return '0';
  const digits = d.mant.toString();
  const drop = digits.length - n;
  const stepExp = d.exp + drop; // exponent of one unit in the n-th place
  const truncated = drop > 0 ? { neg: false, mant: BigInt(digits.slice(0, n)), exp: stepExp } : d;
  const tie = Dec.add(truncated, { neg: false, mant: 5n, exp: stepExp - 1 });
  return Dec.toString(Dec.trimZeros(Dec.abs(Dec.sub(d, tie))));
}

export { Dec };
