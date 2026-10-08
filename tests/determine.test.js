// Task 6b: determination (C5 §5; CLAUDE.md §5.4, §5.5; docs/engine-io.md),
// invariance C5-IV-01, 02, 03, 05 and 06, and display per C5-DT-04.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { determine } from '../src/engine/determine.js';
import { pipettingList, perTestVolumes, concentrations, ratios, PRECISION } from '../src/engine/format.js';
import { sig, Dec } from '../src/engine/numfmt.js';
import { quantity } from '../src/engine/units.js';
import { TOLERANCES, relativeDifference } from '../src/engine/tolerances.js';
import { randomPanel } from './helpers/panels.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = readFileSync(path.join(ROOT, 'docs/engine-io.md'), 'utf8');
const [EXAMPLE_INPUT, EXAMPLE_OUTPUT] = [...contract.matchAll(/```json\n(.*?)```/gs)].map((m) => JSON.parse(m[1]));
const clone = (x) => JSON.parse(JSON.stringify(x));

const PANELS = [];
for (let seed = 1; PANELS.length < 400 && seed < 5000; seed++) {
  const input = randomPanel(seed);
  const result = determine(input);
  if (result.status === 'result') PANELS.push({ seed, input, result });
}

function allNumbers(x, out = []) {
  if (typeof x === 'number') out.push(x);
  else if (Array.isArray(x)) x.forEach((y) => allNumbers(y, out));
  else if (x && typeof x === 'object') Object.values(x).forEach((y) => allNumbers(y, out));
  return out;
}

// ---- the contract ------------------------------------------------------------
test('the worked example in docs/engine-io.md: every unrounded value exactly as built by hand', () => {
  assert.deepStrictEqual(clone(determine(EXAMPLE_INPUT)), EXAMPLE_OUTPUT);
});

test('the generator gives enough computed panels to test invariance on', (t) => {
  t.diagnostic(`${PANELS.length} computed panels from seeds 1 to ${PANELS.at(-1).seed}`);
  assert.ok(PANELS.length >= 400);
});

test('no output is ever non-finite or -0 (C5-FX-19), on every computed panel', () => {
  for (const { seed, result } of PANELS) {
    for (const x of allNumbers(result)) {
      assert.ok(Number.isFinite(x), `seed ${seed}: ${x}`);
      assert.ok(!Object.is(x, -0), `seed ${seed}: -0`);
    }
  }
});

// ---- invariance ----------------------------------------------------------------
test('C5-IV-01 and C5-DT-04: the displayed total is the exact sum of the displayed pipetted volumes', () => {
  for (const { result } of PANELS) {
    const list = pipettingList(result);
    const sum = list.steps.map((s) => Dec.fromString(s.volume_uL)).reduce(Dec.add);
    assert.equal(list.total_uL, Dec.toString(sum));
    assert.equal(list.steps[0].what, 'diluent'); // C5-DT-05
    assert.deepEqual(list.steps.slice(1).map((s) => s.component), result.values.components.map((c) => c.index));
    for (const [i, s] of list.steps.entries()) {
      const own = i === 0 ? result.values.diluentTotal_uL : result.values.components[i - 1].volumeInCocktail_uL;
      assert.equal(s.volume_uL, sig(own, 3)); // each from its own unrounded value
    }
  }
});

test('C5-FX-04-style: a high antibody fraction with a small diluent, where the rounded unrounded total would differ', () => {
  // Three components at 33.333… µL each in a 100.05 µL dispense, one test.
  const input = {
    dispensed: { value: '100.05', unit: 'µL' }, residual: { value: '0', unit: 'µL' },
    assayCells: { value: '1000000', unit: 'cells' }, samples: '1', overage: { form: 'additional-tests', value: '0' },
    basis: '', diluent: { text: 'PBS' }, minTransfer: { value: '2', unit: 'µL' }, capacity: { value: '' },
    components: ['A', 'B', 'C'].map((label) => ({ label, intended: { value: '1', unit: 'µg' }, stock: { value: '0.03', unit: 'mg/mL' },
      establishedVolume: { value: '100.05', unit: 'µL' }, establishedCells: { value: '1000000', unit: 'cells' }, provenance: 'titrated-here' })),
  };
  const r = determine(input);
  assert.equal(r.status, 'result');
  const list = pipettingList(r);
  assert.deepEqual(list.steps.map((s) => s.volume_uL), ['0.0500', '33.3', '33.3', '33.3']);
  assert.equal(list.total_uL, '99.9500');
  assert.equal(sig(r.values.totalCocktail_uL, 3), '100'); // what the v0.1 direction would have shown
  assert.notEqual(list.total_uL, sig(r.values.totalCocktail_uL, 3));
});

