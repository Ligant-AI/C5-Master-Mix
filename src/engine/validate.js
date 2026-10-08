// Validation (C5 §7, C5-HI-01 to C5-HI-11; C5-HI-07 is withdrawn and has no
// rule). Pure: no DOM, no browser API, no state.
//
// validate(inputs) reads every field, says which are incomplete, and applies
// every rejection whose own inputs are present, so a physical impossibility is
// reported even while other fields are still blank.
//
//   { status: 'rejected' | 'incomplete' | 'ok', rejections, incomplete, basisRequired, parsed }
//
// 'rejected' takes precedence over 'incomplete'. Rejections are listed in the
// order of the §7 table (by component row within a rule), then the branches
// pending a ruling, so the same inputs always give the same list (C5-ST-08):
// the rules below are applied in that order.
//
// Incomplete is not a rejection: a blank required field means no result yet.
// Blank, zero and "not recorded" are three different states throughout.
//
// C5-HI-06 needs every component's volume per test, which depends on the
// transfer basis (determine.js, Task 6). It is a separate rule here,
// rejectionHI06(), applied by determine to the volumes it computes.
//
// THE INPUT MODEL. Every number is the string as typed, with its selected unit.
//   dispensed       { value, unit }                      C5-SV-01, volume
//   residual        { value, unit }                      C5-SV-02, volume; zero accepted
//   assayCells      { value, unit }                      C5-SV-04, cells; zero accepted
//   samples         value                                C5-SV-05, an integer count: no unit
//   overage         { form, value, unit }                C5-OV-01; form is 'percentage',
//                                                        'additional-tests' or 'dead-volume'
//                                                        ('' unselected); unit only for
//                                                        dead volume; zero accepted
//   basis           'preserve-concentration' | 'preserve-amount' | ''   C5-CP-06, CP-07
//   diluent         { notRecorded, text }                C5-DL-01
//   minTransfer     { value, unit, defaulted }           C5-PC-01, volume
//   capacity        { value, unit }                      C5-PC-02, volume; optional
//   components      [{ label, intended: { value, unit }, stock: { value, unit },
//                      establishedVolume: { notRecorded, value, unit },
//                      establishedCells: { notRecorded, value, unit },
//                      provenance: 'titrated-here' | 'vendor' | 'not-recorded' | '' }]
// Rows are numbered from 1 in entered order. Transport is always 'entered' in
// 1.0 (C5-CP-05) and is not an input.
import * as Dec from './decimal.js';
import { sig } from './numfmt.js';
import { KIND, quantity, parseTyped, sumVolumes, reduction, rejectionHI05, componentName } from './units.js';
import { equalUnderRule, canonical, canonicalOfDouble } from './compare.js';

export const OVERAGE_FORMS = Object.freeze(['percentage', 'additional-tests', 'dead-volume']);
export const BASES = Object.freeze(['preserve-concentration', 'preserve-amount']);
export const PROVENANCES = Object.freeze(['titrated-here', 'vendor', 'not-recorded']);

// The §7 rules in table order. C5-HI-07 is withdrawn (v0.2, A2) and is not a rule.
export const RULES = Object.freeze(['C5-HI-01', 'C5-HI-02', 'C5-HI-03', 'C5-HI-04', 'C5-HI-05', 'C5-HI-06', 'C5-HI-08', 'C5-HI-09', 'C5-HI-10', 'C5-HI-11']);

// Branches that do not compute until a question is ruled on (CLAUDE.md §3).
// Not URS IDs: the URS IDs are frozen.
export const PENDING = Object.freeze({
  Q1: 'PENDING-Q1',
  Q2: 'PENDING-Q2',
  Q4: 'PENDING-Q4',
});

const typed = (q) => (q.unit ? `${q.text} ${q.unit}` : q.text);

