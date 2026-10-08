// Tolerances for the invariance tests and acceptance 3 (C5-IV-02, C5-IV-03,
// C5-IV-06; §11 register rows "Round-trip tolerance" and "Unit-normalisation
// tolerance").
//
// PROVISIONAL. Open item 5: these are to be DERIVED as analytic bounds over
// this tool's operation set, and that derivation precedes ship. The values
// below are placeholders, stated so the tests can run. Do not tune them to
// make a test pass (CLAUDE.md §7.3).
//
// Each is a bound on the relative difference |x - y| / max(|x|, |y|).
export const TOLERANCES = Object.freeze({
  roundTrip: Object.freeze({
    relative: 2 ** -48, // 16 units in the last place of a double
    status: 'PROVISIONAL',
    basis: 'PROVISIONAL, to be derived. Placeholder: 16 ULP, above the few roundings on the path a → v → V → recomputed concentration, pending the analytic bound.',
  }),
  unitNormalisation: Object.freeze({
    relative: 2 ** -48,
    status: 'PROVISIONAL',
    basis: 'PROVISIONAL, to be derived. Placeholder: 16 ULP. Normalisation is one rounding of the exact typed value, so entries of the same quantity in different units give the same double; the bound covers the path after it.',
  }),
});

/** The relative difference used against every tolerance here; 0 when both are 0. */
export function relativeDifference(x, y) {
  if (x === y) return 0;
  return Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y));
}
