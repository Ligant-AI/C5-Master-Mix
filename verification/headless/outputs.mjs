// Task 9 headless checks on the real page (Tasks 7b to 10 brief, §4.3).
// Headless Chromium against the production preview. Prints one JSON line per
// check, writes greyscale bench-sheet captures of C5-FX-24 to
// verification/print/, and exits 1 on any miss.
//
//   node verification/headless/outputs.mjs [base]   default http://localhost:4175/
import { chromium } from 'playwright';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fill } from './fill.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv.slice(2).find((x) => !x.startsWith('--')) || 'http://localhost:4175/';
const FIXTURES = readdirSync(path.join(ROOT, 'tests/fixtures')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures', f), 'utf8')));
const fx = (id) => FIXTURES.find((x) => x.id === id);
const VIEW = { width: 1366, height: 650 };
// --only=<key> runs the one check family with that key (for the negative
// controls, verification/mutation/headless-controls.mjs); otherwise all run.
const onlyArg = process.argv.find((x) => x.startsWith('--only='));
const want = (key) => !onlyArg || onlyArg.slice(7) === key;
// --decline-consent: on the hosted pages the suite's consent banner covers the
// bottom of the viewport until the visitor chooses; with this flag, each page
// chooses Decline first, as a visitor does. Off by default.
const DECLINE = process.argv.includes('--decline-consent');

const browser = await chromium.launch();
let failed = false;
const report = (check, ok, detail) => { if (!ok) failed = true; console.log(JSON.stringify({ check, result: ok ? 'pass' : 'FAIL', ...detail })); };

async function open(input) {
  const context = await browser.newContext({ viewport: VIEW });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  if (DECLINE) {
    const decline = page.locator('.lpc button', { hasText: 'Decline' });
    if (await decline.count()) await decline.first().click();
  }
  await fill(page, input);
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors };
}
const recordOf = async (page) => JSON.parse(await page.evaluate(() => document.getElementById('object-text').textContent));

