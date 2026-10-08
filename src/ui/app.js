// UI wiring. Reads the form into the engine I/O contract's input object, builds
// the structured result (src/engine/result.js) on every change, and renders
// everything from it. Nothing computed under a previous declaration survives
// a change: the whole result is rebuilt and redrawn (C5-ST-07, acceptance 17b).
// State is in memory only: nothing is written to any storage, and nothing into
// the URL (C5-ST-10). The frame's privacy choice (bindCopy -> initConsent) is
// the one exception, on the hosted pages only.
import { CONFIG } from '../config.js';
import { PRIVACY_STATEMENT, PRIVACY_DATE } from '../shared/privacy-statement.js';
import '@ligant/bench-chrome/chrome.css';
import { bindCopy, markDataUri, escapeHtml as esc } from '@ligant/bench-chrome';
import { renderHeader, renderFooter, renderColophon } from './chrome.js';
import { record } from '../engine/result.js';
import { COMPONENT_CAP } from '../engine/register.js';
import { panelFieldsHtml, ROW_HEADINGS, emptyComponent, rowHtml, applyRowField, assayConditions } from './form.js';
import {
  declarationSummary, flagSummary, cp07Short, flagNames, stateHtml, resultTable, pipettingHtml,
  derivationHtml, statementsHtml, registerHtml, failuresHtml, notebookText, benchSheetHtml,
} from './render.js';
import { visualsHtml } from './visuals.js';

const $ = (id) => document.getElementById(id);
const panelEl = (name) => document.querySelector(`#panel-fields [data-field="${name}"]`);

let nextId = 1;
// Per row, and per established field (volume, cell number), the panel control's
// state: ctl, it is setting the field while ticked; set, the field's value is
// the one it set; kept, that value is retained after it was unticked (C5-ST-07).
const rows = []; // [{ id, data, ctl, set, kept }]
const FIELDS = ['establishedVolume', 'establishedCells'];
const perField = (v) => ({ establishedVolume: v, establishedCells: v });
const newRow = (controlled) => ({ id: nextId++, data: emptyComponent(), ctl: perField(controlled), set: perField(false), kept: perField(false) });
const CONTROL_NAME = 'All components established at these assay conditions';
let minTouched = false;
let lastRecord = null;

function readPanel() {
  const val = (n) => panelEl(n).value;
  return {
    dispensed: { value: val('dispensed.value'), unit: val('dispensed.unit') },
    residual: { value: val('residual.value'), unit: val('residual.unit') },
    assayCells: { value: val('assayCells.value'), unit: val('assayCells.unit') },
    samples: val('samples'),
    overage: { form: val('overage.form'), value: val('overage.value'), unit: val('overage.form') === 'dead-volume' ? val('overage.unit') : '' },
    basis: val('basis'),
    diluent: { notRecorded: panelEl('diluent.notRecorded').checked, text: val('diluent.text') },
    minTransfer: { value: val('minTransfer.value'), unit: val('minTransfer.unit'), defaulted: !minTouched },
    capacity: { value: val('capacity.value'), unit: val('capacity.unit') },
  };
}

const inputs = () => ({ ...readPanel(), components: rows.map((r) => r.data) });

function renderRows() {
  $('components-body').innerHTML = rows.map((r, i) => rowHtml(r.data, i)).join('');
}

// ---- the panel control (CLAUDE.md §6.2) --------------------------------------
// Starts unselected. While selected, it sets the established staining volume
// and cell number of every row it controls to the assay's, and shows them; a
// row edited by hand leaves its control and keeps its own values. Its use is
// recorded per row (declaredByPanelControl). It never sets provenance.
function applyPanelControl() {
  const on = $('panel-control').checked;
  const status = $('panel-control-status');
  if (!on) { status.textContent = ''; return; }
  const a = assayConditions(readPanel());
  if (!a) {
    status.textContent = 'Enter the dispensed volume, the volume already present with the cells and the assay cell number, with their units, and the panel control will set every row to them.';
    return;
  }
  status.textContent = `Established at ${a.volume.value} µL and ${a.cells.value} ${a.cells.unit} on every row set by the panel control; any row can be changed by hand.`;
  const values = { establishedVolume: a.volume, establishedCells: a.cells };
  rows.forEach((r, i) => {
    const tr = document.querySelector(`#components-body tr[data-row="${i + 1}"]`);
    for (const f of FIELDS) {
      if (!r.ctl[f]) continue;
      r.data[f] = { value: values[f].value, unit: values[f].unit };
      r.set[f] = true;
      if (!tr) continue;
      for (const [part, v] of [['value', values[f].value], ['unit', values[f].unit]]) {
        const el = tr.querySelector(`[data-field="${f}.${part}"]`);
        el.disabled = false;
        el.value = v;
      }
    }
    // Recorded as declared through the control while both established values are its own.
    r.data.declaredByPanelControl = r.set.establishedVolume && r.set.establishedCells;
  });
}

