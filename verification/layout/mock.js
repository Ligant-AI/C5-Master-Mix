// Task 3 layout mock. Synthetic content only: no engine, nothing computed.
// Query parameters:
//   n=<count>            number of component rows (default 10)
//   diluent=<chars>      a recorded diluent of that many characters, in place of
//                        "not recorded" (so C5-FL-09 is not raised); measures
//                        the one free-text declaration in the block
// Every flag's count is taken from the synthetic rows, so the counts in the
// block and the names below the list agree.
import '@ligant/bench-chrome/chrome.css';
import { renderHeader, markDataUri, escapeHtml as esc } from '@ligant/bench-chrome';
import { renderFooter } from '../../src/ui/chrome.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const N = Math.max(1, Math.min(200, Number(params.get('n')) || 10));
const DILUENT_CHARS = Number(params.get('diluent')) || 0;
// typed=<chars>: every typed number in the declaration summary padded with
// trailing zeros to that many characters ("50.0000000000"), as a user may type it.
const TYPED = Number(params.get('typed')) || 0;
const typed = (v) => (TYPED && v.length < TYPED ? (v.includes('.') ? v : `${v}.`).padEnd(TYPED, '0') : v);

// A placeholder of C7's tagline length (262 characters), so the header is as
// tall as it will be once A.B.'s wording is supplied.
const TAGLINE = 'Placeholder for the Master Mix tagline, pending A.B.\'s wording. It is set to the length of C7\'s tagline, 262 characters, so that the header measured here is as tall as the real one will be. Nothing in this sentence describes the tool, and none of it will ship as-is.';

const MARKERS = ['CD3', 'CD4', 'CD8', 'CD45RA', 'CCR7', 'CD27', 'CD28', 'CD95', 'CD127', 'CD25', 'CXCR5', 'PD-1', 'ICOS', 'CD38', 'HLA-DR', 'CD14', 'CD16', 'CD56', 'CD19', 'CD20', 'IgD', 'CD24', 'CD11c', 'CD123', 'CD1c', 'CD141', 'TCRγδ', 'Vδ2', 'CD161', 'CCR6', 'CXCR3', 'CCR4', 'KLRG1', 'CD57', 'TIGIT', 'LAG-3', 'TIM-3', 'CD39', 'CD73', 'CD69', 'CD103', 'CD45', 'CD2', 'CD7', 'NKG2A', 'NKG2C', 'CD94', 'CD62L', 'CD31', 'IgM', 'IgG', 'CD10', 'CD21', 'CD86', 'CD80', 'CD40', 'FcεRI', 'CD117', 'CD34', 'Live/Dead'];
const FLUORS = ['BUV395', 'BUV496', 'BUV563', 'BUV615', 'BUV661', 'BUV737', 'BUV805', 'BV421', 'Pacific Blue', 'BV480', 'BV510', 'BV570', 'BV605', 'BV650', 'BV711', 'BV750', 'BV785', 'BB515', 'Alexa Fluor 488', 'Spark Blue 550', 'PerCP', 'PerCP-eFluor 710', 'PE', 'PE-CF594', 'PE-Cy5', 'PE-Cy5.5', 'PE-Cy7', 'APC', 'Alexa Fluor 647', 'APC-R700', 'APC-Fire 750', 'APC-Cy7'];

// Synthetic rows. Assay staining volume is 100 µL and assay cells 1000000.
const rows = Array.from({ length: N }, (_, i) => {
  const sv = i % 5 === 1 ? null : i % 3 === 0 ? '50' : '100';
  const cells = i % 6 === 2 ? null : i % 4 === 0 ? '500000' : '1000000';
  return {
    label: `${MARKERS[i % MARKERS.length]} ${FLUORS[(i * 7) % FLUORS.length]}`,
    qty: ['0.25', '0.125', '1', '2.5', '0.5'][i % 5], qtyUnit: ['µg', 'µg', 'µL', 'µL', 'µg'][i % 5],
    stock: ['0.2', '0.1', '', '', '0.5'][i % 5], stockUnit: ['mg/mL', 'mg/mL', '', '', 'mg/mL'][i % 5],
    sv, cells,
    prov: ['titrated-here', 'vendor', 'titrated-here', 'not-recorded', 'vendor'][i % 5],
    lowVolume: i % 7 === 3,
  };
});

