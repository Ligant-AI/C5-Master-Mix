// C5-ST-10 storage guard (CLAUDE.md §7.2). A source-text check: nothing in this
// tool's own source names localStorage, sessionStorage, indexedDB or
// document.cookie. The shared frame (@ligant/bench-chrome, which is bundled into
// the page) is checked too: its only storage and cookie uses are the privacy
// choice, listed line by line below, so any new use fails until it is reviewed.
// The runtime side (what the page actually stores) is verification/headless.
//
// GUARD_ROOT points the scan at another tree, so the guard can be shown to fail
// on a planted violation without touching this one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.GUARD_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORBIDDEN = /localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie|\bcookieStore\b/;
const OWN = ['src', 'index.html', 'vite.config.js'];
const FRAME = 'node_modules/@ligant/bench-chrome/src';

// The frame's privacy choice: a single localStorage key, read and written only
// through CONSENT_KEY ('ligant_privacy_choice'), and the deletion of Google
// Analytics cookies when the visitor declines. Each entry is one exact line.
const FRAME_ALLOWED = [
  ['consent.js', '//   - Nothing is stored before a click. After one, a single localStorage entry,'],
  ['consent.js', "      const saved = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');"],
  ['consent.js', '    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, v: CONSENT_VERSION })); } catch { /* holds for this page only */ }'],
  ['consent.js', "    for (const c of document.cookie.split(';')) {"],
  ['consent.js', '      for (const d of domains) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;'],
];

function files(p) {
  const abs = path.join(ROOT, p);
  if (statSync(abs).isFile()) return [p];
  return readdirSync(abs).flatMap((n) => files(path.join(p, n)));
}

function hits(rel) {
  return readFileSync(path.join(ROOT, rel), 'utf8').split('\n')
    .map((line, i) => ({ file: rel, line: i + 1, text: line }))
    .filter((h) => FORBIDDEN.test(h.text));
}

test("C5-ST-10: the tool's own source names no browser storage and no cookie", () => {
  const scanned = OWN.flatMap(files).filter((f) => /\.(js|mjs|html)$/.test(f));
  assert.ok(scanned.length > 0, 'nothing scanned');
  const found = scanned.flatMap(hits);
  assert.deepEqual(found, [], `storage or cookie named in:\n${found.map((h) => `  ${h.file}:${h.line}: ${h.text.trim()}`).join('\n')}`);
});

test('C5-ST-10: the shared frame stores only ligant_privacy_choice, and touches cookies only to delete Google Analytics ones', async () => {
  const { CONSENT_KEY } = await import(path.join(ROOT, FRAME, 'consent.js'));
  assert.equal(CONSENT_KEY, 'ligant_privacy_choice');
  const found = files(FRAME).filter((f) => f.endsWith('.js')).flatMap(hits);
  const unexpected = found.filter((h) => !FRAME_ALLOWED.some(([f, t]) => h.file.endsWith(`/${f}`) && h.text === t));
  assert.deepEqual(unexpected, [], `unreviewed storage or cookie use in the frame:\n${unexpected.map((h) => `  ${h.file}:${h.line}: ${h.text.trim()}`).join('\n')}`);
  assert.equal(found.length, FRAME_ALLOWED.length, 'an allowed line is no longer present: review the frame and this list');
});
