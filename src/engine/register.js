// The constants and conventions register (C5 §11, C5-CN-01; acceptance 21),
// the failure classes the tool cannot detect (C5 §9, C5-FC-01), and the
// on-page statements (C5-OUT-05 to OUT-07, C5-CP-07, C5-CP-08, C5-UN-08).
// One place for each, so a ruling changes it in one edit.
//
// Statuses use the tool set's one vocabulary: derived, characterised,
// measured, disclosed, convention, proposed, open. The page states no decision
// that has not been made: where a ruling is awaited, the row says so, and the
// row's code marker (PROVISIONAL or PENDING) names what it waits for.
import { RESOLUTION } from './compare.js';
import { TOLERANCES } from './tolerances.js';
import { PRECISION } from './format.js';

export const COMPONENT_CAP = 60; // Task 3 review, ruling 3 (A.B.); conditional on Task 9's VZ-02 and VZ-03 at 60
export const BLOCK_BOUND_PX = 260; // Task 3 review, ruling 1 (A.B.)

export const REGISTER = Object.freeze([
  { item: 'Volume comparison resolution (C5-UN-10)', value: RESOLUTION.volume.statement, basis: 'Canonical integer of the exact typed value after unit normalisation, rounded half away from zero. Decides whether a declaration is demanded. Scope record for release 1.0, decision 3.', status: 'convention' },
  { item: 'Cell-number comparison resolution (C5-UN-10)', value: RESOLUTION.cells.statement, basis: 'As for volume. Decides whether C5-FL-11 is raised. Scope record for release 1.0, decision 3.', status: 'convention' },
  { item: 'Comparisons at the boundary (C5-HI-06, C5-FL-05, C5-FL-07)', value: 'Decided at 1 nL; values equal under C5-UN-10 neither exceed nor fall below. Where the components fill the dispensed volume, the diluent is exactly 0.', basis: 'Ruling of 8 October 2026 (Adacs), for NADIRA to confirm.', status: 'proposed', marker: 'PENDING: NADIRA to confirm' },
  { item: 'Effective test count', value: 'Used unrounded', basis: 'A scale factor, not a count of physical tests; rounding up would be a second overage hidden in a convention.', status: 'convention' },
  { item: 'Pipetting order', value: 'Diluent first, then components in the order entered', basis: 'Stated on the output. Signed off: NADIRA, 1 October 2026 (open item 4).', status: 'convention' },
  { item: 'Overage', value: 'No default; required', basis: 'A pre-filled value accepted unchanged is a default nobody chose.', status: 'convention' },
  { item: 'Transfer basis', value: 'No default; required wherever a recorded component\'s established staining volume differs from the assay\'s (C5-CP-07)', basis: 'The choice cannot be made by the tool (§9, item 1).', status: 'convention' },
  { item: 'Round-trip tolerance (C5-IV-02, IV-03)', value: `Not yet derived. The tests use a placeholder of 2⁻⁴⁸ (relative), about ${TOLERANCES.roundTrip.relative.toExponential(2)}`, basis: 'To be the analytic bound over this tool\'s operation set.', status: 'open', marker: 'PROVISIONAL: open item 5' },
  { item: 'Unit-normalisation tolerance (C5-IV-06)', value: `Not yet derived. The tests use a placeholder of 2⁻⁴⁸ (relative), about ${TOLERANCES.unitNormalisation.relative.toExponential(2)}`, basis: 'Normalisation is one rounding of the exact typed value; the bound covers the path after it.', status: 'open', marker: 'PROVISIONAL: open item 5' },
  { item: 'Minimum reliable transfer volume', value: 'User-declared; 2 µL pre-filled as a suggestion', basis: 'Inspection. Carried from C4-SR-05. On the behaviour path whenever unchanged.', status: 'disclosed' },
  { item: 'Vessel working capacity', value: 'User-declared, optional, no default', basis: 'Where not declared, C5-FL-07 is not evaluated.', status: 'disclosed' },
  { item: 'Maximum component count', value: `${COMPONENT_CAP}`, basis: 'Measured at 1366 × 650: no declaration or flag leaves view at any scroll position up to 60 components (headless and Chrome, Task 3). Set by A.B. on condition that VZ-02 and VZ-03 stay readable at 60.', status: 'measured' },
  { item: 'Height bound of the declarations and flags kept in view (C5-NF-05)', value: `${BLOCK_BOUND_PX} px at 1366 × 650`, basis: 'Worst cases measured: in Chrome 242.25 px (nine flags, a 400-character diluent; Task 3 mock); on this page, headless, 242.4 px (seven flags, the C5-CP-07 statement, a 400-character diluent). Set by A.B.', status: 'measured' },
  { item: 'Diluent length', value: 'No limit', basis: 'A longer diluent wraps and makes the block taller; a cap or a clamp awaits a ruling.', status: 'open', marker: 'PENDING: A.B. and NADIRA' },
  { item: 'Displayed precision, volumes', value: `${PRECISION.volumes} significant figures`, basis: 'Precision matches the physical act.', status: 'disclosed' },
  { item: 'Displayed precision, concentrations', value: `${PRECISION.concentrations} significant figures`, basis: 'Matches C1, C3 and C7.', status: 'proposed', marker: 'PENDING: open item 8' },
  { item: 'Displayed precision, ratios and fractions', value: `${PRECISION.ratios} significant figures`, basis: 'Ruling of 8 October 2026 (Adacs).', status: 'proposed', marker: 'PROVISIONAL: open item 8' },
  { item: 'Rounding rule', value: 'Half away from zero, on the exact binary value', basis: 'Convention, C1 onward.', status: 'convention' },
  { item: 'Concentration ratio axis range (C5-VZ-03)', value: '0.25 to 4, extended to the nearest power of two beyond the largest and smallest plotted ratio', basis: 'Display convention.', status: 'proposed' },
  { item: 'C5-FL-11 amount-per-cell ratio at zero cells', value: 'Withheld with its reason where the assay or the established cell number is zero', basis: 'Ruling of 8 October 2026 (Adacs), for NADIRA to confirm.', status: 'proposed', marker: 'PENDING: NADIRA to confirm' },
  { item: 'Unit catalogue', value: 'µL, mL; cells, × 10⁶ cells; ng, µg, mg; pmol, nmol, µmol; IU; U; mg/mL, µg/mL, ng/mL, g/L, mg/L; M, mM, µM, nM, pM; IU/mL; U/mL', basis: 'Accepted for the build; IU and U are never converted, and no molecular weight, density or specific activity is used.', status: 'proposed', marker: 'PENDING: NADIRA to confirm' },
]);

