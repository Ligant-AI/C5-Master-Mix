// Task 5: validation and rejections (C5 §7, C5-HI-01 to C5-HI-11; acceptance 12).
// Every rejection's message is asserted for what it must name: the quantity
// as typed, with its unit, the component where there is one, and the
// physical reason. A rejection with generic text fails acceptance 12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, rejectionHI06, RULES, PENDING } from '../src/engine/validate.js';
import { quantity } from '../src/engine/units.js';

// A complete, valid panel: two components established at the assay's own
// staining volume (100 µL as 100 µL and as 0.1 mL), so no basis is required.
function panel() {
  return {
    dispensed: { value: '50', unit: 'µL' },
    residual: { value: '50', unit: 'µL' },
    assayCells: { value: '1000000', unit: 'cells' },
    samples: '96',
    overage: { form: 'percentage', value: '10' },
    basis: '',
    diluent: { notRecorded: false, text: 'PBS, 2% FBS' },
    minTransfer: { value: '2', unit: 'µL', defaulted: true },
    capacity: { value: '', unit: '' },
    components: [
      { label: 'CD3 BUV395', intended: { value: '0.25', unit: 'µg' }, stock: { value: '0.2', unit: 'mg/mL' },
        establishedVolume: { value: '100', unit: 'µL' }, establishedCells: { value: '1000000', unit: 'cells' }, provenance: 'titrated-here' },
      { label: 'CD4 BV421', intended: { value: '0.5', unit: 'µg' }, stock: { value: '0.5', unit: 'mg/mL' },
        establishedVolume: { value: '0.1', unit: 'mL' }, establishedCells: { value: '1', unit: '× 10⁶ cells' }, provenance: 'vendor' },
    ],
  };
}
const withPanel = (f) => { const p = panel(); f(p); return validate(p); };
const codes = (r) => r.rejections.map((x) => x.code);
const only = (r, code) => {
  const xs = r.rejections.filter((x) => x.code === code);
  assert.equal(xs.length, 1, `expected exactly one ${code}, got ${JSON.stringify(codes(r))}`);
  return xs[0];
};
const seen = new Set(); // every code any test produced: C5-HI-07 must never be among them
const run = (f) => { const r = withPanel(f); for (const c of codes(r)) seen.add(c); return r; };

test('a complete, valid panel is ok: no rejection, nothing incomplete, basis not required', () => {
  const r = run(() => {});
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.rejections, []);
  assert.deepEqual(r.incomplete, []);
  assert.equal(r.basisRequired, false);
});

test('C5-HI-01: fewer than one component', () => {
  const r = run((p) => { p.components = []; });
  assert.equal(r.status, 'rejected');
  const x = only(r, 'C5-HI-01');
  assert.match(x.message, /A cocktail requires at least one component\./);
});

test('C5-HI-02: a sample count below 1, or not a whole number, names the count and the permitted range', () => {
  for (const s of ['0', '-3', '2.5', '0.5', '1.0000000000000001']) {
    const r = run((p) => { p.samples = s; });
    const x = only(r, 'C5-HI-02');
    assert.ok(x.message.includes(`Number of samples: ${s} is not permitted`), x.message);
    assert.match(x.message, /must be a whole number of at least 1/);
  }
  // Checked on the exact typed value: the double of 1.0000000000000001 is 1.
  assert.equal(Number('1.0000000000000001'), 1);
  assert.match(only(run((p) => { p.samples = '2.5'; }), 'C5-HI-02').message, /a fraction of a sample cannot be stained/);
  for (const s of ['1', '1.0', '1e2', '96']) assert.equal(run((p) => { p.samples = s; }).status, 'ok', s);
});

