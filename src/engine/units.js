import * as Dec from './decimal.js';
export const DIMENSION = Object.freeze({
    VOLUME: 'volume',
    CELLS: 'cells',
    MASS: 'mass',
    MOLAR: 'molar amount',
    IU: 'activity in IU',
    U: 'activity in U',
});
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
    u('mg/mL', KIND.CONCENTRATION, DIMENSION.MASS, 0),
    u('µg/mL', KIND.CONCENTRATION, DIMENSION.MASS, -3),
    u('ng/mL', KIND.CONCENTRATION, DIMENSION.MASS, -6),
    u('g/L', KIND.CONCENTRATION, DIMENSION.MASS, 0),
    u('mg/L', KIND.CONCENTRATION, DIMENSION.MASS, -3),
    u('M', KIND.CONCENTRATION, DIMENSION.MOLAR, 6),
    u('mM', KIND.CONCENTRATION, DIMENSION.MOLAR, 3),
    u('µM', KIND.CONCENTRATION, DIMENSION.MOLAR, 0),
    u('nM', KIND.CONCENTRATION, DIMENSION.MOLAR, -3),
    u('pM', KIND.CONCENTRATION, DIMENSION.MOLAR, -6),
    u('IU/mL', KIND.CONCENTRATION, DIMENSION.IU, -3),
    u('U/mL', KIND.CONCENTRATION, DIMENSION.U, -3),
]);
const BY_SYMBOL = new Map(UNITS.map((x) => [x.symbol, x]));
export function unitInfo(symbol) {
    return BY_SYMBOL.get(symbol) || null;
}
export const unitsOfKind = (...kinds) => UNITS.filter((x) => kinds.includes(x.kind));
const EXPONENT_LIMIT = 400;
export function parseTyped(raw) {
    if (raw === null || raw === undefined)
        return null;
    const text = String(raw).trim();
    if (text === '')
        return null;
    if (text.includes(',')) {
        return { invalid: true, text, reason: 'contains a comma, which can be a decimal mark or a thousands separator, so it has no single reading. Use a point as the decimal mark and no thousands separator' };
    }
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.replace(/−/g, '-'));
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
        return { invalid: true, text, reason: 'is not a number' };
    }
    const exponent = m[4] === undefined ? 0 : Number(m[4]);
    const mantissa = Dec.fromString(`${m[1]}${m[2] || '0'}${m[3] !== undefined ? `.${m[3]}` : ''}`);
    if (Dec.isZero(mantissa))
        return { text, dec: Dec.fromString('0') };
    if (Math.abs(exponent) > EXPONENT_LIMIT) {
        return { text, dec: null, sign: Dec.sign(mantissa), unrepresentable: true };
    }
    return { text, dec: Dec.shift(mantissa, exponent) };
}
export function quantity(raw, symbol) {
    const p = parseTyped(raw);
    if (p === null)
        return { status: 'blank' };
    if (p.invalid)
        return { status: 'invalid', text: p.text, reason: p.reason };
    if (!symbol)
        return { status: 'no-unit', text: p.text };
    const unit = BY_SYMBOL.get(symbol);
    if (!unit)
        throw new Error(`units: unknown unit "${symbol}"`);
    const common = { status: 'ok', text: p.text, unit: unit.symbol, kind: unit.kind, dimension: unit.dimension, base: unit.base };
    if (p.unrepresentable)
        return { ...common, exact: null, value: NaN, sign: p.sign, unrepresentable: true };
    const exact = Dec.shift(p.dec, unit.exp10);
    const value = Number(Dec.toString(exact));
    const unrepresentable = !Number.isFinite(value) || (value === 0 && !Dec.isZero(exact));
    return { ...common, exact, value, sign: Dec.sign(exact), unrepresentable };
}
export function sumVolumes(a, b) {
    if (a.kind !== KIND.VOLUME || b.kind !== KIND.VOLUME)
        throw new Error('sumVolumes: both terms must be volumes');
    return Object.freeze({ status: 'ok', kind: KIND.VOLUME, dimension: DIMENSION.VOLUME, base: 'µL', derived: true, exact: Dec.add(a.exact, b.exact), value: a.value + b.value });
}
export function reduction(intendedUnit, stockUnit) {
    const q = BY_SYMBOL.get(intendedUnit);
    if (!q)
        throw new Error(`units: unknown unit "${intendedUnit}"`);
    if (q.kind === KIND.CELLS)
        throw new Error(`units: "${intendedUnit}" is not an intended-quantity unit`);
    if (q.kind === KIND.VOLUME)
        return { reducible: true, form: 'stock-volume' };
    if (!stockUnit)
        return { reducible: null, missing: 'stock concentration' };
    const s = BY_SYMBOL.get(stockUnit);
    if (!s)
        throw new Error(`units: unknown unit "${stockUnit}"`);
    if (s.kind !== KIND.CONCENTRATION)
        throw new Error(`units: "${stockUnit}" is not a stock concentration unit`);
    if (s.dimension === q.dimension) {
        return { reducible: true, form: q.kind === KIND.AMOUNT ? 'amount' : 'concentration' };
    }
    return { reducible: false, intended: q, stock: s };
}
const describe = (x) => (x.kind === KIND.CONCENTRATION ? `${x.dimension} per volume` : x.dimension);
function mismatchReason(q, s) {
    const dims = new Set([q.dimension, s.dimension]);
    if (dims.has(DIMENSION.IU) && dims.has(DIMENSION.U))
        return 'IU and U are different units of activity and are never converted into one another';
    if (dims.has(DIMENSION.MASS) && dims.has(DIMENSION.MOLAR))
        return 'converting between mass and molar amount needs a molecular weight, which is not supplied or inferred here';
    if ([...dims].some((d) => d === DIMENSION.IU || d === DIMENSION.U) && (dims.has(DIMENSION.MASS) || dims.has(DIMENSION.MOLAR))) {
        return 'converting between activity and mass or molar amount needs a specific activity, which is not supplied or inferred here';
    }
    return 'the two units are of different dimensions';
}
export function componentName(component) {
    const label = component.label && String(component.label).trim();
    return label ? `Component ${component.row}, "${label}"` : `Component ${component.row} (no label)`;
}
export function rejectionHI05(component, intendedUnit, stockUnit) {
    const r = reduction(intendedUnit, stockUnit);
    if (r.reducible !== false)
        throw new Error('rejectionHI05: the quantity is reducible');
    const q = r.intended;
    const s = r.stock;
    return Object.freeze({
        code: 'C5-HI-05',
        component: { row: component.row, label: component.label },
        units: [q.symbol, s.symbol],
        message: `${componentName(component)}: the intended quantity is in ${q.symbol} (${describe(q)}) and the stock concentration is in ${s.symbol} (${describe(s)}). It cannot be reduced to a volume of its stock: ${mismatchReason(q, s)}. Conversion between ${q.dimension} and ${s.dimension} is not performed here.`,
    });
}
export function stockVolumePerTest(intended, stock) {
    const r = reduction(intended.unit, stock ? stock.unit : null);
    if (r.form === 'stock-volume')
        return { value: intended.value, unit: 'µL', form: r.form };
    if (r.form === 'amount')
        return { value: intended.value / stock.value, unit: 'µL', form: r.form, carried: intended.base };
    throw new Error(`stockVolumePerTest: form ${r.form ?? 'not reducible'} is not reduced here`);
}
