// Determination (C5 §5; CLAUDE.md §5.4; docs/engine-io.md, the accepted
// engine I/O contract). determine(inputs) -> result. Pure: no DOM, no browser
// API, no time, no hidden state (C5-ST-08).
//
// Every double below is computed in the order the contract's §2.1 states, so
// that an independent implementation of the contract reaches the same value.
// Nothing is rounded here (C5-UN-03); display is format.js's, from this result.
import { validate, rejectionHI06 } from './validate.js';
import { KIND, reduction } from './units.js';
import { canonical, canonicalOfDouble, equalUnderRule, scaleFactor } from './compare.js';
import { evaluateFlags } from './flags.js';
import { ENGINE_VERSION } from './version.js';

const nonResult = (status, rejections, incomplete) => Object.freeze({
  status,
  engineVersion: ENGINE_VERSION,
  rejections: rejections.map((x) => {
    const r = { code: x.code };
    if (x.component) r.component = x.component.row;
    if (x.quantity) r.quantity = x.quantity;
    r.message = x.message;
    if (x.units) r.units = x.units;
    if (x.code === 'C5-HI-06') {
      r.components = x.components.map((c) => ({ component: c.row, volumePerTest_uL: c.volumePerTestUl }));
      r.total_uL = x.totalUl;
    }
    return r;
  }),
  incomplete: incomplete.map((e) => {
    const r = { field: e.field };
    if (e.component) r.component = e.component.row;
    r.reason = e.reason;
    r.message = e.message;
    return r;
  }),
});

// A computed value outside the range of a double (for example, an amount of
// 1e300 against a stock of 1e-300) is reported as the inputs' are: incomplete,
// with its own reason and field (Task 5 review, ruling 3). No non-finite value
// is ever returned.
function notRepresentable(field, component, what) {
  const e = { field, reason: 'unrepresentable', message: `${what} is outside the range of numbers this tool can compute with. This is a limit of the arithmetic, not a physical one.` };
  if (component) e.component = { row: component.row, label: component.label };
  return nonResult('incomplete', [], [e]);
}

