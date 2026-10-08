// Units, dimensions and the reading of typed numbers (C5-UN-01 to C5-UN-03,
// C5-CP-01, C5-CP-09, C5-HI-05). Pure: no DOM, no browser API, no state.
//
// Every number arrives as the string the user typed and an explicitly selected
// unit (C5-UN-01). The string is read EXACTLY, as a decimal, and kept: the
// comparison rule (compare.js, C5-UN-10) works on it, not on a double.
//
// Every unit factor in this table is a power of ten. Normalising to the base
// unit is therefore an exact decimal shift of the typed value, followed by ONE
// rounding to the nearest double. The double used for computation is the
// correctly rounded value of exactly what was typed, in the base unit
// (C5-UN-03). "1.000001" × 10⁶ cells is 1000001 cells exactly, where
// 1.000001 × 1e6 in double arithmetic is 1000000.9999999999; "0.00003" mL is
// 0.03 µL, where 0.00003 × 1000 is 0.030000000000000002.
//
// Dimensions (C5-CP-09): mass, molar amount, activity in IU and activity in U
// are separate, and none is converted into another. No specific activity,
// molecular weight or density is ever supplied or inferred. Volume and cell
// number are their own dimensions.
//
// Base units, chosen so that an amount divided by a concentration is a stock
// volume in µL with no further factor:
//   volume µL; cells; mass µg; molar pmol; activity IU or U;
//   mass concentration µg/µL; molar concentration pmol/µL;
//   activity concentration IU/µL or U/µL.
import * as Dec from './decimal.js';

export const DIMENSION = Object.freeze({
  VOLUME: 'volume',
  CELLS: 'cells',
  MASS: 'mass',
  MOLAR: 'molar amount',
  IU: 'activity in IU',
  U: 'activity in U',
});

// What a unit measures: an amount of a substance, a concentration of one, a
// volume, or a cell number.
export const KIND = Object.freeze({
  AMOUNT: 'amount',
  CONCENTRATION: 'concentration',
  VOLUME: 'volume',
  CELLS: 'cells',
});

const BASE = Object.freeze({
  [KIND.VOLUME]: { [DIMENSION.VOLUME]: 'µL' },
  [KIND.CELLS]: { [DIMENSION.CELLS]: 'cells' },
  [KIND.AMOUNT]: { [DIMENSION.MASS]: 'µg', [DIMENSION.MOLAR]: 'pmol', [DIMENSION.IU]: 'IU', [DIMENSION.U]: 'U' },
  [KIND.CONCENTRATION]: { [DIMENSION.MASS]: 'µg/µL', [DIMENSION.MOLAR]: 'pmol/µL', [DIMENSION.IU]: 'IU/µL', [DIMENSION.U]: 'U/µL' },
});

// exp10: the typed value times 10^exp10 is the value in the base unit.
const u = (symbol, kind, dimension, exp10) => Object.freeze({ symbol, kind, dimension, exp10, base: BASE[kind][dimension] });

export const UNITS = Object.freeze([
  u('µL', KIND.VOLUME, DIMENSION.VOLUME, 0),
  u('mL', KIND.VOLUME, DIMENSION.VOLUME, 3),

  u('cells', KIND.CELLS, DIMENSION.CELLS, 0),
  u('× 10⁶ cells', KIND.CELLS, DIMENSION.CELLS, 6),

  u('ng', KIND.AMOUNT, DIMENSION.MASS, -3),
  u('µg', KIND.AMOUNT, DIMENSION.MASS, 0),
  u('mg', KIND.AMOUNT, DIMENSION.MASS, 3),
  u('pmol', KIND.AMOUNT, DIMENSION.MOLAR, 0),
  u('nmol', KIND.AMOUNT, DIMENSION.MOLAR, 3),
  u('µmol', KIND.AMOUNT, DIMENSION.MOLAR, 6),
  u('IU', KIND.AMOUNT, DIMENSION.IU, 0),
  u('U', KIND.AMOUNT, DIMENSION.U, 0),

  // Mass concentration. mg/mL = µg/µL = g/L.
  u('mg/mL', KIND.CONCENTRATION, DIMENSION.MASS, 0),
  u('µg/mL', KIND.CONCENTRATION, DIMENSION.MASS, -3),
  u('ng/mL', KIND.CONCENTRATION, DIMENSION.MASS, -6),
  u('g/L', KIND.CONCENTRATION, DIMENSION.MASS, 0),
  u('mg/L', KIND.CONCENTRATION, DIMENSION.MASS, -3),
  // Molar concentration. 1 M = 10^12 pmol per 10^6 µL = 10^6 pmol/µL.
  u('M', KIND.CONCENTRATION, DIMENSION.MOLAR, 6),
  u('mM', KIND.CONCENTRATION, DIMENSION.MOLAR, 3),
  u('µM', KIND.CONCENTRATION, DIMENSION.MOLAR, 0),
  u('nM', KIND.CONCENTRATION, DIMENSION.MOLAR, -3),
  u('pM', KIND.CONCENTRATION, DIMENSION.MOLAR, -6),
  // Activity concentration.
  u('IU/mL', KIND.CONCENTRATION, DIMENSION.IU, -3),
  u('U/mL', KIND.CONCENTRATION, DIMENSION.U, -3),
]);

