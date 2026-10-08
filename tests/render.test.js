// Task 13: what the page, the bench sheet and the notebook copy render
// (src/ui/render.js), run in Node from the structured result.
//  - No rendered declaration repeats its unit (NADIRA's UAT: "10 % %").
//  - The flag statements on the page are the bench sheet's and the notebook's
//    words (URS §8, human-readable output).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { record } from '../src/engine/result.js';
import { UNITS } from '../src/engine/units.js';
import { flagTexts } from '../src/engine/flags.js';
import { declarationSummary, derivationHtml, notebookText, benchSheetHtml, flagNames } from '../src/ui/render.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = readdirSync(path.join(ROOT, 'tests/fixtures')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures', f), 'utf8')));
const clone = (x) => JSON.parse(JSON.stringify(x));
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Every fixture, and a result fixture in each overage form, so the
// percentage, additional-tests and dead-volume declarations are all rendered.
function panels() {
  const out = FIXTURES.map((f) => [f.id, f.input]);
  const base = FIXTURES.find((f) => f.id === 'C5-FX-01').input;
  for (const overage of [{ form: 'percentage', value: '10', unit: '' }, { form: 'additional-tests', value: '4', unit: '' }, { form: 'dead-volume', value: '0.125', unit: 'mL' }]) {
    const p = clone(base);
    p.overage = overage;
    out.push([`C5-FX-01, overage ${overage.form}`, p]);
  }
  return out;
}

const UNIT_TOKENS = [...UNITS.map((u) => u.symbol), '%'].sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const REPEAT = new RegExp(`(^|[\\s(,])(${UNIT_TOKENS.map(esc).join('|')}) \\2(?=$|[\\s,.;:)])`, 'u');

test('no rendered declaration repeats its unit: page summary, derivation, notebook copy, bench sheet', () => {
  let rendered = 0;
  for (const [id, input] of panels()) {
    const rec = record(input);
    const parts = { summary: text(declarationSummary(rec)), notebook: notebookText(rec), benchSheet: text(benchSheetHtml(rec, '')) };
    if (rec.status === 'result') parts.derivation = text(derivationHtml(rec));
    for (const [where, t] of Object.entries(parts)) {
      const m = REPEAT.exec(t);
      assert.equal(m, null, `${id}, ${where}: "${m && t.slice(Math.max(0, m.index - 30), m.index + 30)}"`);
      rendered++;
    }
  }
  assert.ok(rendered > 150);
});

test('the overage in each form is rendered once with its unit (the "10 % %" finding)', () => {
  const base = FIXTURES.find((f) => f.id === 'C5-FX-01').input;
  const p = clone(base);
  p.overage = { form: 'percentage', value: '10', unit: '' };
  const rec = record(p);
  assert.match(notebookText(rec), /Overage: percentage of samples, 10 %\n/);
  assert.match(text(benchSheetHtml(rec, '')), /percentage of samples, 10 %\s/);
  assert.ok(!/% %/.test(notebookText(rec) + text(benchSheetHtml(rec, ''))));
});

test('the page shows every raised flag in full, in the bench sheet\'s and the notebook\'s words', () => {
  for (const [id, input] of panels()) {
    const rec = record(input);
    if (rec.status !== 'result') continue;
    const page = text(flagNames(rec));
    const sheet = text(benchSheetHtml(rec, ''));
    const notebook = notebookText(rec);
    for (const t of flagTexts(rec)) {
      for (const s of [t.statement, ...t.components.map((c) => c.text)]) {
        assert.ok(page.includes(s), `${id}: ${t.code} not on the page: ${s.slice(0, 80)}`);
        assert.ok(sheet.includes(s), `${id}: ${t.code} not on the bench sheet`);
        assert.ok(notebook.includes(s), `${id}: ${t.code} not in the notebook copy`);
      }
    }
  }
});