// ---- compute and render --------------------------------------------------------
function keepInView() {
  const h = Math.ceil($('bounded-block').getBoundingClientRect().height);
  document.documentElement.style.setProperty('--block-h', `${h}px`);
  $('keep-spacer').style.height = `${h + 24}px`;
}

function compute() {
  applyPanelControl();
  const rec = record(inputs());
  lastRecord = rec;
  const result = rec.status === 'result';

  $('declarations-content').innerHTML = declarationSummary(rec);
  $('flag-summary').innerHTML = flagSummary(rec);
  const cp = cp07Short(rec);
  $('cp07-statement').hidden = !cp;
  $('cp07-statement').textContent = cp;
  if (cp) $('cp07-statement').setAttribute('data-decl', 'cp07'); else $('cp07-statement').removeAttribute('data-decl');
  $('basis-required').textContent = rec.basisRequired === true ? 'required' : rec.basisRequired === false ? 'not required for the recorded components' : '';
  $('basis-required').className = rec.basisRequired === true ? 'required-tag' : 'optional';
  panelEl('overage.unit').disabled = panelEl('overage.form').value !== 'dead-volume';

  $('state-region').innerHTML = stateHtml(rec);
  const names = flagNames(rec);
  $('flag-names').hidden = !names;
  $('flag-names-body').innerHTML = names;

  $('outputs').hidden = !result;
  if (result) {
    $('result-table').innerHTML = resultTable(rec);
    $('pipetting-list').innerHTML = pipettingHtml(rec);
    $('visuals').innerHTML = visualsHtml(rec);
    $('derivation').innerHTML = derivationHtml(rec, { retained: rows.flatMap((r, i) => {
      const fields = FIELDS.filter((f) => r.kept[f]);
      return fields.length ? [{ index: i + 1, fields }] : [];
    }) });
  } else {
    for (const id of ['result-table', 'pipetting-list', 'visuals', 'derivation']) $(id).innerHTML = '';
  }
  markRetained();
  $('object-text').textContent = JSON.stringify(rec, null, 2);
  $('notebook-text').value = notebookText(rec);
  $('bench-sheet').innerHTML = benchSheetHtml(rec, result ? visualsHtml(rec, 'bench-') : '');
  keepInView();
}

// ---- events --------------------------------------------------------------------------
function onPanelInput(e) {
  const f = e.target.getAttribute('data-field');
  if (f === 'minTransfer.value' || f === 'minTransfer.unit') minTouched = true;
  if (f === 'diluent.notRecorded') panelEl('diluent.text').disabled = e.target.checked;
  compute();
}

function onRowInput(e) {
  const tr = e.target.closest('tr[data-row]');
  const name = e.target.getAttribute('data-field');
  if (!tr || !name) return;
  const r = rows[Number(tr.dataset.row) - 1];
  if (applyRowField(r.data, name, e.target)) {
    // An established value changed by hand: that field, and only that field,
    // leaves the panel control and loses its retained mark.
    const base = name.split('.')[0];
    r.ctl[base] = false;
    r.set[base] = false;
    r.kept[base] = false;
    r.data.declaredByPanelControl = r.set.establishedVolume && r.set.establishedCells;
    const valueEl = tr.querySelector(`[data-field="${base}.value"]`);
    valueEl.disabled = !!r.data[base].notRecorded;
    if (r.data[base].notRecorded) valueEl.value = '';
  }
  compute();
}

function addComponent() {
  if (rows.length >= COMPONENT_CAP) {
    $('cap-message').textContent = `Not added: a cocktail here holds at most ${COMPONENT_CAP} components, the count measured to keep every declaration and flag in view (see Constants and conventions).`;
    return;
  }
  $('cap-message').textContent = '';
  rows.push(newRow($('panel-control').checked));
  renderRows();
  compute();
}

function onRowClick(e) {
  const btn = e.target.closest('button[data-action="remove"]');
  if (!btn) return;
  const tr = btn.closest('tr[data-row]');
  rows.splice(Number(tr.dataset.row) - 1, 1);
  $('cap-message').textContent = '';
  renderRows();
  compute();
}

