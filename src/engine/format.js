// Display values derived from the structured result, src/engine/result.js (CLAUDE.md §5.5; C5-UN-04, C5-UN-05,
// C5-DT-04, C5-DT-05). Pure. Nothing here computes a quantity: each displayed
// number is the rounding of one unrounded value in the result, half away from
// zero on its exact binary value (numfmt.js), and the displayed total is the
// exact decimal sum of the displayed pipetted volumes.
import { sig, Dec } from './numfmt.js';
import { unitInfo } from './units.js';

// Significant figures. Ratios and fractions (concentration ratio, scale
// factor, overage fraction, antibody fraction, flag factors): 3, confirmed.
// The effective number of tests: at most 6 significant figures, with no
// trailing zeros ("96", "105.6"), confirmed. See REGISTER-AUDIT-TRAIL.md.
export const PRECISION = Object.freeze({ volumes: 3, concentrations: 6, ratios: 3, effectiveTests: 6 });
export const PRECISION_STATUS = Object.freeze({ volumes: 'disclosed', concentrations: 'disclosed', ratios: 'disclosed', effectiveTests: 'disclosed' });

/** The effective number of tests for display: rounded once, trailing zeros dropped. */
export function effectiveTests(x) {
  return Dec.toString(Dec.trimZeros(Dec.roundSig(Dec.fromNumberExact(x), PRECISION.effectiveTests)));
}

const volume = (x) => sig(x, PRECISION.volumes);

/**
 * The pipetting list (C5-DT-05): diluent first, then the components in the
 * order entered, each volume in the cocktail at 3 significant figures from its
 * own unrounded value (C5-DT-04). The total is the exact sum of the displayed
 * volumes: it may carry more than 3 significant figures, and it is not the
 * rounding of the unrounded total (C5-IV-01).
 */
export function pipettingList(rec) {
  const v = rec.values;
  const steps = [{ step: 1, what: 'diluent', volume_uL: volume(v.diluentTotal.value) }];
  for (const c of v.components) steps.push({ step: steps.length + 1, what: 'component', component: c.index, volume_uL: volume(c.volumeInCocktail.value) });
  const total = steps.map((s) => Dec.fromString(s.volume_uL)).reduce(Dec.add);
  return Object.freeze({ order: 'Diluent first, then components in the order entered.', steps, total_uL: Dec.toString(total) });
}

/** Volumes per test, each at 3 significant figures from its own unrounded value. */
export function perTestVolumes(rec) {
  const v = rec.values;
  return Object.freeze({
    diluent_uL: volume(v.diluentPerTest.value),
    components: v.components.map((c) => ({ component: c.index, volume_uL: volume(c.volumePerTest.value) })),
  });
}

/**
 * Concentrations in the assay at 6 significant figures (C5-UN-05), each in the
 * stock unit the user selected for that component (Task 6b review, ruling 2),
 * read from the structured result (Task 7b). The conversion from the base unit
 * is an exact power-of-ten shift of the double's exact binary value, so the
 * value is rounded once.
 */
export function concentrations(rec) {
  return rec.values.components.map((c) => {
    if (c.concentrationInAssay.withheld) return { component: c.index, withheld: true, reason: c.concentrationInAssay.reason };
    const u = unitInfo(c.concentrationInAssay.stockUnit);
    if (!u || u.base !== c.concentrationInAssay.unit) throw new Error(`format: "${c.concentrationInAssay.stockUnit}" is not a unit of ${c.concentrationInAssay.unit}`);
    const exact = Dec.shift(Dec.fromNumberExact(c.concentrationInAssay.value), -u.exp10);
    return { component: c.index, value: Dec.toString(Dec.roundSig(exact, PRECISION.concentrations)), unit: u.symbol };
  });
}

const ratio = (x) => sig(x, PRECISION.ratios);

/** Ratios and fractions at PRECISION.ratios significant figures (PROVISIONAL). Withheld values stay withheld. */
export function ratios(rec) {
  const v = rec.values;
  return Object.freeze({
    overageFraction: ratio(v.overageFraction.value),
    antibodyFraction: ratio(v.antibodyFraction.value),
    components: v.components.map((c) => ({
      component: c.index,
      ratio: c.ratio.withheld ? { withheld: true, reason: c.ratio.reason } : ratio(c.ratio.value),
      scaleFactor: c.scaleFactor ? ratio(c.scaleFactor.value) : null,
    })),
  });
}