test('C5-HI-03: an intended quantity or stock concentration not above zero names the component, the quantity and the reason', () => {
  let r = run((p) => { p.components[1].intended.value = '0'; });
  let x = only(r, 'C5-HI-03');
  assert.match(x.message, /^Component 2, "CD4 BV421": the intended quantity per test, 0 µg, is not above zero\./);
  assert.match(x.message, /must contribute a positive quantity of reagent to each test/);
  assert.deepEqual(x.component, { row: 2, label: 'CD4 BV421' });

  r = run((p) => { p.components[0].intended.value = '-0.25'; });
  assert.match(only(r, 'C5-HI-03').message, /^Component 1, "CD3 BUV395": the intended quantity per test, -0.25 µg, is not above zero\./);

  r = run((p) => { p.components[0].stock.value = '0'; });
  x = only(r, 'C5-HI-03');
  assert.match(x.message, /^Component 1, "CD3 BUV395": the stock concentration, 0 mg\/mL, is not above zero\./);
  assert.match(x.message, /A stock with no reagent in it cannot supply any quantity/);
  assert.equal(x.quantity, 'stock');
});

test('C5-HI-04: overage below zero, in each form, names the overage and that fewer tests than samples is impossible', () => {
  const forms = [['percentage', '-5', '', '-5 % as a percentage of the sample count'],
    ['additional-tests', '-2', '', '-2 as a number of additional tests'],
    ['dead-volume', '-10', 'µL', '-10 µL as a dead volume']];
  for (const [form, value, unit, text] of forms) {
    const x = only(run((p) => { p.overage = { form, value, unit }; }), 'C5-HI-04');
    assert.ok(x.message.includes(`Overage: ${text} is below zero.`), x.message);
    assert.match(x.message, /A cocktail cannot be made for fewer tests than there are samples\./);
  }
});

test('C5-OV-03: zero overage is accepted in every form', () => {
  for (const [form, unit] of [['percentage', ''], ['additional-tests', ''], ['dead-volume', 'µL']]) {
    const r = run((p) => { p.overage = { form, value: '0', unit }; });
    assert.equal(r.status, 'ok', form);
    assert.deepEqual(r.rejections, []);
  }
});

test('a non-integer number of additional tests is accepted (the effective count is a scale factor, C5-OV-04)', () => {
  assert.equal(run((p) => { p.overage = { form: 'additional-tests', value: '2.5' }; }).status, 'ok');
});

test('C5-HI-05: a dimension mismatch names the component and both units', () => {
  const r = run((p) => { p.components[1].intended = { value: '100', unit: 'IU' }; p.components[1].stock = { value: '1000', unit: 'U/mL' }; });
  const x = only(r, 'C5-HI-05');
  assert.match(x.message, /^Component 2, "CD4 BV421": the intended quantity is in IU \(activity in IU\) and the stock concentration is in U\/mL \(activity in U per volume\)\./);
  assert.match(x.message, /Conversion between activity in IU and activity in U is not performed here\./);
  assert.deepEqual(x.units, ['IU', 'U/mL']);
});

test('C5-HI-06: components exceeding the dispensed volume are each listed with their volume, with the total and the dispensed volume', () => {
  // The URS's own case: twenty components at five microlitres in a fifty-microlitre dispense.
  const vols = Array.from({ length: 20 }, (_, i) => ({ row: i + 1, label: `C${i + 1}`, value: 5 }));
  const x = rejectionHI06(quantity('50', 'µL'), vols);
  assert.equal(x.code, 'C5-HI-06');
  assert.match(x.message, /^The components alone need 100\.00 µL per test, more than the dispensed cocktail volume per test, 50 µL\./);
  assert.match(x.message, /The components alone exceed the volume available, which would leave a negative volume of diluent\./);
  for (let i = 1; i <= 20; i++) assert.ok(x.message.includes(`Component ${i}, "C${i}": 5.00 µL`), `component ${i} listed`);
  assert.equal(x.components.length, 20);
  assert.equal(x.totalUl, '100.00');
});

