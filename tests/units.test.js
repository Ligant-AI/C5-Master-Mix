// Task 4: units, dimensions and the reading of typed numbers
// (C5-UN-01 to C5-UN-03, C5-CP-01, C5-CP-09, C5-HI-05, C5-FX-27).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Dec from '../src/engine/decimal.js';
import { UNITS, DIMENSION, KIND, unitInfo, parseTyped, quantity, sumVolumes, reduction, rejectionHI05, stockVolumePerTest } from '../src/engine/units.js';

test('every unit has one kind, one dimension and a power-of-ten factor; symbols are unique', () => {
  const symbols = UNITS.map((x) => x.symbol);
  assert.equal(new Set(symbols).size, symbols.length);
  for (const x of UNITS) {
    assert.ok(Object.values(KIND).includes(x.kind), x.symbol);
    assert.ok(Object.values(DIMENSION).includes(x.dimension), x.symbol);
    assert.ok(Number.isInteger(x.exp10), x.symbol);
    assert.ok(x.base, x.symbol);
  }
});

test('the unit families, by base unit', () => {
  const expect = {
    'µL': ['volume', 'µL', 0], 'mL': ['volume', 'µL', 3],
    'cells': ['cells', 'cells', 0], '× 10⁶ cells': ['cells', 'cells', 6],
    'ng': ['amount', 'µg', -3], 'µg': ['amount', 'µg', 0], 'mg': ['amount', 'µg', 3],
    'pmol': ['amount', 'pmol', 0], 'nmol': ['amount', 'pmol', 3], 'µmol': ['amount', 'pmol', 6],
    'IU': ['amount', 'IU', 0], 'U': ['amount', 'U', 0],
    'mg/mL': ['concentration', 'µg/µL', 0], 'µg/mL': ['concentration', 'µg/µL', -3], 'ng/mL': ['concentration', 'µg/µL', -6],
    'g/L': ['concentration', 'µg/µL', 0], 'mg/L': ['concentration', 'µg/µL', -3],
    'M': ['concentration', 'pmol/µL', 6], 'mM': ['concentration', 'pmol/µL', 3], 'µM': ['concentration', 'pmol/µL', 0],
    'nM': ['concentration', 'pmol/µL', -3], 'pM': ['concentration', 'pmol/µL', -6],
    'IU/mL': ['concentration', 'IU/µL', -3], 'U/mL': ['concentration', 'U/µL', -3],
  };
  assert.deepEqual(new Set(UNITS.map((x) => x.symbol)), new Set(Object.keys(expect)));
  for (const [s, [kind, base, exp10]] of Object.entries(expect)) {
    const x = unitInfo(s);
    assert.deepEqual([x.kind, x.base, x.exp10], [kind, base, exp10], s);
  }
});

test('IU and U are separate dimensions, as are mass and molar amount', () => {
  assert.notEqual(unitInfo('IU').dimension, unitInfo('U').dimension);
  assert.notEqual(unitInfo('IU/mL').dimension, unitInfo('U/mL').dimension);
  assert.notEqual(unitInfo('µg').dimension, unitInfo('pmol').dimension);
});

test('parseTyped: reads the typed string exactly, and keeps it', () => {
  const ok = (s, exact) => {
    const p = parseTyped(s);
    assert.ok(!p.invalid, `${s} read as invalid`);
    assert.equal(Dec.toString(Dec.trimZeros(p.dec)), exact, s);
    assert.equal(p.text, String(s).trim());
  };
  ok('100', '100');
  ok(' 0.1 ', '0.1');
  ok('.5', '0.5');
  ok('5.', '5');
  ok('+2', '2');
  ok('−0.25', '-0.25'); // Unicode minus
  ok('1e6', '1000000');
  ok('2.5E-3', '0.0025');
  ok('0.000000000000000000001', '0.000000000000000000001');
  ok('100.000000000000000000001', '100.000000000000000000001'); // beyond a double's precision, kept exactly
  ok('0e999999', '0');
});

