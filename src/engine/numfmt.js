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
