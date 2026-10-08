// Task 7b: C5's structured result object (C5-OUT-03, C5-ST-04, C5-UN-07) and
// its published schema, docs/schema/c5-master-mix-1.0.0-draft.schema.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { determine } from '../src/engine/determine.js';
import { record, buildRecord, RECORD_SCHEMA } from '../src/engine/result.js';
import { validate } from './helpers/json-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = JSON.parse(readFileSync(path.join(ROOT, 'docs/schema/c5-master-mix-1.0.0-draft.schema.json'), 'utf8'));
const FIXTURES = readdirSync(path.join(ROOT, 'tests/fixtures')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures', f), 'utf8')));
const fx = (id) => FIXTURES.find((x) => x.id === id).input;
const json = (x) => JSON.parse(JSON.stringify(x));

test('the schema id and version are C5\'s own (not C7\'s draft, not a shared format)', () => {
  assert.deepEqual(RECORD_SCHEMA, { name: 'ligant-benchtools-c5-master-mix', version: '1.0.0-draft' });
  assert.equal(SCHEMA.properties.schema.properties.name.const, RECORD_SCHEMA.name);
  assert.equal(SCHEMA.properties.schema.properties.version.const, RECORD_SCHEMA.version);
});

test('every fixture produces an object that validates against the published schema (acceptance 4, supporting evidence)', (t) => {
  let results = 0;
  for (const f of FIXTURES) {
    const r = json(record(f.input));
    assert.deepEqual(validate(SCHEMA, r), [], f.id);
    if (r.status === 'result') results++;
  }
  t.diagnostic(`${FIXTURES.length} fixtures validate, ${results} of them results`);
  assert.ok(results >= 35);
});

test('the validator is not vacuous: broken objects fail', () => {
  const good = json(record(fx('C5-FX-01')));
  const broken = [
    (o) => { delete o.values.svAssay.unit; },
    (o) => { o.values.components[0].volumeInCocktail = 12; },
    (o) => { o.flags.push({ code: 'C5-FL-06', components: [] }); },
    (o) => { o.declarations.residual = { state: 'entered', value: '0' }; },
    (o) => { o.schema.name = 'ligant.bench-tools.result'; },
    (o) => { o.declarations.components[0].transport = 'imported'; },
    (o) => { o.surplus = 1; },
    (o) => { delete o.values; },
  ];
  for (const f of broken) {
    const o = json(good);
    f(o);
    assert.notDeepEqual(validate(SCHEMA, o), [], f.toString());
  }
});

test('zero and blank residual are distinguishable (C5-FX-08a, C5-FX-08a-blank; C5-SV-02)', () => {
  const zero = json(record(fx('C5-FX-08a')));
  const blank = json(record(fx('C5-FX-08a-blank')));
  assert.deepEqual(zero.declarations.residual, { state: 'entered', value: '0', unit: 'µL', normalised: { value: 0, unit: 'µL' } });
  assert.equal(blank.declarations.residual.state, 'blank');
  assert.equal(blank.status, 'incomplete');
});

test('the C5-FL-08 unevaluated list is present, in the flag and in the values', () => {
  const r = json(record(fx('C5-FX-11b')));
  assert.deepEqual(r.flags.find((f) => f.code === 'C5-FL-08').unevaluated, [3]);
  assert.deepEqual(r.values.fl08Unevaluated, [3]);
  assert.deepEqual(json(record(fx('C5-FX-11'))).values.fl08Unevaluated, [3]);
});

test('every declaration is carried as typed, with transport, provenance, cell numbers and the selected stock units (C5-ST-04)', () => {
  const input = fx('C5-FX-01');
  const r = json(record(input));
  assert.equal(r.declarations.dispensed.value, input.dispensed.value);
  assert.equal(r.declarations.assayCells.value, input.assayCells.value);
  assert.equal(r.declarations.samples.value, input.samples);
  input.components.forEach((c, i) => {
    const d = r.declarations.components[i];
    assert.equal(d.label, c.label);
    assert.equal(d.transport, 'entered');
    assert.equal(d.provenance.value, c.provenance);
    assert.equal(d.stock.unit, c.stock.unit);
    assert.equal(r.values.components[i].concentrationInAssay.stockUnit, c.stock.unit);
    if (c.establishedCells.notRecorded) assert.equal(d.establishedCells.state, 'not-recorded');
    else assert.equal(d.establishedCells.value, c.establishedCells.value);
  });
});

test('C5-OUT-04: no number is recomputed; every value is determine()\'s, with its unit', () => {
  for (const f of FIXTURES) {
    const d = json(determine(f.input));
    if (d.status !== 'result') continue;
    const r = json(buildRecord(f.input, determine(f.input)));
    const x = d.values;
    assert.deepEqual([r.values.svAssay, r.values.nEff, r.values.totalCocktail, r.values.diluentTotal, r.values.diluentPerTest, r.values.antibodyFraction, r.values.overageFraction],
      [{ value: x.svAssay_uL, unit: 'µL' }, { value: x.nEff, unit: 'tests' }, { value: x.totalCocktail_uL, unit: 'µL' }, { value: x.diluentTotal_uL, unit: 'µL' }, { value: x.diluentPerTest_uL, unit: 'µL' }, { value: x.antibodyFraction, unit: '1' }, { value: x.overageFraction, unit: '1' }], f.id);
    x.components.forEach((c, i) => {
      const o = r.values.components[i];
      assert.equal(o.volumePerTest.value, c.volumePerTest_uL);
      assert.equal(o.volumeInCocktail.value, c.volumeInCocktail_uL);
      assert.equal(o.stockVolumePerTest.value, c.stockVolumePerTest_uL);
      if (!c.concentrationInAssay.withheld) assert.equal(o.concentrationInAssay.value, c.concentrationInAssay.value);
      assert.deepEqual(o.ratio.withheld ? o.ratio : o.ratio.value, c.ratio.withheld ? c.ratio : c.ratio.value);
    });
    assert.deepEqual(r.flags, d.flags, f.id);
  }
});

test('every flag keeps its component-level scope (C5-OUT-03)', () => {
  const r = json(record(fx('C5-FX-11b')));
  assert.deepEqual(r.flags.map((f) => [f.code, f.components]), json(determine(fx('C5-FX-11b'))).flags.map((f) => [f.code, f.components]));
  for (const f of r.flags) assert.ok(Array.isArray(f.components), f.code);
});
