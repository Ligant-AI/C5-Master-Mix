// The fixture standards (URS §10), run against the engine. The fixtures and
// their README are supplied by Adacs (tests/fixtures/); each `expect` key is
// implemented here as the README defines it. One test per fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { determine } from '../src/engine/determine.js';
import { pipettingList } from '../src/engine/format.js';
import { Dec } from '../src/engine/numfmt.js';
import { TOLERANCES, relativeDifference } from '../src/engine/tolerances.js';
import { iv03 } from './helpers/invariance.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const FIXTURES = new Map(readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8'))).map((x) => [x.id, x]));
const run = (id) => JSON.parse(JSON.stringify(determine(FIXTURES.get(id).input)));

// "components[2].ratio" -> values.components[2].ratio
function at(obj, p) {
  return p.split('.').flatMap((k) => k.split(/[[\]]/).filter(Boolean)).reduce((o, k) => (o === undefined ? undefined : o[/^\d+$/.test(k) ? Number(k) : k]), obj);
}
function numbersOf(x, skip = () => false, key = '', out = []) {
  if (skip(key)) return out;
  if (typeof x === 'number') out.push([key, x]);
  else if (Array.isArray(x)) x.forEach((y, i) => numbersOf(y, skip, `${key}[${i}]`, out));
  else if (x && typeof x === 'object') for (const [k, y] of Object.entries(x)) numbersOf(y, skip, key ? `${key}.${k}` : k, out);
  return out;
}
const decEqual = (a, b) => Dec.cmp(Dec.fromString(String(a)), Dec.fromString(String(b))) === 0;
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

test('every supplied fixture has an id, an input and an expected status', () => {
  assert.equal(FIXTURES.size, 45); // v2: OVERFLOW-a and OVERFLOW-b added
  for (const [id, x] of FIXTURES) assert.ok(id && x.input && x.expect && x.expect.status, id);
});

for (const [id, fx] of FIXTURES) {
  test(`${id}: ${fx.title} (${fx.standard})`, () => {
    const e = fx.expect;
    const r = run(id);
    assert.equal(r.status, e.status, `${id}: status ${r.status}${r.status !== 'result' ? ` ${JSON.stringify(r.rejections.concat(r.incomplete).map((x) => x.code || `${x.field}:${x.reason}`))}` : ''}`);

    if ('basisRequired' in e) assert.equal(r.basisRequired, e.basisRequired, 'basisRequired');
    if (e.flags) assert.deepEqual(r.flags.map((f) => ({ code: f.code, components: f.components })), e.flags, 'flags');
    for (const [code, comps] of Object.entries(e.flagCodes || {})) {
      const f = r.flags.find((x) => x.code === code);
      assert.ok(f, `${code} not raised`);
      assert.deepEqual(f.components, comps, `${code} components`);
    }
    for (const code of e.flagsAbsent || []) assert.equal(r.flags.find((x) => x.code === code), undefined, `${code} raised`);
    for (const [code, detail] of Object.entries(e.flagDetail || {})) {
      const f = r.flags.find((x) => x.code === code);
      assert.ok(f, `${code} not raised`);
      for (const [k, v] of Object.entries(detail)) assert.deepStrictEqual(f[k], v, `${code}.${k}`);
    }
    for (const [p, v] of Object.entries(e.values || {})) assert.deepStrictEqual(at(r.values, p), v, `values.${p}`);
    if (e.rejections) assert.deepStrictEqual(r.rejections.map((x) => pick(x, ['code', 'component'])), e.rejections, 'rejections');
    if (e.incomplete) {
      const key = (x) => JSON.stringify([x.field, x.component ?? null, x.reason]);
      assert.deepEqual(new Set(r.incomplete.map(key)), new Set(e.incomplete.map(key)), 'incomplete');
    }
    if (e.display3sf || e.displayedTotalMustDifferFrom) {
      const list = pipettingList(r);
      const d = e.display3sf;
      if (d) {
        const comps = list.steps.filter((s) => s.what === 'component').map((s) => s.volume_uL);
        assert.equal(comps.length, d.volumeInCocktail_uL.length);
        comps.forEach((v, i) => assert.ok(decEqual(v, d.volumeInCocktail_uL[i]), `component ${i + 1}: ${v} against ${d.volumeInCocktail_uL[i]}`));
        assert.ok(decEqual(list.steps[0].volume_uL, d.diluentTotal_uL), `diluent: ${list.steps[0].volume_uL} against ${d.diluentTotal_uL}`);
        assert.ok(decEqual(list.total_uL, d.displayedTotal_uL), `displayed total: ${list.total_uL} against ${d.displayedTotal_uL}`);
      }
      if (e.displayedTotalMustDifferFrom) assert.ok(!decEqual(list.total_uL, e.displayedTotalMustDifferFrom), `displayed total ${list.total_uL} equals ${e.displayedTotalMustDifferFrom}`);
    }
    if (e.sameValuesAs) {
      const other = run(e.sameValuesAs);
      const skip = (k) => /concentrationInAssay\.unit$/.test(k);
      assert.deepStrictEqual(numbersOf(r.values, skip), numbersOf(other.values, skip), `values against ${e.sameValuesAs}`);
    }
    if (e.sameNumbersAs) {
      const other = run(e.sameNumbersAs);
      const skip = (k) => /scaleFactor$/.test(k);
      assert.deepStrictEqual(numbersOf(r.values, skip), numbersOf(other.values, skip), `numbers against ${e.sameNumbersAs}`);
    }
    for (const rel of e.relations || []) {
      assert.equal(rel, 'C5-IV-03', `unknown relation ${rel}`);
      for (const c of iv03(fx.input, r, relativeDifference)) {
        assert.equal(c.form, c.expectedForm);
        assert.equal(c.basis, c.expectedBasis);
        assert.ok(c.difference <= TOLERANCES.roundTrip.relative, `component ${c.index}: ${c.difference}`);
      }
    }
    if (e.allFinite) for (const [k, x] of numbersOf(r)) assert.ok(Number.isFinite(x), `${k} = ${x}`);
    if ('minFlagCount' in e) assert.ok(new Set(r.flags.map((f) => f.code)).size >= e.minFlagCount, `${r.flags.length} flags`);
  });
}