// A field's number, with the unit kind the page offers for it. A unit of
// another kind cannot come from the page, so it is a defect, not an input.
function read(field, kind) {
  const q = quantity(field ? field.value : '', field ? field.unit : '');
  if (q.status === 'ok' && kind && q.kind !== kind) throw new Error(`validate: unit "${q.unit}" is not a ${kind} unit`);
  return q;
}

const INCOMPLETE_TEXT = {
  blank: 'is required and is blank',
  'no-unit': 'has a number but no unit selected',
  'not-selected': 'is required and nothing is selected',
};

function incompleteEntry(field, q, what, component) {
  let reason = q.status;
  let message;
  if (q.status === 'invalid') message = `${what}: "${q.text}" ${q.reason}.`;
  else if (q.status === 'ok' && q.unrepresentable) {
    reason = 'unrepresentable';
    message = `${what}: ${typed(q)} is outside the range of numbers this tool can compute with. This is a limit of the arithmetic, not a physical one.`;
  } else message = `${what} ${INCOMPLETE_TEXT[q.status]}.`;
  const e = { field, reason, message };
  if (component) e.component = { row: component.row, label: component.label };
  return e;
}

const isUsable = (q) => q.status === 'ok' && !q.unrepresentable;
// The exact sign of a typed number, available even where its double is not.
const signOf = (q) => (q.status === 'ok' ? q.sign : null);

