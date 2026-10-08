// Rendering from the structured result (C5-OUT-04, C5-VZ-04; CLAUDE.md §5.1).
// No renderer computes a number: each figure is a value of the record,
// displayed by format.js, or a declaration as typed. Messages are the engine's.
import { escapeHtml as esc } from '@ligant/bench-chrome';
import { sig } from '../engine/numfmt.js';
import { PRECISION, pipettingList, perTestVolumes, concentrations, ratios, effectiveTests } from '../engine/format.js';
import { flagTexts, flagNotebookLines, FLAG_TITLES } from '../engine/flags.js';
import { REGISTER, FAILURES, FAILURE_INTRO, STATEMENTS } from '../engine/register.js';
import { RECORD_SCHEMA } from '../engine/result.js';
import { ENGINE_VERSION, URS_VERSION } from '../engine/version.js';
import { SCOPE_STATEMENT } from '../shared/privacy-statement.js';
import { codesByComponent } from './visuals.js';

const vol = (x) => sig(x, PRECISION.volumes);
const rat = (x) => sig(x, PRECISION.ratios);
const tests = (x) => effectiveTests(x);
const BASIS = { 'preserve-concentration': 'preserve concentration', 'preserve-amount': 'preserve amount per test' };
const OVERAGE = { percentage: 'percentage of samples', 'additional-tests': 'additional tests', 'dead-volume': 'dead volume' };
const PROVENANCE = { 'titrated-here': 'titrated in this laboratory', vendor: 'vendor recommendation', 'not-recorded': 'not recorded' };

/** A declaration as typed, with its unit; "not recorded" and blank in words. */
export function typed(d) {
  if (!d) return '—';
  if (d.state === 'not-recorded') return 'not recorded';
  if (d.state === 'not-declared') return 'none declared';
  if (d.state !== 'entered') return '—';
  return d.unit && !['samples', 'tests'].includes(d.unit) ? `${d.value} ${d.unit}` : d.value;
}

export const componentName = (rec, i) => {
  const label = rec.declarations.components[i - 1].label.trim();
  return label ? `Component ${i}, "${label}"` : `Component ${i} (no label)`;
};

// ---- the bounded block (C5-NF-04, C5-NF-05) -----------------------------------
export function declarationSummary(rec) {
  const d = rec.declarations;
  const result = rec.status === 'result';
  const basis = d.basis.state === 'selected' ? BASIS[d.basis.value]
    : rec.basisRequired === false ? 'not required' : 'not selected';
  const overage = d.overage.form
    ? `${OVERAGE[d.overage.form]}, ${d.overage.state === 'entered' ? `${d.overage.value}${d.overage.form === 'percentage' ? ' %' : d.overage.form === 'dead-volume' ? ` ${d.overage.unit}` : ''}` : '—'}${result ? ` · ${tests(rec.values.nEff.value)} effective tests` : ''}`
    : '—';
  const min = d.minTransfer.state === 'entered' ? `${typed(d.minTransfer)} (${d.minTransfer.source === 'defaulted' ? 'suggested default, not changed' : 'entered'})` : '—';
  const items = [
    ['basis', 'Transfer basis', basis],
    ['dispensed', 'Dispensed per test', typed(d.dispensed)],
    ['residual', 'Present with cells', typed(d.residual)],
    ['assay-sv', 'Assay staining volume', result ? `${vol(rec.values.svAssay.value)} µL` : '—'],
    ['assay-cells', 'Assay cells per test', typed(d.assayCells)],
    ['samples', 'Samples', typed(d.samples)],
    ['overage', 'Overage', overage],
    ['min-transfer', 'Minimum transfer', min],
    ['capacity', 'Vessel capacity', typed(d.capacity)],
    ['diluent', 'Diluent', d.diluent.state === 'entered' ? d.diluent.text : d.diluent.state === 'not-recorded' ? 'not recorded' : '—'],
  ];
  return items.map(([id, k, v]) => `<span class="decl${id === 'diluent' ? ' wrap' : ''}" data-decl="${id}"><b>${esc(k)}</b>${esc(v)}</span>`).join('');
}

export function flagSummary(rec) {
  if (rec.status !== 'result') return '';
  return rec.flags.map((f) => {
    const n = f.components.length;
    const count = n ? ` — ${n} component${n === 1 ? '' : 's'}` : '';
    return `<li data-flag="${f.code}"><span class="code">${f.code}</span>${esc(FLAG_TITLES[f.code])}${count}</li>`;
  }).join('');
}

