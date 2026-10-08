# C5 Master Mix: register audit trail

The §11 register on the page (C5-CN-01, acceptance 21) states each row's value,
basis and status. Who proposed, ruled on or confirmed each row, and the review
history behind it, is kept here rather than on the public page. `docs/` holds
the signed specification and is not edited by the builder, so this file sits
at the repository root.

Source of the rows: `src/engine/register.js`.

## Sign-offs recorded 8 October 2026

The chief scientific officer (NADIRA) confirmed the four groups of rows that
were awaiting her:

| Row | Before | Now |
|---|---|---|
| Comparisons at the boundary (C5-HI-06, C5-FL-05, C5-FL-07) | proposed; basis "Ruling of 8 October 2026 (Adacs), for NADIRA to confirm."; marker "PENDING: NADIRA to confirm" | convention, confirmed |
| C5-FL-11 amount-per-cell ratio at zero cells | proposed; basis "Ruling of 8 October 2026 (Adacs), for NADIRA to confirm."; marker "PENDING: NADIRA to confirm" | convention, confirmed |
| Displayed precision, concentrations | proposed; marker "PENDING: open item 8" | disclosed, confirmed |
| Displayed precision, ratios and fractions | proposed; basis "Ruling of 8 October 2026 (Adacs)."; marker "PROVISIONAL: open item 8" | disclosed, confirmed |
| Displayed precision, effective number of tests | proposed; basis "Ruling of 8 October 2026 (Adacs). The value used is unrounded."; marker "PROVISIONAL: open item 8" | disclosed, confirmed |
| Unit catalogue | proposed; basis "Accepted for the build; IU and U are never converted, ..."; marker "PENDING: NADIRA to confirm" | convention, confirmed on condition |

The unit catalogue is confirmed on the condition that IU and U are never
treated as interchangeable. Before the row was marked confirmed this was
checked in the code and pinned by `tests/activity-units.test.js`:

- IU and U (and IU/mL and U/mL) are separate dimensions with separate base
  units (`src/engine/units.js`, `DIMENSION`, `BASE`, `UNITS`).
- `reduction()` reduces a quantity only against a stock of the same dimension;
  every IU/U pairing, in either direction and as an amount or a concentration,
  is rejected under C5-HI-05 with "IU and U are different units of activity
  and are never converted into one another".
- The comparison rule (`src/engine/compare.js`) states a resolution only for
  volume and cell number, so an IU or U quantity is never compared or equated.
- The only sums in the engine are of volumes in µL (`sumVolumes()` refuses
  anything else; `determine.js` sums per-test and cocktail volumes only).

With the four groups confirmed, the precision statement on the page no longer
marks ratios and fractions as provisional.

## Rows that stay open

| Row | Status on the page | What it waits for |
|---|---|---|
| Round-trip tolerance (C5-IV-02, IV-03) | open (awaiting the derived bound) | Open item 5: the analytic bound over the operation set, before ship. Values remain PROVISIONAL in `src/engine/tolerances.js` |
| Unit-normalisation tolerance (C5-IV-06) | open (awaiting the derived bound) | Open item 5, as above. The normalisation path follows the Task 4 review, ruling 1 |
| Diluent length | open (awaiting a ruling) | A cap or a clamp, for A.B. and NADIRA |

## History moved off the page

| Row | Attribution and history formerly on the page |
|---|---|
| Pipetting order | Signed off by NADIRA, 1 October 2026 (open item 4) |
| Maximum component count (60) | Chosen by A.B. (Task 3 review, ruling 3); measured in Chrome by Adacs |
| Height bound of the declarations and flags kept in view (260 px) | Bound set by A.B. (Task 3 review, ruling 1); the 239.7 px Chrome measurement is Adacs's (60 components, nine flags, a 400-character diluent) |
| Comparisons at the boundary | Proposed by Adacs, ruling of 8 October 2026 |
| C5-FL-11 ratio at zero cells | Proposed by Adacs, ruling of 8 October 2026 |
| Displayed precision, ratios and fractions; effective number of tests | Rulings of 8 October 2026 by Adacs (Task 6b review, ruling 3; Task 11 review, item 3), under open item 8 |
| Derivation, concentration carried with the established staining volume not recorded | The derivation line cited "NADIRA's Q1 ruling, 8 October 2026"; the ruling stands, the citation is kept here |