const named = (pred) => rows.filter(pred).map((r) => r.label);
const PANEL_FLAGS = [
  { code: 'C5-FL-01', label: 'Established at a different staining volume', names: named((r) => r.sv !== null && r.sv !== '100') },
  { code: 'C5-FL-02', label: 'Established staining volume not recorded; ratio withheld', names: named((r) => r.sv === null) },
  { code: 'C5-FL-03', label: 'Overage is zero' },
  { code: 'C5-FL-04', label: 'Not titrated in this laboratory', names: named((r) => r.prov !== 'titrated-here') },
  { code: 'C5-FL-05', label: 'Below the minimum transfer volume', names: named((r) => r.lowVolume) },
  { code: 'C5-FL-07', label: 'Total exceeds the declared vessel capacity' },
  { code: 'C5-FL-08', label: 'Established at more than one staining volume', names: named((r) => r.sv !== null) },
  { code: 'C5-FL-09', label: 'Diluent not recorded' },
  { code: 'C5-FL-11', label: 'Established at a different cell number', names: named((r) => r.cells !== null && r.cells !== '1000000') },
  { code: 'C5-FL-12', label: 'Established cell number not recorded', names: named((r) => r.cells === null) },
];
// A component-scoped flag is raised only when it names a component.
const FLAGS = PANEL_FLAGS.filter((f) => (f.names ? f.names.length > 0 : true) && !(DILUENT_CHARS && f.code === 'C5-FL-09'));

const DILUENT_POOL = 'PBS pH 7.4 with 2% heat-inactivated FBS, 2 mM EDTA and 0.1% sodium azide, with Brilliant Stain Buffer Plus at 1x and True-Stain Monocyte Blocker at 5 µL per test, filtered at 0.22 µm and kept at 4 °C; lot numbers recorded in the bench notebook for this run. ';
const diluent = DILUENT_CHARS ? DILUENT_POOL.repeat(Math.ceil(DILUENT_CHARS / DILUENT_POOL.length)).slice(0, DILUENT_CHARS).trim() : 'not recorded';

const DECLS = [
  ['basis', 'Transfer basis', 'preserve concentration'],
  ['dispensed', 'Dispensed per test', `${typed('50')} µL`],
  ['residual', 'Present with cells', `${typed('50')} µL`],
  ['assay-sv', 'Assay staining volume', `${typed('100')} µL`],
  ['assay-cells', 'Assay cells per test', `${typed('1000000')} cells`],
  ['samples', 'Samples', '96'],
  ['overage', 'Overage', `dead-volume form, ${typed('0')} µL · 96 effective tests`],
  ['min-transfer', 'Minimum transfer', `${typed('2')} µL (suggested default, not changed)`],
  ['capacity', 'Vessel capacity', `${typed('1.5')} mL`],
  ['diluent', 'Diluent', diluent],
];

function renderBlock() {
  $('declarations-content').innerHTML = DECLS.map(([id, k, v]) => `<span class="decl${id === 'diluent' && DILUENT_CHARS ? ' wrap' : ''}" data-decl="${id}"><b>${esc(k)}</b>${esc(v)}</span>`).join('');
  $('flag-summary').innerHTML = FLAGS.map((f) => {
    const count = f.names ? ` — ${f.names.length} component${f.names.length === 1 ? '' : 's'}` : '';
    return `<li data-flag="${f.code}"><span class="code">${f.code}</span>${esc(f.label)}${count}</li>`;
  }).join('');
}

function unitSelect(value, options, cls = '') {
  return `<select class="num${cls ? ` ${cls}` : ''}">${['', ...options].map((u) => `<option${u === value ? ' selected' : ''}>${u || '—'}</option>`).join('')}</select>`;
}

function renderRows() {
  $('components-head').innerHTML = '<tr><th>#</th><th>Label</th><th>Intended per test</th><th>Stock concentration</th><th>Established staining volume</th><th>Established cell number</th><th>Provenance</th><th>Transport</th></tr>';
  $('components-body').innerHTML = rows.map((r, i) => `<tr data-component="row-${i + 1}">`
    + `<td class="idx">${i + 1}</td>`
    + `<td><input type="text" class="label-in" value="${esc(r.label)}"></td>`
    + `<td><span class="q"><input type="text" class="num" value="${r.qty}">${unitSelect(r.qtyUnit, ['µg', 'ng', 'µL', 'µg/mL', 'IU', 'U'])}</span></td>`
    + `<td><span class="q"><input type="text" class="num" value="${r.stock}">${unitSelect(r.stockUnit, ['mg/mL', 'µg/mL', 'µM', 'IU/mL', 'U/mL'], 'conc')}</span></td>`
    // "not recorded" is a choice in the unit list, not a separate checkbox: the
    // row then fits 1366 px without cutting off any entered value.
    + `<td><span class="q"><input type="text" class="num" value="${r.sv ?? ''}"${r.sv === null ? ' disabled' : ''}>${unitSelect(r.sv === null ? 'not recorded' : 'µL', ['µL', 'mL', 'not recorded'], 'wide')}</span></td>`
    + `<td><span class="q"><input type="text" class="num cells" value="${r.cells ?? ''}"${r.cells === null ? ' disabled' : ''}>${unitSelect(r.cells === null ? 'not recorded' : 'cells', ['cells', 'not recorded'], 'wide')}</span></td>`
    + `<td><select class="prov">${[['titrated-here', 'titrated here'], ['vendor', 'vendor recommendation'], ['not-recorded', 'not recorded']].map(([v, t]) => `<option${v === r.prov ? ' selected' : ''}>${t}</option>`).join('')}</select></td>`
    + `<td class="transport">entered</td>`
    + '</tr>').join('');
}

