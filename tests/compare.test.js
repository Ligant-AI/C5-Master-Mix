// Task 4: the comparison rule (C5-UN-10), the exact scale factor (C5-UN-11)
// and the C5-FX-13 measurement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Dec from '../src/engine/decimal.js';
import { quantity, sumVolumes } from '../src/engine/units.js';
import { RESOLUTION, canonical, equalUnderRule, scaleFactor, roundHalfAwayToInteger } from '../src/engine/compare.js';

const vol = (t, u = 'µL') => quantity(t, u);
const cells = (t, u = 'cells') => quantity(t, u);

test('the resolutions are 1 nL and 1 cell (scope record, decision 3)', () => {
  assert.equal(RESOLUTION.volume.statement, '1 nL');
  assert.equal(RESOLUTION.cells.statement, '1 cell');
});

test('roundHalfAwayToInteger: half away from zero, in both signs', () => {
  const r = (s) => roundHalfAwayToInteger(Dec.fromString(s));
  assert.equal(r('2.5'), 3n);
  assert.equal(r('-2.5'), -3n);
  assert.equal(r('2.4999999999999999999999'), 2n);
  assert.equal(r('-2.4999999999999999999999'), -2n);
  assert.equal(r('2.5000000000000000000001'), 3n);
  assert.equal(r('0.5'), 1n);
  assert.equal(r('-0.5'), -1n);
  assert.equal(r('0.4'), 0n);
  assert.equal(r('7'), 7n);
  assert.equal(roundHalfAwayToInteger({ neg: false, mant: 12n, exp: 3 }), 12000n);
});

test('C5-UN-10: canonical volumes at 1 nL', () => {
  assert.equal(canonical(vol('100')), 100000n);
  assert.equal(canonical(vol('0.1', 'mL')), 100000n);
  assert.equal(canonical(vol('100.0004')), 100000n);
  assert.equal(canonical(vol('100.0005')), 100001n); // the half rounds away from zero
  assert.equal(canonical(vol('99.9995')), 100000n);
  assert.equal(canonical(vol('99.99949999')), 99999n);
  assert.equal(canonical(vol('0.0000005', 'mL')), 1n); // 0.5 nL
  assert.equal(canonical(vol('0.0004')), 0n);
  assert.equal(canonical(vol('0')), 0n);
  assert.equal(canonical(vol('-0.0005')), -1n);
});

test('C5-UN-10: canonical cell numbers at 1 cell', () => {
  assert.equal(canonical(cells('1000000')), 1000000n);
  assert.equal(canonical(cells('1', '× 10⁶ cells')), 1000000n);
  assert.equal(canonical(cells('1e6')), 1000000n);
  assert.equal(canonical(cells('999999.5')), 1000000n);
  assert.equal(canonical(cells('1.0000005', '× 10⁶ cells')), 1000001n); // 1000000.5
  assert.equal(canonical(cells('1.0000004', '× 10⁶ cells')), 1000000n);
  assert.equal(canonical(cells('0')), 0n); // a no-cell control
});

test('C5-UN-10: equality decides on the canonical integer, never on a double', () => {
  assert.equal(equalUnderRule(vol('100'), vol('0.1', 'mL')), true);
  assert.equal(equalUnderRule(vol('100'), vol('100.0004')), true);
  assert.equal(equalUnderRule(vol('100'), vol('100.0005')), false);
  assert.equal(equalUnderRule(vol('100'), vol('99.999')), false);
  assert.equal(equalUnderRule(cells('5', '× 10⁶ cells'), cells('5000000')), true);
  assert.equal(equalUnderRule(cells('1', '× 10⁶ cells'), cells('5', '× 10⁶ cells')), false);
  // A typed value more precise than any double is still compared exactly.
  assert.equal(equalUnderRule(vol('100.0004999999999999999999'), vol('100')), true);
  assert.equal(equalUnderRule(vol('100.0005000000000000000001'), vol('100')), false);
});

test('C5-UN-10: the assay staining volume is compared as the exact sum of what was typed', () => {
  const sv = sumVolumes(vol('50'), vol('0.05', 'mL'));
  assert.equal(equalUnderRule(sv, vol('100')), true);
  assert.equal(equalUnderRule(sv, vol('0.1', 'mL')), true);
  assert.equal(equalUnderRule(sumVolumes(vol('50'), vol('0')), vol('50')), true); // zero residual (C5-SV-02)
});

test('C5-UN-10: only volumes and cell numbers are compared, and never with each other', () => {
  assert.throws(() => equalUnderRule(vol('100'), cells('100')), /not compared/);
  assert.throws(() => canonical(quantity('1', 'µg')), /no resolution/);
});

