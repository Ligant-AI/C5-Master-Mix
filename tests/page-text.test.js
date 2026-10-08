// C5-NF-10, Task 12: the approved tagline and meta description (A.B., 8 October
// 2026), each byte for byte, each in one place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../src/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TAGLINE = 'The volume of each antibody and the diluent in a master mix, for the samples, overage, staining volume and cell number you declare. Every value is computed deterministically by arithmetic you can read. No model and no inference is applied to any reported number.';
const META = 'Make an antibody master mix for flow cytometry: the volume of every antibody and the diluent, for the staining volume, cell number and overage you declare, with every assumption stated. A free, deterministic bench tool. Runs entirely in your browser.';

test('the tagline is the approved text, byte for byte, 262 characters', () => {
  assert.equal(CONFIG.tagline, TAGLINE);
  assert.equal(CONFIG.tagline.length, 262);
  assert.equal(Buffer.byteLength(CONFIG.tagline, 'utf8'), 262);
});

test('the meta description is the approved text, byte for byte, once', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const metas = [...html.matchAll(/<meta name="description" content="([^"]*)">/g)].map((m) => m[1]);
  assert.deepEqual(metas, [META]);
  assert.ok(!/<meta[^>]+property="og:description"/.test(html), 'no og:description tag: not approved');
});

test('each string lives in one place: the tagline in src/config.js, the description in index.html', () => {
  const files = (p) => (statSync(path.join(ROOT, p)).isFile() ? [p] : readdirSync(path.join(ROOT, p)).flatMap((n) => files(path.join(p, n))));
  const sources = [...files('src'), 'index.html'].filter((f) => /\.(js|html|css)$/.test(f));
  const where = (s) => sources.filter((f) => readFileSync(path.join(ROOT, f), 'utf8').includes(s));
  assert.deepEqual(where(TAGLINE), ['src/config.js']);
  assert.deepEqual(where(META), ['index.html']);
});