/** C5-CP-07, shown when the basis is not required; bounded: a count, names below the list. */
export function cp07Short(rec) {
  if (rec.status !== 'result' || rec.basisRequired !== false) return '';
  const n = rec.values.fl08Unevaluated.length;
  return `Transfer basis not required for the recorded components.${n ? ` It cannot be applied to ${n} component${n === 1 ? '' : 's'} whose established staining volume is not recorded, named below.` : ''}`;
}

// ---- below the component list ------------------------------------------------
// Every raised flag in full (URS §8, human-readable output): the same words as
// the bench sheet and the notebook copy (flags.flagTexts), each named component
// with its own figures. The bounded block keeps the code and count only.
export function flagNames(rec) {
  if (rec.status !== 'result') return '';
  const blocks = flagTexts(rec).map((t) => `<div class="flag-statement" data-flag-statement="${t.code}"${t.code === 'C5-FL-08' ? ' data-component="names-C5-FL-08"' : ''}>`
    + `<p class="flag-names-line"><span class="code">${t.code}</span><strong>${esc(t.title)}.</strong> ${esc(t.statement)}</p>`
    + (t.components.length ? `<ul class="flag-components">${t.components.map((c) => `<li data-component="names-${t.code}-${c.component}">${esc(c.text)}</li>`).join('')}</ul>` : '')
    + '</div>');
  if (rec.basisRequired === false && rec.values.fl08Unevaluated.length) {
    blocks.push(`<p class="flag-names-line" data-component="names-CP-07"><span class="code">C5-CP-07</span>The transfer basis cannot be applied (established staining volume not recorded): ${esc(rec.values.fl08Unevaluated.map((i) => componentName(rec, i)).join('; '))}</p>`);
  }
  return blocks.join('');
}

export function stateHtml(rec) {
  if (rec.status === 'result') return '';
  const inc = rec.incomplete.length
    ? `<div class="state-block incomplete"><h3>Not computed yet</h3><p>Still needed:</p><ul>${rec.incomplete.map((e) => `<li${e.component ? ` data-component="state-${e.component}-${esc(e.field)}"` : ''}>${esc(e.message)}</li>`).join('')}</ul></div>`
    : '';
  const rej = rec.rejections.length
    ? `<div class="state-block withheld"><h3>Not computed</h3><ul>${rec.rejections.map((x) => `<li${x.component ? ` data-component="state-${x.component}-${esc(x.code)}"` : ''}><span class="code">${esc(x.code)}</span>${esc(x.message)}</li>`).join('')}</ul></div>`
    : '';
  return rej + inc;
}

// ---- the result (C5-UN-09, C5-DT-04, C5-DT-05) ----------------------------------
export function resultTable(rec) {
  const list = pipettingList(rec);
  const perTest = perTestVolumes(rec);
  const conc = concentrations(rec);
  const rats = ratios(rec);
  const codes = codesByComponent(rec);
  const rows = rec.values.components.map((c, k) => {
    const cc = codes.get(c.index);
    const r = rats.components[k].ratio;
    const ratioCell = r.withheld
      ? `<td class="withheld-cell" data-key="ratio-${c.index}">withheld: established staining volume not recorded (C5-FL-02)</td>`
      : `<td class="num" data-key="ratio-${c.index}">${esc(r)}</td>`;
    const concCell = conc[k].withheld ? `<td class="withheld-cell">withheld: ${esc(conc[k].reason)}</td>` : `<td class="num" data-key="conc-${c.index}">${esc(conc[k].value)} ${esc(conc[k].unit)}</td>`;
    return `<tr data-component="result-${c.index}"><td>${esc(componentName(rec, c.index))}${cc ? ` <span class="codes">${esc(cc.join(' '))}</span>` : ''}</td>`
      + `<td class="num" data-key="vtest-${c.index}">${esc(perTest.components[k].volume_uL)}</td>`
      + `<td class="num" data-key="vcocktail-${c.index}">${esc(list.steps[k + 1].volume_uL)}</td>${concCell}${ratioCell}</tr>`;
  }).join('');
  return '<table class="result-table"><thead><tr><th>Component</th><th class="num">Volume per test (µL)</th><th class="num">Volume in cocktail (µL)</th><th>Concentration in the assay</th><th>Concentration in the assay ÷ concentration established at</th></tr></thead>'
    + `<tbody>${rows}<tr data-key-row="diluent"><td>Diluent</td><td class="num" data-key="diluent-per-test">${esc(perTest.diluent_uL)}</td><td class="num" data-key="diluent-total">${esc(list.steps[0].volume_uL)}</td><td></td><td></td></tr></tbody>`
    + `<tfoot><tr><td>Total cocktail</td><td></td><td class="num" data-key="displayed-total">${esc(list.total_uL)}</td><td colspan="2" class="hint">The total is the sum of the volumes shown above it.</td></tr></tfoot></table>`
    + `<p class="hint">Effective number of tests: <span class="num" data-key="n-eff">${esc(tests(rec.values.nEff.value))}</span>. Overage made ÷ samples (overage fraction) = <span class="num" data-key="overage-fraction">${esc(rats.overageFraction)}</span>. Total component volume ÷ total cocktail volume (antibody fraction) = <span class="num" data-key="antibody-fraction">${esc(rats.antibodyFraction)}</span>.</p>`;
}

