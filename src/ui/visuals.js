// The visuals (C5-VZ-01 to VZ-10), as SVG, drawn from the structured result
// only (C5-VZ-04). No number is computed here: each label is a value of the
// record, displayed as the table displays it (format.js); positions are only
// the drawing's geometry. No animation and no progress indicator (VZ-10).
//
// Every shape and every piece of text carries its own paint as presentation
// attributes, so the drawing is the same on the page and on the printed bench
// sheet, where no page stylesheet applies (C5-VZ-08), and nothing relies on
// SVG's default black fill. Colour encodes identity only and never alone
// (VZ-07): adjacent segments differ by pattern and are outlined, so they stay
// distinct in greyscale; nothing is coloured by acceptability. The one
// deliberate solid black is the VZ-03 mark (data-deliberate). Every flagged
// component carries its reason codes wherever it appears (VZ-06). Each label
// carries data-key, the same key as the table's cell for that value
// (acceptance 27).
import { escapeHtml as esc } from '@ligant/bench-chrome';
import { sig } from '../engine/numfmt.js';
import { PRECISION } from '../engine/format.js';

const W = 1200;
const vol = (x) => sig(x, PRECISION.volumes);
const ratio = (x) => sig(x, PRECISION.ratios);
const WITHHELD = { 'C5-FL-02': 'withheld: established staining volume not recorded (C5-FL-02)' };

// Paint, in one place. Greys only, so greyscale print loses nothing.
const INK = '#262626';
const OUTLINE = 'stroke="#333333" stroke-width="1"';
const TEXT = `fill="${INK}" font-family="Inter, Arial, sans-serif" font-size="11"`;
const NUM = `fill="${INK}" font-family="IBM Plex Mono, Menlo, monospace" font-size="11"`;

// The fills, as patterns defined in each drawing (ids prefixed, so the page and
// the bench sheet copies do not collide).
//   component A: light grey; component B: light grey with vertical lines (the
//   two alternate, so adjacent components differ by pattern); diluent: white
//   with diagonal hatching; residual (VZ-01): white with dots; dispensed
//   (VZ-01): light grey.
const PATTERNS = (p) => '<defs>'
  + `<pattern id="${p}pat-comp-a" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#d9d9d9"/></pattern>`
  + `<pattern id="${p}pat-comp-b" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#d9d9d9"/><line x1="1" y1="0" x2="1" y2="4" stroke="#666666" stroke-width="1"/></pattern>`
  + `<pattern id="${p}pat-diluent" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ffffff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#6b6b6b" stroke-width="1.2"/></pattern>`
  + `<pattern id="${p}pat-residual" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#ffffff"/><circle cx="3" cy="3" r="1.2" fill="#555555"/></pattern>`
  + '</defs>';
const fill = (p, name) => `fill="url(#${p}pat-${name})"`;
const compPattern = (index) => (index % 2 === 1 ? 'comp-a' : 'comp-b');
const swatch = (p, name) => `<svg class="swatch" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="0.5" y="0.5" width="11" height="11" ${fill(p, name)} ${OUTLINE}/></svg>`;

/** The reason codes naming each component, as "FL-01 FL-04". */
export function codesByComponent(rec) {
  const m = new Map();
  for (const f of rec.flags) for (const i of f.components) m.set(i, [...(m.get(i) || []), f.code.replace('C5-', '')]);
  return m;
}

const name = (rec, i) => {
  const label = rec.declarations.components[i - 1].label.trim();
  return label ? `${i} ${label}` : `${i} (no label)`;
};

// C5-VZ-01: the assay staining volume, divided into the volume already present
// with the cells and the dispensed volume. A declared zero residual is drawn as
// a labelled zero-width segment, not omitted.
function vz01(rec, p) {
  const R = rec.declarations.residual.normalised.value;
  const D = rec.declarations.dispensed.normalised.value;
  const SV = rec.values.svAssay.value;
  const xr = (R / SV) * W;
  const residual = R === 0
    ? `<line data-segment="residual" data-key="vz01-residual-segment" x1="1" y1="6" x2="1" y2="38" stroke="${INK}" stroke-width="2"/>`
    : `<rect data-segment="residual" data-key="vz01-residual-segment" x="0" y="10" width="${xr}" height="24" ${fill(p, 'residual')} ${OUTLINE}/>`;
  return `<div class="vz" id="${p}vz01">`
    + '<h3 class="sub-h">C5-VZ-01 · Tube composition</h3>'
    + `<svg viewBox="0 0 ${W} 64" role="img" aria-label="Tube composition: volume present with the cells (dotted) and volume dispensed (grey)">${PATTERNS(p)}`
    + `${residual}<rect data-segment="dispensed" x="${xr}" y="10" width="${W - xr}" height="24" fill="#d9d9d9" ${OUTLINE}/>`
    + `<text x="2" y="54" ${NUM} data-key="vz01-residual">present with cells ${esc(vol(R))} µL</text>`
    + `<text x="${Math.min(Math.max(xr + 4, 240), W - 260)}" y="54" ${NUM} data-key="vz01-dispensed">dispensed ${esc(vol(D))} µL</text>`
    + `<text x="${W - 4}" y="54" text-anchor="end" ${NUM} data-key="vz01-sv">assay staining volume ${esc(vol(SV))} µL</text>`
    + '</svg></div>';
}

