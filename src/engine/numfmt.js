import * as Dec from './decimal.js';
export function roundDec(x, n) {
    return Dec.roundSig(Dec.fromNumberExact(x), n);
}
export function sig(x, n) {
    return Dec.toString(roundDec(x, n));
}
export function pct(f, n = 3) {
    if (f === 0)
        return '0';
    return Dec.toString(Dec.shift(roundDec(f, n), 2));
}
export function signedPct(f, n = 3) {
    const s = pct(f, n);
    return f > 0 ? `+${s}` : s;
}
export function tieDistance(x, n) {
    const d = Dec.abs(Dec.fromNumberExact(x));
    if (Dec.isZero(d))
        return '0';
    const digits = d.mant.toString();
    const drop = digits.length - n;
    const stepExp = d.exp + drop;
    const truncated = drop > 0 ? { neg: false, mant: BigInt(digits.slice(0, n)), exp: stepExp } : d;
    const tie = Dec.add(truncated, { neg: false, mant: 5n, exp: stepExp - 1 });
    return Dec.toString(Dec.trimZeros(Dec.abs(Dec.sub(d, tie))));
}
export { Dec };
