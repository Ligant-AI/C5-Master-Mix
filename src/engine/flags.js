// Flag evaluation (C5 §8; CLAUDE.md §5.7; engine I/O contract §2.2). Pure.
//
// Which flags are raised, the components each names, and the numbers each
// carries. Flags never block a result. C5-FL-06 is deferred (imports, 1.0
// scope) and is never raised. The words of each flag are Task 7's.
//
// Every comparison is under C5-UN-10: typed values as canonical integers at
// 1 nL or 1 cell, computed doubles from their exact binary value.
import { KIND } from './units.js';
import { canonical, canonicalOfDouble, equalUnderRule } from './compare.js';
import { sig, Dec } from './numfmt.js';

export const FLAG_ORDER = Object.freeze(['C5-FL-01', 'C5-FL-02', 'C5-FL-03', 'C5-FL-04', 'C5-FL-05', 'C5-FL-07', 'C5-FL-08', 'C5-FL-09', 'C5-FL-11', 'C5-FL-12']);

/**
 * ctx: { svAssay, cells, overage, minTransfer, capacity, diluent,
 *        totalCocktail, components: [{ index, estVolume, estCells, provenance,
 *        basisApplied, scaleFactor, volumeInCocktail }] }
 * Returns { flags, fl08Unevaluated }.
 */
export function evaluateFlags(ctx) {
  const comps = ctx.components;
  const where = (pred) => comps.filter(pred).map((c) => c.index);
  const recorded = comps.filter((c) => c.estVolume !== 'not-recorded');
  const unevaluated = where((c) => c.estVolume === 'not-recorded');
  const flags = [];
  const raise = (code, components, detail = {}) => flags.push({ code, components, ...detail });

  const fl01 = where((c) => c.estVolume !== 'not-recorded' && !equalUnderRule(ctx.svAssay, c.estVolume));
  if (fl01.length) raise('C5-FL-01', fl01);
  if (unevaluated.length) raise('C5-FL-02', unevaluated);
  if (ctx.overage.sign === 0) raise('C5-FL-03', []);
  const fl04 = where((c) => c.provenance === 'vendor' || c.provenance === 'not-recorded');
  if (fl04.length) raise('C5-FL-04', fl04);
  const min = canonical(ctx.minTransfer);
  const fl05 = where((c) => canonicalOfDouble(c.volumeInCocktail, KIND.VOLUME) < min);
  if (fl05.length) raise('C5-FL-05', fl05);
  if (ctx.capacity && canonicalOfDouble(ctx.totalCocktail, KIND.VOLUME) > canonical(ctx.capacity)) raise('C5-FL-07', []);

  const groups = new Map();
  for (const c of recorded) {
    const nL = canonical(c.estVolume);
    if (!groups.has(nL)) groups.set(nL, []);
    groups.get(nL).push(c.index);
  }
  if (groups.size >= 2) {
    const volumes = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([nL, components]) => ({ nL: Number(nL), components }));
    raise('C5-FL-08', recorded.map((c) => c.index), { volumes, unevaluated });
  }

  if (ctx.diluent === 'not-recorded') raise('C5-FL-09', []);

  const fl11 = comps.filter((c) => c.estCells !== 'not-recorded' && !equalUnderRule(ctx.cells, c.estCells));
  if (fl11.length) {
    raise('C5-FL-11', fl11.map((c) => c.index), {
      amountPerCell: fl11.map((c) => {
        if (ctx.cells.sign === 0) return { component: c.index, withheld: true, reason: 'assay-cells-zero' };
        if (c.estCells.sign === 0) return { component: c.index, withheld: true, reason: 'established-cells-zero' };
        const cellRatio = c.estCells.value / ctx.cells.value;
        const factor = c.basisApplied === 'preserve-concentration' ? c.scaleFactor.value * cellRatio : cellRatio;
        return { component: c.index, factor };
      }),
    });
  }
  const fl12 = where((c) => c.estCells === 'not-recorded');
  if (fl12.length) raise('C5-FL-12', fl12);

  return { flags, fl08Unevaluated: unevaluated };
}

// ---- The words of each flag (C5 §8 "Flag states"; CLAUDE.md §5.7) -----------
//
// For display and for the notebook copy. Each statement is the URS's "Flag
// states" text; each named component carries its own figures. Every ratio or
// factor is stated in the direction of its physical consequence and labelled
// with the two quantities it compares (C5-DT-06), as "A ÷ B = value".
//
// The words read the typed declarations (labels, volumes and cell numbers as
// entered) from the structured result, src/engine/result.js (Task 7b).

export const FLAG_TITLES = Object.freeze({
  'C5-FL-01': 'Established at a different staining volume',
  'C5-FL-02': 'Established staining volume not recorded; ratio withheld',
  'C5-FL-03': 'Overage is zero',
  'C5-FL-04': 'Not titrated in this laboratory',
  'C5-FL-05': 'Below the minimum transfer volume',
  'C5-FL-07': 'Total exceeds the declared vessel capacity',
  'C5-FL-08': 'Established at more than one staining volume',
  'C5-FL-09': 'Diluent not recorded',
  'C5-FL-11': 'Established at a different cell number',
  'C5-FL-12': 'Established cell number not recorded',
});