// §9, verbatim. Displayed at the tool's own address (C5-FC-01).
export const FAILURE_INTRO = 'The tool guarantees that the cocktail arithmetic is correct and that the transfer basis, the overage, the dispensed and residual volumes, the assay cell number, and each component\'s established conditions and provenance are recorded. It cannot detect:';
export const FAILURES = Object.freeze([
  ['Which transfer basis is correct.', 'Each is exact only in a limiting regime — concentration where antibody is in large excess over sites, amount per cell where binding is effectively stoichiometric — and many panels sit between them, where neither transfers the titration exactly. Which regime applies depends on antigen density, affinity and cell number. The tool records the choice and states the consequence; it cannot make the choice'],
  ['Component incompatibility.', 'Polymer-dye buffer requirements, tandem-dye degradation, and interference between components are real and are not assessed. The diluent is recorded, not evaluated'],
  ['Epitope interference', 'between antibodies binding the same or adjacent targets'],
  ['Spillover and spreading error.', 'Panel design is out of scope; an arithmetically correct cocktail may still be a poor panel'],
  ['Cocktail stability.', 'A pre-made cocktail changes with time, temperature and light'],
  ['Whether each component\'s titration transfers to this assay.', 'Cell number is now declared and C5-FL-11 evaluates it, but the titration transfers only if cell type, fixation state, matrix, incubation time and temperature also match. None of the last four is declared or detectable'],
  ['Loss of activity', 'in any component, from storage, freeze–thaw or age'],
  ['Precipitation or aggregation', 'in the cocktail, including where a component\'s required buffer has been diluted'],
  ['Absence of Fc receptor blocking', ''],
  ['Any error in the preparation or the dispensing.', 'The tool states the composition; it does not observe what was pipetted or what volume reached each sample'],
]);

export const STATEMENTS = Object.freeze({
  // C5-OUT-07
  composition: 'This tool determines a composition. It does not verify what was prepared, or what volume reached each sample.',
  // C5-OUT-06, C5-UN-08
  precision: `Volumes are shown to ${PRECISION.volumes} significant figures and concentrations to ${PRECISION.concentrations}; ratios and fractions to ${PRECISION.ratios} (provisional). Each number shown is rounded once, half away from zero, from the exact binary value of its own unrounded value. Each pipetted volume is rounded from its own value, and the total shown is the exact sum of the pipetted volumes as shown, so it may carry more figures. The unrounded values are in the structured result.`,
  // C5-CP-08
  twoCocktails: 'A panel that needs different transfer bases for different components is prepared as two cocktails, so that each cocktail\'s record describes one basis.',
  // C5-CP-07, when the basis is not required
  basisNotRequired: 'The transfer basis is not required for the recorded components: none was established at a staining volume different from the assay\'s, so the two bases give identical results.',
});
