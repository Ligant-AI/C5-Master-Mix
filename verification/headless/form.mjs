// Task 8 headless checks on the real page (Tasks 7b to 10 brief, §3.3).
// Headless Chromium against the production preview. Prints one JSON line per
// check, and exits 1 on any miss.
//
//   node verification/headless/form.mjs [base]   default http://localhost:4175/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fill, typeInto } from './fill.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const base = process.argv.slice(2).find((x) => !x.startsWith('--')) || 'http://localhost:4175/';
const fixture = (id) => JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures', `${id}.json`), 'utf8')).input;
const clone = (x) => JSON.parse(JSON.stringify(x));
const VIEW = { width: 1366, height: 650 };
// --only=<key> runs the one check family with that key (for the negative
// controls, verification/mutation/headless-controls.mjs); otherwise all run.
const onlyArg = process.argv.find((x) => x.startsWith('--only='));
const want = (key) => !onlyArg || onlyArg.slice(7) === key;

const browser = await chromium.launch();
let failed = false;
const report = (check, ok, detail) => { if (!ok) failed = true; console.log(JSON.stringify({ check, result: ok ? 'pass' : 'FAIL', ...detail })); };

async function fresh() {
  const context = await browser.newContext({ viewport: VIEW });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  return { context, page, errors };
}
// Everything the page shows that depends on the inputs.
const snapshot = (page) => page.evaluate(() => ({
  block: document.getElementById('bounded-block').innerText,
  state: document.getElementById('state-region').innerText,
  outputsHidden: document.getElementById('outputs').hidden,
  outputs: document.getElementById('outputs').hidden ? '' : document.getElementById('result-table').innerText + document.getElementById('pipetting-list').innerText + document.getElementById('derivation').innerText + document.getElementById('visuals').innerText,
  names: document.getElementById('flag-names').innerText,
  notebook: document.getElementById('notebook-text').value,
}));
const recordOf = async (page) => JSON.parse(await page.evaluate(() => document.getElementById('object-text').textContent));
const rowField = (page, i, f) => page.locator(`#components-body tr[data-row="${i}"] [data-field="${f}"]`);