test('C5-HI-06: the total is the exact sum of the volumes as listed', () => {
  const vols = [{ row: 1, label: 'A', value: 12.345 }, { row: 2, label: '', value: 40.0049 }];
  const x = rejectionHI06(quantity('50', 'µL'), vols);
  assert.ok(x.message.includes('Component 1, "A": 12.3 µL; Component 2 (no label): 40.0 µL'), x.message);
  assert.equal(x.totalUl, '52.3');
});

test('C5-HI-06: "more than" is decided at 1 nL (C5-UN-10)', () => {
  const D = quantity('50', 'µL');
  assert.equal(rejectionHI06(D, [{ row: 1, label: 'A', value: 50 }]), null); // exactly full: no diluent, not negative
  assert.equal(rejectionHI06(D, [{ row: 1, label: 'A', value: 50.0004 }]), null); // 0.4 nL over: equal under the rule
  assert.equal(rejectionHI06(D, [{ row: 1, label: 'A', value: 50.0005 }]).code, 'C5-HI-06'); // 0.5 nL over
  assert.equal(rejectionHI06(D, [{ row: 1, label: 'A', value: 49.9 }]), null);
  assert.equal(rejectionHI06(D, [{ row: 1, label: 'A', value: 25 }, { row: 2, label: 'B', value: 25.001 }]).code, 'C5-HI-06');
});

test('C5-HI-08: a negative residual volume is rejected; zero is accepted (C5-SV-02)', () => {
  const x = only(run((p) => { p.residual = { value: '-0.50', unit: 'mL' }; }), 'C5-HI-08');
  assert.match(x.message, /^Volume already present with the cells: -0\.50 mL is below zero\. A volume cannot be negative\./);
  const r = run((p) => { p.residual = { value: '0', unit: 'µL' }; p.basis = 'preserve-amount'; });
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.rejections, []);
  assert.equal(r.parsed.R.status, 'ok');
  assert.equal(r.parsed.R.value, 0);
});

test('C5-HI-09: a negative assay cell number is rejected; zero cells is accepted as a no-cell control', () => {
  const x = only(run((p) => { p.assayCells = { value: '-1', unit: '× 10⁶ cells' }; }), 'C5-HI-09');
  assert.match(x.message, /^Assay cell number per test: -1 × 10⁶ cells is below zero\. A count of cells cannot be negative\./);
  const r = run((p) => { p.assayCells = { value: '0', unit: 'cells' }; });
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.rejections, []);
});

test('C5-HI-10: a minimum transfer volume not above zero is rejected', () => {
  for (const v of ['0', '-2']) {
    const x = only(run((p) => { p.minTransfer = { value: v, unit: 'µL', defaulted: false }; }), 'C5-HI-10');
    assert.ok(x.message.startsWith(`Minimum reliable transfer volume: ${v} µL is not above zero.`), x.message);
    assert.match(x.message, /cannot be zero or negative/);
  }
  assert.equal(run((p) => { p.minTransfer = { value: '0.5', unit: 'µL', defaulted: false }; }).status, 'ok');
});

test('C5-HI-11: a dispensed volume not above zero is rejected', () => {
  for (const v of ['0', '-50']) {
    const x = only(run((p) => { p.dispensed = { value: v, unit: 'µL' }; }), 'C5-HI-11');
    assert.ok(x.message.startsWith(`Dispensed cocktail volume per test: ${v} µL is not above zero.`), x.message);
    assert.match(x.message, /A cocktail cannot be dispensed in zero volume/);
  }
});

test('signs are read from the exact typed value: "1e-400" is positive, though its double is 0', () => {
  for (const f of [(p) => { p.dispensed.value = '1e-400'; }, (p) => { p.minTransfer.value = '1e-400'; }, (p) => { p.components[0].intended.value = '1e-400'; }]) {
    const r = run(f);
    assert.deepEqual(r.rejections, []);
    assert.equal(r.status, 'incomplete');
    assert.equal(r.incomplete[0].reason, 'unrepresentable');
    assert.match(r.incomplete[0].message, /a limit of the arithmetic, not a physical one/);
  }
  assert.equal(only(run((p) => { p.dispensed.value = '-1e-400'; }), 'C5-HI-11').code, 'C5-HI-11');
});