// C5-VZ-02: the cocktail, to scale, divided into each component and the
// diluent. Segments become too thin to label as the count grows, so a legend
// lists every component with its pattern, its volume and its reason codes. The
// antibody fraction is stated beside it (C5-DT-06); no threshold, band or
// colour judges it.
function vz02(rec, codes, p) {
  const v = rec.values;
  const total = v.totalCocktail.value;
  let x = 0;
  let segs = '';
  for (const c of v.components) {
    const w = (c.volumeInCocktail.value / total) * W;
    segs += `<rect data-segment="component-${c.index}" data-component-segment="${c.index}" x="${x}" y="8" width="${w}" height="26" ${fill(p, compPattern(c.index))} ${OUTLINE}/>`;
    if (w > 22) segs += `<text x="${x + w / 2}" y="26" text-anchor="middle" ${NUM}>${c.index}</text>`;
    x += w;
  }
  segs += `<rect data-segment="diluent" x="${x}" y="8" width="${Math.max(W - x, 0)}" height="26" ${fill(p, 'diluent')} ${OUTLINE}/>`;
  const legend = v.components.map((c) => {
    const cc = codes.get(c.index);
    return `<li data-component="vz02-${c.index}">${swatch(p, compPattern(c.index))}${esc(name(rec, c.index))}: <span class="num" data-key="vcocktail-${c.index}">${esc(vol(c.volumeInCocktail.value))}</span> µL${cc ? ` <span class="codes">${esc(cc.join(' '))}</span>` : ''}</li>`;
  }).join('');
  return `<div class="vz" id="${p}vz02">`
    + '<h3 class="sub-h">C5-VZ-02 · Cocktail composition</h3>'
    + `<svg viewBox="0 0 ${W} 42" role="img" aria-label="Cocktail composition, to scale; components alternate plain and lined grey, diluent hatched">${PATTERNS(p)}${segs}</svg>`
    + `<p class="hint">Total component volume ÷ total cocktail volume (antibody fraction) = <span class="num" data-key="antibody-fraction">${esc(ratio(v.antibodyFraction.value))}</span>. No threshold applies.</p>`
    + `<ul class="vz-legend">${legend}<li>${swatch(p, 'diluent')}Diluent: <span class="num" data-key="diluent-total">${esc(vol(v.diluentTotal.value))}</span> µL</li></ul></div>`;
}

// C5-VZ-03: each component's concentration in the assay ÷ the concentration it
// was established at, on a log axis centred on 1 with ticks symmetric in log
// space. The range is 0.25 to 4, extended to the nearest power of two beyond
// the plotted ratios (§11). A withheld ratio is an empty labelled row with its
// reason, never a mark (VZ-05). The axis is pinned at the top of the strip,
// under the bounded block, so it stays in view at 60 components.
const LEFT = 360;
const RIGHT = 60;
function vz03(rec, codes, p) {
  const comps = rec.values.components;
  let L = 2; // log2(4)
  for (const c of comps) if (!c.ratio.withheld) L = Math.max(L, Math.ceil(Math.abs(Math.log2(c.ratio.value))));
  const xOf = (r) => LEFT + ((Math.log2(r) + L) / (2 * L)) * (W - LEFT - RIGHT);
  const ticks = [];
  for (let k = -L; k <= L; k++) ticks.push(2 ** k);
  const tickLabel = (t) => (t >= 1 ? String(t) : `1/${1 / t}`);
  const axis = `<svg viewBox="0 0 ${W} 30" role="img" aria-label="Ratio axis, logarithmic, centred on 1">`
    + `<text x="4" y="20" ${TEXT}>concentration in the assay ÷ concentration established at</text>`
    + ticks.map((t) => `<text x="${xOf(t)}" y="20" text-anchor="middle" ${NUM} data-tick="${t}">${tickLabel(t)}</text>`).join('')
    + '</svg>';
  const ROW = 22;
  const h = comps.length * ROW + 6;
  const grid = ticks.map((t) => `<line class="${t === 1 ? 'unity' : 'axis'}" x1="${xOf(t)}" y1="0" x2="${xOf(t)}" y2="${h}" stroke="${t === 1 ? INK : '#9a9a9a'}" stroke-width="1"/>`).join('');
  const rows = comps.map((c, i) => {
    const y = i * ROW + ROW / 2 + 3;
    const cc = codes.get(c.index);
    const label = `<text x="4" y="${y + 4}" ${TEXT}>${esc(name(rec, c.index))}${cc ? `  ${esc(cc.join(' '))}` : ''}</text>`;
    const body = c.ratio.withheld
      ? `<text x="${LEFT + 6}" y="${y + 4}" ${TEXT} font-style="italic" data-key="ratio-${c.index}">${esc(WITHHELD[c.ratio.reason] || `withheld: ${c.ratio.reason}`)}</text>`
      : `<circle class="mark" data-mark="${c.index}" data-deliberate="mark" cx="${xOf(c.ratio.value)}" cy="${y}" r="4" fill="#000000"/><text x="${xOf(c.ratio.value) + 8}" y="${y + 4}" ${NUM} data-key="ratio-${c.index}">${esc(ratio(c.ratio.value))}</text>`;
    return `<g data-component="vz03-${c.index}">${label}${body}</g>`;
  }).join('');
  return `<div class="vz" id="${p}vz03">`
    + '<h3 class="sub-h">C5-VZ-03 · Concentration ratio strip</h3>'
    + `<div class="vz03-axis">${axis}</div>`
    + `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="Concentration ratio of each component, logarithmic axis centred on 1">${grid}${rows}</svg></div>`;
}

/** All three visuals. `prefix` keeps element ids unique when drawn twice (page and bench sheet). */
export function visualsHtml(rec, prefix = '') {
  const codes = codesByComponent(rec);
  return vz01(rec, prefix) + vz02(rec, codes, prefix) + vz03(rec, codes, prefix);
}