export function validate(inputs) {
  const rejections = [];
  const incomplete = [];
  const reject = (code, message, extra = {}) => rejections.push({ code, message, ...extra });
  const need = (field, q, what, component) => {
    if (isUsable(q)) return true;
    incomplete.push(incompleteEntry(field, q, what, component));
    return false;
  };

  // ---- the panel -----------------------------------------------------------
  const D = read(inputs.dispensed, KIND.VOLUME);
  const R = read(inputs.residual, KIND.VOLUME);
  const cells = read(inputs.assayCells, KIND.CELLS);
  need('dispensed', D, 'Dispensed cocktail volume per test');
  need('residual', R, 'Volume already present with the cells');
  need('assayCells', cells, 'Assay cell number per test');

  const samplesP = parseTyped(inputs.samples);
  const samples = samplesP === null ? { status: 'blank' }
    : samplesP.invalid ? { status: 'invalid', text: samplesP.text, reason: samplesP.reason }
      : { status: 'ok', text: samplesP.text, unit: '', dec: samplesP.dec, sign: samplesP.dec ? Dec.sign(samplesP.dec) : samplesP.sign, unrepresentable: !!samplesP.unrepresentable, value: samplesP.dec ? Number(Dec.toString(samplesP.dec)) : NaN };
  need('samples', samples, 'Number of samples');

  const ov = inputs.overage || {};
  const form = OVERAGE_FORMS.includes(ov.form) ? ov.form : '';
  let overage = null;
  if (!form) incomplete.push({ field: 'overage.form', reason: 'not-selected', message: `Overage form ${INCOMPLETE_TEXT['not-selected']}: percentage, additional tests or dead volume.` });
  else if (form === 'dead-volume') overage = read(ov, KIND.VOLUME);
  else {
    const p = parseTyped(ov.value);
    overage = p === null ? { status: 'blank' } : p.invalid ? { status: 'invalid', text: p.text, reason: p.reason }
      : { status: 'ok', text: p.text, unit: form === 'percentage' ? '%' : '', sign: p.dec ? Dec.sign(p.dec) : p.sign, unrepresentable: !!p.unrepresentable, value: p.dec ? Number(Dec.toString(p.dec)) : NaN, exact: p.dec };
  }
  if (overage) need('overage.value', overage, 'Overage');

  const basis = BASES.includes(inputs.basis) ? inputs.basis : '';

  const dil = inputs.diluent || {};
  if (!dil.notRecorded && !(dil.text && String(dil.text).trim())) {
    incomplete.push({ field: 'diluent', reason: 'blank', message: 'Diluent is required and is blank. "Not recorded" is an accepted answer.' });
  }

  const minT = read(inputs.minTransfer, KIND.VOLUME);
  need('minTransfer', minT, 'Minimum reliable transfer volume');

  const cap = read(inputs.capacity, KIND.VOLUME);
  const capacity = cap.status === 'blank' ? null : cap; // optional, no default (C5-PC-02)
  if (capacity) need('capacity', capacity, 'Vessel working capacity');

  // ---- components ----------------------------------------------------------
  const list = Array.isArray(inputs.components) ? inputs.components : [];
  const components = list.map((c, i) => {
    const comp = { row: i + 1, label: c.label ? String(c.label) : '' };
    const intended = read(c.intended);
    const stock = read(c.stock, KIND.CONCENTRATION);
    const ev = c.establishedVolume || {};
    const ec = c.establishedCells || {};
    const estVolume = ev.notRecorded ? 'not-recorded' : read(ev, KIND.VOLUME);
    const estCells = ec.notRecorded ? 'not-recorded' : read(ec, KIND.CELLS);
    const provenance = PROVENANCES.includes(c.provenance) ? c.provenance : '';
    const name = componentName(comp);

    if (!comp.label.trim()) incomplete.push({ field: 'label', reason: 'blank', message: `${name}: the label is required and is blank.`, component: { row: comp.row, label: comp.label } });
    need('intended', intended, `${name}: intended quantity per test`, comp);
    if (intended.status === 'ok' && intended.kind === KIND.CELLS) throw new Error('validate: a cell number is not an intended-quantity unit');
    // A stock concentration is required where the quantity is an amount or a
    // concentration (C5-CP-01). For a stock volume per test it is not.
    const stockNeeded = intended.status === 'ok' && intended.kind !== KIND.VOLUME;
    if (stockNeeded) need('stock', stock, `${name}: stock concentration`, comp);
    else if (stock.status !== 'blank') need('stock', stock, `${name}: stock concentration`, comp);
    if (estVolume !== 'not-recorded') need('establishedVolume', estVolume, `${name}: established staining volume`, comp);
    if (estCells !== 'not-recorded') need('establishedCells', estCells, `${name}: established cell number`, comp);
    if (!provenance) incomplete.push({ field: 'provenance', reason: 'not-selected', message: `${name}: provenance ${INCOMPLETE_TEXT['not-selected']}: titrated in this laboratory, vendor recommendation, or not recorded.`, component: { row: comp.row, label: comp.label } });
    return { ...comp, name, intended, stock, estVolume, estCells, provenance };
  });

  // ---- §7, in table order --------------------------------------------------
  // HI-01
  if (components.length < 1) {
    reject('C5-HI-01', 'No component has been entered. A cocktail requires at least one component.');
  }
  // HI-02: on the exact typed value, so "1.0000000000000001" is not an integer.
  if (samples.status === 'ok') {
    const integer = samples.unrepresentable ? null : Dec.trimZeros(samples.dec).exp >= 0;
    if (samples.sign < 1 || integer === false) {
      reject('C5-HI-02', `Number of samples: ${samples.text} is not permitted. The number of samples must be a whole number of at least 1${samples.sign < 1 ? '' : '; a fraction of a sample cannot be stained'}.`, { quantity: 'samples' });
    }
  }
  // HI-03
  for (const c of components) {
    if (signOf(c.intended) !== null && c.intended.sign <= 0) {
      reject('C5-HI-03', `${c.name}: the intended quantity per test, ${typed(c.intended)}, is not above zero. A component must contribute a positive quantity of reagent to each test; zero or less is not a quantity that can be pipetted.`, { quantity: 'intended', component: { row: c.row, label: c.label } });
    }
    if (signOf(c.stock) !== null && c.stock.sign <= 0) {
      reject('C5-HI-03', `${c.name}: the stock concentration, ${typed(c.stock)}, is not above zero. A stock with no reagent in it cannot supply any quantity, at any volume.`, { quantity: 'stock', component: { row: c.row, label: c.label } });
    }
  }
  // HI-04
  if (overage && signOf(overage) !== null && overage.sign < 0) {
    const formText = { percentage: 'percentage of the sample count', 'additional-tests': 'number of additional tests', 'dead-volume': 'dead volume' }[form];
    reject('C5-HI-04', `Overage: ${typed(overage)} as a ${formText} is below zero. A cocktail cannot be made for fewer tests than there are samples.`, { quantity: 'overage' });
  }
  // HI-05
  for (const c of components) {
    if (c.intended.status !== 'ok' || c.stock.status !== 'ok' || c.intended.kind === KIND.VOLUME) continue;
    if (reduction(c.intended.unit, c.stock.unit).reducible === false) {
      const r = rejectionHI05(c, c.intended.unit, c.stock.unit);
      rejections.push({ code: r.code, message: r.message, quantity: 'intended', component: r.component, units: r.units });
    }
  }
  // HI-06 is applied by determine.js (see rejectionHI06).
  // HI-08
  if (signOf(R) !== null && R.sign < 0) {
    reject('C5-HI-08', `Volume already present with the cells: ${typed(R)} is below zero. A volume cannot be negative. Zero is accepted.`, { quantity: 'residual' });
  }
  // HI-09: zero cells is a no-cell control and is accepted.
  if (signOf(cells) !== null && cells.sign < 0) {
    reject('C5-HI-09', `Assay cell number per test: ${typed(cells)} is below zero. A count of cells cannot be negative. Zero is accepted, as a no-cell control.`, { quantity: 'assayCells' });
  }
  // HI-10
  if (signOf(minT) !== null && minT.sign <= 0) {
    reject('C5-HI-10', `Minimum reliable transfer volume: ${typed(minT)} is not above zero. A volume that can be transferred cannot be zero or negative.`, { quantity: 'minTransfer' });
  }
  // HI-11
  if (signOf(D) !== null && D.sign <= 0) {
    reject('C5-HI-11', `Dispensed cocktail volume per test: ${typed(D)} is not above zero. A cocktail cannot be dispensed in zero volume, or less.`, { quantity: 'dispensed' });
  }

  // ---- branches pending a ruling --------------------------------------------
  for (const c of components) {
    if (c.intended.status === 'ok' && c.intended.kind === KIND.CONCENTRATION && c.estVolume === 'not-recorded') {
      reject(PENDING.Q1, `${c.name}: not yet supported, pending ruling on question Q1. The intended quantity, ${typed(c.intended)}, is a concentration, and the staining volume it was established at is not recorded; what is computed for this case has not been decided. Nothing is computed for it.`, { component: { row: c.row, label: c.label } });
    }
  }
  // Q2 covers a volume of stock per test with NO stock concentration entered
  // (Task 5 review, ruling 5). With one entered, the component is computed:
  // its concentration in the assay is c_stock × v ÷ SV_assay.
  for (const c of components) {
    if (c.intended.status === 'ok' && c.intended.kind === KIND.VOLUME && c.stock.status === 'blank') {
      reject(PENDING.Q2, `${c.name}: not yet supported, pending ruling on question Q2. The intended quantity, ${typed(c.intended)}, is a volume of stock per test and no stock concentration is entered; how its concentration in the assay is reported has not been decided. Nothing is computed for it.`, { component: { row: c.row, label: c.label } });
    }
  }
  // Values the URS gives no rejection for, which would make a later value
  // non-finite or impossible: held, not computed, pending a ruling (Q4, proposed).
  for (const c of components) {
    if (c.estVolume !== 'not-recorded' && signOf(c.estVolume) !== null && c.estVolume.sign <= 0) {
      reject(PENDING.Q4, `${c.name}: not yet supported, pending ruling on question Q4. The established staining volume, ${typed(c.estVolume)}, is not above zero, and the specification states no rule for it; the assay staining volume divided by it is not a number. Nothing is computed for it.`, { quantity: 'establishedVolume', component: { row: c.row, label: c.label } });
    }
    if (c.estCells !== 'not-recorded' && signOf(c.estCells) !== null && c.estCells.sign < 0) {
      reject(PENDING.Q4, `${c.name}: not yet supported, pending ruling on question Q4. The established cell number, ${typed(c.estCells)}, is below zero, and the specification states no rule for it. Nothing is computed for it.`, { quantity: 'establishedCells', component: { row: c.row, label: c.label } });
    }
  }
  if (capacity && signOf(capacity) !== null && capacity.sign <= 0) {
    reject(PENDING.Q4, `Vessel working capacity: not yet supported, pending ruling on question Q4. ${typed(capacity)} is not above zero, and the specification states no rule for it. Nothing is computed for it.`, { quantity: 'capacity' });
  }

  // ---- C5-CP-07: is the transfer basis required? ------------------------------
  // Required wherever a recorded component's established staining volume
  // differs from the assay's under C5-UN-10. Undetermined (null) while the
  // assay staining volume or a recorded volume is not yet usable, or while
  // either of its terms is rejected (HI-11, HI-08): a demand derived from a
  // rejected volume would be noise.
  let basisRequired = null;
  let svAssay = null;
  if (isUsable(D) && D.sign > 0 && isUsable(R) && R.sign >= 0) {
    svAssay = sumVolumes(D, R);
    const recorded = components.filter((c) => c.estVolume !== 'not-recorded');
    if (recorded.every((c) => isUsable(c.estVolume))) {
      basisRequired = recorded.some((c) => !equalUnderRule(svAssay, c.estVolume));
    }
  }
  if (basisRequired === true && !basis) {
    incomplete.push({ field: 'basis', reason: 'not-selected', message: 'Transfer basis is required, because a recorded component was established at a staining volume different from the assay\'s, and nothing is selected: preserve concentration, or preserve amount per test.' });
  }

  const status = rejections.length ? 'rejected' : incomplete.length ? 'incomplete' : 'ok';
  return Object.freeze({
    status,
    rejections,
    incomplete,
    basisRequired,
    parsed: { D, R, svAssay, cells, samples, overageForm: form, overage, basis, diluent: dil.notRecorded ? 'not-recorded' : String(dil.text || '').trim(), minTransfer: minT, minTransferDefaulted: !!(inputs.minTransfer && inputs.minTransfer.defaulted), capacity, components },
  });
}