// Unticked, the control stops setting rows; each value it set is kept and
// visibly marked as retained (C5-ST-07) until that field is changed by hand.
function onPanelControl() {
  const on = $('panel-control').checked;
  for (const r of rows) {
    for (const f of FIELDS) {
      if (on) { r.ctl[f] = true; r.kept[f] = false; } else { r.kept[f] = r.ctl[f] && r.set[f]; r.ctl[f] = false; }
    }
  }
  compute();
}

// C5-ST-07: "any value retained shall be visibly marked as retained". Each
// retained established volume and cell number has a dashed outline and its
// own "retained" label; a note names the control it came from.
function markRetained() {
  const any = rows.some((r) => FIELDS.some((f) => r.kept[f]));
  $('retained-note').hidden = !any;
  $('retained-note').textContent = any ? `Retained from "${CONTROL_NAME}" (unticked): the established staining volumes and cell numbers marked "retained" were set by that control before it was unticked. Changing a value removes its mark.` : '';
  rows.forEach((r, i) => {
    const tr = document.querySelector(`#components-body tr[data-row="${i + 1}"]`);
    if (!tr) return;
    for (const base of FIELDS) {
      const kept = r.kept[base];
      const td = tr.querySelector(`[data-field="${base}.value"]`).closest('td');
      for (const el of td.querySelectorAll('[data-field]')) el.classList.toggle('retained', kept);
      let mark = td.querySelector('.retained-mark');
      if (kept && !mark) {
        mark = document.createElement('span');
        mark.className = 'retained-mark';
        mark.setAttribute('data-retained-mark', base);
        mark.textContent = 'retained, control unticked';
        td.appendChild(mark);
      } else if (!kept && mark) mark.remove();
    }
  });
}

async function copyNotebook() {
  const text = lastRecord ? notebookText(lastRecord) : '';
  try {
    await navigator.clipboard.writeText(text);
    $('copy-status').hidden = false;
    $('copy-status').textContent = 'Copied.';
    $('notebook-fallback').hidden = true;
  } catch {
    $('notebook-fallback').hidden = false;
    $('copy-status').hidden = false;
    $('copy-status').textContent = 'The clipboard is unavailable; the text is below.';
  }
}

function init() {
  document.title = `${CONFIG.publisher} · ${CONFIG.toolTitle}`;
  $('site-header').innerHTML = renderHeader();
  $('site-footer').innerHTML = renderFooter();
  $('colophon').innerHTML = renderColophon();
  $('favicon').href = markDataUri();
  $('privacy-body').innerHTML = `<p>${esc(PRIVACY_STATEMENT)}</p><p><a href="${esc(CONFIG.privacyUrl)}" target="_blank" rel="noopener noreferrer">Privacy Policy</a></p>`;
  $('privacy-version').textContent = PRIVACY_DATE;
  $('statements').innerHTML = statementsHtml();
  $('register').innerHTML = registerHtml();
  $('failures').innerHTML = failuresHtml();
  $('object-hint').textContent = 'The machine-readable record of this cocktail: every declaration as typed, every unrounded value with its unit, and every flag with the components it names. Its schema is C5\'s own (ligant-benchtools-c5-master-mix 1.0.0-draft); the tool set has no shared format yet.';
  bindCopy($('site-footer'));

  $('mm-form').reset();
  $('panel-fields').innerHTML = panelFieldsHtml();
  $('components-head').innerHTML = `<tr>${ROW_HEADINGS.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  rows.push(newRow(false));
  renderRows();

  $('panel-fields').addEventListener('input', onPanelInput);
  $('panel-fields').addEventListener('change', onPanelInput);
  $('components-body').addEventListener('input', onRowInput);
  $('components-body').addEventListener('change', onRowInput);
  $('components-body').addEventListener('click', onRowClick);
  $('add-component').addEventListener('click', addComponent);
  $('panel-control').addEventListener('change', onPanelControl);
  $('mm-form').addEventListener('submit', (e) => e.preventDefault());
  $('print-bench-sheet').addEventListener('click', () => window.print());
  $('copy-notebook').addEventListener('click', copyNotebook);
  new ResizeObserver(keepInView).observe($('bounded-block'));
  compute();
}

window.addEventListener('error', (e) => {
  // A system error, not a rejection: one of the two places the restricted red is used.
  const el = $('system-error');
  el.hidden = false;
  el.textContent = `System error: ${e.message}. The result shown may be stale; reload the page.`;
});

init();