try {
  // ---- acceptance 27: every visual agrees with the table and the object -------------------
  if (want('agreement')) {
    const results = [];
    for (const f of FIXTURES) {
      const { context, page, errors } = await open(f.input);
      const rec = await recordOf(page);
      if (rec.status !== 'result') { await context.close(); continue; }
      const r = await page.evaluate(() => {
        const out = document.getElementById('outputs');
        const text = (sel) => [...out.querySelectorAll(sel)].map((e) => [e.getAttribute('data-key'), e.textContent.trim()]);
        return {
          table: Object.fromEntries(text('#result-table [data-key]')),
          visuals: text('#visuals [data-key]'),
        };
      });
      const misses = [];
      for (const [key, shown] of r.visuals) {
        if (key.startsWith('vz01-')) continue; // checked against the object below
        if (!(key in r.table)) misses.push({ key, visual: shown, table: '(absent)' });
        else if (r.table[key] !== shown) misses.push({ key, visual: shown, table: r.table[key] });
      }
      // VZ-01 labels the residual, dispensed and assay staining volumes, which the
      // table does not list: they are checked against the object's own values,
      // displayed as volumes are (3 significant figures).
      const vz01 = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#outputs [data-key^="vz01-"]')].map((e) => [e.getAttribute('data-key'), e.textContent])));
      const sig3 = (x) => { if (x === 0) return '0'; const s = Number(x.toPrecision(3)); return s.toString(); };
      const numIn = (s) => (s ? Number(s.match(/-?[\d.]+(?= µL)/)?.[0]) : NaN);
      const pairs = [['vz01-residual', rec.declarations.residual.normalised.value], ['vz01-dispensed', rec.declarations.dispensed.normalised.value], ['vz01-sv', rec.values.svAssay.value]];
      for (const [k, v] of pairs) if (Math.abs(numIn(vz01[k]) - Number(sig3(v))) > 0) misses.push({ key: k, visual: vz01[k], object: v });
      results.push({ fixture: f.id, labelsCompared: r.visuals.length, misses, errors });
      await context.close();
    }
    report('acceptance 27: every visual label equals the table and the object', results.every((x) => !x.misses.length && !x.errors.length), {
      fixtures: results.length, labelsCompared: results.reduce((s, x) => s + x.labelsCompared, 0), misses: results.filter((x) => x.misses.length || x.errors.length),
    });
  }

  // ---- acceptance 28: a withheld value is never drawn (C5-FX-20) ------------------------------
  if (want('withheld')) {
    const { context, page } = await open(fx('C5-FX-20').input);
    const rec = await recordOf(page);
    const withheld = rec.values.components.filter((c) => c.ratio.withheld).map((c) => c.index);
    const r = await page.evaluate((withheld) => withheld.map((i) => {
      const row = document.querySelector(`#outputs [data-component="vz03-${i}"]`);
      return { component: i, rowExists: !!row, marks: row ? row.querySelectorAll('circle, [data-mark]').length : -1, label: row ? row.textContent : '' };
    }), withheld);
    report('acceptance 28: no mark for a withheld ratio, an empty labelled row (C5-FX-20)', withheld.length > 0 && r.every((x) => x.rowExists && x.marks === 0 && /withheld/.test(x.label) && /FL-02/.test(x.label)), { withheld, rows: r });
    await context.close();
  }

  // ---- acceptance 29: log symmetry (C5-FX-21) -------------------------------------------
  if (want('symmetry')) {
    const { context, page } = await open(fx('C5-FX-21').input);
    const rec = await recordOf(page);
    const ratios = rec.values.components.map((c) => [c.index, c.ratio.value]);
    const geo = await page.evaluate(() => {
      const unity = document.querySelector('#outputs #vz03 > svg line.unity').getBoundingClientRect();
      const marks = Object.fromEntries([...document.querySelectorAll('#outputs #vz03 circle[data-mark]')].map((c) => { const b = c.getBoundingClientRect(); return [c.getAttribute('data-mark'), b.left + b.width / 2]; }));
      return { unityX: unity.left + unity.width / 2, marks };
    });
    const pairs = [];
    for (const [i, r] of ratios) for (const [j, s] of ratios) if (i < j && Math.abs(r * s - 1) < 1e-12) {
      const di = geo.marks[i] - geo.unityX;
      const dj = geo.marks[j] - geo.unityX;
      pairs.push({ components: [i, j], ratios: [r, s], distancesFromOnePx: [di, dj], asymmetryPx: Math.abs(di + dj) });
    }
    report('acceptance 29: r and 1/r equidistant from 1 within 0.5 px (C5-FX-21)', pairs.length > 0 && pairs.every((p) => p.asymmetryPx <= 0.5 && Math.sign(p.distancesFromOnePx[0]) === Math.sign(p.ratios[0] - 1)), { pairs });
    await context.close();
  }

  // ---- C5-VZ-01: the zero residual segment (C5-FX-22) ------------------------------------
  if (want('zero-residual')) {
    const { context, page } = await open(fx('C5-FX-22').input);
    const r = await page.evaluate(() => ({
      segment: !!document.querySelector('#outputs #vz01 [data-key="vz01-residual-segment"]'),
      segmentTag: document.querySelector('#outputs #vz01 [data-key="vz01-residual-segment"]')?.tagName,
      label: document.querySelector('#outputs [data-key="vz01-residual"]')?.textContent,
    }));
    report('C5-VZ-01: a declared zero residual drawn as a labelled zero-width segment (C5-FX-22)', r.segment && r.segmentTag === 'line' && /present with cells 0 µL/.test(r.label), r);
    await context.close();
  }

  // ---- C5-FX-23 at 60 components --------------------------------------------------------
  if (want('sixty')) {
    const { context, page, errors } = await open(fx('C5-FX-23').input);
    const rec = await recordOf(page);
    const codes = new Map();
    for (const f of rec.flags) for (const i of f.components) codes.set(i, [...(codes.get(i) || []), f.code.replace('C5-', '')]);
    const shown = await page.evaluate(() => ({
      vz02: Object.fromEntries([...document.querySelectorAll('#outputs [data-component^="vz02-"]')].map((e) => [e.getAttribute('data-component').slice(5), e.textContent])),
      vz03: Object.fromEntries([...document.querySelectorAll('#outputs [data-component^="vz03-"]')].map((e) => [e.getAttribute('data-component').slice(5), e.textContent])),
    }));
    const missingCodes = [];
    for (const [i, cs] of codes) for (const v of ['vz02', 'vz03']) for (const c of cs) if (!(shown[v][i] || '').includes(c)) missingCodes.push({ component: i, visual: v, code: c });
    const legendComplete = rec.values.components.every((c) => c.index in shown.vz02);
    // Scroll the strip: wherever any of its rows is in view below the bounded
    // block, the axis labels must be in view and uncovered.
    const steps = await page.evaluate(async () => {
      const strip = document.querySelector('#outputs #vz03');
      const top = strip.getBoundingClientRect().top + scrollY - innerHeight;
      const bottom = strip.getBoundingClientRect().bottom + scrollY;
      const out = [];
      for (let y = Math.max(0, top); y <= bottom; y += 50) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const blockBottom = document.getElementById('bounded-block').getBoundingClientRect().bottom;
        const rows = [...strip.querySelectorAll('[data-component^="vz03-"]')].filter((g) => { const b = g.getBoundingClientRect(); return b.bottom > blockBottom && b.top < innerHeight; });
        if (!rows.length) continue;
        const labels = [...strip.querySelectorAll('.vz03-axis [data-tick]')];
        const bad = labels.filter((t) => {
          const b = t.getBoundingClientRect();
          if (!(b.top >= 0 && b.bottom <= innerHeight)) return true;
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return !(hit === t || t.contains(hit));
        }).map((t) => t.getAttribute('data-tick'));
        out.push({ scrollY: window.scrollY, rowsInView: rows.length, axisLabelsOutOfView: bad });
      }
      return out;
    });
    const axisOk = steps.length > 0 && steps.every((s) => s.axisLabelsOutOfView.length === 0);
    report('C5-FX-23 at 60 components: reason codes on every visual, the VZ-03 axis in view, the VZ-02 legend complete', rec.values.components.length === 60 && missingCodes.length === 0 && legendComplete && axisOk && errors.length === 0, {
      components: rec.values.components.length, flags: rec.flags.map((f) => f.code), flaggedComponents: codes.size, missingCodes, legendComplete,
      axisChoice: 'pinned (sticky within the strip, under the bounded block)', scrollStepsWithRowsInView: steps.length, stepsWithAxisOutOfView: steps.filter((s) => s.axisLabelsOutOfView.length), errors,
    });
    await context.close();
  }

  // ---- acceptance 25 and 26: the bench sheet in print media, and the notebook copy ------------
  if (want('print-notebook')) {
    const results = [];
    for (const id of ['C5-FX-23', 'C5-FX-11b', 'C5-FX-22', 'C5-FX-19', 'C5-FX-01']) {
      const { context, page } = await open(fx(id).input);
      const rec = await recordOf(page);
      await page.emulateMedia({ media: 'print' });
      const sheet = await page.evaluate(() => {
        const s = document.getElementById('bench-sheet');
        return { visible: getComputedStyle(s).display !== 'none', text: s.innerText, mainHidden: getComputedStyle(document.getElementById('main')).display === 'none', svgs: s.querySelectorAll('svg').length };
      });
      const words = await page.evaluate(() => [...document.querySelectorAll('#bench-sheet [data-flag-words]')].map((d) => [d.getAttribute('data-flag-words'), d.innerText]));
      const notebook = await page.evaluate(() => document.getElementById('notebook-text').value);
      const flagCodes = rec.flags.map((f) => f.code);
      const sheetMissing = flagCodes.filter((c) => !words.some(([k, t]) => k === c && t.length > 60));
      // The sheet's own residual row, with the residual as declared, zero included.
      const residualRow = await page.evaluate(() => [...document.querySelectorAll('#bench-sheet tr')].map((tr) => tr.innerText).find((t) => t.startsWith('Present with cells (residual)')));
      const residualShown = residualRow === `Present with cells (residual)\t${rec.declarations.residual.value} ${rec.declarations.residual.unit}`;
      const notebookNeeds = [
        ...['Dispensed cocktail volume per test', 'Volume already present with the cells', 'Assay cell number per test', 'Number of samples', 'Overage', 'Diluent', 'Minimum reliable transfer volume', 'Vessel working capacity', 'Transfer basis', 'Effective number of tests'],
        ...flagCodes,
        ...rec.declarations.components.map((c) => `Component ${c.index}`),
      ];
      const notebookMissing = notebookNeeds.filter((s) => !notebook.includes(s));
      const perComponent = rec.values.components.every((c) => new RegExp(`Component ${c.index}[^\\n]*µL per test; [^\\n]*µL in the cocktail; [^\\n]*(in the assay|concentration withheld)`).test(notebook));
      results.push({ fixture: id, printShowsOnlyTheSheet: sheet.visible && sheet.mainHidden, flags: flagCodes.length, flagsMissingWords: sheetMissing, residualShown, residualRow, visualsOnSheet: sheet.svgs, notebookMissing, notebookHasEachVolumeAndConcentration: perComponent });
      await context.close();
    }
    report('acceptance 25: the bench sheet in print media carries every flag in words and the residual', results.every((r) => r.printShowsOnlyTheSheet && !r.flagsMissingWords.length && r.residualShown && r.visualsOnSheet >= 4), { results: results.map(({ notebookMissing, notebookHasEachVolumeAndConcentration, ...x }) => x) });
    report('acceptance 26: the notebook copy carries every declaration, every flag in words, each volume and concentration, and the effective test count', results.every((r) => !r.notebookMissing.length && r.notebookHasEachVolumeAndConcentration), { results: results.map((r) => ({ fixture: r.fixture, notebookMissing: r.notebookMissing, eachVolumeAndConcentration: r.notebookHasEachVolumeAndConcentration })) });
  }

  // ---- acceptance 14 on the page (C5-FX-11) -------------------------------------------
  if (want('acceptance-14')) {
    const { context, page } = await open(fx('C5-FX-11').input);
    const rec = await recordOf(page);
    const unevaluated = rec.values.fl08Unevaluated;
    const r = await page.evaluate((unevaluated) => ({
      cells: unevaluated.map((i) => document.querySelector(`#outputs #result-table [data-key="ratio-${i}"]`)?.textContent),
      cp07Block: document.getElementById('cp07-statement').textContent,
      cp07Names: document.querySelector('[data-component="names-CP-07"]')?.textContent || '',
      notEvaluated: [...document.querySelectorAll('#derivation dd')].map((d) => d.textContent).find((t) => t.startsWith('Not evaluated for C5-FL-08')) || '',
    }), unevaluated);
    const ok = unevaluated.length > 0 && r.cells.every((t) => /^withheld/.test(t) && t.trim() !== '1' && t.trim() !== '1.00')
      && /not required/.test(r.cp07Block) && unevaluated.every((i) => r.cp07Names.includes(`Component ${i}`)) && unevaluated.every((i) => r.notEvaluated.includes(`Component ${i}`));
    report('acceptance 14: withheld in the cell, named unevaluated for C5-FL-08, named separately under C5-CP-07 (C5-FX-11)', ok, { unevaluated, ...r });
    await context.close();
  }

  // ---- acceptance 21: register, failure list and privacy text on the page ------------------
  if (want('acceptance-21')) {
    const { context, page } = await open(fx('C5-FX-01').input);
    const { REGISTER, FAILURES } = await import('../../src/engine/register.js');
    const { PRIVACY_STATEMENT } = await import('../../src/shared/privacy-statement.js');
    const r = await page.evaluate(() => ({
      rows: [...document.querySelectorAll('#register tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent)),
      failures: document.querySelectorAll('#failures ol > li').length,
      privacy: document.querySelector('#privacy-body p').textContent,
    }));
    const statuses = new Set(['derived', 'characterised', 'measured', 'disclosed', 'convention', 'proposed', 'open']);
    const rowsOk = r.rows.length === REGISTER.length && r.rows.every((x) => x.length === 4 && x.every((t) => t.trim().length > 0) && statuses.has(x[3].split(' ')[0]));
    const privacyByteEqual = Buffer.from(r.privacy, 'utf8').equals(Buffer.from(PRIVACY_STATEMENT, 'utf8'));
    report('acceptance 21: every register row with value, basis and status; the failure list; the privacy text byte-for-byte', rowsOk && r.failures === FAILURES.length && r.failures === 10 && privacyByteEqual, {
      registerRows: r.rows.length, everyRowHasValueBasisAndOneStatus: rowsOk, failureClasses: r.failures, privacyByteEqual, privacyText: 'C7\'s statement, pending URS v1.0.1',
    });
    await context.close();
  }

  // ---- acceptance 26: the notebook copy on the clipboard (Task 13, item 6) -----------------
  if (want('clipboard')) {
    const results = [];
    for (const id of ['C5-FX-01', 'C5-FX-11b', 'C5-FX-16']) {
      const context = await browser.newContext({ viewport: VIEW, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await context.newPage();
      await page.goto(base, { waitUntil: 'networkidle' });
      await fill(page, fx(id).input);
      const rendered = await page.evaluate(() => document.getElementById('notebook-text').value);
      const shown = await page.evaluate(() => !document.getElementById('outputs').hidden);
      let clip = null;
      if (shown) {
        await page.locator('#copy-notebook').click();
        await page.waitForFunction(() => /Copied/.test(document.getElementById('copy-status').textContent));
        clip = await page.evaluate(() => navigator.clipboard.readText());
      }
      results.push({ fixture: id, copyButtonShown: shown, clipboardEqualsNotebookCopy: shown ? clip === rendered : null, characters: clip ? clip.length : 0 });
      await context.close();
    }
    report('acceptance 26: "Copy for notebook" puts exactly the rendered notebook copy on the clipboard', results.filter((r) => r.copyButtonShown).length >= 2 && results.every((r) => !r.copyButtonShown || r.clipboardEqualsNotebookCopy), { results });
  }

  // ---- the paint of every visual, printed and on the page (C5-VZ-07, VZ-08; acceptance 30) ------
  if (want('print-paint')) {
    const results = [];
    for (const id of ['C5-FX-24', 'C5-FX-22', 'C5-FX-01', 'C5-FX-20']) {
      const { context, page } = await open(fx(id).input);
      for (const media of ['print', 'screen']) {
        await page.emulateMedia({ media });
        const r = await page.evaluate((media) => {
          const root = document.getElementById(media === 'print' ? 'bench-sheet' : 'outputs');
          const paint = (el) => { const cs = getComputedStyle(el); return { fill: cs.fill, stroke: cs.stroke, strokeWidth: cs.strokeWidth }; };
          const same = (a, b) => a.fill === b.fill && a.stroke === b.stroke && a.strokeWidth === b.strokeWidth;
          const adjacent = [];
          for (const vz of ['vz01', 'vz02']) {
            const segs = [...root.querySelectorAll(`[id$="${vz}"] [data-segment]`)].sort((a, b) => a.getBBox().x - b.getBBox().x);
            for (let i = 1; i < segs.length; i++) {
              const a = paint(segs[i - 1]); const b = paint(segs[i]);
              if (same(a, b)) adjacent.push({ visual: vz, pair: [segs[i - 1].getAttribute('data-segment'), segs[i].getAttribute('data-segment')], paint: a });
            }
          }
          const defaultBlack = [...root.querySelectorAll('svg rect, svg circle, svg path, svg polygon, svg text')]
            .filter((el) => !el.closest('defs, pattern') && !el.hasAttribute('data-deliberate'))
            .filter((el) => getComputedStyle(el).fill === 'rgb(0, 0, 0)')
            .map((el) => `${el.tagName} ${el.getAttribute('data-segment') || el.getAttribute('data-key') || el.textContent.slice(0, 20)}`);
          const unstrokedLines = [...root.querySelectorAll('svg line')].filter((el) => !el.closest('defs, pattern') && getComputedStyle(el).stroke === 'none').length;
          const segments = root.querySelectorAll('[data-segment]').length;
          return { segments, adjacentAlike: adjacent.slice(0, 5), adjacentAlikeCount: adjacent.length, defaultBlack: defaultBlack.slice(0, 5), defaultBlackCount: defaultBlack.length, unstrokedLines };
        }, media);
        results.push({ fixture: id, media, ...r });
      }
      await context.close();
    }
    report('visual paint: adjacent segments differ by fill, pattern or stroke; nothing uses the default black fill (printed and on the page)', results.every((r) => r.segments > 0 && r.adjacentAlikeCount === 0 && r.defaultBlackCount === 0 && r.unstrokedLines === 0), { results });
  }

  // ---- greyscale bench sheet of C5-FX-24, for Adacs (ahead of acceptance 30) ---------------------
  if (want('greyscale')) {
    const dir = path.join(ROOT, 'verification/print');
    mkdirSync(dir, { recursive: true });
    const { context, page } = await open(fx('C5-FX-24').input);
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => { document.documentElement.style.filter = 'grayscale(1)'; });
    const file = path.join(dir, 'C5-FX-24-bench-sheet-greyscale.png');
    await page.screenshot({ path: file, fullPage: true });
    report('greyscale bench sheet of C5-FX-24 saved for Adacs (acceptance 30 pending his re-check)', true, { screenshot: path.relative(ROOT, file) });
    await context.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
