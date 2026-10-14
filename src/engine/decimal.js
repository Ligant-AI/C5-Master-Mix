const ZERO = Object.freeze({ neg: false, mant: 0n, exp: 0 });
function make(neg, mant, exp) {
    if (mant === 0n)
        neg = false;
    return { neg, mant, exp };
}
export function fromString(s) {
    const str = String(s).trim();
    const m = /^([+-])?(\d*)(?:\.(\d*))?$/.exec(str);
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
        throw new Error(`not a plain decimal: "${s}"`);
    }
    const neg = m[1] === '-';
    const intPart = m[2] || '0';
    const fracPart = m[3] || '';
    const mant = BigInt(intPart + fracPart);
    return make(neg, mant, -fracPart.length);
}
export function fromNumberExact(x) {
    if (typeof x !== 'number' || !Number.isFinite(x)) {
        throw new Error(`fromNumberExact: not a finite number: ${x}`);
    }
    if (x === 0)
        return ZERO;
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, x);
    const hi = view.getUint32(0);
    const lo = view.getUint32(4);
    const neg = (hi >>> 31) === 1;
    const biased = (hi >>> 20) & 0x7ff;
    let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    let e2;
    if (biased === 0) {
        e2 = -1074;
    }
    else {
        mant |= 1n << 52n;
        e2 = biased - 1075;
    }
    if (e2 >= 0)
        return make(neg, mant << BigInt(e2), 0);
    return trimZeros(make(neg, mant * 5n ** BigInt(-e2), e2));
}
export function fromInt(n) {
    if (!Number.isSafeInteger(n))
        throw new Error(`fromInt: not a safe integer: ${n}`);
    return make(n < 0, BigInt(Math.abs(n)), 0);
}
function align(a, b) {
    const exp = Math.min(a.exp, b.exp);
    const am = a.mant * 10n ** BigInt(a.exp - exp);
    const bm = b.mant * 10n ** BigInt(b.exp - exp);
    return [am, bm, exp];
}
function signed(d) {
    return d.neg ? -d.mant : d.mant;
}
export function add(a, b) {
    const [am, bm, exp] = align(a, b);
    const s = (a.neg ? -am : am) + (b.neg ? -bm : bm);
    return make(s < 0n, s < 0n ? -s : s, exp);
}
export function sub(a, b) {
    return add(a, neg(b));
}
export function neg(a) {
    return make(!a.neg, a.mant, a.exp);
}
export function shift(a, k) {
    return make(a.neg, a.mant, a.exp + k);
}
export function mulInt(a, n) {
    if (!Number.isSafeInteger(n))
        throw new Error(`mulInt: not a safe integer: ${n}`);
    const neg2 = n < 0;
    return make(a.neg !== neg2, a.mant * BigInt(Math.abs(n)), a.exp);
}
export function cmp(a, b) {
    const [am, bm] = align(a, b);
    const x = a.neg ? -am : am;
    const y = b.neg ? -bm : bm;
    return x < y ? -1 : x > y ? 1 : 0;
}
export function isZero(a) {
    return a.mant === 0n;
}
export function sign(a) {
    return a.mant === 0n ? 0 : a.neg ? -1 : 1;
}
export function abs(a) {
    return make(false, a.mant, a.exp);
}
export function max(a, b) {
    return cmp(a, b) >= 0 ? a : b;
}
export function min(a, b) {
    return cmp(a, b) <= 0 ? a : b;
}
function digitCount(mant) {
    return mant === 0n ? 1 : mant.toString().length;
}
export function roundSig(a, n) {
    if (!Number.isInteger(n) || n < 1)
        throw new Error(`roundSig: n must be >= 1, got ${n}`);
    if (a.mant === 0n)
        return make(false, 0n, 0);
    const digits = a.mant.toString();
    const len = digits.length;
    if (len <= n) {
        return make(a.neg, a.mant * 10n ** BigInt(n - len), a.exp - (n - len));
    }
    const drop = len - n;
    let kept = BigInt(digits.slice(0, n));
    const firstDropped = digits.charCodeAt(n) - 48;
    if (firstDropped >= 5)
        kept += 1n;
    let exp = a.exp + drop;
    if (kept.toString().length > n) {
        kept /= 10n;
        exp += 1;
    }
    return make(a.neg, kept, exp);
}
export function roundPlaces(a, places) {
    if (a.exp >= -places) {
        return make(a.neg, a.mant * 10n ** BigInt(a.exp + places), -places);
    }
    const drop = -places - a.exp;
    const digits = a.mant.toString();
    if (digits.length <= drop) {
        const padded = digits.padStart(drop, '0');
        const firstDropped = padded.charCodeAt(0) - 48;
        return make(a.neg, firstDropped >= 5 ? 1n : 0n, -places);
    }
    let kept = BigInt(digits.slice(0, digits.length - drop));
    const firstDropped = digits.charCodeAt(digits.length - drop) - 48;
    if (firstDropped >= 5)
        kept += 1n;
    return make(a.neg, kept, -places);
}
export function toString(a) {
    const digits = a.mant.toString();
    let body;
    if (a.exp >= 0) {
        body = digits + '0'.repeat(a.exp);
    }
    else {
        const places = -a.exp;
        const padded = digits.padStart(places + 1, '0');
        body = padded.slice(0, padded.length - places) + '.' + padded.slice(padded.length - places);
    }
    return (a.neg ? '-' : '') + body;
}
export function toNumber(a) {
    return Number(toString(a));
}
export function ulp(a) {
    return make(false, 1n, a.exp);
}
export function halfUlp(a) {
    return make(false, 5n, a.exp - 1);
}
export function eq(a, b) {
    return cmp(a, b) === 0;
}
export function isDec(x) {
    return x && typeof x === 'object' && typeof x.mant === 'bigint' && typeof x.exp === 'number';
}
export { ZERO, signed, digitCount };
export function trimZeros(a) {
    if (a.mant === 0n)
        return make(false, 0n, 0);
    let mant = a.mant;
    let exp = a.exp;
    while (mant % 10n === 0n) {
        mant /= 10n;
        exp += 1;
    }
    return make(a.neg, mant, exp);
}
export function padSig(a, n) {
    const t = trimZeros(a);
    if (t.mant === 0n)
        return make(false, 0n, -(n - 1));
    const len = t.mant.toString().length;
    if (len >= n)
        return t;
    return make(t.neg, t.mant * 10n ** BigInt(n - len), t.exp - (n - len));
}
