// The comparison rule (C5-UN-10) and the exact scale factor (C5-UN-11).
// Pure: no DOM, no browser API, no state.
//
// Two quantities of the same dimension are equal when their canonical integers
// are equal. The canonical integer is the EXACT typed value (units.js keeps it
// as a decimal), normalised to the base unit and expressed at the stated
// resolution, rounded half away from zero, in BigInt arithmetic. No double is
// compared. This rule decides C5-FL-01, C5-FL-08, C5-FL-11 and whether a
// transfer basis is required under C5-CP-07.
//
// Resolutions (scope record, decision 3): volumes at 1 nL, cell numbers at
// 1 cell. No other dimension has a stated resolution, so no other dimension is
// compared here.
import * as Dec from './decimal.js';
import { KIND } from './units.js';

// shift: the base-unit value times 10^shift is the value in resolution units.
export const RESOLUTION = Object.freeze({
  [KIND.VOLUME]: Object.freeze({ statement: '1 nL', unit: 'nL', shift: 3 }), // base µL
  [KIND.CELLS]: Object.freeze({ statement: '1 cell', unit: 'cells', shift: 0 }), // base cells
});

/** An exact decimal rounded to an integer, half away from zero, as a BigInt. */
export function roundHalfAwayToInteger(d) {
  if (d.exp >= 0) {
    const n = d.mant * 10n ** BigInt(d.exp);
    return d.neg ? -n : n;
  }
  const div = 10n ** BigInt(-d.exp);
  let n = d.mant / div;
  if ((d.mant % div) * 2n >= div) n += 1n;
  return d.neg ? -n : n;
}

/**
 * The canonical integer of a volume or a cell number, at its resolution.
 * `q` is a quantity from units.quantity() or units.sumVolumes().
 */
export function canonical(q) {
  const r = RESOLUTION[q.kind];
  if (!r) throw new Error(`compare: C5-UN-10 states no resolution for a ${q.kind}`);
  if (!q.exact) throw new Error('compare: the quantity has no exact value');
  return roundHalfAwayToInteger(Dec.shift(q.exact, r.shift));
}

/**
 * The canonical integer of a COMPUTED value (a double, such as a sum of
 * per-test volumes), at the resolution of its kind: the exact binary value of
 * the double, rounded half away from zero.
 */
export function canonicalOfDouble(x, kind) {
  const r = RESOLUTION[kind];
  if (!r) throw new Error(`compare: C5-UN-10 states no resolution for a ${kind}`);
  if (!Number.isFinite(x)) throw new Error(`compare: ${x} is not finite`);
  return roundHalfAwayToInteger(Dec.shift(Dec.fromNumberExact(x), r.shift));
}

/** C5-UN-10: equal under the rule. Quantities of different kinds are not compared. */
export function equalUnderRule(a, b) {
  if (a.kind !== b.kind) throw new Error(`compare: a ${a.kind} is not compared with a ${b.kind}`);
  return canonical(a) === canonical(b);
}

/**
 * C5-UN-11: the preserve-concentration scale factor s_i = SV_assay ÷ SV_i. Where
 * the two volumes compare equal under C5-UN-10 it is the literal 1, not a
 * computed ratio: the user entered the same volume twice, and a ratio of two
 * doubles one ULP apart would be 0.999…9.
 */
export function scaleFactor(assayVolume, establishedVolume) {
  if (assayVolume.kind !== KIND.VOLUME || establishedVolume.kind !== KIND.VOLUME) {
    throw new Error('compare: a scale factor is between two volumes');
  }
  if (equalUnderRule(assayVolume, establishedVolume)) return Object.freeze({ value: 1, exactlyOne: true });
  return Object.freeze({ value: assayVolume.value / establishedVolume.value, exactlyOne: false });
}
