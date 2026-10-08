// C5's structured result object (C5-OUT-03, C5-ST-04, C5-UN-07; Task 7b).
// Pure: no DOM, no browser API, no state.
//
// No shared format exists (docs/out-03-escalation.md). Following C1 and C4,
// C5 produces a tool-specific, versioned object, published as
// docs/schema/c5-master-mix-1.0.0-draft.schema.json. It is not a shared format.
//
// It is built from determine()'s result and the input only, and never
// recomputes a number (C5-OUT-04). Each declaration carries the string as
// typed, its unit, an explicit state (entered, blank or not recorded, so that
// zero and blank stay distinct) and its value normalised to the base unit by
// the engine's own reader (units.quantity), which is a reading of the input,
// not a result. Every value of the result carries its unit.
//
// Everything rendered on the page, the bench sheet and the notebook copy is
// rendered from this object.
import { determine } from './determine.js';
import { quantity, parseTyped } from './units.js';
import { Dec } from './numfmt.js';
import { ENGINE_VERSION, TOOL_ID, TOOL_NAME } from './version.js';

export const RECORD_SCHEMA = Object.freeze({ name: 'ligant-benchtools-c5-master-mix', version: '1.0.0-draft' });

const typedText = (f) => (f && typeof f.value === 'string' ? f.value : '');

// A typed quantity: { state, value, unit, normalised }.
function typedQuantity(f, { notRecordable = false } = {}) {
  if (notRecordable && f && f.notRecorded) return { state: 'not-recorded' };
  const value = typedText(f);
  const unit = (f && f.unit) || '';
  if (value.trim() === '') return { state: 'blank', unit };
  const q = quantity(value, unit);
  return { state: 'entered', value, unit, normalised: q.status === 'ok' && !q.unrepresentable ? { value: q.value, unit: q.base } : null };
}

// A typed dimensionless number (sample count, percentage, additional tests).
function typedNumber(text, unit) {
  const value = typeof text === 'string' ? text : '';
  if (value.trim() === '') return { state: 'blank', unit };
  const p = parseTyped(value);
  const n = p && !p.invalid && p.dec ? Number(Dec.toString(p.dec)) : null;
  return { state: 'entered', value, unit, normalised: n !== null && Number.isFinite(n) ? { value: n, unit } : null };
}

function declarations(inputs) {
  const ov = inputs.overage || {};
  const form = ['percentage', 'additional-tests', 'dead-volume'].includes(ov.form) ? ov.form : null;
  let overage;
  if (form === 'dead-volume') overage = { form, ...typedQuantity(ov) };
  else if (form) overage = { form, ...typedNumber(ov.value, form === 'percentage' ? '%' : 'tests') };
  else overage = { form: null, state: 'blank', unit: '' };
  const dil = inputs.diluent || {};
  const diluentText = typeof dil.text === 'string' ? dil.text : '';
  const cap = typedQuantity(inputs.capacity);
  return {
    dispensed: typedQuantity(inputs.dispensed),
    residual: typedQuantity(inputs.residual),
    assayCells: typedQuantity(inputs.assayCells),
    samples: typedNumber(inputs.samples, 'samples'),
    overage,
    basis: inputs.basis ? { state: 'selected', value: inputs.basis } : { state: 'unselected' },
    diluent: dil.notRecorded ? { state: 'not-recorded' } : diluentText.trim() ? { state: 'entered', text: diluentText } : { state: 'blank' },
    minTransfer: { ...typedQuantity(inputs.minTransfer), source: inputs.minTransfer && inputs.minTransfer.defaulted ? 'defaulted' : 'entered' },
    capacity: cap.state === 'blank' ? { state: 'not-declared' } : cap,
    components: (inputs.components || []).map((c, i) => ({
      index: i + 1,
      label: typeof c.label === 'string' ? c.label : '',
      intended: typedQuantity(c.intended),
      stock: typedQuantity(c.stock),
      establishedVolume: typedQuantity(c.establishedVolume, { notRecordable: true }),
      establishedCells: typedQuantity(c.establishedCells, { notRecordable: true }),
      provenance: c.provenance ? { state: 'selected', value: c.provenance } : { state: 'unselected' },
      transport: 'entered', // C5-CP-05: always entered in 1.0
      declaredByPanelControl: !!c.declaredByPanelControl,
    })),
  };
}

const v = (value, unit) => ({ value, unit });

function values(r, decl) {
  const x = r.values;
  return {
    svAssay: v(x.svAssay_uL, 'µL'),
    nEff: v(x.nEff, 'tests'),
    overageFraction: v(x.overageFraction, '1'),
    diluentPerTest: v(x.diluentPerTest_uL, 'µL'),
    componentsFillDispensedVolume: x.componentsFillDispensedVolume,
    diluentTotal: v(x.diluentTotal_uL, 'µL'),
    totalCocktail: v(x.totalCocktail_uL, 'µL'),
    antibodyFraction: v(x.antibodyFraction, '1'),
    fl08Unevaluated: x.fl08Unevaluated,
    components: x.components.map((c) => ({
      index: c.index,
      form: c.form,
      basisApplied: c.basisApplied,
      stockVolumePerTest: v(c.stockVolumePerTest_uL, 'µL'),
      scaleFactor: c.scaleFactor ? { value: c.scaleFactor.value, unit: '1', exactlyOne: c.scaleFactor.exactlyOne } : null,
      volumePerTest: v(c.volumePerTest_uL, 'µL'),
      volumeInCocktail: v(c.volumeInCocktail_uL, 'µL'),
      concentrationInAssay: c.concentrationInAssay.withheld
        ? { withheld: true, reason: c.concentrationInAssay.reason }
        : { value: c.concentrationInAssay.value, unit: c.concentrationInAssay.unit, stockUnit: decl.components[c.index - 1].stock.unit },
      ratio: c.ratio.withheld ? { withheld: true, reason: c.ratio.reason } : { value: c.ratio.value, unit: '1' },
    })),
  };
}

/** The structured object for a determine() result and the inputs it was given. */
export function buildRecord(inputs, r) {
  const decl = declarations(inputs);
  const record = {
    schema: { ...RECORD_SCHEMA },
    tool: { id: TOOL_ID, name: TOOL_NAME, product: 'Ligant Bench Tools', publisher: 'Ligant', engineVersion: ENGINE_VERSION },
    status: r.status,
    declarations: decl,
  };
  if (r.status === 'result') {
    record.basisRequired = r.basisRequired;
    record.values = values(r, decl);
    record.flags = r.flags.map((f) => JSON.parse(JSON.stringify(f)));
  } else {
    record.rejections = r.rejections.map((x) => ({ ...x }));
    record.incomplete = r.incomplete.map((x) => ({ ...x }));
  }
  return record;
}

/** determine() and the record, in one call. */
export function record(inputs) {
  return buildRecord(inputs, determine(inputs));
}
