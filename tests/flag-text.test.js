// Task 7 item 1: the words of each flag (C5 §8 "Flag states"), for display and
// the notebook copy. Content is asserted: the statement, every named component
// with its own figures, and every ratio or factor in the direction of C5-DT-06,
// labelled with the two quantities it compares.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { determine } from '../src/engine/determine.js';
import { flagTexts, flagNotebookLines, FLAG_ORDER } from '../src/engine/flags.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (id) => JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures', `${id}.json`), 'utf8')).input;
const contract = readFileSync(path.join(ROOT, 'docs/engine-io.md'), 'utf8');
const EXAMPLE = JSON.parse(/```json\n(.*?)```/s.exec(contract)[1]);
const words = (input) => flagTexts(determine(input), input);
const one = (input, code) => {
  const t = words(input).find((x) => x.code === code);
  assert.ok(t, `${code} not raised`);
  return t;
};

test('every raised flag has words, in flag order, and no other flag does', () => {
  const r = determine(EXAMPLE);
  const t = flagTexts(r, EXAMPLE);
  assert.deepEqual(t.map((x) => x.code), r.flags.map((f) => f.code));
  assert.deepEqual(t.map((x) => x.code), FLAG_ORDER.filter((c) => t.some((x) => x.code === c)));
  for (const x of t) {
    assert.ok(x.title.length > 10 && x.statement.length > 40, x.code);
    assert.deepEqual(x.components.map((c) => c.component), r.flags.find((f) => f.code === x.code).components);
  }
});

test('C5-FL-01: the volume established at, the assay volume, the delivered ÷ established concentration, and the three regime statements', () => {
  const t = one(EXAMPLE, 'C5-FL-01');
  assert.match(t.statement, /Each basis is exact only in a limiting regime;/);
  assert.match(t.statement, /in the intermediate regime neither transfers the titration exactly,/);
  assert.match(t.statement, /this tool cannot determine which regime applies\./);
  assert.deepEqual(t.components.map((c) => c.text), [
    'Component 2, "CD4 BV421": established at 50 µL; assay staining volume 100 µL; under preserve concentration, concentration in the assay ÷ concentration it was established at = 1.00.',
  ]);
  // Preserve amount, established at 50 µL, assay 100 µL: delivered at half the
  // established concentration, a ratio below 1 (C5-DT-06), never the inverse volume ratio.
  const b = one(fixture('C5-FX-05b'), 'C5-FL-01');
  assert.match(b.components[0].text, /under preserve amount per test, concentration in the assay ÷ concentration it was established at = 0\.500\.$/);
});

test('C5-FL-02 and C5-FL-12: each named, with the URS statement', () => {
  assert.match(one(EXAMPLE, 'C5-FL-02').statement, /its concentration ratio is withheld, because the concentration it was established at is unknown\. The transfer basis has not been applied to it\./);
  assert.deepEqual(one(EXAMPLE, 'C5-FL-02').components.map((c) => c.text), ['Component 3, "CD8 BV711": named.']);
  assert.match(one(EXAMPLE, 'C5-FL-12').statement, /whether the assay reproduces the condition they were established under cannot be determined\./);
});

test('C5-FL-03, C5-FL-09: panel-level statements', () => {
  const p = JSON.parse(JSON.stringify(EXAMPLE));
  p.overage = { form: 'percentage', value: '0', unit: '' };
  p.diluent = { notRecorded: true };
  assert.equal(one(p, 'C5-FL-03').statement, 'No overage declared; the cocktail is made for exactly the sample count, and volume lost to the tube and tips will leave the last tests short.');
  assert.equal(one(p, 'C5-FL-09').statement, 'Diluent not recorded; the cocktail cannot be reproduced from this record.');
});

test('C5-FL-04: each component with its provenance in words', () => {
  const t = one(EXAMPLE, 'C5-FL-04');
  assert.match(t.statement, /A vendor recommendation is a concentration chosen for a stated assay and is not a titrated value for this panel\./);
  assert.deepEqual(t.components.map((c) => c.text), ['Component 2, "CD4 BV421": vendor recommendation.', 'Component 3, "CD8 BV711": provenance not recorded.']);
});

test('C5-FL-05: the volume in the cocktail against the declared minimum, and both remedies, neither chosen', () => {
  const t = one(fixture('C5-FX-18b'), 'C5-FL-05');
  assert.match(t.statement, /Either an intermediate dilution of those components or a larger batch will make them pipettable; the tool states both and chooses neither\./);
  assert.match(t.components[0].text, /^Component 1, ".*": volume in the cocktail [\d.]+ µL, below the declared minimum of 2 µL\.$/);
});

test('C5-FL-07: the total against the declared capacity', () => {
  const t = one(fixture('C5-FX-18e'), 'C5-FL-07');
  assert.match(t.statement, /^The cocktail exceeds the declared vessel capacity and must be split or made in a larger vessel\. Total cocktail volume [\d.]+ µL; declared vessel capacity [\d.]+ (µL|mL)\.$/);
});

test('C5-FL-08: the distinct volumes with the components at each, and the unevaluated components named', () => {
  const t = one(EXAMPLE, 'C5-FL-08');
  assert.match(t.statement, /no single cocktail can deliver all of them at both their established concentration and their established amount per test\./);
  assert.ok(t.statement.endsWith('Established volumes — 50 µL: Component 2, "CD4 BV421"; 100 µL: Component 1, "CD3 BUV395". Unevaluated (established volume not recorded): Component 3, "CD8 BV711".'), t.statement);
});

test('C5-FL-11: amount per cell in the assay ÷ as established, under each basis, and withheld with its reason at zero cells', () => {
  let t = one(fixture('C5-FX-12a'), 'C5-FL-11');
  assert.match(t.statement, /Neither basis recovers the established condition across a cell-number difference\./);
  assert.match(t.components[0].text, /amount per cell in the assay ÷ amount per cell as established = 0\.200\.$/);
  t = one(fixture('C5-FX-12b'), 'C5-FL-11');
  assert.match(t.components[0].text, /established at 1 × 10⁶ cells; assay 5 × 10⁶ cells; amount per cell in the assay ÷ amount per cell as established = 0\.200\.$/);
  t = one(fixture('C5-FX-19'), 'C5-FL-11');
  assert.match(t.components[0].text, /amount per cell in the assay ÷ amount per cell as established withheld, because the assay cell number is zero\.$/);
  assert.ok(!/Infinity|NaN/.test(JSON.stringify(t)));
});

test('the notebook copy carries every flag in words with every named component (C5-OUT-10)', () => {
  const lines = flagNotebookLines(determine(EXAMPLE), EXAMPLE);
  assert.equal(lines[0], 'Flags');
  for (const code of ['C5-FL-01', 'C5-FL-02', 'C5-FL-04', 'C5-FL-08', 'C5-FL-11', 'C5-FL-12']) assert.ok(lines.some((l) => l.startsWith(`  ${code} — `)), code);
  assert.ok(lines.includes('    Component 2, "CD4 BV421": vendor recommendation.'));
  const clean = fixture('C5-FX-09');
  assert.deepEqual(flagNotebookLines(determine(clean), clean), ['Flags: none raised.']);
});
