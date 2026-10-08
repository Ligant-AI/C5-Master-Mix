// C5-IV-03, shared by tests/determine.test.js and tests/fixtures.test.js:
// the concentration each component was meant to reach in the assay, and the
// concentration recomputed from the volume actually pipetted into the cocktail.
import { quantity } from '../../src/engine/units.js';

// The concentration a component was meant to reach in the assay, from its
// typed quantity and the declared basis (C5-DT-03), and the concentration
// recomputed from the volume actually pipetted into the cocktail.
// The form and the basis are derived here from the input, not read from the
// engine's output, so a defect that applies the wrong one cannot move the
// target with it.
export function expectedFormAndBasis(input, comp) {
  const kind = quantity(comp.intended.value, comp.intended.unit).kind;
  const form = { amount: 'amount', concentration: 'concentration', volume: 'stock-volume' }[kind];
  const basis = comp.establishedVolume.notRecorded ? 'not-applied' : input.basis || 'not-required';
  return { form, basis };
}
export function target(input, comp) {
  const { form, basis } = expectedFormAndBasis(input, comp);
  const q = quantity(comp.intended.value, comp.intended.unit);
  const c = quantity(comp.stock.value, comp.stock.unit).value;
  const D = quantity(input.dispensed.value, input.dispensed.unit).value;
  const SV = D + quantity(input.residual.value, input.residual.unit).value;
  const SVi = comp.establishedVolume.notRecorded ? null : quantity(comp.establishedVolume.value, comp.establishedVolume.unit).value;
  const amountPerTest = { amount: q.value, concentration: SVi === null ? null : q.value * SVi, 'stock-volume': c * q.value }[form];
  if (basis === 'preserve-concentration' || basis === 'not-required') return amountPerTest / SVi;
  return amountPerTest / SV; // preserve amount, or the basis not applied: the amount per test is carried
}


/**
 * For every component: the form and basis the engine applied, against those
 * derived from the input, and the largest relative difference of the
 * recomputed and reported concentrations from the target.
 * Returns [{ index, form, expectedForm, basis, expectedBasis, difference }].
 */
export function iv03(input, result, relativeDifference) {
  const v = result.values;
  const D = quantity(input.dispensed.value, input.dispensed.unit).value;
  return v.components.map((out) => {
    const comp = input.components[out.index - 1];
    const expected = expectedFormAndBasis(input, comp);
    const want = target(input, comp);
    const c = quantity(comp.stock.value, comp.stock.unit).value;
    // Each test receives D of the cocktail, of which the component is V_i / total.
    const recomputed = (c * (out.volumeInCocktail_uL / v.totalCocktail_uL) * D) / v.svAssay_uL;
    return {
      index: out.index,
      form: out.form,
      expectedForm: expected.form,
      basis: out.basisApplied,
      expectedBasis: expected.basis,
      difference: Math.max(relativeDifference(recomputed, want), relativeDifference(out.concentrationInAssay.value, want)),
    };
  });
}