try {
  // ---- the panel control: five behaviours --------------------------------------
  if (want('panel-control')) {
    const { context, page } = await fresh();
    const control = page.locator('#panel-control');
    const startsUnselected = !(await control.isChecked());
    const p = clone(fixture('C5-FX-01'));
    p.dispensed = { value: '50', unit: 'µL' };
    p.residual = { value: '20', unit: 'µL' };
    p.assayCells = { value: '1', unit: '× 10⁶ cells' };
    for (const c of p.components) { c.establishedVolume = { value: '', unit: '' }; c.establishedCells = { value: '', unit: '' }; c.provenance = ''; }
    await fill(page, p);
    const blankBefore = await page.evaluate(() => [...document.querySelectorAll('[data-field="establishedVolume.value"]')].every((e) => e.value === ''));
    await control.check();
    const set = await page.evaluate(() => [...document.querySelectorAll('#components-body tr')].map((tr) => [
      tr.querySelector('[data-field="establishedVolume.value"]').value, tr.querySelector('[data-field="establishedVolume.unit"]').value,
      tr.querySelector('[data-field="establishedCells.value"]').value, tr.querySelector('[data-field="establishedCells.unit"]').value,
      tr.querySelector('[data-field="provenance"]').value]));
    const setsAndShows = set.every(([v, u, c, cu]) => v === '70' && u === 'µL' && c === '1' && cu === '× 10⁶ cells');
    const neverProvenance = set.every((r) => r[4] === '');
    await rowField(page, 2, 'establishedVolume.value').fill('100');
    await page.locator('#panel-fields [data-field="residual.value"]').fill('30');
    const after = await page.evaluate(() => [...document.querySelectorAll('#components-body tr')].map((tr) => tr.querySelector('[data-field="establishedVolume.value"]').value));
    const overridable = after[1] === '100' && after.filter((x, i) => i !== 1).every((x) => x === '80');
    const rec = await recordOf(page);
    const recorded = rec.declarations.components.map((c) => c.declaredByPanelControl);
    const recordedOk = recorded[1] === false && recorded.filter((x, i) => i !== 1).every((x) => x === true);
    report('panel control', startsUnselected && blankBefore && setsAndShows && overridable && recordedOk && neverProvenance, {
      startsUnselected, setsAndShowsOnEveryRow: setsAndShows, rowsAfterSetting: set, rowOverriddenByHand: overridable, establishedVolumesAfterResidualChanged: after,
      recordedInObject: recorded, neverSetsProvenance: neverProvenance,
    });
    await context.close();
  }

  // ---- the panel control, unchecked (Task 11, item 4) -------------------------------
  // Rows keep the values it set and stay recorded as declared through it, but
  // stop following later changes to the assay conditions.
  if (want('panel-control-unchecked')) {
    const { context, page } = await fresh();
    const p = clone(fixture('C5-FX-01'));
    p.dispensed = { value: '50', unit: 'µL' };
    p.residual = { value: '20', unit: 'µL' };
    for (const c of p.components) { c.establishedVolume = { value: '', unit: '' }; c.establishedCells = { value: '', unit: '' }; }
    await fill(page, p);
    const volumes = () => page.evaluate(() => [...document.querySelectorAll('[data-field="establishedVolume.value"]')].map((e) => e.value));
    await page.locator('#panel-control').check();
    const set = await volumes();
    await page.locator('#panel-control').uncheck();
    await page.locator('#panel-fields [data-field="residual.value"]').fill('30');
    const after = await volumes();
    const recorded = (await recordOf(page)).declarations.components.map((c) => c.declaredByPanelControl);
    report('panel control unchecked: rows keep their values and their record, and stop following the assay', set.every((v) => v === '70') && after.every((v) => v === '70') && recorded.every((x) => x === true), { whileChecked: set, afterUncheckingAndChangingTheResidualTo30: after, recordedAsDeclaredThroughTheControl: recorded });
    await context.close();
  }

  // ---- the panel control unticked: retained values marked (C5-ST-07; Task 13, item 3) ----
  if (want('panel-control-retained')) {
    const { context, page } = await fresh();
    const p = clone(fixture('C5-FX-01'));
    p.dispensed = { value: '50', unit: 'µL' };
    p.residual = { value: '20', unit: 'µL' };
    for (const c of p.components) { c.establishedVolume = { value: '', unit: '' }; c.establishedCells = { value: '', unit: '' }; }
    await fill(page, p);
    // Per field: each established value's own "retained" label and dashed outline.
    const marks = () => page.evaluate(() => [...document.querySelectorAll('#components-body tr')].map((tr) => Object.fromEntries(['establishedVolume', 'establishedCells'].map((f) => {
      const td = tr.querySelector(`[data-field="${f}.value"]`).closest('td');
      const label = [...td.querySelectorAll('.retained-mark')].some((m) => m.offsetParent !== null && /retained/.test(m.textContent));
      const outlined = [...td.querySelectorAll('[data-field]')].every((el) => el.classList.contains('retained') && getComputedStyle(el).borderStyle.includes('dashed'));
      return [f === 'establishedVolume' ? 'volume' : 'cells', label && outlined];
    }))));
    await page.locator('#panel-control').check();
    const whileTicked = await marks();
    await page.locator('#panel-control').uncheck();
    const unticked = await marks();
    const note = await page.evaluate(() => { const n = document.getElementById('retained-note'); return n.hidden ? '' : n.textContent; });
    const derivation = await page.evaluate(() => [...document.querySelectorAll('#derivation dd')].map((d) => d.textContent).filter((t) => /later unticked/.test(t)));
    // Override row 2's established staining volume only, by hand, to the assay's own
    // volume (so the cocktail is still computed): its cell number is still the value
    // retained from the control, and keeps its mark (Task 13 review, C5-ST-07).
    await rowField(page, 2, 'establishedVolume.value').fill('70.0');
    const overridden = await marks();
    const derivationAfter = await page.evaluate(() => [...document.querySelectorAll('#derivation dd')].map((d) => d.textContent).filter((t) => /later unticked/.test(t)));
    await page.locator('#panel-control').check();
    const reticked = await marks();
    const n = unticked.length;
    const ok = whileTicked.every((m) => !m.volume && !m.cells)
      && unticked.every((m) => m.volume && m.cells)
      && /Retained from "All components established at these assay conditions" \(unticked\)/.test(note)
      && derivation.length === n
      && overridden[1].volume === false && overridden[1].cells === true
      && overridden.filter((m, i) => i !== 1).every((m) => m.volume && m.cells)
      && derivationAfter.length === n && /established cell number set through/.test(derivationAfter[1]) && !/established staining volume and/.test(derivationAfter[1])
      && reticked.every((m) => !m.volume && !m.cells);
    report('panel control unticked: each retained value visibly marked, the derivation says so, an override removes only that field\'s mark', ok, {
      marksWhileTicked: whileTicked, marksAfterUnticking: unticked, note, derivationLinesSayingUnticked: derivation.length,
      marksAfterRow2VolumeOverridden: overridden, row2DerivationAfterOverride: derivationAfter[1], marksAfterReticking: reticked,
    });
    await context.close();
  }

  // ---- basis gating (C5-CP-07, C5-ST-07) -------------------------------------------
  if (want('basis-gating')) {
    const { context, page } = await fresh();
    const p = clone(fixture('C5-FX-07c')); // all at the assay's conditions, basis unselected
    await fill(page, p);
    const shownBefore = !(await page.evaluate(() => document.getElementById('outputs').hidden));
    await rowField(page, 1, 'establishedVolume.value').fill('50');
    const s = await snapshot(page);
    const hiddenWhenRequired = s.outputsHidden && /Transfer basis is required/.test(s.state);
    await page.locator('#panel-fields [data-field="basis"]').selectOption('preserve-concentration');
    const shownAfter = !(await page.evaluate(() => document.getElementById('outputs').hidden));
    report('basis gating', shownBefore && hiddenWhenRequired && shownAfter, { cocktailShownBefore: shownBefore, hiddenUntilBasisSelected: hiddenWhenRequired, shownOnceSelected: shownAfter, requiredTag: await page.locator('#basis-required').textContent() });
    await context.close();
  }

  // ---- recompute on every change (acceptance 17b) -------------------------------------
  if (want('recompute')) {
    const start = fixture('C5-FX-01');
    const changes = [
      ['transfer basis', (p) => { p.basis = 'preserve-amount'; }],
      ['dispensed volume', (p) => { p.dispensed.value = '60'; }],
      ['residual volume', (p) => { p.residual.value = '25'; }],
      ['assay cell number', (p) => { p.assayCells.value = '2000000'; }],
      ['sample count', (p) => { p.samples = '48'; }],
      ['overage', (p) => { p.overage = { form: 'percentage', value: '15', unit: '' }; }],
      ['minimum transfer volume', (p) => { p.minTransfer = { value: '20', unit: 'µL', defaulted: false }; }],
      ['vessel capacity', (p) => { p.capacity = { value: '1', unit: 'mL' }; }],
      ['diluent', (p) => { p.diluent = { notRecorded: true }; }],
      ['a component quantity', (p) => { p.components[1].intended.value = '1'; }],
      ['a component stock', (p) => { p.components[2].stock.value = '0.25'; }],
      ['an established volume', (p) => { p.components[0].establishedVolume = { value: '50', unit: 'µL' }; p.basis = p.basis || 'preserve-concentration'; }],
      ['an established cell number', (p) => { p.components[3].establishedCells = { value: '2', unit: '× 10⁶ cells' }; }],
      ['a provenance', (p) => { p.components[0].provenance = 'vendor'; }],
    ];
    const { context, page } = await fresh();
    await fill(page, start);
    const results = [];
    let current = clone(start);
    for (const [what, change] of changes) {
      const next = clone(current);
      change(next);
      await fill(page, next);
      const changed = await snapshot(page);
      const other = await fresh();
      await fill(other.page, next);
      const fromScratch = await snapshot(other.page);
      await other.context.close();
      const same = JSON.stringify(changed) === JSON.stringify(fromScratch);
      results.push({ what, sameAsAFreshPageWithTheseInputs: same, status: changed.outputsHidden ? 'no cocktail' : 'cocktail' });
      current = next;
    }
    report('recompute on every change (acceptance 17b)', results.every((r) => r.sameAsAFreshPageWithTheseInputs), { changes: results });
    await context.close();
  }

  // ---- acceptance 17: each required declaration, removed, prevents a result ----------------
  if (want('required')) {
    const removals = [
      ['dispensed volume', (p) => { p.dispensed.value = ''; }],
      ['residual volume', (p) => { p.residual.value = ''; }],
      ['assay cell number', (p) => { p.assayCells.value = ''; }],
      ['sample count', (p) => { p.samples = ''; }],
      ['overage form', (p) => { p.overage = { form: '', value: '', unit: '' }; }],
      ['overage value', (p) => { p.overage.value = ''; }],
      ['minimum transfer volume', (p) => { p.minTransfer = { value: '', unit: 'µL', defaulted: false }; }],
      ['transfer basis, where required', (p) => { p.components[0].establishedVolume = { value: '50', unit: 'µL' }; p.basis = ''; }],
      ['diluent (neither text nor not recorded)', (p) => { p.diluent = { notRecorded: false, text: '' }; }],
      ['a component label', (p) => { p.components[1].label = ''; }],
      ['a component intended quantity', (p) => { p.components[1].intended.value = ''; }],
      ['a component stock concentration', (p) => { p.components[1].stock.value = ''; }],
      ['an established staining volume (neither a value nor not recorded)', (p) => { p.components[1].establishedVolume = { value: '', unit: 'µL' }; }],
      ['an established cell number (neither a value nor not recorded)', (p) => { p.components[1].establishedCells = { value: '', unit: 'cells' }; }],
      ['a provenance', (p) => { p.components[1].provenance = ''; }],
    ];
    const results = [];
    for (const [what, remove] of removals) {
      const { context, page } = await fresh();
      const p = clone(fixture('C5-FX-01'));
      remove(p);
      await fill(page, p);
      const s = await snapshot(page);
      results.push({ removed: what, noCocktail: s.outputsHidden, saysWhatIsNeeded: /Still needed/.test(s.state), notShownAsAnError: !/System error/.test(s.state) });
      await context.close();
    }
    const { context, page } = await fresh();
    await fill(page, fixture('C5-FX-01'));
    const complete = !(await snapshot(page)).outputsHidden;
    await context.close();
    report('acceptance 17: every required declaration', complete && results.every((r) => r.noCocktail && r.saysWhatIsNeeded && r.notShownAsAnError), { completePanelComputes: complete, removals: results });
  }

  // ---- acceptance 20: reload and re-enter reproduces exactly -------------------------------
  if (want('reload')) {
    const { context, page } = await fresh();
    await typeInto(page, fixture('C5-FX-01'));
    const first = await snapshot(page);
    await page.reload({ waitUntil: 'networkidle' });
    const afterReload = await page.evaluate(() => ({ dispensed: document.querySelector('[data-field="dispensed.value"]').value, rows: document.querySelectorAll('#components-body tr').length, outputsHidden: document.getElementById('outputs').hidden }));
    await typeInto(page, fixture('C5-FX-01'));
    const second = await snapshot(page);
    const order = (s) => s.outputs.match(/Diluent first[\s\S]*?Total/)?.[0];
    report('acceptance 20: reload and re-enter', !first.outputsHidden && JSON.stringify(first) === JSON.stringify(second) && afterReload.dispensed === '' && afterReload.outputsHidden, {
      identicalOutput: JSON.stringify(first) === JSON.stringify(second), pipettingOrder: order(second), nothingSurvivedTheReload: afterReload,
    });
    await context.close();
  }

  // ---- storage and the network sentinel (C5-ST-10, C5-NF-01) ----------------------------
  if (want('storage-network')) {
    const context = await browser.newContext({ viewport: VIEW });
    const page = await context.newPage();
    const requests = [];
    page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() || '' }));
    await page.goto(base, { waitUntil: 'networkidle' });
    const cookiesBefore = (await context.cookies()).length;
    const SENTINEL = 'C5SENTINEL7f3a';
    await typeInto(page, fixture('C5-FX-01'));
    const fields = page.locator('[data-field]:is(input[type=text])');
    const n = await fields.count();
    for (let i = 0; i < n; i++) await fields.nth(i).fill(`${SENTINEL}${i}`);
    await page.locator('#add-component').click();
    await page.locator('#print-bench-sheet').isVisible();
    await page.waitForTimeout(300);
    const store = await page.evaluate(() => ({ localStorageKeys: Object.keys(localStorage), sessionStorageLength: sessionStorage.length }));
    const cookies = (await context.cookies()).length;
    const carrying = requests.filter((r) => r.url.includes(SENTINEL) || r.body.includes(SENTINEL));
    const hosts = [...new Set(requests.map((r) => new URL(r.url).host))];
    const storageOk = store.localStorageKeys.every((k) => k === 'ligant_privacy_choice') && store.sessionStorageLength === 0 && cookiesBefore === 0 && cookies === 0;
    report('storage after a full session (C5-ST-10)', storageOk, { ...store, cookiesBeforeConsent: cookiesBefore, cookiesAfterSession: cookies });
    report('network: no request carries entered data (local, ahead of acceptance 18)', carrying.length === 0, { fieldsTypedWithTheSentinel: n, requests: requests.length, hosts, requestsCarryingTheSentinel: carrying });
    await context.close();
  }

  // ---- the component cap ---------------------------------------------------------
  if (want('cap')) {
    const { context, page, errors } = await fresh();
    for (let i = 0; i < 59; i++) await page.locator('#add-component').click();
    const at60 = await page.locator('#components-body tr').count();
    await page.locator('#add-component').click();
    const after = await page.locator('#components-body tr').count();
    const message = await page.locator('#cap-message').textContent();
    report('component cap: the 61st is refused with its reason', at60 === 60 && after === 60 && /at most 60 components/.test(message) && errors.length === 0, { rowsAt60: at60, rowsAfterThe61stAdd: after, message, errors });
    await context.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
