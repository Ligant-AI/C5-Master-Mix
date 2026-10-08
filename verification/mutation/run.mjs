// Mutation check for the engine's rules (Tasks 4 and 5). Each mutation is a
// single planted fault in a scratch copy of the repository (outside it, in the
// system temp directory); the full test suite must fail on every one. The
// unmutated copy must pass. Exit 1 if any mutation survives.
//
//   node verification/mutation/run.mjs
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// [name, file, exact text, replacement]
const MUTATIONS = [
  // Task 4
  ['rounding: a half rounds down (decimal.js)', 'src/engine/decimal.js', 'if (firstDropped >= 5) kept += 1n;', 'if (firstDropped > 5) kept += 1n;'],
  ['comparison: a half rounds toward zero at the resolution', 'src/engine/compare.js', 'if ((d.mant % div) * 2n >= div) n += 1n;', 'if ((d.mant % div) * 2n > div) n += 1n;'],
  ['normalisation by double multiplication', 'src/engine/units.js', 'const value = Number(Dec.toString(exact));', "const value = Number(p.text.replace(/\\u2212/g, '-')) * 10 ** unit.exp10;"],
  ['commas stripped instead of refused', 'src/engine/units.js', "if (text.includes(',')) {", 'if (false) {'],
  ['C5-UN-11: scale factor computed even when equal', 'src/engine/compare.js', 'if (equalUnderRule(assayVolume, establishedVolume)) return', 'if (false) return'],
  ['IU and U treated as one dimension', 'src/engine/units.js', "  U: 'activity in U',", "  U: 'activity in IU',"],
  // Task 5
  ['C5-HI-01: one component required becomes none', 'src/engine/validate.js', 'if (components.length < 1) {', 'if (components.length < 0) {'],
  ['C5-HI-02: integer checked on the double', 'src/engine/validate.js', 'Dec.trimZeros(samples.dec).exp >= 0', 'Number.isInteger(samples.value)'],
  ['C5-HI-02: zero samples accepted', 'src/engine/validate.js', 'if (samples.sign < 1 || integer === false) {', 'if (samples.sign < 0 || integer === false) {'],
  ['C5-HI-03: zero intended quantity accepted', 'src/engine/validate.js', 'c.intended.sign <= 0', 'c.intended.sign < 0'],
  ['C5-HI-03: zero stock concentration accepted', 'src/engine/validate.js', 'c.stock.sign <= 0', 'c.stock.sign < 0'],
  ['C5-HI-04: zero overage rejected', 'src/engine/validate.js', 'overage.sign < 0', 'overage.sign <= 0'],
  ['C5-HI-05: dimension mismatch not rejected', 'src/engine/validate.js', 'if (reduction(c.intended.unit, c.stock.unit).reducible === false) {', 'if (false) {'],
  ['C5-HI-06: "more than" decided on doubles', 'src/engine/validate.js', 'if (!(canonicalOfDouble(sum, KIND.VOLUME) > canonical(dispensed))) return null;', 'if (!(sum > dispensed.value)) return null;'],
  ['C5-HI-06: total taken from the unrounded sum', 'src/engine/validate.js', 'const total = Dec.toString(shown.map((v) => Dec.fromString(v.display)).reduce(Dec.add));', 'const total = String(sum);'],
  ['C5-HI-06: a component left out of the list', 'src/engine/validate.js', "const lines = shown.map((v) => `${componentName(v)}: ${v.display} µL`).join('; ');", "const lines = shown.slice(1).map((v) => `${componentName(v)}: ${v.display} µL`).join('; ');"],
  ['C5-HI-07 reintroduced (v0.1: residual at or above the dispensed volume)', 'src/engine/validate.js', '  // HI-06 is applied by determine.js (see rejectionHI06).', "  if (isUsable(R) && isUsable(D) && R.value >= D.value) reject('C5-HI-07', 'Residual at or above the staining volume.');"],
  ['C5-HI-08: zero residual rejected', 'src/engine/validate.js', 'R.sign < 0', 'R.sign <= 0'],
  ['C5-HI-09: zero cells rejected', 'src/engine/validate.js', 'cells.sign < 0', 'cells.sign <= 0'],
  ['C5-HI-10: zero minimum transfer accepted', 'src/engine/validate.js', 'minT.sign <= 0', 'minT.sign < 0'],
  ['C5-HI-11: zero dispensed volume accepted', 'src/engine/validate.js', 'D.sign <= 0', 'D.sign < 0'],
  ['signs read from the double', 'src/engine/units.js', 'return { ...common, exact, value, sign: Dec.sign(exact), unrepresentable };', 'return { ...common, exact, value, sign: Math.sign(value), unrepresentable };'],
  ['Q1 not held', 'src/engine/validate.js', "c.intended.kind === KIND.CONCENTRATION && c.estVolume === 'not-recorded'", 'false'],
  ['Q2 held even with a stock concentration', 'src/engine/validate.js', "c.intended.kind === KIND.VOLUME && c.stock.status === 'blank') {", 'c.intended.kind === KIND.VOLUME) {'],
  ['Q2 not held without a stock concentration', 'src/engine/validate.js', "c.intended.kind === KIND.VOLUME && c.stock.status === 'blank') {", "c.intended.kind === KIND.VOLUME && false) {"],
  ['Q4: zero established staining volume not held', 'src/engine/validate.js', 'c.estVolume.sign <= 0', 'c.estVolume.sign < 0'],
  ['rejections not in table order', 'src/engine/validate.js', "  const status = rejections.length ?", "  rejections.reverse();\n  const status = rejections.length ?"],
  ['C5-CP-07: basis requirement decided on doubles', 'src/engine/validate.js', 'basisRequired = recorded.some((c) => !equalUnderRule(svAssay, c.estVolume));', 'basisRequired = recorded.some((c) => svAssay.value !== c.estVolume.value);'],
  // Task 6b
  ['diluent per test not the literal 0 when the components fill the dispense', 'src/engine/determine.js', 'const diluentPerTest = fills ? 0 : D - sumV;', 'const diluentPerTest = D - sumV;'],
  ['diluent in the cocktail not the literal 0 when the components fill the dispense', 'src/engine/determine.js', 'const diluentTotal = fills ? 0 : totalCocktail - sumCocktail;', 'const diluentTotal = totalCocktail - sumCocktail;'],
  ['C5-HI-06 not applied by determine', 'src/engine/determine.js', 'if (hi06) return nonResult', 'if (false) return nonResult'],
  ['preserve-amount ratio computed when the volumes are equal', 'src/engine/determine.js', '{ value: equalUnderRule(c.estVolume, svAssay) ? 1 : c.estVolume.value / SV }', '{ value: c.estVolume.value / SV }'],
  ['overage fraction as (N_eff - n) / n', 'src/engine/determine.js', 'overageFraction = p.overage.value / 100;', 'overageFraction = (nEff - n) / n;'],
  ['C5-FL-08 unevaluated components dropped', 'src/engine/flags.js', "raise('C5-FL-08', recorded.map((c) => c.index), { volumes, unevaluated });", "raise('C5-FL-08', recorded.map((c) => c.index), { volumes, unevaluated: [] });"],
  ['C5-FL-11 factor ignores the scale factor', 'src/engine/flags.js', "c.basisApplied === 'preserve-concentration' ? c.scaleFactor.value * cellRatio : cellRatio", 'cellRatio'],
  ['C5-FL-05 raised for a volume equal to the minimum', 'src/engine/flags.js', 'canonicalOfDouble(c.volumeInCocktail, KIND.VOLUME) < min', 'canonicalOfDouble(c.volumeInCocktail, KIND.VOLUME) <= min'],
  ['C5-FL-07 raised for a total equal to the capacity', 'src/engine/flags.js', 'canonicalOfDouble(ctx.totalCocktail, KIND.VOLUME) > canonical(ctx.capacity)', 'canonicalOfDouble(ctx.totalCocktail, KIND.VOLUME) >= canonical(ctx.capacity)'],
  ['C5-FL-11 factor not withheld at zero assay cells', 'src/engine/flags.js', "if (ctx.cells.sign === 0) return { component: c.index, withheld: true, reason: 'assay-cells-zero' };", ''],
  ['displayed total from the unrounded total', 'src/engine/format.js', 'total_uL: Dec.toString(total)', 'total_uL: sig(v.totalCocktail_uL, 3)'],
  ['pipetting list: components before the diluent', 'src/engine/format.js', "const steps = [{ step: 1, what: 'diluent', volume_uL: volume(v.diluentTotal_uL) }];", "const steps = [];"],
  ['blank residual treated as zero', 'src/engine/validate.js', 'const R = read(inputs.residual, KIND.VOLUME);', "const R = read(inputs.residual && inputs.residual.value === '' ? { ...inputs.residual, value: '0' } : inputs.residual, KIND.VOLUME);"],
];

