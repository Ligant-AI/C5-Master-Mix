import { sig, Dec } from './numfmt.js';
import { unitInfo } from './units.js';
export const PRECISION = Object.freeze({ volumes: 3, concentrations: 6, ratios: 3, effectiveTests: 6 });
export const PRECISION_STATUS = Object.freeze({ volumes: 'disclosed', concentrations: 'disclosed', ratios: 'disclosed', effectiveTests: 'disclosed' });
export function effectiveTests(x) {
    return Dec.toString(Dec.trimZeros(Dec.roundSig(Dec.fromNumberExact(x), PRECISION.effectiveTests)));
}
const volume = (x) => sig(x, PRECISION.volumes);
export function pipettingList(rec) {
    const v = rec.values;
    const steps = [{ step: 1, what: 'diluent', volume_uL: volume(v.diluentTotal.value) }];
    for (const c of v.components)
        steps.push({ step: steps.length + 1, what: 'component', component: c.index, volume_uL: volume(c.volumeInCocktail.value) });
    const total = steps.map((s) => Dec.fromString(s.volume_uL)).reduce(Dec.add);
    return Object.freeze({ order: 'Diluent first, then components in the order entered.', steps, total_uL: Dec.toString(total) });
}
export function perTestVolumes(rec) {
    const v = rec.values;
    return Object.freeze({
        diluent_uL: volume(v.diluentPerTest.value),
        components: v.components.map((c) => ({ component: c.index, volume_uL: volume(c.volumePerTest.value) })),
    });
}
export function concentrations(rec) {
    return rec.values.components.map((c) => {
        if (c.concentrationInAssay.withheld)
            return { component: c.index, withheld: true, reason: c.concentrationInAssay.reason };
        const u = unitInfo(c.concentrationInAssay.stockUnit);
        if (!u || u.base !== c.concentrationInAssay.unit)
            throw new Error(`format: "${c.concentrationInAssay.stockUnit}" is not a unit of ${c.concentrationInAssay.unit}`);
        const exact = Dec.shift(Dec.fromNumberExact(c.concentrationInAssay.value), -u.exp10);
        return { component: c.index, value: Dec.toString(Dec.roundSig(exact, PRECISION.concentrations)), unit: u.symbol };
    });
}
const ratio = (x) => sig(x, PRECISION.ratios);
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
