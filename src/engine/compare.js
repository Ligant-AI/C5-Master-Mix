import * as Dec from './decimal.js';
import { KIND } from './units.js';
export const RESOLUTION = Object.freeze({
    [KIND.VOLUME]: Object.freeze({ statement: '1 nL', unit: 'nL', shift: 3 }),
    [KIND.CELLS]: Object.freeze({ statement: '1 cell', unit: 'cells', shift: 0 }),
});
export function roundHalfAwayToInteger(d) {
    if (d.exp >= 0) {
        const n = d.mant * 10n ** BigInt(d.exp);
        return d.neg ? -n : n;
    }
    const div = 10n ** BigInt(-d.exp);
    let n = d.mant / div;
    if ((d.mant % div) * 2n >= div)
        n += 1n;
    return d.neg ? -n : n;
}
export function canonical(q) {
    const r = RESOLUTION[q.kind];
    if (!r)
        throw new Error(`compare: C5-UN-10 states no resolution for a ${q.kind}`);
    if (!q.exact)
        throw new Error('compare: the quantity has no exact value');
    return roundHalfAwayToInteger(Dec.shift(q.exact, r.shift));
}
export function canonicalOfDouble(x, kind) {
    const r = RESOLUTION[kind];
    if (!r)
        throw new Error(`compare: C5-UN-10 states no resolution for a ${kind}`);
    if (!Number.isFinite(x))
        throw new Error(`compare: ${x} is not finite`);
    return roundHalfAwayToInteger(Dec.shift(Dec.fromNumberExact(x), r.shift));
}
export function equalUnderRule(a, b) {
    if (a.kind !== b.kind)
        throw new Error(`compare: a ${a.kind} is not compared with a ${b.kind}`);
    return canonical(a) === canonical(b);
}
export function scaleFactor(assayVolume, establishedVolume) {
    if (assayVolume.kind !== KIND.VOLUME || establishedVolume.kind !== KIND.VOLUME) {
        throw new Error('compare: a scale factor is between two volumes');
    }
    if (equalUnderRule(assayVolume, establishedVolume))
        return Object.freeze({ value: 1, exactlyOne: true });
    return Object.freeze({ value: assayVolume.value / establishedVolume.value, exactlyOne: false });
}