test('C5-HI-07 is withdrawn: it is not a rule and is never raised', () => {
  assert.ok(!RULES.includes('C5-HI-07'));
  assert.deepEqual(RULES, ['C5-HI-01', 'C5-HI-02', 'C5-HI-03', 'C5-HI-04', 'C5-HI-05', 'C5-HI-06', 'C5-HI-08', 'C5-HI-09', 'C5-HI-10', 'C5-HI-11']);
  // v0.1's condition: a cell suspension volume at or above the staining volume.
  const r = run((p) => { p.residual = { value: '500', unit: 'µL' }; p.basis = 'preserve-amount'; });
  assert.equal(r.status, 'ok');
});

test('blank is incomplete, not a rejection, and is distinct from zero', () => {
  const blank = run((p) => { p.residual = { value: '', unit: 'µL' }; });
  assert.equal(blank.status, 'incomplete');
  assert.deepEqual(blank.rejections, []);
  assert.deepEqual(blank.incomplete, [{ field: 'residual', reason: 'blank', message: 'Volume already present with the cells is required and is blank.' }]);
  assert.equal(blank.parsed.R.status, 'blank');
  const zero = run((p) => { p.residual = { value: '0', unit: 'µL' }; p.basis = 'preserve-amount'; });
  assert.equal(zero.parsed.R.status, 'ok');
  assert.equal(zero.parsed.R.value, 0);
});

test('incomplete: each required field, with its own reason', () => {
  const cases = [
    [(p) => { p.dispensed.unit = ''; }, 'dispensed', 'no-unit', /^Dispensed cocktail volume per test has a number but no unit selected\.$/],
    [(p) => { p.samples = '0,5'; }, 'samples', 'invalid', /^Number of samples: "0,5" contains a comma/],
    [(p) => { p.samples = 'ninety'; }, 'samples', 'invalid', /^Number of samples: "ninety" is not a number\.$/],
    [(p) => { p.overage = { form: '', value: '' }; }, 'overage.form', 'not-selected', /Overage form is required and nothing is selected/],
    [(p) => { p.overage.value = ''; }, 'overage.value', 'blank', /^Overage is required and is blank\.$/],
    [(p) => { p.overage = { form: 'dead-volume', value: '10', unit: '' }; }, 'overage.value', 'no-unit', /^Overage has a number but no unit selected\.$/],
    [(p) => { p.diluent = { notRecorded: false, text: '  ' }; }, 'diluent', 'blank', /"Not recorded" is an accepted answer/],
    [(p) => { p.minTransfer.value = ''; }, 'minTransfer', 'blank', /^Minimum reliable transfer volume is required and is blank\.$/],
    [(p) => { p.capacity = { value: '1.5', unit: '' }; }, 'capacity', 'no-unit', /^Vessel working capacity has a number but no unit selected\.$/],
    [(p) => { p.components[1].label = ''; }, 'label', 'blank', /^Component 2 \(no label\): the label is required and is blank\.$/],
    [(p) => { p.components[0].intended.value = ''; }, 'intended', 'blank', /^Component 1, "CD3 BUV395": intended quantity per test is required and is blank\.$/],
    [(p) => { p.components[0].stock.value = ''; }, 'stock', 'blank', /^Component 1, "CD3 BUV395": stock concentration is required and is blank\.$/],
    [(p) => { p.components[1].establishedVolume = { notRecorded: false, value: '', unit: 'µL' }; }, 'establishedVolume', 'blank', /established staining volume is required and is blank/],
    [(p) => { p.components[1].establishedCells = { notRecorded: false, value: '1', unit: '' }; }, 'establishedCells', 'no-unit', /established cell number has a number but no unit selected/],
    [(p) => { p.components[0].provenance = ''; }, 'provenance', 'not-selected', /provenance is required and nothing is selected: titrated in this laboratory, vendor recommendation, or not recorded\./],
  ];
  for (const [f, field, reason, message] of cases) {
    const r = run(f);
    assert.equal(r.status, 'incomplete', field);
    assert.deepEqual(r.rejections, [], field);
    assert.equal(r.incomplete.length, 1, `${field}: ${JSON.stringify(r.incomplete)}`);
    assert.equal(r.incomplete[0].field, field);
    assert.equal(r.incomplete[0].reason, reason);
    assert.match(r.incomplete[0].message, message);
  }
});