const BY_SYMBOL = new Map(UNITS.map((x) => [x.symbol, x]));

export function unitInfo(symbol) {
  return BY_SYMBOL.get(symbol) || null;
}

export const unitsOfKind = (...kinds) => UNITS.filter((x) => kinds.includes(x.kind));

// Beyond this decimal exponent a typed number is outside the double range in
// any unit here (the largest factor is 10^6), so it is not representable; the
// exponent is not expanded, which would cost memory for no information.
const EXPONENT_LIMIT = 400;

/**
 * Read a typed number exactly. Returns:
 *   null                                   the field is blank
 *   { invalid: true, text, reason }        not a number, stated why
 *   { text, dec, unrepresentable? }        dec is the exact decimal typed
 * Accepts a plain decimal or scientific notation ("1e6", "2.5E-3"), a leading
 * sign, and the Unicode minus. A comma is refused, not stripped: it can be a
 * decimal mark or a thousands separator, so "0,5" has no single reading, and
 * stripping it would read it as 5.
 */
export function parseTyped(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === '') return null;
  if (text.includes(',')) {
    return { invalid: true, text, reason: 'contains a comma, which can be a decimal mark or a thousands separator, so it has no single reading. Use a point as the decimal mark and no thousands separator' };
  }
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.replace(/−/g, '-'));
  if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
    return { invalid: true, text, reason: 'is not a number' };
  }
  const exponent = m[4] === undefined ? 0 : Number(m[4]);
  const mantissa = Dec.fromString(`${m[1]}${m[2] || '0'}${m[3] !== undefined ? `.${m[3]}` : ''}`);
  // Zero is zero at any exponent ("0e999999"); keep it small.
  if (Dec.isZero(mantissa)) return { text, dec: Dec.fromString('0') };
  if (Math.abs(exponent) > EXPONENT_LIMIT) {
    return { text, dec: null, sign: Dec.sign(mantissa), unrepresentable: true };
  }
  return { text, dec: Dec.shift(mantissa, exponent) };
}

/**
 * A typed number with its selected unit, read and normalised.
 *   { status: 'blank' }
 *   { status: 'invalid', text, reason }
 *   { status: 'no-unit', text }            a number with no unit selected (C5-UN-01)
 *   { status: 'ok', text, unit, kind, dimension, base, exact, value, sign, unrepresentable }
 * `exact` is the typed value in the base unit as an exact decimal; `value` is
 * the nearest double to it; `sign` (-1, 0 or 1) is the sign of what was typed,
 * exactly, so that "1e-400" is positive though its double is 0.
 * `unrepresentable` marks a typed number that is finite and nonzero but
 * outside the range of a double in the base unit.
 */
export function quantity(raw, symbol) {
  const p = parseTyped(raw);
  if (p === null) return { status: 'blank' };
  if (p.invalid) return { status: 'invalid', text: p.text, reason: p.reason };
  if (!symbol) return { status: 'no-unit', text: p.text };
  const unit = BY_SYMBOL.get(symbol);
  // Units come from a fixed list, never from typing, so an unknown one is a
  // defect in the page, not an input to report.
  if (!unit) throw new Error(`units: unknown unit "${symbol}"`);
  const common = { status: 'ok', text: p.text, unit: unit.symbol, kind: unit.kind, dimension: unit.dimension, base: unit.base };
  if (p.unrepresentable) return { ...common, exact: null, value: NaN, sign: p.sign, unrepresentable: true };
  const exact = Dec.shift(p.dec, unit.exp10);
  const value = Number(Dec.toString(exact));
  const unrepresentable = !Number.isFinite(value) || (value === 0 && !Dec.isZero(exact));
  return { ...common, exact, value, sign: Dec.sign(exact), unrepresentable };
}

/**
 * The assay staining volume, SV_assay = D + R (C5-SV-03). The double is the
 * IEEE sum of the two doubles, as every other computed value is; the exact
 * decimal is the exact sum of what was typed, for the comparison rule.
 */
export function sumVolumes(a, b) {
  if (a.kind !== KIND.VOLUME || b.kind !== KIND.VOLUME) throw new Error('sumVolumes: both terms must be volumes');
  return Object.freeze({ status: 'ok', kind: KIND.VOLUME, dimension: DIMENSION.VOLUME, base: 'µL', derived: true, exact: Dec.add(a.exact, b.exact), value: a.value + b.value });
}

