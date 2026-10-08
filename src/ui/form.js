// The form (CLAUDE.md §6.2; C5-UN-01, C5-CP-01 to C5-CP-05, C5-PC-01). Builds
// the panel fields and the spreadsheet rows, and reads them into the engine
// I/O contract's input object. State lives in memory only (C5-ST-10).
//
// Every control carries data-field, so the headless checks drive the page as
// a user does. Every unit selector starts unselected (C5-UN-01); the one
// pre-selected unit, the minimum transfer's, is marked as a suggestion
// (C5-PC-01). "Not recorded" is a choice in a unit list (Task 3 review).
import { escapeHtml as esc } from '@ligant/bench-chrome';
import { UNITS, KIND, quantity, sumVolumes } from '../engine/units.js';
import { Dec } from '../engine/numfmt.js';

const symbols = (kind, dimension) => UNITS.filter((u) => u.kind === kind && (!dimension || u.dimension === dimension)).map((u) => u.symbol);
const VOLUME = symbols(KIND.VOLUME);
const CELLS = symbols(KIND.CELLS);
const AMOUNT = symbols(KIND.AMOUNT);
const CONCENTRATION = symbols(KIND.CONCENTRATION);

export const NOT_RECORDED = 'not-recorded';

function options(groups, selected = '', placeholder = '—') {
  const opt = (v, t) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(t)}</option>`;
  let html = opt('', placeholder);
  for (const [label, items] of groups) {
    const body = items.map((x) => (Array.isArray(x) ? opt(x[0], x[1]) : opt(x, x))).join('');
    html += label ? `<optgroup label="${esc(label)}">${body}</optgroup>` : body;
  }
  return html;
}

const field = (label, inner, cls = '') => `<div class="field${cls ? ` ${cls}` : ''}"><label>${label}</label>${inner}</div>`;
const valueInput = (name, value = '') => `<input type="text" inputmode="decimal" class="num" data-field="${name}" value="${esc(value)}" aria-label="${esc(name)}">`;
const unitSelect = (name, groups, selected = '', cls = '') => `<select class="num${cls ? ` ${cls}` : ''}" data-field="${name}" aria-label="${esc(name)} unit">${options(groups, selected)}</select>`;

/** The panel-level fields (CLAUDE.md §5.2). */
export function panelFieldsHtml() {
  return [
    field('Dispensed cocktail volume per test', `<span class="q">${valueInput('dispensed.value')}${unitSelect('dispensed.unit', [['', VOLUME]])}</span>`),
    field('Volume already present with the cells', `<span class="q">${valueInput('residual.value')}${unitSelect('residual.unit', [['', VOLUME]])}</span>`),
    field('Assay cell number per test', `<span class="q">${valueInput('assayCells.value')}${unitSelect('assayCells.unit', [['', CELLS]])}</span>`),
    field('Number of samples', `<input type="text" inputmode="numeric" class="num" data-field="samples" aria-label="samples">`),
    field('Overage', `<span class="q"><select data-field="overage.form" aria-label="overage form">${options([['', [['percentage', 'percentage of samples'], ['additional-tests', 'additional tests'], ['dead-volume', 'dead volume']]]], '', 'form')}</select>${valueInput('overage.value')}${unitSelect('overage.unit', [['', VOLUME]])}</span>`, 'span2'),
    field('Transfer basis <span class="optional" id="basis-required"></span>', `<select data-field="basis" aria-label="transfer basis">${options([['', [['preserve-concentration', 'preserve concentration'], ['preserve-amount', 'preserve amount per test']]]], '', '— select —')}</select>`),
    field('Diluent', `<input type="text" data-field="diluent.text" aria-label="diluent"><label class="check"><input type="checkbox" data-field="diluent.notRecorded"> not recorded</label>`),
    field('Minimum reliable transfer volume', `<span class="q">${valueInput('minTransfer.value', '2')}${unitSelect('minTransfer.unit', [['', VOLUME]], 'µL')}</span><p class="help" id="min-suggested"><span class="suggested-dot" aria-hidden="true"></span>suggested, not chosen: 2 µL. Replace it with your pipette's value.</p>`),
    field('Vessel working capacity <span class="optional">optional, no default</span>', `<span class="q">${valueInput('capacity.value')}${unitSelect('capacity.unit', [['', VOLUME]])}</span>`),
  ].join('');
}

