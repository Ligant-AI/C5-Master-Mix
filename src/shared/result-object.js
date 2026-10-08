// The shared result object — C7's expression of it, and a validator (C7-OUT-04).
//
// The shared format is this tool set's own and gains, at a new version, the
// fields C7-OUT-04 enumerates. Publishing that version and confirming that C1
// (live) and C4 (deployed) still validate against it is outstanding item 8,
// owned by the developer with NADIRA. Until then the version string carries
// "draft" so that no object claims to conform to a version that has not been
// published. The validator below checks every C7-OUT-04 field and is what
// acceptance 4 will run once the version is published.
//
// `tool` is an OBJECT ({ id, name, engineVersion }), which is C1's shipped
// shape. C3's importer reads `tool` as a string. That is a genuine conflict in
// an existing field — one field that cannot mean two things at once — and per
// C7-OUT-04 it is escalated rather than resolved here: see docs/escalation-tool-field.md.

export const SCHEMA = Object.freeze({ name: 'ligant.bench-tools.result', version: '2.0.0-draft.c7' });

const LABELS = ['achieved', 'obtained', 'at-most', 'uncorrected-for-displacement'];

const isQ = (x) => x && typeof x.display === 'string' && typeof x.unit === 'string' && typeof x.unrounded === 'number' && Number.isFinite(x.unrounded);
const isDecl = (x) => x && typeof x.value === 'string' && typeof x.label === 'string';