/**
 * C5-CP-01 and C5-CP-09: how an intended quantity in `intendedUnit` reduces to
 * a volume of a stock in `stockUnit` (or null where none is entered).
 *   { reducible: true, form: 'stock-volume' }   a volume of stock per test; no
 *                                               stock concentration is needed
 *   { reducible: true, form: 'amount' }         an amount per test against a
 *                                               concentration of the same dimension
 *   { reducible: true, form: 'concentration' }  a concentration against a
 *                                               concentration of the same dimension
 *   { reducible: null, missing: 'stock concentration' }  required and not entered
 *   { reducible: false, intended, stock }       a dimension mismatch: C5-HI-05
 */
export function reduction(intendedUnit, stockUnit) {
  const q = BY_SYMBOL.get(intendedUnit);
  if (!q) throw new Error(`units: unknown unit "${intendedUnit}"`);
  // The intended quantity is offered only in amount, concentration and volume
  // units, and the stock only in concentration units: anything else is a
  // defect in the page, like an unknown unit, not an input to report.
  if (q.kind === KIND.CELLS) throw new Error(`units: "${intendedUnit}" is not an intended-quantity unit`);
  if (q.kind === KIND.VOLUME) return { reducible: true, form: 'stock-volume' };
  if (!stockUnit) return { reducible: null, missing: 'stock concentration' };
  const s = BY_SYMBOL.get(stockUnit);
  if (!s) throw new Error(`units: unknown unit "${stockUnit}"`);
  if (s.kind !== KIND.CONCENTRATION) throw new Error(`units: "${stockUnit}" is not a stock concentration unit`);
  if (s.dimension === q.dimension) {
    return { reducible: true, form: q.kind === KIND.AMOUNT ? 'amount' : 'concentration' };
  }
  return { reducible: false, intended: q, stock: s };
}

const describe = (x) => (x.kind === KIND.CONCENTRATION ? `${x.dimension} per volume` : x.dimension);

// Why a pair of dimensions cannot be reduced here, stated for the pair.
function mismatchReason(q, s) {
  const dims = new Set([q.dimension, s.dimension]);
  if (dims.has(DIMENSION.IU) && dims.has(DIMENSION.U)) return 'IU and U are different units of activity and are never converted into one another';
  if (dims.has(DIMENSION.MASS) && dims.has(DIMENSION.MOLAR)) return 'converting between mass and molar amount needs a molecular weight, which is not supplied or inferred here';
  if ([...dims].some((d) => d === DIMENSION.IU || d === DIMENSION.U) && (dims.has(DIMENSION.MASS) || dims.has(DIMENSION.MOLAR))) {
    return 'converting between activity and mass or molar amount needs a specific activity, which is not supplied or inferred here';
  }
  return 'the two units are of different dimensions';
}

/** A component as messages name it: its row, and its label if it has one. */
export function componentName(component) {
  const label = component.label && String(component.label).trim();
  return label ? `Component ${component.row}, "${label}"` : `Component ${component.row} (no label)`;
}

/**
 * The C5-HI-05 rejection for a component whose intended quantity cannot be
 * reduced to a volume of its stock: the component, both units, and that
 * conversion between those dimensions is not performed here.
 */
export function rejectionHI05(component, intendedUnit, stockUnit) {
  const r = reduction(intendedUnit, stockUnit);
  if (r.reducible !== false) throw new Error('rejectionHI05: the quantity is reducible');
  const q = r.intended;
  const s = r.stock;
  return Object.freeze({
    code: 'C5-HI-05',
    component: { row: component.row, label: component.label },
    units: [q.symbol, s.symbol],
    message: `${componentName(component)}: the intended quantity is in ${q.symbol} (${describe(q)}) and the stock concentration is in ${s.symbol} (${describe(s)}). It cannot be reduced to a volume of its stock: ${mismatchReason(q, s)}. Conversion between ${q.dimension} and ${s.dimension} is not performed here.`,
  });
}

/**
 * A component's stock volume per test, a_i in µL, for the two forms that need
 * no staining volume: an amount per test against a stock concentration of the
 * same dimension (a = amount ÷ concentration, the unit carried), or a stock
 * volume per test (a = the volume). The concentration form needs the staining
 * volume it was established at and is reduced in determine.js.
 */
export function stockVolumePerTest(intended, stock) {
  const r = reduction(intended.unit, stock ? stock.unit : null);
  if (r.form === 'stock-volume') return { value: intended.value, unit: 'µL', form: r.form };
  if (r.form === 'amount') return { value: intended.value / stock.value, unit: 'µL', form: r.form, carried: intended.base };
  throw new Error(`stockVolumePerTest: form ${r.form ?? 'not reducible'} is not reduced here`);
}
