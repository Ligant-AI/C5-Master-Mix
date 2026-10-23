import { RESOLUTION } from './compare.js';
import { PRECISION } from './format.js';
export const COMPONENT_CAP = 60;
export const BLOCK_BOUND_PX = 260;
export const REGISTER = Object.freeze([
    { item: 'Volume comparison resolution', value: RESOLUTION.volume.statement, basis: 'The exact typed value is converted to the base unit and rounded half away from zero to this resolution. Decides whether a declaration is demanded.' },
    { item: 'Cell-number comparison resolution', value: RESOLUTION.cells.statement, basis: 'As for volume. Decides whether FL-11 is raised.' },
    { item: 'Comparisons at the boundary', value: 'Decided at 1 nL; values equal at that resolution neither exceed nor fall below one another. Where the components fill the dispensed volume, the diluent is exactly 0.', basis: 'A value at the boundary neither exceeds it nor falls below it, so the boundary itself raises nothing (FL-05, FL-07 and the check that the components fit in the dispensed volume).' },
    { item: 'Effective test count', value: 'Used unrounded', basis: 'A scale factor, not a count of physical tests; rounding up would be a second overage hidden in a convention.' },
    { item: 'Pipetting order', value: 'Diluent first, then components in the order entered', basis: 'Stated on the output.' },
    { item: 'Overage', value: 'No default; required', basis: 'A pre-filled value accepted unchanged is a default nobody chose.' },
    { item: 'Transfer basis', value: 'No default; required wherever a recorded component\'s established staining volume differs from the assay\'s', basis: 'The choice cannot be made by the tool (see What it does not do, item 1).' },
    { item: 'Minimum reliable transfer volume', value: 'User-declared; 2 µL pre-filled as a suggestion', basis: 'Replace it with your pipette\'s value. It is recorded as a suggestion for as long as it is unchanged.' },
    { item: 'Vessel working capacity', value: 'User-declared, optional, no default', basis: 'Where not declared, FL-07 is not evaluated.' },
    { item: 'Maximum component count', value: `${COMPONENT_CAP}`, basis: 'Keeps every declaration and flag in view while you work.' },
    { item: 'Diluent length', value: 'No limit', basis: 'A longer diluent wraps and makes the declarations block taller.' },
    { item: 'Displayed precision, volumes', value: `${PRECISION.volumes} significant figures`, basis: 'Precision matches the physical act.' },
    { item: 'Displayed precision, concentrations', value: `${PRECISION.concentrations} significant figures`, basis: 'A concentration is recorded rather than pipetted, so more figures are kept; the unrounded value is in the structured result.' },
    { item: 'Displayed precision, ratios and fractions', value: `${PRECISION.ratios} significant figures`, basis: 'Ratios compare two displayed quantities; three figures is enough to see a difference worth acting on.' },
    { item: 'Displayed precision, effective number of tests', value: `At most ${PRECISION.effectiveTests} significant figures, no trailing zeros`, basis: 'The value used is unrounded.' },
    { item: 'Rounding rule', value: 'Half away from zero, on the exact binary value', basis: 'Ties round away from zero, the rule most people use by hand, applied to the exact binary value so that a number that only looks like a tie is rounded by its true value. The Molarity Converter rounds exact ties to even; on a tie the last displayed digit can differ by one.' },
    { item: 'Concentration ratio axis range', value: '0.25 to 4, extended to the nearest power of two beyond the largest and smallest plotted ratio', basis: 'Display convention: equal distances on the axis are equal factors.' },
    { item: 'FL-11 amount-per-cell ratio at zero cells', value: 'Withheld with its reason where the assay or the established cell number is zero', basis: 'At zero cells the amount per cell has no finite value, so the ratio is withheld with its reason and never shown as a number.' },
    { item: 'Unit catalogue', value: 'µL, mL; cells, × 10⁶ cells; ng, µg, mg; pmol, nmol, µmol; IU; U; mg/mL, µg/mL, ng/mL, g/L, mg/L; M, mM, µM, nM, pM; IU/mL; U/mL', basis: 'IU and U are never converted, equated or summed, and no molecular weight, density or specific activity is used.' },
]);
export const FAILURE_INTRO = 'The tool guarantees that the cocktail arithmetic is correct and that the transfer basis, the overage, the dispensed and residual volumes, the assay cell number, and each component\'s established conditions and provenance are recorded. It cannot detect:';
export const FAILURES = Object.freeze([
    ['Which transfer basis is correct.', 'Each is exact only in a limiting regime (concentration where antibody is in large excess over sites, amount per cell where binding is effectively stoichiometric), and many panels sit between them, where neither transfers the titration exactly. Which regime applies depends on antigen density, affinity and cell number. The tool records the choice and states the consequence; it cannot make the choice'],
    ['Component incompatibility.', 'Polymer-dye buffer requirements, tandem-dye degradation, and interference between components are real and are not assessed. The diluent is recorded, not evaluated'],
    ['Epitope interference', 'between antibodies binding the same or adjacent targets'],
    ['Spillover and spreading error.', 'Panel design is out of scope; an arithmetically correct cocktail may still be a poor panel'],
    ['Cocktail stability.', 'A pre-made cocktail changes with time, temperature and light'],
    ['Whether each component\'s titration transfers to this assay.', 'Cell number is declared and FL-11 evaluates it, but the titration transfers only if cell type, fixation state, matrix, incubation time and temperature also match. None of these five is declared or detectable'],
    ['Loss of activity', 'in any component, from storage, freeze–thaw or age'],
    ['Precipitation or aggregation', 'in the cocktail, including where a component\'s required buffer has been diluted'],
    ['Absence of Fc receptor blocking', ''],
    ['Any error in the preparation or the dispensing.', 'The tool states the composition; it does not observe what was pipetted or what volume reached each sample'],
]);
export const STATEMENTS = Object.freeze({
    composition: 'This tool determines a composition. It does not verify what was prepared, or what volume reached each sample.',
    precision: `Volumes are shown to ${PRECISION.volumes} significant figures and concentrations to ${PRECISION.concentrations}; ratios and fractions to ${PRECISION.ratios}. Each number shown is rounded once, half away from zero, from the exact binary value of its own unrounded value. Each pipetted volume is rounded from its own value, and the total shown is the exact sum of the pipetted volumes as shown, so it may carry more figures. The unrounded values are in the structured result.`,
    twoCocktails: 'A panel that needs different transfer bases for different components is prepared as two cocktails, one per basis, so that each cocktail\'s record describes one basis. When both go into the same tube, include the other cocktail\'s dispensed volume in the volume already present with the cells, so that each run computes against the true staining volume.',
    basisNotRequired: 'The transfer basis is not required for the recorded components: none was established at a staining volume different from the assay\'s, so the two bases give identical results.',
});
export const FLAG_LEGEND = Object.freeze([
    ['FL-01', 'A component was established (titrated) at a different staining volume from this assay.', 'Check the ratio shown for it. Confirm the transfer basis you chose suits that component, or titrate it again at this staining volume and cell number, which removes the question.'],
    ['FL-02', 'A component\'s established staining volume is not recorded, so its concentration ratio is withheld and the transfer basis was not applied to it.', 'Find the staining volume it was established at and enter it, then read the result again.'],
    ['FL-03', 'No overage was declared, so the cocktail is made for exactly the sample count.', 'Expect the last tests to be short, because some volume stays in the tube and tips. Declare an overage if that matters.'],
    ['FL-04', 'A component\'s intended quantity was not established by titration in this laboratory (vendor recommendation, or not recorded).', 'Treat the quantity as a starting point. Titrate it for this panel if you can.'],
    ['FL-05', 'A component\'s volume in the cocktail is below your minimum reliable transfer volume.', 'Make an intermediate dilution of that component (and enter the diluted stock\'s concentration), or make a larger batch, so it can be pipetted accurately.'],
    ['FL-07', 'The total cocktail is more than the vessel working capacity you declared.', 'Split the cocktail between vessels or use a larger vessel.'],
    ['FL-08', 'The components were established at more than one staining volume, so no single cocktail can deliver all of them at both their established concentration and their established amount per test.', 'Decide for each component whether its concentration or its amount per test should be kept. If they all take the same basis, one cocktail with that basis serves. If some need one and some the other, make two cocktails, one per basis, and run this tool once for each, counting the other cocktail\'s dispensed volume in the volume already present with the cells.'],
    ['FL-09', 'The diluent is not recorded.', 'Enter the diluent, so the cocktail can be reproduced from this record.'],
    ['FL-11', 'A component was established at a different cell number from this assay.', 'Check the amount-per-cell ratio shown. Neither basis recovers the established condition across a cell-number difference; stain at the cell number the component was established at, or titrate it at this one.'],
    ['FL-12', 'A component\'s established cell number is not recorded.', 'Find the cell number it was established at and enter it, so the comparison can be made.'],
]);