test('parseTyped: blank is blank, and what is not a number is refused with its reason', () => {
  assert.equal(parseTyped(''), null);
  assert.equal(parseTyped('   '), null);
  assert.equal(parseTyped(null), null);
  for (const s of ['abc', '1 000', '0x10', 'Infinity', 'NaN', '1e', 'e5', '--1', '1.2.3', '½', '.', '-']) {
    const p = parseTyped(s);
    assert.ok(p && p.invalid, `${s} accepted`);
    assert.match(p.reason, /not a number/, s);
  }
});

test('parseTyped: a comma is refused, not stripped ("0,5" is not read as 5)', () => {
  for (const s of ['0,5', '1,000', '1,000.5']) {
    const p = parseTyped(s);
    assert.ok(p.invalid, s);
    assert.match(p.reason, /comma/);
    assert.match(p.reason, /decimal mark or a thousands separator/);
  }
});

test('quantity: blank, invalid, no unit, ok', () => {
  assert.deepEqual(quantity('', 'µL'), { status: 'blank' });
  assert.equal(quantity('x', 'µL').status, 'invalid');
  assert.deepEqual(quantity('5', ''), { status: 'no-unit', text: '5' });
  assert.throws(() => quantity('5', 'furlong'), /unknown unit/);
  const q = quantity('0.1', 'mL');
  assert.equal(q.status, 'ok');
  assert.equal(q.text, '0.1');
  assert.equal(q.unit, 'mL');
  assert.equal(q.base, 'µL');
  assert.equal(Dec.toString(Dec.trimZeros(q.exact)), '100');
  assert.equal(q.value, 100);
});

test('C5-UN-03: normalisation is one rounding of the exact typed value', () => {
  // The double is the nearest double to the typed value in the base unit,
  // checked against JavaScript's own correctly rounded string conversion.
  const cases = [['0.00003', 'mL', '0.03'], ['0.07', 'mL', '70'], ['0.1', 'mL', '100'], ['1.1', 'mL', '1100'], ['0.3', 'µg/mL', '0.0003'],
    ['1.000001', '× 10⁶ cells', '1000001'], ['2.675', 'ng', '0.002675'], ['3', 'pM', '0.000003'], ['0.123456789', 'M', '123456.789']];
  for (const [t, unit, inBase] of cases) {
    const q = quantity(t, unit);
    assert.equal(q.value, Number(inBase), `${t} ${unit}`);
    assert.equal(Dec.toString(Dec.trimZeros(q.exact)), inBase);
  }
  // Where a double multiplication would not be: these are the cases that matter.
  assert.notEqual(0.00003 * 1000, 0.03);
  assert.equal(quantity('0.00003', 'mL').value, 0.03);
  assert.notEqual(1.000001 * 1e6, 1000001);
  assert.equal(quantity('1.000001', '× 10⁶ cells').value, 1000001);
});

test('quantity: finite but beyond the range of a double is marked, not made infinite or zero', () => {
  assert.equal(quantity('1e400', 'µL').unrepresentable, true);
  assert.equal(quantity('1e-400', 'µL').unrepresentable, true);
  assert.equal(quantity('1e307', 'mL').unrepresentable, true); // 1e310 µL
  assert.equal(quantity('1e-320', 'µL').unrepresentable, false); // subnormal, nonzero: representable
  assert.equal(quantity('0', 'µL').unrepresentable, false);
  assert.equal(quantity('0', 'µL').value, 0);
});

test('C5-SV-03: the assay staining volume is the exact sum for comparison and the IEEE sum for computation', () => {
  const sv = sumVolumes(quantity('50', 'µL'), quantity('0.05', 'mL'));
  assert.equal(Dec.toString(Dec.trimZeros(sv.exact)), '100');
  assert.equal(sv.value, 100);
  assert.equal(sv.kind, KIND.VOLUME);
  assert.throws(() => sumVolumes(quantity('50', 'µL'), quantity('5', 'cells')), /volumes/);
});