/**
 * C5-HI-06: the components' volumes per test add up to more than the
 * dispensed volume per test, which would make the diluent volume negative.
 * `dispensed` is the dispensed-volume quantity; `volumes` is
 * [{ row, label, value }] in µL, in entered order, as computed by determine.
 * "More than" is decided under C5-UN-10: the sum and the dispensed volume as
 * canonical integers at 1 nL. Returns the rejection, or null.
 * The message lists every component with its volume per test at display
 * precision (3 significant figures), the total of those displayed volumes as
 * their exact decimal sum, and the dispensed volume as typed.
 */
export function rejectionHI06(dispensed, volumes) {
  let sum = 0;
  for (const v of volumes) sum += v.value;
  if (!(canonicalOfDouble(sum, KIND.VOLUME) > canonical(dispensed))) return null;
  const shown = volumes.map((v) => ({ ...v, display: sig(v.value, 3) }));
  const total = Dec.toString(shown.map((v) => Dec.fromString(v.display)).reduce(Dec.add));
  const lines = shown.map((v) => `${componentName(v)}: ${v.display} µL`).join('; ');
  return Object.freeze({
    code: 'C5-HI-06',
    quantity: 'dispensed',
    message: `The components alone need ${total} µL per test, more than the dispensed cocktail volume per test, ${typed(dispensed)}. The components alone exceed the volume available, which would leave a negative volume of diluent. Volume per test of each component: ${lines}. (Total ${total} µL is the sum of the volumes listed.)`,
    components: shown.map((v) => ({ row: v.row, label: v.label, volumePerTestUl: v.display })),
    totalUl: total,
  });
}

