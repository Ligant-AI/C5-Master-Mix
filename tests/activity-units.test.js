// C5-CP-09: IU and U are never treated as interchangeable. The unit catalogue
// is confirmed on that condition, so this file pins it: no IU quantity is ever
// converted into, equated with, compared with or summed with a U quantity, in
// either direction, as an amount or as a concentration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, DIMENSION, KIND, unitInfo, quantity, sumVolumes, reduction, rejectionHI05, stockVolumePerTest } from '../src/engine/units.js';
import { canonical, equalUnderRule } from '../src/engine/compare.js';
import { determine } from '../src/engine/determine.js';

const IU_UNITS = UNITS.filter((x) => x.dimension === DIMENSION.IU).map((x) => x.symbol);
const U_UNITS = UNITS.filter((x) => x.dimension === DIMENSION.U).map((x) => x.symbol);

test('the catalogue has IU and U units, each in its own dimension and base unit', () => {
  assert.deepEqual(IU_UNITS, ['IU', 'IU/mL']);
  assert.deepEqual(U_UNITS, ['U', 'U/mL']);
  for (const [a, b] of [['IU', 'U'], ['IU/mL', 'U/mL']]) {
    assert.notEqual(unitInfo(a).dimension, unitInfo(b).dimension, `${a} and ${b}`);
    assert.notEqual(unitInfo(a).base, unitInfo(b).base, `${a} and ${b}`);
  }
});

test('no IU quantity reduces against a U stock, and no U quantity against an IU stock, as an amount or a concentration', () => {
  const pairs = [['IU', 'U/mL'], ['U', 'IU/mL'], ['IU/mL', 'U/mL'], ['U/mL', 'IU/mL']];
  for (const [intended, stock] of pairs) {
    const r = reduction(intended, stock);
    assert.equal(r.reducible, false, `${intended} against ${stock}`);
    const x = rejectionHI05({ row: 1, label: 'IL-2' }, intended, stock);
    assert.equal(x.code, 'C5-HI-05');
    assert.deepEqual(x.units, [intended, stock]);
    assert.match(x.message, /IU and U are different units of activity and are never converted into one another/);
    assert.throws(() => stockVolumePerTest(quantity('10', intended), quantity('100', stock)), `${intended} against ${stock}`);
  }
});

test('IU reduces only against IU, and U only against U', () => {
  assert.deepEqual(reduction('IU', 'IU/mL'), { reducible: true, form: 'amount' });
  assert.deepEqual(reduction('U', 'U/mL'), { reducible: true, form: 'amount' });
  assert.deepEqual(reduction('IU/mL', 'IU/mL'), { reducible: true, form: 'concentration' });
  assert.deepEqual(reduction('U/mL', 'U/mL'), { reducible: true, form: 'concentration' });
  assert.equal(stockVolumePerTest(quantity('10', 'IU'), quantity('100', 'IU/mL')).carried, 'IU');
  assert.equal(stockVolumePerTest(quantity('10', 'U'), quantity('100', 'U/mL')).carried, 'U');
});

test('IU and U quantities are never compared or summed: the comparison rule and the volume sum refuse them', () => {
  const iu = quantity('10', 'IU');
  const u = quantity('10', 'U');
  assert.equal(iu.kind, KIND.AMOUNT);
  assert.throws(() => canonical(iu), /states no resolution/);
  assert.throws(() => canonical(u), /states no resolution/);
  assert.throws(() => equalUnderRule(iu, u), /states no resolution/);
  assert.throws(() => equalUnderRule(quantity('10', 'IU/mL'), quantity('10', 'U/mL')), /states no resolution/);
  assert.throws(() => sumVolumes(iu, u), /both terms must be volumes/);
});

// A valid panel with one IU component and one U component, each against a
// stock of its own unit.
function panel(iuStock, uStock) {
  return {
    dispensed: { value: '50', unit: 'µL' },
    residual: { value: '50', unit: 'µL' },
    assayCells: { value: '1000000', unit: 'cells' },
    samples: '10',
    overage: { form: 'percentage', value: '10' },
    basis: '',
    diluent: { notRecorded: false, text: 'PBS' },
    minTransfer: { value: '2', unit: 'µL', defaulted: true },
    capacity: { value: '', unit: '' },
    components: [
      { label: 'IL-2', intended: { value: '10', unit: 'IU' }, stock: iuStock,
        establishedVolume: { value: '100', unit: 'µL' }, establishedCells: { value: '1000000', unit: 'cells' }, provenance: 'vendor' },
      { label: 'Enzyme', intended: { value: '10', unit: 'U' }, stock: uStock,
        establishedVolume: { value: '100', unit: 'µL' }, establishedCells: { value: '1000000', unit: 'cells' }, provenance: 'vendor' },
    ],
  };
}

test('an IU component and a U component in one panel: each is carried in its own unit, none in the other', () => {
  const r = determine(panel({ value: '1000', unit: 'IU/mL' }, { value: '1000', unit: 'U/mL' }));
  assert.equal(r.status, 'result');
  const [iu, u] = r.values.components;
  assert.equal(iu.concentrationInAssay.unit, 'IU/µL');
  assert.equal(u.concentrationInAssay.unit, 'U/µL');
  assert.equal(iu.stockVolumePerTest_uL, 10);
  assert.equal(u.stockVolumePerTest_uL, 10);
});

test('a panel whose stocks are swapped (IU against U/mL, U against IU/mL) is rejected for each component, and nothing is computed', () => {
  const r = determine(panel({ value: '1000', unit: 'U/mL' }, { value: '1000', unit: 'IU/mL' }));
  assert.equal(r.status, 'rejected');
  const hi05 = r.rejections.filter((x) => x.code === 'C5-HI-05');
  assert.deepEqual(hi05.map((x) => x.units), [['IU', 'U/mL'], ['U', 'IU/mL']]);
  assert.equal(r.values, undefined);
});