test('C5-IV-02: the total cocktail volume is the dispensed volume times the effective test count, and the diluent agrees with it', (t) => {
  // Under the contract, total = D × N_eff and diluent in the cocktail =
  // total − ΣV by definition, so those two relations hold by construction and
  // cannot fail. The check that can: the diluent in the cocktail against the
  // diluent per test times N_eff. A defect in a component's cocktail volume
  // moves one and not the other. The bound is relative to the total, because
  // total − ΣV cancels when the diluent is small.
  let worst = 0;
  for (const { seed, input, result } of PANELS) {
    const v = result.values;
    const D = quantity(input.dispensed.value, input.dispensed.unit).value;
    assert.equal(v.totalCocktail_uL, D * v.nEff);
    if (v.componentsFillDispensedVolume) continue;
    const d = Math.abs(v.diluentTotal_uL - v.diluentPerTest_uL * v.nEff) / v.totalCocktail_uL;
    worst = Math.max(worst, d);
    assert.ok(d <= TOLERANCES.roundTrip.relative, `seed ${seed}: ${d}`);
  }
  t.diagnostic(`largest |diluent in cocktail − diluent per test × N_eff| ÷ total: ${worst} (tolerance ${TOLERANCES.roundTrip.relative}, PROVISIONAL)`);
});

// The concentration a component was meant to reach in the assay, from its
// typed quantity and the declared basis (C5-DT-03), and the concentration
// recomputed from the volume actually pipetted into the cocktail.
// The form and the basis are derived here from the input, not read from the
// engine's output, so a defect that applies the wrong one cannot move the
// target with it.
function expectedFormAndBasis(input, comp) {
  const kind = quantity(comp.intended.value, comp.intended.unit).kind;
  const form = { amount: 'amount', concentration: 'concentration', volume: 'stock-volume' }[kind];
  const basis = comp.establishedVolume.notRecorded ? 'not-applied' : input.basis || 'not-required';
  return { form, basis };
}
function target(input, comp) {
  const { form, basis } = expectedFormAndBasis(input, comp);
  const q = quantity(comp.intended.value, comp.intended.unit);
  const c = quantity(comp.stock.value, comp.stock.unit).value;
  const D = quantity(input.dispensed.value, input.dispensed.unit).value;
  const SV = D + quantity(input.residual.value, input.residual.unit).value;
  const SVi = comp.establishedVolume.notRecorded ? null : quantity(comp.establishedVolume.value, comp.establishedVolume.unit).value;
  const amountPerTest = { amount: q.value, concentration: SVi === null ? null : q.value * SVi, 'stock-volume': c * q.value }[form];
  if (basis === 'preserve-concentration' || basis === 'not-required') return amountPerTest / SVi;
  return amountPerTest / SV; // preserve amount, or the basis not applied: the amount per test is carried
}

test('C5-IV-03: target concentration → volume → recomputed concentration, for every component', (t) => {
  let worst = 0;
  let n = 0;
  for (const { seed, input, result } of PANELS) {
    const v = result.values;
    const D = quantity(input.dispensed.value, 'µL').value;
    for (const out of v.components) {
      const comp = input.components[out.index - 1];
      const expected = expectedFormAndBasis(input, comp);
      assert.equal(out.form, expected.form, `seed ${seed}, component ${out.index}: form`);
      assert.equal(out.basisApplied, expected.basis, `seed ${seed}, component ${out.index}: basis`);
      const want = target(input, comp);
      const c = quantity(comp.stock.value, comp.stock.unit).value;
      // Each test receives D of the cocktail, of which the component is V_i / total.
      const recomputed = (c * (out.volumeInCocktail_uL / v.totalCocktail_uL) * D) / v.svAssay_uL;
      const d = Math.max(relativeDifference(recomputed, want), relativeDifference(out.concentrationInAssay.value, want));
      worst = Math.max(worst, d);
      n++;
      assert.ok(d <= TOLERANCES.roundTrip.relative, `seed ${seed}, component ${out.index}: ${d}`);
    }
  }
  t.diagnostic(`${n} components; largest relative difference from the target: ${worst} (tolerance ${TOLERANCES.roundTrip.relative}, PROVISIONAL)`);
});

