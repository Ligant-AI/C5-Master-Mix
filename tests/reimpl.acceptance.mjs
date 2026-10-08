// Acceptance 3: the engine against Adacs's independent Python reimplementation
// (reimpl/c5_reimpl.py, run, never read), over every supplied fixture, as
// tests/fixtures/README.md specifies. Run by `npm run test:reimpl`; it is not
// part of `npm test` (no Python there).
//
// Results: every value in `values` and `flags` (engineVersion excepted).
// Numbers are compared for identity, and every non-identical pair is reported
// with its relative difference, whether or not it is within the PROVISIONAL
// tolerance: the contract fixes the order of computation, so exact agreement
// is expected and any difference is a finding. Everything else exactly.
// Non-results: status, the ordered (code, component) list, and the set of
// (field, component, reason). Messages are not compared.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { determine } from '../src/engine/determine.js';
import { TOLERANCES, relativeDifference } from '../src/engine/tolerances.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tests/fixtures');
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const tolerance = TOLERANCES.roundTrip.relative;

function reimpl(file) {
  const r = spawnSync('python3', ['-I', 'reimpl/c5_reimpl.py', '--fixture', path.join('tests/fixtures', file)], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`reimpl exited ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

// Every difference between two JSON values, by path.
function compare(a, b, p, out) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (!Object.is(a, b)) out.push({ field: p, engine: a, reimpl: b, relative: relativeDifference(a, b), numeric: true });
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push({ field: `${p}.length`, engine: a.length, reimpl: b.length });
    for (let i = 0; i < Math.min(a.length, b.length); i++) compare(a[i], b[i], `${p}[${i}]`, out);
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) out.push({ field: `${p}.${k}`, engine: '(absent)', reimpl: b[k] });
      else if (!(k in b)) out.push({ field: `${p}.${k}`, engine: a[k], reimpl: '(absent)' });
      else compare(a[k], b[k], `${p}.${k}`, out);
    }
    return out;
  }
  if (!Object.is(a, b)) out.push({ field: p, engine: a, reimpl: b });
  return out;
}

const all = [];
let numbersCompared = 0;
const countNumbers = (x) => (typeof x === 'number' ? 1 : x && typeof x === 'object' ? Object.values(x).reduce((s, y) => s + countNumbers(y), 0) : 0);

for (const file of FILES) {
  const fx = JSON.parse(readFileSync(path.join(DIR, file), 'utf8'));
  test(`${fx.id}`, () => {
    const e = JSON.parse(JSON.stringify(determine(fx.input)));
    const p = reimpl(file);
    const diffs = [];
    if (e.status !== p.status) diffs.push({ field: 'status', engine: e.status, reimpl: p.status });
    else if (e.status === 'result') {
      compare(e.basisRequired, p.basisRequired, 'basisRequired', diffs);
      compare(e.values, p.values, 'values', diffs);
      compare(e.flags, p.flags, 'flags', diffs);
      numbersCompared += countNumbers(e.values) + countNumbers(e.flags);
    } else {
      const codes = (r) => r.rejections.map((x) => [x.code, x.component ?? null]);
      const fields = (r) => r.incomplete.map((x) => JSON.stringify([x.field, x.component ?? null, x.reason])).sort();
      compare(codes(e), codes(p), 'rejections(code, component)', diffs);
      compare(fields(e), fields(p), 'incomplete(field, component, reason)', diffs);
    }
    for (const d of diffs) all.push({ fixture: fx.id, ...d });
    const text = diffs.map((d) => `${d.field}: engine ${JSON.stringify(d.engine)}, reimpl ${JSON.stringify(d.reimpl)}${d.numeric ? `, relative difference ${d.relative} (${d.relative <= tolerance ? 'within' : 'BEYOND'} the PROVISIONAL tolerance ${tolerance})` : ''}`);
    assert.deepEqual(text, [], `${fx.id}: ${diffs.length} difference(s)`);
  });
}

test('acceptance 3 summary', (t) => {
  t.diagnostic(`${FILES.length} fixtures; ${numbersCompared} numbers compared in results; ${all.length} difference(s)`);
  for (const d of all) t.diagnostic(`${d.fixture} ${d.field}: engine ${JSON.stringify(d.engine)}, reimpl ${JSON.stringify(d.reimpl)}${d.numeric ? `, relative ${d.relative}` : ''}`);
  assert.equal(all.length, 0);
});
