// Display values derived from a result (CLAUDE.md §5.5; C5-UN-04, C5-UN-05,
// C5-DT-04, C5-DT-05). Pure. Nothing here computes a quantity: each displayed
// number is the rounding of one unrounded value in the result, half away from
// zero on its exact binary value (numfmt.js), and the displayed total is the
// exact decimal sum of the displayed pipetted volumes.
import { sig, Dec } from './numfmt.js';

export const PRECISION = Object.freeze({ volumes: 3, concentrations: 6 });

const volume = (x) => sig(x, PRECISION.volumes);

/**
 * The pipetting list (C5-DT-05): diluent first, then the components in the
 * order entered, each volume in the cocktail at 3 significant figures from its
 * own unrounded value (C5-DT-04). The total is the exact sum of the displayed
 * volumes: it may carry more than 3 significant figures, and it is not the
 * rounding of the unrounded total (C5-IV-01).
 */
export function pipettingList(result) {
  const v = result.values;
  const steps = [{ step: 1, what: 'diluent', volume_uL: volume(v.diluentTotal_uL) }];
  for (const c of v.components) steps.push({ step: steps.length + 1, what: 'component', component: c.index, volume_uL: volume(c.volumeInCocktail_uL) });
  const total = steps.map((s) => Dec.fromString(s.volume_uL)).reduce(Dec.add);
  return Object.freeze({ order: 'Diluent first, then components in the order entered.', steps, total_uL: Dec.toString(total) });
}

/** Volumes per test, each at 3 significant figures from its own unrounded value. */
export function perTestVolumes(result) {
  const v = result.values;
  return Object.freeze({
    diluent_uL: volume(v.diluentPerTest_uL),
    components: v.components.map((c) => ({ component: c.index, volume_uL: volume(c.volumePerTest_uL) })),
  });
}

/** Concentrations in the assay at 6 significant figures (C5-UN-05), in the stock's base unit. */
export function concentrations(result) {
  return result.values.components.map((c) => (c.concentrationInAssay.withheld
    ? { component: c.index, withheld: true, reason: c.concentrationInAssay.reason }
    : { component: c.index, value: sig(c.concentrationInAssay.value, PRECISION.concentrations), unit: c.concentrationInAssay.unit }));
}
