// Negative controls for the headless check scripts (Task 11, item 2).
// For each check family of verification/headless/form.mjs and outputs.mjs,
// one defect is planted in a scratch copy of the page (outside the repository),
// the copy is built and served on its own port, and only that family's check
// is run against it (--only). The control passes when that check reports FAIL
// and the script exits 1. Writes verification/headless-controls-record.md and
// prints it. Exit 1 if any planted defect goes undetected.
//
//   node verification/mutation/headless-controls.mjs
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 4195;

// [script, --only key, the check's name as reported (prefix), defect, [[file, from, to], ...]]
const CONTROLS = [
  ['form', 'panel-control', 'panel control', 'the panel control also sets provenance',
    [['src/ui/app.js', '    r.data.declaredByPanelControl = true;\n', "    r.data.declaredByPanelControl = true;\n    r.data.provenance = 'titrated-here';\n    { const pv = document.querySelector(`#components-body tr[data-row=\"${i + 1}\"] [data-field=\"provenance\"]`); if (pv) pv.value = 'titrated-here'; }\n"]]],
  ['form', 'panel-control-unchecked', 'panel control unchecked', 'unchecked, the panel control keeps following the assay',
    [['src/ui/app.js', "  if (!on) { status.textContent = ''; return; }", "  if (!on && !rows.some((r) => r.controlled)) { status.textContent = ''; return; }"],
      ['src/ui/app.js', '  else for (const r of rows) r.controlled = false;', '  else for (const r of rows) r.controlled = r.controlled;']]],
  ['form', 'panel-control-retained', 'panel control unticked: each retained value', 'retained values are kept but not marked',
    [['src/ui/app.js', '  markRetained();\n', '']]],
  ['outputs', 'clipboard', 'acceptance 26: "Copy for notebook"', 'the copy leaves out the flags',
    [['src/ui/app.js', '  const text = lastRecord ? notebookText(lastRecord) : \'\';', "  const text = lastRecord ? notebookText(lastRecord).replace(/\\nFlags[\\s\\S]*$/, '') : '';"]]],
  ['form', 'basis-gating', 'basis gating', 'the cocktail is shown while the basis is required and unselected',
    [['src/ui/app.js', "  $('outputs').hidden = !result;", "  $('outputs').hidden = false;"]]],
  ['form', 'recompute', 'recompute on every change', 'a stale result table survives a declaration change',
    [['src/ui/app.js', "    $('result-table').innerHTML = resultTable(rec);", "    if (!$('result-table').innerHTML) $('result-table').innerHTML = resultTable(rec);"]]],
  ['form', 'required', 'acceptance 17', 'a blank sample count is read as 96',
    [['src/ui/app.js', "    samples: val('samples'),", "    samples: val('samples') || '96',"]]],
  ['form', 'reload', 'acceptance 20', 'the dispensed volume is kept in the URL and restored on reload',
    [['src/ui/app.js', '  lastRecord = rec;', "  lastRecord = rec;\n  history.replaceState(null, '', `#d=${encodeURIComponent(panelEl('dispensed.value').value)}`);"],
      ['src/ui/app.js', '  rows.push({ id: nextId++, data: emptyComponent(), controlled: false });\n  renderRows();', "  { const h = /#d=([^&]*)/.exec(location.hash); if (h) panelEl('dispensed.value').value = decodeURIComponent(h[1]); }\n  rows.push({ id: nextId++, data: emptyComponent(), controlled: false });\n  renderRows();"]]],
  ['form', 'storage-network', 'network', 'every change sends the labels to the page\'s own server',
    [['src/ui/app.js', '  lastRecord = rec;', "  lastRecord = rec;\n  new Image().src = `./b?d=${encodeURIComponent(rows.map((r) => r.data.label).join(','))}`;"]]],
  ['form', 'storage-network', 'storage', 'the form is written to browser storage',
    [['src/ui/app.js', '  lastRecord = rec;', "  lastRecord = rec;\n  window['local' + 'Storage'].setItem('c5-form', JSON.stringify(inputs()));"]]],
  ['form', 'cap', 'component cap', 'a 61st component is added',
    [['src/ui/app.js', '  if (rows.length >= COMPONENT_CAP) {', '  if (rows.length > COMPONENT_CAP) {']]],
  ['outputs', 'agreement', 'acceptance 27', 'the VZ-02 legend labels the volume per test, not the volume in the cocktail',
    [['src/ui/visuals.js', 'data-key="vcocktail-${c.index}">${esc(vol(c.volumeInCocktail.value))}', 'data-key="vcocktail-${c.index}">${esc(vol(c.volumePerTest.value))}']]],
  ['outputs', 'withheld', 'acceptance 28', 'a withheld ratio is drawn at 1',
    [['src/ui/visuals.js', "      ? `<text x=\"${LEFT + 6}\"", "      ? `<circle class=\"mark\" data-mark=\"${c.index}\" data-deliberate=\"mark\" cx=\"${xOf(1)}\" cy=\"${y}\" r=\"4\" fill=\"#000000\"/><text x=\"${LEFT + 6}\""]]],
  ['outputs', 'symmetry', 'acceptance 29', 'the ratio axis is linear, not logarithmic',
    [['src/ui/visuals.js', '  const xOf = (r) => LEFT + ((Math.log2(r) + L) / (2 * L)) * (W - LEFT - RIGHT);', '  const xOf = (r) => LEFT + (r / (2 ** L)) * (W - LEFT - RIGHT);']]],
  ['outputs', 'zero-residual', 'C5-VZ-01', 'a zero residual segment is omitted',
    [['src/ui/visuals.js', '  const residual = R === 0\n    ? `<line data-segment="residual" data-key="vz01-residual-segment" x1="1" y1="6" x2="1" y2="38" stroke="${INK}" stroke-width="2"/>`', "  const residual = R === 0\n    ? ''"]]],
  ['outputs', 'sixty', 'C5-FX-23 at 60 components', 'the VZ-03 axis is not pinned',
    [['styles.css', '.vz03-axis { position: sticky;', '.vz03-axis { position: static;']]],
  ['outputs', 'print-notebook', 'acceptance 25', 'the bench sheet leaves out the flags',
    [['src/ui/render.js', '  html += `<h3>Flags</h3>', '  if (false) html += `<h3>Flags</h3>']]],
  ['outputs', 'acceptance-14', 'acceptance 14', 'the C5-CP-07 names line is not shown',
    [['src/ui/render.js', '  if (rec.basisRequired === false && rec.values.fl08Unevaluated.length) {', '  if (false) {']]],
  ['outputs', 'acceptance-21', 'acceptance 21', 'a register row is not shown',
    [['src/ui/render.js', '    + REGISTER.map((r) =>', '    + REGISTER.slice(1).map((r) =>']]],
  ['outputs', 'print-paint', 'visual paint', 'the original defect: segment paint scoped to .visuals, so the bench sheet falls back to default black',
    [['src/ui/visuals.js', '${fill(p, compPattern(c.index))} ${OUTLINE}/>`;', 'class="seg-a"/>`;'],
      ['src/ui/visuals.js', 'height="24" fill="#d9d9d9" ${OUTLINE}/>', 'height="24" class="seg-a"/>'],
      ['src/ui/visuals.js', "height=\"24\" ${fill(p, 'residual')} ${OUTLINE}/>", 'height="24" class="seg-b"/>'],
      ['src/ui/visuals.js', "height=\"26\" ${fill(p, 'diluent')} ${OUTLINE}/>", 'height="26" class="seg-diluent"/>'],
      ['styles.css', '.visuals .vz { margin-bottom: 16px; }', '.visuals .vz { margin-bottom: 16px; }\n.visuals .seg-a { fill: #b8d8cf; stroke: #555555; stroke-width: 1; }\n.visuals .seg-b { fill: #e6e6e6; stroke: #555555; stroke-width: 1; }\n.visuals .seg-diluent { fill: #ffffff; stroke: #555555; stroke-width: 1; }']]],
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function serve(dir) {
  const p = spawn(process.execPath, [path.join(dir, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: dir, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return p; } catch { /* not yet */ }
    await wait(200);
  }
  p.kill();
  throw new Error('preview did not start');
}

const scratch = mkdtempSync(path.join(tmpdir(), 'c5-controls-'));
const rows = [];
let ok = true;
try {
  // The repository's own .git and dist only; node_modules/vite/dist is needed.
  cpSync(ROOT, scratch, { recursive: true, filter: (src) => !['.git', 'dist'].includes(path.relative(ROOT, src).split(path.sep)[0]) });
  for (const [script, key, check, defect, edits] of CONTROLS) {
    const originals = new Map();
    let applied = true;
    for (const [file, from, to] of edits) {
      const f = path.join(scratch, file);
      if (!originals.has(f)) originals.set(f, readFileSync(f, 'utf8'));
      const now = readFileSync(f, 'utf8');
      if (!now.includes(from)) { applied = false; break; }
      writeFileSync(f, now.replace(from, to));
    }
    let row;
    if (!applied) row = { script, key, check, defect, result: 'NOT APPLIED (text not found)', detected: false };
    else {
      const build = spawnSync(process.execPath, [path.join(scratch, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: scratch, encoding: 'utf8' });
      if (build.status !== 0) row = { script, key, check, defect, result: `BUILD FAILED: ${build.stderr.slice(0, 200)}`, detected: false };
      else {
        const server = await serve(scratch);
        const run = spawnSync(process.execPath, [path.join(ROOT, `verification/headless/${script}.mjs`), `http://localhost:${PORT}/`, `--only=${key}`], { cwd: ROOT, encoding: 'utf8' });
        server.kill();
        await wait(300);
        const lines = run.stdout.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
        const target = lines.find((l) => l.check.startsWith(check));
        const detected = run.status === 1 && target && target.result === 'FAIL';
        row = { script, key, check, defect, result: detected ? 'detected' : `NOT DETECTED (exit ${run.status}, ${target ? target.result : 'no such check'})`, detected };
      }
    }
    for (const [f, s] of originals) writeFileSync(f, s);
    if (!row.detected) ok = false;
    rows.push(row);
    console.log(`${row.detected ? 'detected' : 'MISSED  '} ${script}.mjs --only=${key}: ${defect}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const out = [
  '# Negative controls for the headless checks',
  '',
  'Generated by `node verification/mutation/headless-controls.mjs` (Task 11, item 2). Each defect is planted alone in a scratch copy of the page outside the repository; the copy is built and served on its own port; and only the named check family is run against it. A control is **detected** when that check reports FAIL and the script exits 1.',
  '',
  '| Script | Check family | Defect planted | Result |',
  '|---|---|---|---|',
  ...rows.map((r) => `| ${r.script}.mjs | ${r.key} | ${r.defect} | ${r.result} |`),
  '',
  ok ? `All ${rows.length} planted defects were detected.` : '**At least one planted defect was not detected.**',
  '',
];
writeFileSync(path.join(ROOT, 'verification/headless-controls-record.md'), out.join('\n'));
console.log(`${rows.length} controls, ${rows.filter((r) => r.detected).length} detected`);
process.exit(ok ? 0 : 1);
