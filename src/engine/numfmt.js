// Display rounding and number parsing (C7-UN-04 to C7-UN-09).
//
// Every displayed number is rounded ONCE, from the exact decimal expansion of
// its own unrounded double, half away from zero (C7-UN-06). The decimal layer
// is C3's (src/engine/decimal.js), copied whole so the two tools round
// identically.
import * as Dec from './decimal.js';

/**
 * Parse an entered number. Accepts a plain decimal or scientific notation
 * ("1e6", for activity content), held EXACTLY as a decimal so that an entered
 * value is displayed and compared as entered (C7-IV-03, C7-FX-10).
 * Returns null for an empty field, { invalid: true, text } for text that is
 * not a number, else { text, value (double), dec (exact decimal) }.
 */
export function parseEntered(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { invalid: true, text: String(raw) };
    return { text: String(raw), value: raw, dec: Dec.fromNumberExact(raw) };
  }
  const text = String(raw).trim().replace(/,/g, '').replace(/−/g, '-');
  if (text === '') return null;
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) return { invalid: true, text };
  const base = Dec.fromString(`${m[1]}${m[2] || '0'}${m[3] !== undefined ? `.${m[3]}` : ''}`);
  const dec = m[4] ? Dec.shift(base, Number(m[4])) : base;
  const value = Number(text);
  // A well-formed positive number that overflows to infinity or underflows to
  // zero as a double is still that number: it is not representable, not "not a
  // number" and not zero (adversarial findings F-4; PROTOCOL convention 7). A
  // negative one keeps its sign and meets the ≤ 0 rejections as stated.
  if (value === Infinity || (value === 0 && Dec.sign(dec) > 0)) return { text, value, dec, unrepresentable: true };
  if (!Number.isFinite(value)) return { invalid: true, text };
  return { text, value, dec };
}

/** Round a double to n significant figures; returns the exact decimal kept. */
export function roundDec(x, n) {
  return Dec.roundSig(Dec.fromNumberExact(x), n);
}

/**
 * Directed rounding for a displayed bound (decision of 28 September 2026,
 * spec/decision-2026-09-28-directed-rounding.md): 'up' for an "at most" value,
 * 'down' for an "at least" value, at n significant figures, on the exact
 * decimal expansion of the double. Values are positive (a bound on a
 * concentration or a volume). Exactness is kept: a value already on the grid
 * is returned unchanged.
 */
export function roundDecDirected(x, n, dir) {
  if (!(x > 0)) throw new Error(`roundDecDirected: expects a positive value, got ${x}`);
  const d = Dec.fromNumberExact(x);
  const digits = d.mant.toString();
  if (digits.length <= n) return Dec.roundSig(d, n); // exact; pads to n figures
  const drop = digits.length - n;
  let kept = BigInt(digits.slice(0, n));
  let exp = d.exp + drop;
  const inexact = /[1-9]/.test(digits.slice(n));
  if (dir === 'up' && inexact) {
    kept += 1n;
    if (kept.toString().length > n) { kept /= 10n; exp += 1; } // 999… → 1000…
  } else if (dir !== 'up' && dir !== 'down') throw new Error(`roundDecDirected: direction ${dir}`);
  return { neg: false, mant: kept, exp };
}

export function sigDirected(x, n, dir) {
  return Dec.toString(roundDecDirected(x, n, dir));
}

/**
 * A signed fraction as a percentage at n sf, rounded toward +∞ ('up') on the
 * exact binary value — for a quantity that is an upper bound (the departure of
 * an "at most" concentration, T2). Positive values round away from zero,
 * negative ones toward it. An explicit '+' when positive.
 */
export function signedPctUp(f, n = 3) {
  if (f === 0) return '0';
  const mag = roundDecDirected(Math.abs(f), n, f > 0 ? 'up' : 'down');
  const s = Dec.toString(Dec.shift(mag, 2));
  return f > 0 ? `+${s}` : `-${s}`;
}

/** C7-FX-12 for a directed bound: the critical points are the grid points, not the ties. */
export function gridDistance(x, n) {
  const d = Dec.fromNumberExact(x);
  const down = roundDecDirected(x, n, 'down');
  const up = roundDecDirected(x, n, 'up');
  const a = Dec.abs(Dec.sub(d, down)); const b = Dec.abs(Dec.sub(up, d));
  return Dec.toString(Dec.trimZeros(Dec.cmp(a, b) <= 0 ? a : b));
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