function suite(dir) {
  const r = spawnSync('node --test tests/*.test.js', { cwd: dir, encoding: 'utf8', shell: true });
  const out = `${r.stdout}${r.stderr}`;
  const fail = Number((/^ℹ fail (\d+)/m.exec(out) || [])[1]);
  const pass = Number((/^ℹ pass (\d+)/m.exec(out) || [])[1]);
  const failing = [...new Set([...out.matchAll(/^✖ (.+?) \([\d.]+ms\)$/gm)].map((m) => m[1]))];
  return { fail, pass, failing };
}

const scratch = mkdtempSync(path.join(tmpdir(), 'c5-mutation-'));
let survived = 0;
try {
  cpSync(ROOT, scratch, { recursive: true, filter: (src) => !/[/\\](\.git|dist)([/\\]|$)/.test(src) });
  const base = suite(scratch);
  console.log(`unmutated: pass ${base.pass}, fail ${base.fail}`);
  if (base.fail !== 0) { console.log('the unmutated suite does not pass; nothing to check'); process.exit(1); }
  for (const [name, file, from, to] of MUTATIONS) {
    const p = path.join(scratch, file);
    const original = readFileSync(p, 'utf8');
    if (!original.includes(from)) { console.log(`MUTATION NOT APPLIED (text not found): ${name}`); survived++; continue; }
    writeFileSync(p, original.replace(from, to));
    const r = suite(scratch);
    writeFileSync(p, original);
    const caught = r.fail > 0;
    if (!caught) survived++;
    console.log(`${caught ? 'caught  ' : 'SURVIVED'} ${name}: fail ${r.fail}${caught ? ` | ${r.failing.join('; ')}` : ''}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`${MUTATIONS.length} mutations, ${MUTATIONS.length - survived} caught, ${survived} survived`);
process.exit(survived ? 1 : 0);