export function determine(inputs) {
  const v = validate(inputs);
  if (v.status !== 'ok') return nonResult(v.status, v.rejections, v.incomplete);
  const p = v.parsed;

  // ---- panel ----------------------------------------------------------------
  const D = p.D.value;
  const svAssay = p.svAssay; // D + R, C5-SV-03
  const SV = svAssay.value;
  const n = p.samples.value;
  let nEff;
  let overageFraction;
  if (p.overageForm === 'percentage') {
    nEff = n * (1 + p.overage.value / 100);
    overageFraction = p.overage.value / 100;
  } else if (p.overageForm === 'additional-tests') {
    nEff = n + p.overage.value;
    overageFraction = p.overage.value / n;
  } else {
    nEff = n + p.overage.value / D;
    overageFraction = p.overage.value / (n * D);
  }
  if (!Number.isFinite(nEff) || !Number.isFinite(overageFraction)) return notRepresentable('overage.value', null, 'The effective number of tests');

  // ---- components -----------------------------------------------------------
  const comps = [];
  for (const c of p.components) {
    const q = c.intended;
    const stock = c.stock.status === 'ok' ? c.stock : null;
    const form = reduction(q.unit, stock ? stock.unit : null).form;
    const recorded = c.estVolume !== 'not-recorded';

    let a;
    if (form === 'amount') a = q.value / stock.value;
    else if (form === 'concentration') a = (q.value * c.estVolume.value) / stock.value; // SV_i recorded: Q1 is held otherwise
    else a = q.value; // stock-volume, µL

    let basisApplied;
    if (!recorded) basisApplied = 'not-applied';
    else if (p.basis) basisApplied = p.basis;
    else basisApplied = 'not-required';

    const s = basisApplied === 'preserve-concentration' ? scaleFactor(svAssay, c.estVolume) : null;
    const vPerTest = s ? a * s.value : a;
    const vCocktail = vPerTest * nEff;

    let concentrationInAssay;
    if (stock) concentrationInAssay = { value: (stock.value * vPerTest) / SV, unit: stock.base };
    else concentrationInAssay = { withheld: true, reason: 'PENDING-Q2' }; // unreachable: Q2 is held by validate

    let ratio;
    if (!recorded) ratio = { withheld: true, reason: 'C5-FL-02' };
    else if (basisApplied === 'preserve-amount') ratio = { value: equalUnderRule(c.estVolume, svAssay) ? 1 : c.estVolume.value / SV };
    else ratio = { value: 1 }; // preserve concentration, or not required

    for (const [name, x] of [['the stock volume per test', a], ['the volume per test', vPerTest], ['the volume in the cocktail', vCocktail], ['the concentration in the assay', concentrationInAssay.value ?? 0], ['the concentration ratio', ratio.value ?? 1]]) {
      if (!Number.isFinite(x)) return notRepresentable('intended', c, `${c.name}: ${name}`);
    }

    comps.push({
      src: c,
      out: {
        index: c.row,
        form,
        basisApplied,
        stockVolumePerTest_uL: a,
        scaleFactor: s ? { value: s.value, exactlyOne: s.exactlyOne } : null,
        volumePerTest_uL: vPerTest,
        volumeInCocktail_uL: vCocktail,
        concentrationInAssay,
        ratio,
      },
    });
  }

  // ---- the cocktail ---------------------------------------------------------
  let sumV = 0;
  for (const c of comps) sumV += c.out.volumePerTest_uL;
  // Finite volumes per test can still sum beyond the range of a double.
  if (!Number.isFinite(sumV)) return notRepresentable('intended', null, 'The total volume of the components per test');
  const hi06 = rejectionHI06(p.D, comps.map((c) => ({ row: c.src.row, label: c.src.label, value: c.out.volumePerTest_uL })));
  if (hi06) return nonResult('rejected', [hi06], []);
  const fills = canonicalOfDouble(sumV, KIND.VOLUME) === canonical(p.D);
  const diluentPerTest = fills ? 0 : D - sumV;
  const totalCocktail = D * nEff;
  let sumCocktail = 0;
  for (const c of comps) sumCocktail += c.out.volumeInCocktail_uL;
  const diluentTotal = fills ? 0 : totalCocktail - sumCocktail;
  const antibodyFraction = sumCocktail / totalCocktail;
  for (const x of [totalCocktail, sumCocktail, diluentTotal, antibodyFraction]) {
    if (!Number.isFinite(x)) return notRepresentable('dispensed', null, 'The total cocktail volume');
  }

  const { flags, fl08Unevaluated } = evaluateFlags({
    svAssay,
    cells: p.cells,
    overage: p.overage,
    minTransfer: p.minTransfer,
    capacity: p.capacity,
    diluent: p.diluent,
    totalCocktail,
    components: comps.map((c) => ({
      index: c.src.row,
      estVolume: c.src.estVolume,
      estCells: c.src.estCells,
      provenance: c.src.provenance,
      basisApplied: c.out.basisApplied,
      scaleFactor: c.out.scaleFactor,
      volumeInCocktail: c.out.volumeInCocktail_uL,
    })),
  });
  for (const f of flags) {
    for (const x of f.amountPerCell || []) {
      if ('factor' in x && !Number.isFinite(x.factor)) return notRepresentable('establishedCells', p.components[x.component - 1], `${p.components[x.component - 1].name}: the change in amount per cell`);
    }
  }

  return Object.freeze({
    status: 'result',
    engineVersion: ENGINE_VERSION,
    basisRequired: v.basisRequired,
    values: {
      svAssay_uL: SV,
      nEff,
      overageFraction,
      diluentPerTest_uL: diluentPerTest,
      componentsFillDispensedVolume: fills,
      diluentTotal_uL: diluentTotal,
      totalCocktail_uL: totalCocktail,
      antibodyFraction,
      fl08Unevaluated,
      components: comps.map((c) => c.out),
    },
    flags,
  });
}
