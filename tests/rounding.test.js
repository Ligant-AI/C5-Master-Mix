// Task 4: display rounding (C5-UN-04 to C5-UN-06), numfmt.js and decimal.js.
// Half away from zero, applied to the exact binary value of the double.
//
// The oracle is Number.prototype.toPrecision, which ECMA-262 defines on the
// exact mathematical value of the double ("if there are two such n, pick the
// larger n"), with the sign handled separately: that is half away from zero on
// the exact binary value. It is independent of decimal.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Dec from '../src/engine/decimal.js';
import { sig, roundDec } from '../src/engine/numfmt.js';

/** toPrecision's string, read as an exact decimal (it may use e-notation). */
function oracle(x, n) {
  const s = x.toPrecision(n);
  const [m, e] = s.split('e');
  return Dec.shift(Dec.fromString(m), e === undefined ? 0 : Number(e));
}

const same = (a, b) => Dec.cmp(a, b) === 0;

function nextUp(x) {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  v.setBigUint64(0, v.getBigUint64(0) + (x >= 0 ? 1n : -1n));
  return v.getFloat64(0);
}
function nextDown(x) {
  const v = new DataView(new ArrayBuffer(8));
  v.setFloat64(0, x);
  v.setBigUint64(0, v.getBigUint64(0) + (x > 0 ? -1n : 1n));
  return v.getFloat64(0);
}

test('exact binary ties round half away from zero', () => {
  // Each value is exactly representable, so it is a true tie at the stated precision.
  const cases = [
    [0.125, 2, '0.13'], [-0.125, 2, '-0.13'], [0.375, 2, '0.38'], [2.5, 1, '3'], [-2.5, 1, '-3'],
    [1.5, 1, '2'], [0.5, 1, '0.5'], [12.5, 2, '13'], [1002.5, 4, '1003'], [-1002.5, 4, '-1003'],
    [0.0009765625, 6, '0.000976563'], [999.5, 3, '1000'], [99.5, 2, '100'], [4.5, 1, '5'],
    [1048576.5, 7, '1048577'], [0.03125, 3, '0.0313'], [-0.03125, 3, '-0.0313'],
  ];
  for (const [x, n, want] of cases) {
    assert.equal(Dec.toString(Dec.fromNumberExact(x)).length > 0, true);
    assert.equal(sig(x, n), want, `${x} at ${n} sf`);
    assert.ok(same(roundDec(x, n), oracle(x, n)), `${x} at ${n} sf against toPrecision`);
  }
});

test('values stored just below a decimal tie round down; just above, up', () => {
  // The literal looks like a tie; the double it is stored as is not.
  const below = [
    [2.675, 3, '2.67', '2.67499999999999982236431605997495353221893310546875'],
    [1.005, 3, '1.00', '1.00499999999999989341858963598497211933135986328125'],
    [0.145, 2, '0.14', '0.1449999999999999900079927783735911361873149871826171875'],
    [1.015, 3, '1.01', '1.0149999999999999023003738329862244427204132080078125'],
    [0.155, 2, '0.15', '0.1549999999999999988897769753748434595763683319091796875'],
  ];
  for (const [x, n, want, expansion] of below) {
    assert.equal(Dec.toString(Dec.fromNumberExact(x)), expansion, `${x} is stored as ${expansion}`);
    assert.equal(sig(x, n), want, `${x} at ${n} sf`);
    assert.ok(same(roundDec(x, n), oracle(x, n)));
  }
  const above = [
    [2.665, 3, '2.67', '2.66500000000000003552713678800500929355621337890625'],
    [8.345, 3, '8.35', '8.3450000000000006394884621840901672840118408203125'],
  ];
  for (const [x, n, want, expansion] of above) {
    assert.equal(Dec.toString(Dec.fromNumberExact(x)), expansion, `${x} is stored as ${expansion}`);
    assert.equal(sig(x, n), want, `${x} at ${n} sf`);
    assert.ok(same(roundDec(x, n), oracle(x, n)));
  }
});

test('every significant-figure boundary from 1e-12 to 1e12, at 3 and 6 significant figures', (t) => {
  // At each decade, the tie below the next power of ten (999.5 at 3 sf below
  // 1000) and the doubles either side of it: each must round as the exact
  // value says, carrying into the next decade only from the tie up.
  let checked = 0;
  for (const n of [3, 6]) {
    for (let k = -12; k <= 12; k++) {
      const tieText = `${'9'.repeat(n)}.5e${k - n}`;
      const tie = Number(tieText);
      for (const x of [nextDown(nextDown(tie)), nextDown(tie), tie, nextUp(tie), nextUp(nextUp(tie)), -tie, -nextUp(tie)]) {
        assert.ok(same(roundDec(x, n), oracle(x, n)), `${x} at ${n} sf: ${sig(x, n)} against ${x.toPrecision(n)}`);
        checked++;
      }
      // The carry: anything at or above the exact tie rounds to 10^k.
      const exactTie = Dec.shift(Dec.fromString(`${'9'.repeat(n)}5`), k - n - 1);
      const tieDec = Dec.fromNumberExact(tie);
      const rounded = roundDec(tie, n);
      if (Dec.cmp(tieDec, exactTie) >= 0) assert.ok(same(rounded, Dec.shift(Dec.fromString('1'), k)), `${tieText} carries to 1e${k}`);
      else assert.ok(same(rounded, Dec.shift(Dec.fromString('9'.repeat(n)), k - n)), `${tieText} stays below 1e${k}`);
    }
  }
  t.diagnostic(`${checked} boundary values checked against toPrecision`);
});

test('the same rule on 200 000 doubles across 40 decades, at 3 and 6 significant figures', () => {
  // Deterministic: xorshift64*, seeded.
  let s = 0x9e3779b97f4a7c15n;
  const rand = () => {
    s ^= s >> 12n; s ^= (s << 25n) & 0xffffffffffffffffn; s ^= s >> 27n;
    return Number(((s * 0x2545f4914f6cdd1dn) & 0xffffffffffffffffn) >> 11n) / 2 ** 53;
  };
  for (let i = 0; i < 100000; i++) {
    const x = (rand() < 0.5 ? -1 : 1) * 10 ** (rand() * 40 - 20) * (1 + rand());
    for (const n of [3, 6]) {
      assert.ok(same(roundDec(x, n), oracle(x, n)), `${x} at ${n} sf: ${sig(x, n)} against ${x.toPrecision(n)}`);
    }
  }
});

test('decimal.js: sums of displayed decimals are exact (for C5-DT-04)', () => {
  const sum = (xs) => Dec.toString(xs.map(Dec.fromString).reduce(Dec.add));
  assert.equal(sum(['0.1', '0.2']), '0.3');
  assert.equal(sum(['12.4', '0.125', '1.33', '86.1']), '99.955');
  assert.equal(sum(['1.25', '1.25', '1.25', '1.25', '1.25', '1.25', '1.25', '1.25', '1.25', '1.25']), '12.50');
  assert.notEqual(0.1 + 0.2, 0.3); // what a double sum would have shown
});
