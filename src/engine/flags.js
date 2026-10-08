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