export function pipettingHtml(rec) {
  const list = pipettingList(rec);
  const d = rec.declarations;
  const what = (s) => (s.what === 'diluent' ? `Diluent (${esc(d.diluent.state === 'entered' ? d.diluent.text : 'not recorded')})` : esc(componentName(rec, s.component)));
  return `<p class="hint">${esc(list.order)}</p><ol class="pipetting">${list.steps.map((s) => `<li${s.component ? ` data-component="pipette-${s.component}"` : ''}>${what(s)}: <span class="num">${esc(s.volume_uL)}</span> µL</li>`).join('')}</ol>`
    + `<p>Total: <span class="num">${esc(list.total_uL)}</span> µL, the sum of the volumes listed.</p>`;
}

// ---- the derivation (C5-DT-02, C5-OUT-01, C5-OUT-02) ----------------------------------
/**
 * `ui.retained`: the rows whose established values were set by the panel
 * control and kept after it was unticked (C5-ST-07), from the form's state.
 */
export function derivationHtml(rec, ui = {}) {
  const retained = new Set(ui.retained || []);
  const d = rec.declarations;
  const v = rec.values;
  const conc = concentrations(rec);
  const rats = ratios(rec);
  const dl = (t, items) => `<dt>${esc(t)}</dt>${items.map((x) => `<dd${x.component ? ` data-component="derivation-${x.component}"` : ''}>${x.html}</dd>`).join('')}`;
  const h = (s) => ({ html: esc(s) });
  const out = [];
  out.push(dl('Declarations', [
    h(`Transfer basis: ${d.basis.state === 'selected' ? BASIS[d.basis.value] : 'not selected'}${rec.basisRequired === false ? ' (not required for the recorded components)' : ''}.`),
    h(`Dispensed cocktail volume per test D: ${typed(d.dispensed)}. Volume already present with the cells R: ${typed(d.residual)}.`),
    h(`Assay cell number per test: ${typed(d.assayCells)}. Number of samples n: ${typed(d.samples)}.`),
    h(`Overage: ${d.overage.form ? OVERAGE[d.overage.form] : '—'}, ${d.overage.state === 'entered' ? `${d.overage.value}${d.overage.form === 'percentage' ? ' %' : d.overage.form === 'dead-volume' ? ` ${d.overage.unit}` : ''}` : '—'}.`),
    h(`Diluent: ${d.diluent.state === 'entered' ? d.diluent.text : 'not recorded'}. Minimum reliable transfer volume: ${typed(d.minTransfer)} (${d.minTransfer.source === 'defaulted' ? 'suggested default, not changed' : 'entered'}). Vessel working capacity: ${typed(d.capacity)}.`),
    ...d.components.map((c) => ({ component: c.index, html: esc(`${componentName(rec, c.index)}: intended ${typed(c.intended)} per test; stock ${typed(c.stock)}; established at ${typed(c.establishedVolume)} and ${typed(c.establishedCells)}${c.declaredByPanelControl ? (retained.has(c.index) ? ' (set through "All components established at these assay conditions"; the control was later unticked, and the values are retained)' : ' (declared through "All components established at these assay conditions")') : ''}; provenance ${PROVENANCE[c.provenance.value] || '—'}; transport ${c.transport}.`) })),
  ]));
  const nEffRel = { percentage: `N_eff = n × (1 + p ÷ 100) = ${typed(d.samples)} × (1 + ${d.overage.value} ÷ 100)`, 'additional-tests': `N_eff = n + k = ${typed(d.samples)} + ${d.overage.value}`, 'dead-volume': `N_eff = n + V_dead ÷ D = ${typed(d.samples)} + ${typed(d.overage)} ÷ ${typed(d.dispensed)}` }[d.overage.form];
  const fracRel = { percentage: 'p ÷ 100', 'additional-tests': 'k ÷ n (additional tests ÷ samples)', 'dead-volume': 'V_dead ÷ (n × D)' }[d.overage.form];
  out.push(dl('Relations', [
    h(`Assay staining volume SV = D + R = ${typed(d.dispensed)} + ${typed(d.residual)} = ${vol(v.svAssay.value)} µL. Every concentration is computed against it.`),
    h(`${nEffRel} = ${tests(v.nEff.value)}, used unrounded. Overage fraction = ${fracRel} = ${rats.overageFraction}.`),
    ...v.components.map((c, k) => {
      const dc = d.components[c.index - 1];
      const a = { amount: `a = q ÷ c = ${typed(dc.intended)} ÷ ${typed(dc.stock)}`, concentration: dc.establishedVolume.state === 'not-recorded'
        ? `a = q × SV ÷ c = ${typed(dc.intended)} × ${vol(v.svAssay.value)} µL ÷ ${typed(dc.stock)} (the established staining volume is not recorded, so the entered concentration is carried into the assay: NADIRA's Q1 ruling, 8 October 2026)`
        : `a = q × SV_i ÷ c = ${typed(dc.intended)} × ${typed(dc.establishedVolume)} ÷ ${typed(dc.stock)}`, 'stock-volume': `a = ${typed(dc.intended)}` }[c.form];
      const s = c.scaleFactor
        ? (c.scaleFactor.exactlyOne ? 's = SV ÷ SV_i = exactly 1 (the volumes are equal under C5-UN-10)' : `s = SV ÷ SV_i = ${vol(v.svAssay.value)} µL ÷ ${typed(dc.establishedVolume)} = ${rat(c.scaleFactor.value)}`)
        : null;
      const basisWords = { 'preserve-concentration': 'preserve concentration: v = a × s', 'preserve-amount': 'preserve amount per test: v = a', 'not-required': 'basis not required: v = a', 'not-applied': 'the transfer basis could not be applied, because the established staining volume is not recorded; carried at its entered per-test quantity: v = a' }[c.basisApplied];
      const ratio = rats.components[k].ratio.withheld ? 'concentration ratio withheld: the concentration it was established at is unknown (C5-FL-02)' : `concentration in the assay ÷ concentration established at = ${rats.components[k].ratio}`;
      const cAssay = conc[k].withheld ? 'concentration in the assay withheld' : `c_assay = c × v ÷ SV = ${conc[k].value} ${conc[k].unit}`;
      return { component: c.index, html: esc(`${componentName(rec, c.index)}: ${a} = ${vol(c.stockVolumePerTest.value)} µL;${s ? ` ${s};` : ''} ${basisWords} = ${vol(c.volumePerTest.value)} µL; V = v × N_eff = ${vol(c.volumeInCocktail.value)} µL; ${cAssay}; ${ratio}.`) };
    }),
    h(v.componentsFillDispensedVolume
      ? 'The components fill the dispensed volume; no diluent. Diluent per test and in the cocktail: 0 µL.'
      : `Diluent per test = D − Σv = ${vol(v.diluentPerTest.value)} µL. Total cocktail = D × N_eff = ${vol(v.totalCocktail.value)} µL. Diluent in the cocktail = total − ΣV = ${vol(v.diluentTotal.value)} µL.`),
    h(`Antibody fraction = ΣV ÷ total = ${rats.antibodyFraction}.`),
  ]));
  const fl08 = rec.flags.find((f) => f.code === 'C5-FL-08');
  if (!fl08 && v.fl08Unevaluated.length) {
    // PENDING (NADIRA): where FL-08 is not raised, the unevaluated components are named here (brief §0.2).
    out.push(dl('Not evaluated', [{ html: esc(`Not evaluated for C5-FL-08 (established volume not recorded): ${v.fl08Unevaluated.map((i) => componentName(rec, i)).join('; ')}.`) }]));
  }
  out.push(dl('Assumptions', [
    h('Every component\'s concentration is computed against the assay staining volume, the dispensed volume plus the volume already present with the cells.'),
    h('Each component is carried into the assay on the declared transfer basis; which basis is correct cannot be determined here (see What this tool cannot detect, item 1).'),
    h(`Engine ${ENGINE_VERSION}, against URS ${URS_VERSION}. Structured result ${RECORD_SCHEMA.name} ${RECORD_SCHEMA.version}.`),
  ]));
  return `<dl>${out.join('')}</dl>`;
}