test('"not recorded" is accepted where the URS allows it, and is distinct from blank', () => {
  const r = run((p) => {
    p.diluent = { notRecorded: true, text: '' };
    p.components[0].establishedCells = { notRecorded: true };
    p.components[1].establishedVolume = { notRecorded: true };
    p.components[1].provenance = 'not-recorded';
  });
  assert.equal(r.status, 'ok');
  assert.equal(r.parsed.diluent, 'not-recorded');
  assert.equal(r.parsed.components[0].estCells, 'not-recorded');
  assert.equal(r.parsed.components[1].estVolume, 'not-recorded');
});

test('C5-CP-01: a capacity left blank is not declared, not incomplete', () => {
  const r = run(() => {});
  assert.equal(r.parsed.capacity, null);
});

test('C5-CP-07: the basis is required only where a recorded established volume differs from the assay\'s, under C5-UN-10', () => {
  let r = run((p) => { p.components[0].establishedVolume = { value: '50', unit: 'µL' }; });
  assert.equal(r.basisRequired, true);
  assert.equal(r.status, 'incomplete');
  assert.equal(r.incomplete[0].field, 'basis');
  assert.match(r.incomplete[0].message, /Transfer basis is required, because a recorded component was established at a staining volume different from the assay's/);
  r = run((p) => { p.components[0].establishedVolume = { value: '50', unit: 'µL' }; p.basis = 'preserve-concentration'; });
  assert.equal(r.status, 'ok');
  // The C5-FX-13 pair: D + R non-identical to SV_i as doubles, equal under the rule.
  r = run((p) => {
    p.dispensed.value = '10.1'; p.residual.value = '11.2';
    for (const c of p.components) c.establishedVolume = { value: '21.3', unit: 'µL' };
  });
  assert.equal(r.basisRequired, false);
  assert.equal(r.status, 'ok');
  // A component whose established volume is not recorded does not make the basis required.
  r = run((p) => { p.components[0].establishedVolume = { notRecorded: true }; });
  assert.equal(r.basisRequired, false);
});

test('Q1: a concentration-type quantity with its established staining volume not recorded is held, pending the ruling', () => {
  const r = run((p) => { p.components[0].intended = { value: '5', unit: 'µg/mL' }; p.components[0].establishedVolume = { notRecorded: true }; });
  const x = only(r, PENDING.Q1);
  assert.match(x.message, /^Component 1, "CD3 BUV395": not yet supported, pending ruling on question Q1\./);
  assert.match(x.message, /The intended quantity, 5 µg\/mL, is a concentration/);
  assert.match(x.message, /Nothing is computed for it\./);
  // With the staining volume recorded, Q1 does not arise.
  assert.deepEqual(codes(run((p) => { p.components[0].intended = { value: '5', unit: 'µg/mL' }; })), []);
});

test('Q2: a volume of stock per test with no stock concentration is held, pending the ruling; with one, it is computed (ruling 5)', () => {
  let r = run((p) => { p.components[1].intended = { value: '2', unit: 'µL' }; p.components[1].stock = { value: '', unit: '' }; });
  const x = only(r, PENDING.Q2);
  assert.match(x.message, /^Component 2, "CD4 BV421": not yet supported, pending ruling on question Q2\./);
  assert.match(x.message, /The intended quantity, 2 µL, is a volume of stock per test and no stock concentration is entered/);
  assert.ok(!r.incomplete.some((e) => e.field === 'stock'), 'no stock concentration is demanded for a volume of stock');
  r = run((p) => { p.components[1].intended = { value: '2', unit: 'µL' }; p.components[1].stock = { value: '0.2', unit: 'mg/mL' }; });
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.rejections, []);
  // The entered stock concentration is still checked (C5-HI-03).
  r = run((p) => { p.components[1].intended = { value: '2', unit: 'µL' }; p.components[1].stock = { value: '0', unit: 'mg/mL' }; });
  assert.deepEqual(codes(r), ['C5-HI-03']);
});