function renderFlagNames() {
  $('flag-names-body').innerHTML = FLAGS.filter((f) => f.names).map((f) => `<p class="flag-names-line" data-component="names-${f.code}"><span class="code">${f.code}</span>${esc(f.names.join(', '))}</p>`).join('');
}

function renderPanelFields() {
  const fields = [['Dispensed cocktail volume per test', '50', 'µL'], ['Volume already present with the cells', '50', 'µL'], ['Assay cell number per test', '1000000', 'cells'], ['Number of samples', '96', ''], ['Overage', '0', 'µL dead volume'], ['Transfer basis', 'preserve concentration', ''], ['Diluent', DILUENT_CHARS ? diluent.slice(0, 40) : 'not recorded', ''], ['Minimum transfer volume', '2', 'µL'], ['Vessel working capacity', '1.5', 'mL'], ['Established at assay conditions', 'not used', '']];
  $('panel-fields').innerHTML = fields.map(([l, v, u]) => `<div class="field"><label>${esc(l)}</label><input type="text" class="num" value="${esc(v)}${u ? ` ${esc(u)}` : ''}"></div>`).join('');
}

// Placeholder SVGs at their real sizes: VZ-01 and VZ-02 single bars, VZ-03 one
// row per component. Positions are illustrative; nothing is computed.
const W = 1200;
function renderVisuals() {
  $('vz01').innerHTML = `<svg viewBox="0 0 ${W} 56" role="img" aria-label="placeholder: tube composition">`
    + `<rect class="seg-a" x="0" y="8" width="${W / 2}" height="24"/><rect class="seg-b" x="${W / 2}" y="8" width="${W / 2}" height="24"/>`
    + `<text x="4" y="48" class="num">present with cells 50 µL</text><text x="${W / 2 + 4}" y="48" class="num">dispensed 50 µL</text></svg>`;
  const fr = 0.31;
  $('vz02').innerHTML = `<svg viewBox="0 0 ${W} 56" role="img" aria-label="placeholder: cocktail composition">`
    + rows.map((_, i) => `<rect class="seg-a" x="${(i * W * fr) / N}" y="8" width="${(W * fr) / N}" height="24"/>`).join('')
    + `<rect class="seg-b" x="${W * fr}" y="8" width="${W * (1 - fr)}" height="24"/>`
    + `<text x="4" y="48" class="num">components ${N} · antibody fraction (total component volume ÷ total cocktail volume) 0.310</text></svg>`;
  const ROW = 22, TOP = 26, LEFT = 300;
  const h = TOP + N * ROW + 8;
  const x = (r) => LEFT + ((Math.log2(r) + 2) / 4) * (W - LEFT - 20);
  const flagsOf = (label) => FLAGS.filter((f) => f.names && f.names.includes(label)).map((f) => f.code.replace('C5-', '')).join(' ');
  $('vz03').innerHTML = `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="placeholder: concentration ratio strip">`
    + [0.25, 0.5, 1, 2, 4].map((t) => `<line class="${t === 1 ? 'unity' : 'axis'}" x1="${x(t)}" y1="${TOP - 6}" x2="${x(t)}" y2="${h - 4}"/><text x="${x(t) - 8}" y="${TOP - 10}" class="num">${t}</text>`).join('')
    + rows.map((r, i) => {
      const y = TOP + i * ROW + ROW / 2;
      const body = r.sv === null
        ? `<text x="${LEFT}" y="${y + 4}">withheld: established staining volume not recorded (FL-02)</text>`
        : `<circle class="mark" cx="${x(r.sv === '50' ? 2 : 1)}" cy="${y}" r="4"/><text x="${x(r.sv === '50' ? 2 : 1) + 8}" y="${y + 4}" class="num">${r.sv === '50' ? '2' : '1'}</text>`;
      return `<g data-component="vz03-${i + 1}"><text x="4" y="${y + 4}">${esc(r.label)}  ${flagsOf(r.label)}</text>${body}</g>`;
    }).join('')
    + '</svg>';
}

// C7's keep-in-view rule: a trailing spacer at least the block's height, inside
// the sticky block's container, so the last component-bearing line has left the
// viewport before the block is pushed off the top. The column headings stick
// directly under the block.
function keepInView() {
  const h = Math.ceil($('bounded-block').getBoundingClientRect().height);
  document.documentElement.style.setProperty('--block-h', `${h}px`);
  $('keep-spacer').style.height = `${h + 24}px`;
}

$('site-header').innerHTML = renderHeader({ path: null, title: 'Master Mix', description: TAGLINE });
$('site-footer').innerHTML = renderFooter();
$('favicon').href = markDataUri();
renderPanelFields();
renderBlock();
renderRows();
renderFlagNames();
renderVisuals();
keepInView();
new ResizeObserver(keepInView).observe($('bounded-block'));
document.fonts.ready.then(() => { keepInView(); document.documentElement.dataset.mockReady = '1'; });