test('C5-IV-05: where no recorded staining volume differs under C5-UN-10, the two bases give identical unrounded results', () => {
  const strip = (r) => ({ ...clone(r), values: { ...clone(r.values), components: r.values.components.map(({ basisApplied, scaleFactor, ...rest }) => rest) } });
  const cases = [];
  for (const { input } of PANELS.slice(0, 150)) {
    const p = clone(input);
    const sv = (Number(p.dispensed.value) + Number(p.residual.value)).toFixed(1);
    for (const c of p.components) if (!c.establishedVolume.notRecorded) c.establishedVolume = { value: sv, unit: 'µL' };
    cases.push(p);
  }
  // The C5-FX-13 pair: D + R non-identical to SV_i as doubles, equal under the rule.
  const fx13 = clone(EXAMPLE_INPUT);
  fx13.dispensed.value = '10.1'; fx13.residual.value = '11.2';
  for (const c of fx13.components) if (!c.establishedVolume.notRecorded) c.establishedVolume = { value: '0.0213', unit: 'mL' };
  fx13.components.forEach((c) => { c.intended.value = '0.001'; });
  cases.push(fx13);
  for (const p of cases) {
    const [a, b, none] = ['preserve-concentration', 'preserve-amount', ''].map((basis) => determine({ ...p, basis }));
    assert.equal(a.status, 'result');
    assert.equal(a.basisRequired, false);
    assert.deepStrictEqual(strip(a), strip(b));
    assert.deepStrictEqual(strip(a), strip(none));
  }
});

test('C5-IV-06: the same panel in other units of the same families agrees within the unit-normalisation tolerance', (t) => {
  const reunit = (p) => {
    const q = clone(p);
    const toMl = (x) => ({ value: Dec.toString(Dec.shift(Dec.fromString(x.value), -3)), unit: 'mL' });
    q.dispensed = toMl(q.dispensed); q.residual = toMl(q.residual);
    q.minTransfer = toMl(q.minTransfer);
    const otherCells = (x) => (x.unit === 'cells'
      ? { value: Dec.toString(Dec.shift(Dec.fromString(x.value), -6)), unit: '× 10⁶ cells' }
      : { value: Dec.toString(Dec.shift(Dec.fromString(x.value), 6)), unit: 'cells' });
    q.assayCells = otherCells(q.assayCells);
    if (q.overage.form === 'dead-volume') q.overage = { form: 'dead-volume', ...toMl(q.overage) };
    if (q.capacity.value) q.capacity = { value: Dec.toString(Dec.shift(Dec.fromString(q.capacity.value), 3)), unit: 'µL' };
    for (const c of q.components) {
      if (!c.establishedVolume.notRecorded) c.establishedVolume = toMl(c.establishedVolume);
      if (!c.establishedCells.notRecorded) c.establishedCells = otherCells(c.establishedCells);
      if (c.intended.unit === 'µL') c.intended = toMl(c.intended);
      // IU, U, IU/mL and U/mL have no second unit in the catalogue, so they stay as entered.
      const swap = { µg: ['ng', 3], pmol: ['nmol', -3], 'mg/mL': ['µg/mL', 3], 'µM': ['nM', 3], 'IU/mL': null, 'U/mL': null, 'µg/mL': ['ng/mL', 3] };
      for (const k of ['intended', 'stock']) {
        const s = swap[c[k].unit];
        if (s) c[k] = { value: Dec.toString(Dec.shift(Dec.fromString(c[k].value), s[1])), unit: s[0] };
      }
    }
    return q;
  };
  let worst = 0;
  for (const { seed, input, result } of PANELS) {
    const other = determine(reunit(input));
    assert.equal(other.status, 'result', `seed ${seed}`);
    assert.deepEqual(other.flags.map((f) => [f.code, f.components]), result.flags.map((f) => [f.code, f.components]));
    const a = allNumbers(result.values);
    const b = allNumbers(other.values);
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      const d = relativeDifference(a[i], b[i]);
      worst = Math.max(worst, d);
      assert.ok(d <= TOLERANCES.unitNormalisation.relative, `seed ${seed}: ${a[i]} against ${b[i]}`);
    }
  }
  t.diagnostic(`largest relative difference between unit spellings: ${worst} (tolerance ${TOLERANCES.unitNormalisation.relative}, PROVISIONAL)`);
});