export const ROW_HEADINGS = ['#', 'Label', 'Intended per test', 'Stock concentration', 'Established staining volume', 'Established cell number', 'Provenance', 'Transport'];

export function emptyComponent() {
  return {
    label: '',
    intended: { value: '', unit: '' },
    stock: { value: '', unit: '' },
    establishedVolume: { value: '', unit: '' },
    establishedCells: { value: '', unit: '' },
    provenance: '',
    declaredByPanelControl: false,
  };
}

const recordedUnit = (f) => (f.notRecorded ? NOT_RECORDED : f.unit);

/** One spreadsheet row. */
export function rowHtml(c, i) {
  const n = i + 1;
  const ev = c.establishedVolume;
  const ec = c.establishedCells;
  return `<tr data-component="row-${n}" data-row="${n}">`
    + `<td class="idx">${n}</td>`
    + `<td><input type="text" class="label-in" data-field="label" value="${esc(c.label)}" aria-label="component ${n} label"></td>`
    + `<td><span class="q">${valueInput('intended.value', c.intended.value)}${unitSelect('intended.unit', [['amount per test', AMOUNT], ['concentration', CONCENTRATION], ['stock volume per test', VOLUME]], c.intended.unit, 'conc')}</span></td>`
    + `<td><span class="q">${valueInput('stock.value', c.stock.value)}${unitSelect('stock.unit', [['', CONCENTRATION]], c.stock.unit, 'conc')}</span></td>`
    + `<td><span class="q"><input type="text" inputmode="decimal" class="num" data-field="establishedVolume.value" value="${esc(ev.notRecorded ? '' : ev.value)}"${ev.notRecorded ? ' disabled' : ''} aria-label="component ${n} established staining volume">${unitSelect('establishedVolume.unit', [['', [...VOLUME, [NOT_RECORDED, 'not recorded']]]], recordedUnit(ev), 'wide')}</span></td>`
    + `<td><span class="q"><input type="text" inputmode="decimal" class="num cells" data-field="establishedCells.value" value="${esc(ec.notRecorded ? '' : ec.value)}"${ec.notRecorded ? ' disabled' : ''} aria-label="component ${n} established cell number">${unitSelect('establishedCells.unit', [['', [...CELLS, [NOT_RECORDED, 'not recorded']]]], recordedUnit(ec), 'wide')}</span></td>`
    + `<td><select class="prov" data-field="provenance" aria-label="component ${n} provenance">${options([['', [['titrated-here', 'titrated here'], ['vendor', 'vendor recommendation'], [NOT_RECORDED, 'not recorded']]]], c.provenance, '— select —')}</select></td>`
    + `<td class="transport">entered<button type="button" class="remove" data-action="remove" aria-label="Remove component ${n}">×</button></td>`
    + '</tr>';
}

/** Set one component's field from a control. Returns true where it changes an established value. */
export function applyRowField(c, name, el) {
  const [a, b] = name.split('.');
  if (name === 'label') c.label = el.value;
  else if (name === 'provenance') c.provenance = el.value;
  else if (a === 'establishedVolume' || a === 'establishedCells') {
    const f = c[a];
    if (b === 'unit') {
      if (el.value === NOT_RECORDED) { c[a] = { notRecorded: true, value: '', unit: '' }; }
      else c[a] = { value: f.notRecorded ? '' : f.value, unit: el.value };
    } else c[a] = { value: el.value, unit: f.notRecorded ? '' : f.unit };
    return true;
  } else c[a] = { ...c[a], [b]: el.value };
  return false;
}

/** The panel control's values: the assay staining volume (the exact sum of the typed D and R, in µL) and the assay cell number as typed. */
export function assayConditions(inputs) {
  const D = quantity(inputs.dispensed.value, inputs.dispensed.unit);
  const R = quantity(inputs.residual.value, inputs.residual.unit);
  const cells = quantity(inputs.assayCells.value, inputs.assayCells.unit);
  const ok = (q, kind) => q.status === 'ok' && !q.unrepresentable && q.kind === kind;
  if (!ok(D, KIND.VOLUME) || !ok(R, KIND.VOLUME) || !ok(cells, KIND.CELLS)) return null;
  return {
    volume: { value: Dec.toString(Dec.trimZeros(sumVolumes(D, R).exact)), unit: 'µL' },
    cells: { value: inputs.assayCells.value, unit: inputs.assayCells.unit },
  };
}