/** Returns an array of problems; empty means the object carries every C7-OUT-04 field. */
export function validateResultObject(r) {
  const p = [];
  const need = (c, m) => { if (!c) p.push(m); };
  need(r && typeof r === 'object', 'not an object');
  if (!r) return p;
  need(r.schema && r.schema.name === SCHEMA.name && r.schema.version === SCHEMA.version, 'schema name/version');
  need(r.tool && r.tool.id === 'C7' && /^\d+\.\d+\.\d+$/.test(r.tool.engineVersion), 'tool / engine version');
  need(['result', 'rejected', 'incomplete', 'not-representable'].includes(r.status), `status "${r.status}"`);
  if (r.status === 'not-representable') need(r.notRepresentable && r.notRepresentable.code === 'C7-HI-10' && r.rejections.length === 1 && r.rejections[0].code === 'C7-HI-10' && typeof r.notRepresentable.quantity === 'string' && /limit of the arithmetic/.test(r.notRepresentable.message), 'C7-HI-10: code, quantity, and that it is a limit of the arithmetic');
  need(Array.isArray(r.flags) && Array.isArray(r.rejections) && Array.isArray(r.incomplete), 'flags / rejections / incomplete arrays');
  need(r.statements && /GxP/.test(r.statements.scope), 'scope statement');
  need(r.precision && r.precision.volumes === 3 && r.precision.concentrations === 6, 'precision');
  for (const f of r.flags || []) {
    need(/^C7-FL-\d\d$/.test(f.code), `flag code ${f.code}`);
    need(typeof f.message === 'string' && f.message.length > 0 && typeof f.title === 'string', `flag ${f.code} words`);
  }
  for (const x of r.rejections || []) need(/^C7-HI-\d\d$/.test(x.code) && x.message, `rejection ${x.code}`);
  if (r.status !== 'result') return p;

  const d = r.declarations;
  need(d.content && typeof d.content.value === 'string' && typeof d.content.unit === 'string', 'stated content with unit');
  need(d.wholeVial && d.wholeVial.confirmed === true, 'whole-vial confirmation');
  need(isDecl(d.contentBasis), 'content basis');
  need(isDecl(d.contentProvenance), 'content provenance');
  need(isDecl(d.conjugate), 'conjugate declaration');
  need(isDecl(d.carrier), 'carrier declaration');
  need(isDecl(d.direction) && isDecl(d.volumeBasis), 'direction and volume basis');
  need(d.minTransfer && ['entered', 'default'].includes(d.minTransfer.source), 'minimum transfer volume and its source');
  need(d.capacity && typeof d.capacity.declared === 'boolean', 'capacity declared or not');
  need(r.volumes && isQ(r.volumes.diluent) && isQ(r.volumes.final), 'both volumes');
  if (d.direction.value === 'volume' && d.volumeBasis.value === 'final') need(r.volumes.enteredFinal, 'entered final beside the achieved final');
  const disp = r.displacement;
  need(disp && ['computed', 'reagent-own-volume-only', 'not-computable-uncorrected'].includes(disp.treatment), 'displacement treatment');
  if (disp.treatment === 'computed') need(disp.computed && isQ(disp.computed.D) && typeof disp.computed.f.unrounded === 'number', 'displacement value and fraction');
  else need(disp.notComputable && disp.notComputable.reason, 'displacement not computable, with reason');
  if (disp.treatment === 'reagent-own-volume-only') need(disp.Dmin && disp.Dmin.applied === true, 'Dmin applied');
  const c = r.concentration;
  need(c && isQ(c.reported) && LABELS.includes(c.reported.label), 'reported concentration with label');
  if (c.reported.label === 'at-most') need(c.upperBound.isUpperBound === true && c.upperBound.reason && c.upperBound.assumptions.length, 'upper bound with reason and assumptions');
  if (d.direction.value === 'target') need(r.target && typeof r.target.unrounded === 'number', 'target retained');
  need(Array.isArray(r.declarationsApplied) && r.declarationsApplied.length >= 10, 'declarations applied in the derivation (C7-OUT-02)');
  // Fields the contract check (verification/contract/report-2026-09-28.md) found the
  // validator did not itself enforce; each is a C7-OUT-04 field.
  if (d.capacity.declared) need(typeof d.capacity.value === 'string' && typeof d.capacity.unit === 'string', 'declared capacity with its value and unit');
  if (r.volumes.enteredFinal) need(typeof r.volumes.enteredFinal.display === 'string' && typeof r.volumes.enteredFinal.unit === 'string', 'entered final volume with its unit');
  if (disp.Dmin) need(isQ(disp.Dmin) && disp.Dmin.fmin && typeof disp.Dmin.fmin.unrounded === 'number' && typeof disp.Dmin.fmin.ratioOf === 'string', 'Dmin with its unit, value and fmin');
  if (r.target) need(typeof r.target.unit === 'string' && typeof r.target.display === 'string', 'target with its unit');
  const ROUNDINGS = ['up', 'down', 'half away from zero'];
  need(ROUNDINGS.includes(c.reported.rounding), 'rounding direction of the reported concentration');
  need(ROUNDINGS.includes(r.volumes.final.rounding), 'rounding direction of the final volume');
  if (c.reported.label === 'at-most') need(c.reported.rounding === 'up' && r.volumes.final.rounding === 'down' && r.volumes.final.isLowerBound === true, 'a bound rounded on its own side (decision of 28 September 2026)');
  else need(c.reported.rounding === 'half away from zero', 'a non-bound concentration rounded half away from zero');
  if (d.molecularWeight) {
    const m = c.molar;
    need(m && ['reported', 'withheld', 'unit-not-selected'].includes(m.status) && Number.isInteger(m.pairingRow), 'molar form: status and §8 pairing row');
    if (m && m.status === 'reported') need(typeof m.display === 'string' && typeof m.unit === 'string' && typeof m.unrounded === 'number' && typeof m.molarityOf === 'string' && ROUNDINGS.includes(m.rounding), 'reported molar form with unit, value, what it is the molarity of, and its rounding');
    if (m && m.status === 'withheld') need(typeof m.reason === 'string' && m.reason.length > 0, 'withheld molar form with its reason');
    const e = r.importedC1;
    need(e && e.quantities && e.quantities.molecularWeight && typeof e.quantities.molecularWeight.value === 'number' && e.declarations && typeof e.declarations.massBasis === 'string' && Array.isArray(e.flags), 'embedded C1 object with its molecular weight, mass basis and flags');
  }
  need(r.unrounded && typeof r.unrounded.Ca.value === 'number' && typeof r.unrounded.Fa.value === 'number', 'unrounded values');
  if (d.molecularWeight) need(r.importedC1 && typeof r.importedC1 === 'object', 'embedded C1 object');
  return p;
}