// ---- ruling 1: equality under C5-UN-10 at the boundaries ---------------------------
function onePanel(components, over = {}) {
  return {
    dispensed: { value: '50', unit: 'µL' }, residual: { value: '0', unit: 'µL' },
    assayCells: { value: '1000000', unit: 'cells' }, samples: '1', overage: { form: 'additional-tests', value: '0' },
    basis: '', diluent: { text: 'PBS' }, minTransfer: { value: '2', unit: 'µL' }, capacity: { value: '' },
    components: components.map(([value, unit, stockValue, label = 'A']) => ({ label, intended: { value, unit }, stock: { value: stockValue, unit: 'mg/mL' },
      establishedVolume: { value: '50', unit: 'µL' }, establishedCells: { value: '1000000', unit: 'cells' }, provenance: 'titrated-here' })),
    ...over,
  };
}

test('components that fill the dispensed volume leave the literal 0 of diluent, never a negative one', () => {
  for (const amount of ['25', '25.0002']) { // 50 µL exactly; 50.0004 µL, equal at 1 nL
    const r = determine(onePanel([[amount, 'µg', '0.5']]));
    assert.equal(r.status, 'result', amount);
    assert.ok(Object.is(r.values.diluentPerTest_uL, 0));
    assert.ok(Object.is(r.values.diluentTotal_uL, 0));
    assert.equal(r.values.componentsFillDispensedVolume, true);
    assert.equal(pipettingList(r).steps[0].volume_uL, '0');
    assert.equal(perTestVolumes(r).diluent_uL, '0');
  }
  const over = determine(onePanel([['25.00025', 'µg', '0.5']])); // 50.0005 µL: more than 50 at 1 nL
  assert.equal(over.status, 'rejected');
  assert.equal(over.rejections[0].code, 'C5-HI-06');
  assert.deepEqual(over.rejections[0].components, [{ component: 1, volumePerTest_uL: '50.0' }]);
  assert.equal(over.rejections[0].total_uL, '50.0');
  const under = determine(onePanel([['24.9', 'µg', '0.5']]));
  assert.equal(under.values.componentsFillDispensedVolume, false);
  assert.ok(under.values.diluentPerTest_uL > 0);
});

test('C5-FL-05 and C5-FL-07 are not raised for values equal under C5-UN-10', () => {
  const fl = (r, code) => r.flags.find((f) => f.code === code);
  // One test, so the cocktail volume of a component is its volume per test.
  assert.equal(fl(determine(onePanel([['1', 'µg', '0.5']])), 'C5-FL-05'), undefined); // 2 µL exactly
  assert.equal(fl(determine(onePanel([['0.9998', 'µg', '0.5']])), 'C5-FL-05'), undefined); // 1.9996 µL = 2000 nL
  assert.deepEqual(fl(determine(onePanel([['0.9997', 'µg', '0.5']])), 'C5-FL-05').components, [1]); // 1.9994 µL = 1999 nL
  const cap = (value) => determine(onePanel([['1', 'µg', '0.5']], { capacity: { value, unit: 'mL' } }));
  assert.equal(fl(cap('0.05'), 'C5-FL-07'), undefined); // total 50 µL, capacity 50 µL
  assert.equal(fl(cap('0.0500004'), 'C5-FL-07'), undefined);
  assert.deepEqual(fl(cap('0.0499994'), 'C5-FL-07').components, []); // 49.9994 µL = 49999 nL
});

