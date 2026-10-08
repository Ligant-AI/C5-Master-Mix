// Task 2's trivial engine test. The display rounding (numfmt.js, decimal.js) is
// C7's, copied unchanged: half away from zero on the exact binary value
// (C5-UN-06), the rule C7 states as C7-UN-06.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sig } from '../src/engine/numfmt.js';
import { ENGINE_VERSION, TOOL_ID, TOOL_NAME } from '../src/engine/version.js';

test('ties round half away from zero, in both signs', () => {
  // 0.125 and 2.5 are exact in binary, so these are true ties.
  assert.equal(sig(0.125, 2), '0.13');
  assert.equal(sig(-0.125, 2), '-0.13');
  assert.equal(sig(2.5, 1), '3');
  assert.equal(sig(-2.5, 1), '-3');
});

test('rounding is on the exact binary value, not the decimal literal', () => {
  // The double nearest 1.005 is 1.00499999999999989341858963598497211933135986328125.
  assert.equal(sig(1.005, 3), '1.00');
  // The double nearest 0.145 is 0.1449999999999999900079927783735911361873149871826171875.
  assert.equal(sig(0.145, 2), '0.14');
});

test('identity: C5 Master Mix, engine 0.1.0', () => {
  assert.equal(TOOL_ID, 'C5');
  assert.equal(TOOL_NAME, 'Master Mix');
  assert.equal(ENGINE_VERSION, '0.1.0');
});