test('Q4 (proposed): values with no stated rule that would make a later value non-finite are held, not computed', () => {
  let x = only(run((p) => { p.components[1].establishedVolume = { value: '0', unit: 'µL' }; p.basis = 'preserve-amount'; }), PENDING.Q4);
  assert.match(x.message, /^Component 2, "CD4 BV421": not yet supported, pending ruling on question Q4\. The established staining volume, 0 µL, is not above zero/);
  x = only(run((p) => { p.components[0].establishedCells = { value: '-5', unit: 'cells' }; }), PENDING.Q4);
  assert.match(x.message, /The established cell number, -5 cells, is below zero/);
  x = only(run((p) => { p.capacity = { value: '0', unit: 'mL' }; }), PENDING.Q4);
  assert.match(x.message, /^Vessel working capacity: not yet supported, pending ruling on question Q4\. 0 mL is not above zero/);
  // Zero established cells has no division: accepted.
  assert.equal(run((p) => { p.components[0].establishedCells = { value: '0', unit: 'cells' }; }).status, 'ok');
});

test('rejections are listed in §7 table order, by row within a rule, then the pending branches; reported while other fields are blank', () => {
  const r = run((p) => {
    p.dispensed.value = '0'; // HI-11
    p.residual.value = '-1'; // HI-08
    p.samples = '0'; // HI-02
    p.components[1].intended.value = '-1'; // HI-03 row 2
    p.components[0].stock.value = '0'; // HI-03 row 1
    p.components.push({ label: 'X', intended: { value: '2', unit: 'µL' }, stock: { value: '', unit: '' }, establishedVolume: { notRecorded: true }, establishedCells: { notRecorded: true }, provenance: 'vendor' }); // Q2
    p.minTransfer.value = ''; // incomplete
  });
  assert.equal(r.status, 'rejected');
  assert.deepEqual(codes(r), ['C5-HI-02', 'C5-HI-03', 'C5-HI-03', 'C5-HI-08', 'C5-HI-11', PENDING.Q2]);
  assert.deepEqual(r.rejections.filter((x) => x.code === 'C5-HI-03').map((x) => x.component.row), [1, 2]);
  assert.deepEqual(r.incomplete.map((e) => e.field), ['minTransfer']);
});

test('the same inputs give the same result (C5-ST-08)', () => {
  const a = run((p) => { p.samples = '0'; p.residual.value = '-1'; });
  const b = run((p) => { p.samples = '0'; p.residual.value = '-1'; });
  assert.deepStrictEqual(a, b);
  assert.equal(a.basisRequired, null); // not decided on a rejected residual volume
});

test('no rejection anywhere in this file was C5-HI-07', () => {
  assert.ok(seen.size > 5);
  assert.ok(!seen.has('C5-HI-07'));
});

test('a value held under a pending branch drives no decision: a held established volume does not demand a basis (Task 6c ruling 1)', () => {
  const r = run((p) => { p.components[1].establishedVolume = { value: '0', unit: 'µL' }; });
  assert.deepEqual(codes(r), [PENDING.Q4]);
  assert.deepEqual(r.incomplete, []);
  assert.equal(r.basisRequired, false);
  // A held volume beside a valid one that differs: the valid one still decides.
  const q = run((p) => { p.components[1].establishedVolume = { value: '0', unit: 'µL' }; p.components[0].establishedVolume = { value: '50', unit: 'µL' }; });
  assert.equal(q.basisRequired, true);
});