// ---- statements, register, failure list ---------------------------------------------
export function statementsHtml() {
  return `<p><strong>${esc(SCOPE_STATEMENT)}</strong></p>`
    + `<p>${esc(STATEMENTS.composition)}</p>`
    + `<p>${esc(STATEMENTS.precision)}</p>`
    + `<p>${esc(STATEMENTS.twoCocktails)}</p>`
    + '<p>The pipetting order is set by the tool: diluent first, then the components in the order entered.</p>'
    + `<p class="hint">Engine ${esc(ENGINE_VERSION)}. URS ${esc(URS_VERSION)}.</p>`;
}

const STATUS_WORDS = (r) => (r.marker ? `${r.status} (${r.marker.replace(/^(PROVISIONAL|PENDING): /, 'awaiting ')})` : r.status);
export function registerHtml() {
  return '<table class="register"><thead><tr><th>Item</th><th>Value</th><th>Basis</th><th>Status</th></tr></thead><tbody>'
    + REGISTER.map((r) => `<tr data-register="${esc(r.item)}"><td>${esc(r.item)}</td><td>${esc(r.value)}</td><td>${esc(r.basis)}</td><td>${esc(STATUS_WORDS(r))}</td></tr>`).join('')
    + '</tbody></table>';
}

export function failuresHtml() {
  return `<p>${esc(FAILURE_INTRO)}</p><ol>${FAILURES.map(([b, rest]) => `<li><strong>${esc(b)}</strong>${rest ? ` ${esc(rest)}` : ''}</li>`).join('')}</ol>`;
}