test('C5-FX-19 and ruling 6: a zero cell number withholds FL-11\'s factor with its reason, and nothing is non-finite', () => {
  let r = determine(onePanel([['1', 'µg', '0.5']], { assayCells: { value: '0', unit: 'cells' } }));
  assert.deepEqual(r.flags.find((f) => f.code === 'C5-FL-11').amountPerCell, [{ component: 1, withheld: true, reason: 'assay-cells-zero' }]);
  for (const x of allNumbers(r)) assert.ok(Number.isFinite(x));
  const p = onePanel([['1', 'µg', '0.5']]);
  p.components[0].establishedCells = { value: '0', unit: 'cells' };
  r = determine(p);
  assert.deepEqual(r.flags.find((f) => f.code === 'C5-FL-11').amountPerCell, [{ component: 1, withheld: true, reason: 'established-cells-zero' }]);
});

test('C5-FL-11: the amount-per-cell factor under each basis (C5-FX-12)', () => {
  const p = onePanel([['1', 'µg', '0.5']], { assayCells: { value: '5', unit: '× 10⁶ cells' } });
  p.components[0].establishedCells = { value: '1', unit: '× 10⁶ cells' };
  p.components[0].establishedVolume = { value: '100', unit: 'µL' }; // SV_i 100, assay 50
  const f = (basis) => determine({ ...p, basis }).flags.find((x) => x.code === 'C5-FL-11').amountPerCell[0].factor;
  assert.equal(f('preserve-amount'), 0.2); // 1e6 / 5e6
  assert.equal(f('preserve-concentration'), 0.5 * 0.2); // s = 50 / 100
});

test('a stock volume per test with a stock concentration is computed (ruling 5)', () => {
  const r = determine(onePanel([['2', 'µL', '0.2']]));
  assert.equal(r.status, 'result');
  const c = r.values.components[0];
  assert.equal(c.form, 'stock-volume');
  assert.equal(c.stockVolumePerTest_uL, 2);
  assert.deepEqual(c.concentrationInAssay, { value: (0.2 * 2) / 50, unit: 'µg/µL' });
});

test('held branches compute nothing: PENDING-Q1, PENDING-Q2 and PENDING-Q4', () => {
  const q1 = onePanel([['5', 'µg/mL', '0.5']]);
  q1.components[0].establishedVolume = { notRecorded: true };
  assert.deepEqual(determine(q1).rejections.map((x) => [x.code, x.component]), [['PENDING-Q1', 1]]);
  const q2 = onePanel([['2', 'µL', '']]);
  assert.deepEqual(determine(q2).rejections.map((x) => [x.code, x.component]), [['PENDING-Q2', 1]]);
  const q4 = onePanel([['1', 'µg', '0.5']]);
  q4.components[0].establishedVolume = { value: '0', unit: 'µL' };
  q4.basis = 'preserve-amount';
  const r = determine(q4);
  assert.equal(r.status, 'rejected');
  assert.deepEqual(r.rejections.map((x) => [x.code, x.component]), [['PENDING-Q4', 1]]);
  assert.equal(r.values, undefined);
});

test('a non-result is reported in the contract\'s shape (§3)', () => {
  const p = clone(EXAMPLE_INPUT);
  p.samples = '0';
  p.residual.value = '';
  const r = determine(p);
  assert.deepEqual(Object.keys(r), ['status', 'engineVersion', 'rejections', 'incomplete']);
  assert.equal(r.status, 'rejected');
  assert.deepEqual(r.rejections.map((x) => x.code), ['C5-HI-02']);
  assert.deepEqual(r.incomplete.map((e) => [e.field, e.reason]), [['residual', 'blank']]);
  const q = clone(EXAMPLE_INPUT);
  q.components[1].provenance = '';
  assert.deepEqual(determine(q).incomplete.map((e) => [e.field, e.component, e.reason]), [['provenance', 2, 'not-selected']]);
});

test('a computed value beyond the range of a double is incomplete with its reason, never infinite', () => {
  const r = determine(onePanel([['1e300', 'µg', '1e-300']]));
  assert.equal(r.status, 'incomplete');
  assert.equal(r.incomplete[0].reason, 'unrepresentable');
  assert.match(r.incomplete[0].message, /Component 1, "A": the stock volume per test is outside the range/);
});

test('the same inputs give the same result (C5-ST-08)', () => {
  for (const { input, result } of PANELS.slice(0, 50)) assert.deepStrictEqual(determine(clone(input)), result);
});

