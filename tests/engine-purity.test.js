// CLAUDE.md §5.1 and C5-ST-08: the engine is pure. No DOM, no browser API, no
// time, no randomness and no network in src/engine/. A source-text check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/engine');
const FORBIDDEN = /\b(window|document|navigator|globalThis|self|location|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|setTimeout|setInterval|performance|Date|Math\.random|crypto)\b/;

test('src/engine names no DOM, browser API, clock, randomness or network', () => {
  const hits = [];
  for (const f of readdirSync(ENGINE).filter((n) => n.endsWith('.js'))) {
    readFileSync(path.join(ENGINE, f), 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      if (FORBIDDEN.test(code)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('src/engine imports only from src/engine', () => {
  for (const f of readdirSync(ENGINE).filter((n) => n.endsWith('.js'))) {
    for (const m of readFileSync(path.join(ENGINE, f), 'utf8').matchAll(/^import .* from '([^']+)';/gm)) {
      assert.match(m[1], /^\.\/[\w-]+\.js$/, `${f} imports ${m[1]}`);
    }
  }
});