// ---- the notebook copy (C5-OUT-10) ---------------------------------------------------
export function notebookText(rec) {
  const d = rec.declarations;
  const L = [`Master Mix — Ligant Bench Tools C5, engine ${ENGINE_VERSION}`, SCOPE_STATEMENT, STATEMENTS.composition, ''];
  L.push('Declarations');
  L.push(`  Transfer basis: ${d.basis.state === 'selected' ? BASIS[d.basis.value] : rec.basisRequired === false ? 'not required for the recorded components' : 'not selected'}`);
  L.push(`  Dispensed cocktail volume per test: ${typed(d.dispensed)}`);
  L.push(`  Volume already present with the cells: ${typed(d.residual)}`);
  L.push(`  Assay cell number per test: ${typed(d.assayCells)}`);
  L.push(`  Number of samples: ${typed(d.samples)}`);
  L.push(`  Overage: ${d.overage.form ? OVERAGE[d.overage.form] : '—'}, ${typed(d.overage)}`);
  L.push(`  Diluent: ${d.diluent.state === 'entered' ? d.diluent.text : 'not recorded'}`);
  L.push(`  Minimum reliable transfer volume: ${typed(d.minTransfer)} (${d.minTransfer.source === 'defaulted' ? 'suggested default, not changed' : 'entered'})`);
  L.push(`  Vessel working capacity: ${typed(d.capacity)}`);
  L.push('Components, in the order entered');
  for (const c of d.components) {
    L.push(`  ${componentName(rec, c.index)}: intended ${typed(c.intended)} per test; stock ${typed(c.stock)}; established at ${typed(c.establishedVolume)} and ${typed(c.establishedCells)}${c.declaredByPanelControl ? ' (through the panel control)' : ''}; provenance ${PROVENANCE[c.provenance.value] || '—'}; transport ${c.transport}`);
  }
  L.push('');
  if (rec.status !== 'result') {
    L.push('No cocktail computed.');
    for (const x of rec.rejections) L.push(`  [${x.code}] ${x.message}`);
    for (const e of rec.incomplete) L.push(`  Still needed: ${e.message}`);
    return L.join('\n');
  }
  const v = rec.values;
  const list = pipettingList(rec);
  const perTest = perTestVolumes(rec);
  const conc = concentrations(rec);
  const rats = ratios(rec);
  L.push('Result');
  L.push(`  Assay staining volume: ${vol(v.svAssay.value)} µL`);
  L.push(`  Effective number of tests: ${tests(v.nEff.value)} (unrounded scale factor); overage made ÷ samples = ${rats.overageFraction}`);
  v.components.forEach((c, k) => {
    const ratio = rats.components[k].ratio.withheld ? 'concentration ratio withheld (established staining volume not recorded)' : `concentration in the assay ÷ concentration established at = ${rats.components[k].ratio}`;
    L.push(`  ${componentName(rec, c.index)}: ${perTest.components[k].volume_uL} µL per test; ${list.steps[k + 1].volume_uL} µL in the cocktail; ${conc[k].withheld ? 'concentration withheld' : `${conc[k].value} ${conc[k].unit} in the assay`}; ${ratio}`);
  });
  L.push(`  Diluent: ${perTest.diluent_uL} µL per test; ${list.steps[0].volume_uL} µL in the cocktail${v.componentsFillDispensedVolume ? ' (the components fill the dispensed volume; no diluent)' : ''}`);
  L.push(`  Total cocktail: ${list.total_uL} µL (the sum of the volumes listed)`);
  L.push(`  Antibody fraction (total component volume ÷ total cocktail volume) = ${rats.antibodyFraction}`);
  L.push('Pipetting order (diluent first, then the components in the order entered)');
  for (const s of list.steps) L.push(`  ${s.step}. ${s.what === 'diluent' ? 'Diluent' : componentName(rec, s.component)}: ${s.volume_uL} µL`);
  L.push('');
  L.push(...flagNotebookLines(rec));
  L.push('');
  L.push(STATEMENTS.precision);
  return L.join('\n');
}