test('C5-CP-01 and C5-CP-09: every intended-quantity unit against every stock unit', () => {
  const amounts = UNITS.filter((x) => x.kind === KIND.AMOUNT);
  const concs = UNITS.filter((x) => x.kind === KIND.CONCENTRATION);
  for (const q of [...amounts, ...concs]) {
    for (const s of concs) {
      const r = reduction(q.symbol, s.symbol);
      const same = s.dimension === q.dimension;
      assert.equal(r.reducible, same, `${q.symbol} against ${s.symbol}`);
      if (same) assert.equal(r.form, q.kind === KIND.AMOUNT ? 'amount' : 'concentration');
    }
    // A stock unit that is not a concentration is not offered by the page.
    for (const s of UNITS.filter((x) => x.kind !== KIND.CONCENTRATION)) {
      assert.throws(() => reduction(q.symbol, s.symbol), /not a stock concentration unit/, `${q.symbol} against ${s.symbol}`);
    }
    assert.deepEqual(reduction(q.symbol, null), { reducible: null, missing: 'stock concentration' });
  }
  // A stock volume per test needs no stock concentration (C5-CP-01).
  for (const v of ['µL', 'mL']) {
    assert.deepEqual(reduction(v, null), { reducible: true, form: 'stock-volume' });
    assert.deepEqual(reduction(v, 'mg/mL'), { reducible: true, form: 'stock-volume' });
  }
  // A cell number is never an intended quantity; the page does not offer it.
  assert.throws(() => reduction('cells', 'mg/mL'), /not an intended-quantity unit/);
});

test('C5-FX-27: IU against IU/mL is accepted and reduced to a volume, the unit carried', () => {
  assert.deepEqual(reduction('IU', 'IU/mL'), { reducible: true, form: 'amount' });
  const a = stockVolumePerTest(quantity('10', 'IU'), quantity('100', 'IU/mL'));
  assert.deepEqual(a, { value: 100, unit: 'µL', form: 'amount', carried: 'IU' });
});

test('C5-FX-27: IU against U/mL is rejected per C5-HI-05, naming both units', () => {
  const r = rejectionHI05('IL-2', 'IU', 'U/mL');
  assert.equal(r.code, 'C5-HI-05');
  assert.equal(r.component, 'IL-2');
  assert.deepEqual(r.units, ['IU', 'U/mL']);
  assert.match(r.message, /"IL-2"/);
  assert.match(r.message, /in IU \(activity in IU\)/);
  assert.match(r.message, /in U\/mL \(activity in U per volume\)/);
  assert.match(r.message, /IU and U are different units of activity and are never converted/);
  assert.match(r.message, /Conversion between activity in IU and activity in U is not performed here\./);
});

test('C5-FX-27: IU against mg/mL is rejected per C5-HI-05, naming both units', () => {
  const r = rejectionHI05('IL-2', 'IU', 'mg/mL');
  assert.equal(r.code, 'C5-HI-05');
  assert.deepEqual(r.units, ['IU', 'mg/mL']);
  assert.match(r.message, /in IU \(activity in IU\)/);
  assert.match(r.message, /in mg\/mL \(mass per volume\)/);
  assert.match(r.message, /specific activity, which is not supplied or inferred/);
  assert.match(r.message, /Conversion between activity in IU and mass is not performed here\./);
});

test('C5-HI-05: mass against molar, and the reverse, names the molecular weight it would need', () => {
  for (const [q, s] of [['µg', 'µM'], ['pmol', 'mg/mL'], ['µg/mL', 'nM']]) {
    const r = rejectionHI05('CD3 BUV395', q, s);
    assert.deepEqual(r.units, [q, s]);
    assert.match(r.message, /molecular weight, which is not supplied or inferred/);
    assert.match(r.message, /Conversion between (mass and molar amount|molar amount and mass) is not performed here\./);
  }
});

test('rejectionHI05 refuses a reducible pair', () => {
  assert.throws(() => rejectionHI05('CD4', 'µg', 'mg/mL'), /reducible/);
});

test('stock volume per test: a volume is taken as entered; an amount is amount ÷ concentration', () => {
  assert.deepEqual(stockVolumePerTest(quantity('2.5', 'µL'), null), { value: 2.5, unit: 'µL', form: 'stock-volume' });
  // 0.25 µg at 0.2 mg/mL (0.2 µg/µL) is 1.25 µL.
  assert.equal(stockVolumePerTest(quantity('0.25', 'µg'), quantity('0.2', 'mg/mL')).value, 0.25 / 0.2);
  // The concentration form needs a staining volume: not reduced here (Q1 and Task 6).
  assert.throws(() => stockVolumePerTest(quantity('5', 'µg/mL'), quantity('0.5', 'mg/mL')), /not reduced here/);
});