test('C5-UN-11: the scale factor is the literal 1 when the volumes compare equal', () => {
  // A pair whose doubles differ but which compare equal (measured below, FX-13).
  const sv = sumVolumes(vol('10.1'), vol('10.2'));
  const svi = vol('20.3');
  assert.notEqual(sv.value, svi.value);
  assert.notEqual(sv.value / svi.value, 1); // the computed ratio is not 1
  assert.deepEqual(scaleFactor(sv, svi), { value: 1, exactlyOne: true });
  assert.ok(Object.is(scaleFactor(sv, svi).value, 1));
  // Unequal volumes: the ratio SV_assay ÷ SV_i, in that direction.
  assert.deepEqual(scaleFactor(vol('100'), vol('50')), { value: 2, exactlyOne: false });
  assert.deepEqual(scaleFactor(vol('50'), vol('100')), { value: 0.5, exactlyOne: false });
  assert.throws(() => scaleFactor(vol('100'), cells('100')), /between two volumes/);
});

// C5-FX-13: a volume pair and a cell-number pair, each measured in this engine
// to be non-identical after normalisation and equal under C5-UN-10. The search
// is run here, in the shipped code, and its result printed as the recorded
// measurement (C5-FX-15). Draft note N3: a pair is not assumed non-identical.
test('C5-FX-13: measurement', (t) => {
  const fmt = (x) => x.toPrecision(17);

  // Volume: SV_assay = D + R, typed in µL to one decimal place across 10.0 to
  // 200.0 µL, against an established staining volume typed as the exact sum.
  let volumePair = null;
  let tried = 0;
  let nonIdentical = 0;
  for (let i = 100; i <= 2000; i++) {
    for (let j = 100; j <= 2000; j += 3) {
      const D = vol((i / 10).toFixed(1));
      const R = vol((j / 10).toFixed(1));
      const sv = sumVolumes(D, R);
      const svi = vol(Dec.toString(sv.exact));
      tried++;
      if (sv.value !== svi.value) {
        nonIdentical++;
        assert.equal(equalUnderRule(sv, svi), true);
        if (!volumePair) volumePair = { D, R, sv, svi };
      }
    }
  }
  assert.ok(volumePair, 'no non-identical volume pair found');
  const { D, R, sv, svi } = volumePair;
  t.diagnostic(`FX-13 volume pair: dispensed ${D.text} µL + present with cells ${R.text} µL, against established ${svi.text} µL`);
  t.diagnostic(`  SV_assay as computed (IEEE sum) = ${fmt(sv.value)} µL; established as normalised = ${fmt(svi.value)} µL; identical: ${sv.value === svi.value}`);
  t.diagnostic(`  canonical at 1 nL: ${canonical(sv)} and ${canonical(svi)}; equal under C5-UN-10: ${equalUnderRule(sv, svi)}`);
  t.diagnostic(`  across ${tried} one-decimal (D, R) pairs from 10.0 to 200.0 µL, ${nonIdentical} sums were non-identical to the typed sum, every one equal under the rule`);
  assert.equal(sv.value === svi.value, false);
  assert.equal(equalUnderRule(sv, svi), true);

  // Cell number: cell numbers are typed, never summed, and normalised by one
  // rounding of the exact typed value, so two entries of the same number of
  // cells in different units always give identical doubles. The only
  // non-identical pair equal under the rule is two entries less than half a
  // cell apart. Searched over ×10⁶ entries with 7 decimals against the whole
  // number of cells they round to.
  let cellPair = null;
  for (let k = 1; k <= 9999999 && !cellPair; k += 7) {
    const typed = `1.${String(k).padStart(7, '0')}`;
    const a = cells(typed, '× 10⁶ cells');
    const b = cells(String(canonical(a)));
    if (a.value !== b.value && equalUnderRule(a, b)) cellPair = { a, b };
  }
  assert.ok(cellPair, 'no non-identical cell-number pair found');
  t.diagnostic(`FX-13 cell-number pair: ${cellPair.a.text} × 10⁶ cells against ${cellPair.b.text} cells`);
  t.diagnostic(`  normalised: ${fmt(cellPair.a.value)} and ${fmt(cellPair.b.value)} cells; identical: ${cellPair.a.value === cellPair.b.value}`);
  t.diagnostic(`  canonical at 1 cell: ${canonical(cellPair.a)} and ${canonical(cellPair.b)}; equal under C5-UN-10: ${equalUnderRule(cellPair.a, cellPair.b)}`);
  assert.equal(cellPair.a.value === cellPair.b.value, false);
  assert.equal(equalUnderRule(cellPair.a, cellPair.b), true);

  // For the record: the same number of cells entered two ways is identical
  // here, where a double multiplication would not be.
  const x = cells('1.000001', '× 10⁶ cells');
  const y = cells('1000001');
  t.diagnostic(`not an FX-13 pair in this engine: 1.000001 × 10⁶ cells and 1000001 cells normalise to ${fmt(x.value)} and ${fmt(y.value)} (identical: ${x.value === y.value}); 1.000001 * 1e6 in double arithmetic would be ${fmt(1.000001 * 1e6)}`);
  assert.equal(x.value, y.value);
});