// ---- the bench sheet (C5-OUT-09): printed; legible without the application ----------
export function benchSheetHtml(rec, visuals) {
  const d = rec.declarations;
  const decl = [
    ['Transfer basis', d.basis.state === 'selected' ? BASIS[d.basis.value] : rec.basisRequired === false ? 'not required' : 'not selected'],
    ['Dispensed per test', typed(d.dispensed)],
    ['Present with cells (residual)', typed(d.residual)],
    ['Assay cells per test', typed(d.assayCells)],
    ['Samples', typed(d.samples)],
    ['Overage', `${d.overage.form ? OVERAGE[d.overage.form] : '—'}, ${typed(d.overage)}`],
    ['Diluent', d.diluent.state === 'entered' ? d.diluent.text : 'not recorded'],
    ['Minimum transfer', `${typed(d.minTransfer)} (${d.minTransfer.source === 'defaulted' ? 'suggested default' : 'entered'})`],
    ['Vessel capacity', typed(d.capacity)],
  ];
  let html = `<h2>Master Mix — bench sheet</h2><p>Ligant Bench Tools C5, engine ${esc(ENGINE_VERSION)}. ${esc(SCOPE_STATEMENT)}</p>`
    + `<table><tbody>${decl.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
  if (rec.status !== 'result') {
    return `${html}<h3>No cocktail computed</h3><ul>${rec.rejections.map((x) => `<li>[${esc(x.code)}] ${esc(x.message)}</li>`).join('')}${rec.incomplete.map((e) => `<li>Still needed: ${esc(e.message)}</li>`).join('')}</ul>`;
  }
  const list = pipettingList(rec);
  html += `<h3>Pipetting order</h3><p>${esc(list.order)}</p><table><thead><tr><th>Step</th><th>Add</th><th>Volume (µL)</th></tr></thead><tbody>`
    + list.steps.map((s) => `<tr><td>${s.step}</td><td>${s.what === 'diluent' ? 'Diluent' : esc(componentName(rec, s.component))}</td><td class="num">${esc(s.volume_uL)}</td></tr>`).join('')
    + `<tr><td></td><td>Total (the sum of the volumes above)</td><td class="num">${esc(list.total_uL)}</td></tr></tbody></table>`;
  const texts = flagTexts(rec);
  html += `<h3>Flags</h3>${texts.length ? texts.map((t) => `<div class="flag" data-flag-words="${t.code}"><p><strong>${t.code} — ${esc(t.title)}.</strong> ${esc(t.statement)}</p>${t.components.length ? `<ul>${t.components.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul>` : ''}</div>`).join('') : '<p>None raised.</p>'}`;
  html += `<h3>Visuals</h3>${visuals}`;
  html += `<p>${esc(STATEMENTS.composition)}</p><p>${esc(STATEMENTS.precision)}</p>`;
  return html;
}