export const FLAG_STATEMENTS = Object.freeze({
  'C5-FL-01': 'The named components were established at a different staining volume. For each: the volume it was established at, the assay staining volume, and the concentration it will be delivered at relative to the concentration it was established at, under the declared basis. Each basis is exact only in a limiting regime; in the intermediate regime neither transfers the titration exactly, and this tool cannot determine which regime applies.',
  'C5-FL-02': 'The named components\' established staining volume is not recorded. Each is carried at its entered per-test quantity; its concentration ratio is withheld, because the concentration it was established at is unknown. The transfer basis has not been applied to it.',
  'C5-FL-03': 'No overage declared; the cocktail is made for exactly the sample count, and volume lost to the tube and tips will leave the last tests short.',
  'C5-FL-04': 'The named components\' intended quantity was not established by titration in this laboratory. A vendor recommendation is a concentration chosen for a stated assay and is not a titrated value for this panel.',
  'C5-FL-05': 'The named components require a volume below the declared minimum at this cocktail scale. Either an intermediate dilution of those components or a larger batch will make them pipettable; the tool states both and chooses neither.',
  'C5-FL-07': 'The cocktail exceeds the declared vessel capacity and must be split or made in a larger vessel.',
  'C5-FL-08': 'The panel\'s components were established at more than one staining volume; no single cocktail can deliver all of them at both their established concentration and their established amount per test. The distinct volumes and the components at each are named. Components whose established volume is not recorded are excluded from this evaluation and are named as unevaluated.',
  'C5-FL-09': 'Diluent not recorded; the cocktail cannot be reproduced from this record.',
  'C5-FL-11': 'The named components were established at a different cell number. Under the amount basis each delivers a proportionally different amount per cell; under the concentration basis the depletion regime differs from the one the titration was performed in. Neither basis recovers the established condition across a cell-number difference.',
  'C5-FL-12': 'The named components\' established cell number is not recorded, so whether the assay reproduces the condition they were established under cannot be determined.',
});

const BASIS_WORDS = { 'preserve-concentration': 'preserve concentration', 'preserve-amount': 'preserve amount per test' };
const PROVENANCE_WORDS = { vendor: 'vendor recommendation', 'not-recorded': 'provenance not recorded' };
const WITHHELD_WORDS = {
  'assay-cells-zero': 'withheld, because the assay cell number is zero',
  'established-cells-zero': 'withheld, because the established cell number is zero',
};
const typedQ = (q) => `${q.value} ${q.unit}`;
const ul = (x) => `${sig(x, 3)} µL`;

/**
 * The words of every raised flag, in flag order.
 * Returns [{ code, title, statement, components: [{ component, text }] }].
 */
export function flagTexts(rec) {
  const v = rec.values;
  const d = rec.declarations;
  const comp = (i) => v.components[i - 1];
  const name = (i) => {
    const label = (d.components[i - 1].label || '').trim();
    return label ? `Component ${i}, "${label}"` : `Component ${i} (no label)`;
  };
  const per = (f, text) => f.components.map((i) => ({ component: i, text: `${name(i)}: ${text(i)}` }));
  const sv = ul(v.svAssay.value);

  return rec.flags.map((f) => {
    let components = [];
    let extra = '';
    switch (f.code) {
      case 'C5-FL-01':
        components = per(f, (i) => {
          const c = comp(i);
          return `established at ${typedQ(d.components[i - 1].establishedVolume)}; assay staining volume ${sv}; under ${BASIS_WORDS[c.basisApplied]}, concentration in the assay ÷ concentration it was established at = ${sig(c.ratio.value, 3)}.`;
        });
        break;
      case 'C5-FL-02':
      case 'C5-FL-12':
        components = per(f, () => 'named.');
        break;
      case 'C5-FL-04':
        components = per(f, (i) => `${PROVENANCE_WORDS[d.components[i - 1].provenance.value]}.`);
        break;
      case 'C5-FL-05':
        components = per(f, (i) => `volume in the cocktail ${ul(comp(i).volumeInCocktail.value)}, below the declared minimum of ${typedQ(d.minTransfer)}.`);
        break;
      case 'C5-FL-07':
        extra = `Total cocktail volume ${ul(v.totalCocktail.value)}; declared vessel capacity ${typedQ(d.capacity)}.`;
        break;
      case 'C5-FL-08': {
        const microlitres = (nL) => Dec.toString(Dec.trimZeros(Dec.shift(Dec.fromString(String(nL)), -3)));
        const groups = f.volumes.map((g) => `${microlitres(g.nL)} µL: ${g.components.map(name).join(', ')}`);
        extra = `Established volumes — ${groups.join('; ')}.`;
        if (f.unevaluated.length) extra += ` Unevaluated (established volume not recorded): ${f.unevaluated.map(name).join('; ')}.`;
        components = per(f, () => 'named.');
        break;
      }
      case 'C5-FL-11':
        components = f.amountPerCell.map((x) => {
          const i = x.component;
          const ratio = 'withheld' in x ? WITHHELD_WORDS[x.reason] : `= ${sig(x.factor, 3)}`;
          return { component: i, text: `${name(i)}: established at ${typedQ(d.components[i - 1].establishedCells)}; assay ${typedQ(d.assayCells)}; amount per cell in the assay ÷ amount per cell as established ${ratio}.` };
        });
        break;
      default:
        break;
    }
    return { code: f.code, title: FLAG_TITLES[f.code], statement: extra ? `${FLAG_STATEMENTS[f.code]} ${extra}` : FLAG_STATEMENTS[f.code], components };
  });
}

/** The flags as notebook lines (C5-OUT-10): every flag in words, with every named component. */
export function flagNotebookLines(rec) {
  const texts = flagTexts(rec);
  if (!texts.length) return ['Flags: none raised.'];
  return ['Flags', ...texts.flatMap((t) => [`  ${t.code} — ${t.title}. ${t.statement}`, ...t.components.map((c) => `    ${c.text}`)])];
}
