// A seeded generator of valid C5 panels, for the invariance tests
// (tests/determine.test.js) and the C5-IV-04 confirmation
// (verification/mutation/iv04.mjs). Deterministic: the same seed gives the
// same panel. Values are typed strings, as a user types them.
export function rng(seed) {
  let s = BigInt(seed) | 1n;
  return () => {
    s ^= s >> 12n; s ^= (s << 25n) & 0xffffffffffffffffn; s ^= s >> 27n;
    return Number(((s * 0x2545f4914f6cdd1dn) & 0xffffffffffffffffn) >> 11n) / 2 ** 53;
  };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const num = (r, lo, hi, dp) => (lo + r() * (hi - lo)).toFixed(dp);

export function randomPanel(seed) {
  const r = rng(seed);
  const D = num(r, 20, 120, 1);
  const R = pick(r, ['0', num(r, 0, 100, 1)]);
  const svAssay = (Number(D) + Number(R)).toFixed(1); // the same volume, typed
  const components = Array.from({ length: 1 + Math.floor(r() * 8) }, (_, i) => {
    const form = pick(r, ['amount', 'amount', 'amount', 'concentration', 'stock-volume']);
    const recorded = form === 'concentration' || r() < 0.8;
    const sv = pick(r, [svAssay, svAssay, num(r, 20, 200, 1), '50', '100']);
    let intended;
    let stock;
    if (form === 'amount') {
      const fam = pick(r, ['mass', 'mass', 'molar', 'IU', 'U']);
      intended = { mass: { value: num(r, 0.005, 1, 3), unit: 'µg' }, molar: { value: num(r, 0.5, 20, 2), unit: 'pmol' }, IU: { value: num(r, 1, 100, 1), unit: 'IU' }, U: { value: num(r, 1, 100, 1), unit: 'U' } }[fam];
      stock = { mass: { value: num(r, 0.05, 1, 3), unit: 'mg/mL' }, molar: { value: num(r, 5, 50, 2), unit: 'µM' }, IU: { value: num(r, 1000, 50000, 0), unit: 'IU/mL' }, U: { value: num(r, 1000, 50000, 0), unit: 'U/mL' } }[fam];
    } else if (form === 'concentration') {
      intended = { value: num(r, 0.5, 5, 2), unit: 'µg/mL' };
      stock = { value: num(r, 0.1, 1, 3), unit: 'mg/mL' };
    } else {
      intended = { value: num(r, 0.1, 2, 2), unit: 'µL' };
      stock = { value: num(r, 0.1, 1, 3), unit: 'mg/mL' };
    }
    return {
      label: `C${i + 1}`,
      intended,
      stock,
      establishedVolume: recorded ? { value: sv, unit: 'µL' } : { notRecorded: true },
      establishedCells: r() < 0.8 ? { value: pick(r, ['1000000', '500000', '2', '0']), unit: pick(r, ['cells', '× 10⁶ cells']) } : { notRecorded: true },
      provenance: pick(r, ['titrated-here', 'vendor', 'not-recorded']),
    };
  });
  const form = pick(r, ['percentage', 'additional-tests', 'dead-volume']);
  return {
    dispensed: { value: D, unit: 'µL' },
    residual: { value: R, unit: 'µL' },
    assayCells: { value: pick(r, ['1000000', '500000', '0', '1']), unit: 'cells' },
    samples: String(1 + Math.floor(r() * 96)),
    overage: { form, value: form === 'percentage' ? num(r, 0, 20, 1) : form === 'additional-tests' ? String(Math.floor(r() * 6)) : num(r, 0, 300, 0), unit: form === 'dead-volume' ? 'µL' : '' },
    basis: pick(r, ['preserve-concentration', 'preserve-amount']),
    diluent: pick(r, [{ notRecorded: false, text: 'PBS' }, { notRecorded: true }]),
    minTransfer: { value: '2', unit: 'µL', defaulted: true },
    capacity: pick(r, [{ value: '', unit: '' }, { value: '5', unit: 'mL' }, { value: '1.5', unit: 'mL' }]),
    components,
  };
}