test('C5-OV-04: the effective test count and the overage fraction in each form, as the contract computes them', () => {
  const r = (overage) => determine({ ...clone(EXAMPLE_INPUT), overage }).values;
  // 96 samples, D = 50 µL. Percentage 10: N_eff = 96 * (1 + 10/100) = 96 * 1.1, fraction 10/100.
  let v = r({ form: 'percentage', value: '10', unit: '' });
  assert.equal(v.nEff, 96 * (1 + 10 / 100));
  assert.equal(v.nEff, 105.60000000000001); // not 105.6: unrounded (C5-OV-04)
  assert.equal(v.overageFraction, 0.1); // directly p/100, not (N_eff - n)/n = 0.10000000000000009
  assert.notEqual((v.nEff - 96) / 96, 0.1);
  // Dead volume 125 µL: N_eff = 96 + 125/50 = 98.5, fraction 125 / (96 * 50).
  v = r({ form: 'dead-volume', value: '125', unit: 'µL' });
  assert.equal(v.nEff, 98.5);
  assert.equal(v.overageFraction, 125 / 4800);
  // Additional tests 4: N_eff = 100, fraction 4/96.
  v = r({ form: 'additional-tests', value: '4', unit: '' });
  assert.equal(v.nEff, 100);
  assert.equal(v.overageFraction, 4 / 96);
  // Zero overage: C5-FL-03, N_eff = n.
  const z = determine({ ...clone(EXAMPLE_INPUT), overage: { form: 'percentage', value: '0', unit: '' } });
  assert.equal(z.values.nEff, 96);
  assert.equal(z.values.overageFraction, 0);
  assert.ok(z.flags.some((f) => f.code === 'C5-FL-03'));
});

test('C5-FL-08 names unevaluated components, and values.fl08Unevaluated is present whether or not FL-08 is raised', () => {
  const r = determine(EXAMPLE_INPUT);
  assert.deepEqual(r.flags.find((f) => f.code === 'C5-FL-08').unevaluated, [3]);
  assert.deepEqual(r.values.fl08Unevaluated, [3]);
  const p = clone(EXAMPLE_INPUT);
  p.components[1].establishedVolume = { value: '100', unit: 'µL' }; // all recorded volumes now equal
  const q = determine(p);
  assert.equal(q.flags.find((f) => f.code === 'C5-FL-08'), undefined);
  assert.deepEqual(q.values.fl08Unevaluated, [3]);
});

test('finite volumes per test whose sum is beyond a double is incomplete with its reason, never a crash', () => {
  const r = determine(onePanel([['1e308', 'µg', '1'], ['1e308', 'µg', '1', 'B']]));
  assert.equal(r.status, 'incomplete');
  assert.equal(r.incomplete[0].reason, 'unrepresentable');
  assert.match(r.incomplete[0].message, /^The total volume of the components per test is outside the range/);
});

test('concentrations display in each component\'s own stock unit, at 6 significant figures, rounded once (ruling 2)', () => {
  const r = determine(EXAMPLE_INPUT);
  assert.deepEqual(concentrations(r, ['mg/mL', 'µg/mL', 'g/L']), [
    { component: 1, value: '0.00500000', unit: 'mg/mL' },
    { component: 2, value: '5.00000', unit: 'µg/mL' },
    { component: 3, value: '0.00100000', unit: 'g/L' },
  ]);
  // The shift is exact: 1/3 µg/µL shown in ng/mL is the double's own digits, moved.
  const third = { values: { components: [{ index: 1, concentrationInAssay: { value: 1 / 3, unit: 'µg/µL' } }] } };
  assert.deepEqual(concentrations(third, ['ng/mL']), [{ component: 1, value: '333333', unit: 'ng/mL' }]);
  assert.throws(() => concentrations(r, ['µM', 'mg/mL', 'mg/mL']), /not a unit of µg\/µL/);
});

test('ratios and fractions display at 3 significant figures, PROVISIONAL (ruling 3); a withheld ratio stays withheld', () => {
  assert.equal(PRECISION.ratios, 3);
  const r = ratios(determine(EXAMPLE_INPUT));
  assert.equal(r.overageFraction, '0.0417');
  assert.equal(r.antibodyFraction, '0.0500');
  assert.deepEqual(r.components.map((c) => [c.ratio, c.scaleFactor]), [['1.00', '1.00'], ['1.00', '2.00'], [{ withheld: true, reason: 'C5-FL-02' }, null]]);
});
