export const TOLERANCES = Object.freeze({
    roundTrip: Object.freeze({
        relative: 2 ** -48,
        status: 'PROVISIONAL',
        basis: 'PROVISIONAL, to be derived. Placeholder: 16 ULP, above the few roundings on the path a → v → V → recomputed concentration, pending the analytic bound.',
    }),
    unitNormalisation: Object.freeze({
        relative: 2 ** -48,
        status: 'PROVISIONAL',
        basis: 'PROVISIONAL, to be derived. Placeholder: 16 ULP. Normalisation is one rounding of the exact typed value, so entries of the same quantity in different units give the same double; the bound covers the path after it.',
    }),
});
export function relativeDifference(x, y) {
    if (x === y)
        return 0;
    return Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y));
}
