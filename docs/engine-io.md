# C5 Master Mix: engine I/O contract

**Status:** accepted by Adacs (Task 6a review), with the C5-FL-08 unevaluated-components amendment, the computed-overflow amendment (Task 6b review) and NADIRA's Q1 ruling of 8 October 2026 (Task 13).
**Engine version:** 0.1.0. **URS:** v1.0 (citations checked against draft v0.2.3, which Adacs confirmed identical on every cited line).
**Purpose:** the inputs `determine()` receives and the outputs acceptance 3 compares, so that the fixtures and the Python reimplementation can be written from the URS and this contract alone, without reading the engine.

This file was written at Adacs's request in `docs/`; the builder does not edit it again without a ruling.

Rulings applied: Task 4 review 1 to 4; Task 5 review 1 to 6 (in particular, HI-06, FL-05 and FL-07 are decided at 1 nL, the diluent is the literal 0 when the components fill the dispensed volume, PENDING-Q2 covers only a stock volume per test with no stock concentration, and FL-11's factor is withheld when either cell number is zero).

---

## 1. Input

`determine(inputs)` receives one JSON object. Every number is **the string as typed** with **an explicitly selected unit identifier**. Nothing is pre-parsed.

### 1.1 Encoding of a typed number

| State | Encoding |
|---|---|
| A number with a unit | `{ "value": "0.25", "unit": "µg" }` |
| Blank | `{ "value": "", "unit": "" }` (a unit may be present; a blank value is blank) |
| A number with no unit selected | `{ "value": "0.25", "unit": "" }` |
| Zero | `{ "value": "0", "unit": "µL" }`: a number, distinct from blank |
| "Not recorded" (only where the URS allows it) | `{ "notRecorded": true }`; `value` and `unit` are then ignored |

`value` is read exactly as a decimal: optional leading `+`, `-` or `−` (U+2212), digits with an optional `.`, optional exponent `e`/`E` with an optional sign. Surrounding whitespace is ignored. **A comma anywhere makes the entry invalid** (it is not stripped). Anything else is invalid. A finite, nonzero typed value whose nearest double in the base unit is ±0 or ±∞ is **unrepresentable**.

### 1.2 Unit identifiers

Exactly these strings (`µ` is U+00B5 MICRO SIGN; `×` is U+00D7; `⁶` is U+2076). Every factor is a power of ten.

| Kind | Identifier | Base unit | Value in base unit |
|---|---|---|---|
| volume | `µL` | µL | ×1 |
| volume | `mL` | µL | ×10³ |
| cells | `cells` | cells | ×1 |
| cells | `× 10⁶ cells` | cells | ×10⁶ |
| amount, mass | `ng` | µg | ×10⁻³ |
| amount, mass | `µg` | µg | ×1 |
| amount, mass | `mg` | µg | ×10³ |
| amount, molar | `pmol` | pmol | ×1 |
| amount, molar | `nmol` | pmol | ×10³ |
| amount, molar | `µmol` | pmol | ×10⁶ |
| amount, activity in IU | `IU` | IU | ×1 |
| amount, activity in U | `U` | U | ×1 |
| concentration, mass | `mg/mL` | µg/µL | ×1 |
| concentration, mass | `µg/mL` | µg/µL | ×10⁻³ |
| concentration, mass | `ng/mL` | µg/µL | ×10⁻⁶ |
| concentration, mass | `g/L` | µg/µL | ×1 |
| concentration, mass | `mg/L` | µg/µL | ×10⁻³ |
| concentration, molar | `M` | pmol/µL | ×10⁶ |
| concentration, molar | `mM` | pmol/µL | ×10³ |
| concentration, molar | `µM` | pmol/µL | ×1 |
| concentration, molar | `nM` | pmol/µL | ×10⁻³ |
| concentration, molar | `pM` | pmol/µL | ×10⁻⁶ |
| concentration, activity in IU | `IU/mL` | IU/µL | ×10⁻³ |
| concentration, activity in U | `U/mL` | U/µL | ×10⁻³ |

**Normalisation (C5-UN-03, Task 4 ruling 1):** the double used for computation is the **nearest double to the exact typed decimal times the power of ten** (one rounding). It is not `float(text) * factor`.

### 1.3 The input object

```
{
  "dispensed":   { "value", "unit" }              C5-SV-01. Unit: a volume.
  "residual":    { "value", "unit" }              C5-SV-02. Unit: a volume. Required; zero accepted.
  "assayCells":  { "value", "unit" }              C5-SV-04. Unit: cells. Zero accepted (no-cell control).
  "samples":     "96"                             C5-SV-05. A string; dimensionless; must be a whole number ≥ 1.
  "overage":     { "form", "value", "unit" }      C5-OV-01. form: "percentage" | "additional-tests" |
                                                  "dead-volume" | "" (not selected). value: typed string.
                                                  unit: "" for percentage and additional-tests (dimensionless;
                                                  a percentage is typed as 10 for 10 %); a volume for dead-volume.
  "basis":       "preserve-concentration" | "preserve-amount" | ""      C5-CP-06, CP-07. "" = unselected.
  "diluent":     { "notRecorded": false, "text": "PBS, 2% FBS" }       C5-DL-01. Blank text and not
                                                  notRecorded = blank.
  "minTransfer": { "value", "unit", "defaulted" } C5-PC-01. Unit: a volume. defaulted: true when the 2 µL
                                                  suggestion was left unchanged. Recorded only.
  "capacity":    { "value", "unit" }              C5-PC-02. Unit: a volume. Blank value = not declared.
  "components":  [ component, ... ]               In entered order. Index = position, from 1.
}

component = {
  "label":               "CD3 BUV395"                         C5-CP-01. Blank is incomplete.
  "intended":            { "value", "unit" }                  C5-CP-01. Unit: an amount, a concentration,
                                                              or a volume (a volume of stock per test).
  "stock":               { "value", "unit" }                  C5-CP-01. Unit: a concentration. Required
                                                              unless "intended" is a volume.
  "establishedVolume":   { "value", "unit" } | { "notRecorded": true }   C5-CP-02. Unit: a volume.
  "establishedCells":    { "value", "unit" } | { "notRecorded": true }   C5-CP-03. Unit: cells.
  "provenance":          "titrated-here" | "vendor" | "not-recorded" | ""  C5-CP-04. "" is incomplete.
  "declaredByPanelControl": true | false                      §6.2: the established volume and cell number
                                                              were set by the panel control. Recorded only;
                                                              no effect on any number. Optional (default false).
}
```

Transport is always `entered` in 1.0 (C5-CP-05) and is not an input. A unit identifier outside §1.2, or of the wrong kind for its field, cannot come from the page; the engine treats it as a defect (it throws), not as an input to report.

---

## 2. Output for a computed result

Every number is the **unrounded double** (C5-UN-07), as a JSON number in shortest round-trip form. `-0` never appears. Where a value is stated to be **the literal 1** or **the literal 0**, it is exactly that, by rule, not a computed value that happens to be close.

```
{
  "status": "result",
  "engineVersion": "0.1.0",
  "basisRequired": true | false,
  "values": {
    "svAssay_uL":                    SV_assay
    "nEff":                          N_eff (dimensionless, unrounded)
    "overageFraction":               (dimensionless)
    "diluentPerTest_uL":             diluent per test
    "componentsFillDispensedVolume": true | false
    "diluentTotal_uL":               diluent in the cocktail
    "totalCocktail_uL":              total cocktail volume
    "antibodyFraction":              (dimensionless)
    "fl08Unevaluated":               [indexes]: components with SV_i not recorded, ascending; always
                                     present, whether or not C5-FL-08 is raised (acceptance 14)
    "components": [ per component, in entered order ]
  },
  "flags": [ { "code", "components": [indexes], ...detail } ]
}

per component = {
  "index":                1, 2, ...
  "form":                 "amount" | "concentration" | "stock-volume"
  "basisApplied":         "preserve-concentration" | "preserve-amount" | "not-required" | "not-applied"
  "stockVolumePerTest_uL": a_i
  "scaleFactor":          { "value": s_i, "exactlyOne": true | false } | null
  "volumePerTest_uL":     v_i
  "volumeInCocktail_uL":  V_i
  "concentrationInAssay": { "value": c_assay_i, "unit": base unit } | { "withheld": true, "reason": code }
  "ratio":                { "value": ratio_i } | { "withheld": true, "reason": "C5-FL-02" }
}
```

### 2.1 The relations, in the order the doubles are computed

All quantities in base units (§1.2). `D`, `R` are the dispensed and residual volumes; `n` the sample count; `q_i`, `c_i` a component's intended quantity and stock concentration; `SV_i` its established staining volume. "Equal" and "differs" are always **under C5-UN-10**: canonical integers of the exact typed values at 1 nL (volumes) or 1 cell (cell numbers), rounded half away from zero; `SV_assay` is canonicalised as the exact sum of the typed `D` and `R`; a computed double is canonicalised from its exact binary value.

| Output | Computed as | Source |
|---|---|---|
| `svAssay_uL` | `D + R` | C5-SV-03 |
| `nEff` | percentage: `n * (1 + p / 100)`; additional tests: `n + k`; dead volume: `n + V_dead / D` | C5-OV-04 |
| `overageFraction` | percentage: `p / 100`; additional tests: `k / n`; dead volume: `V_dead / (n * D)` | C5-OV-04, DT-06 (see note 1) |
| `stockVolumePerTest_uL` (a_i) | amount form: `q_i / c_i`; concentration form with `SV_i` recorded: `(q_i * SV_i) / c_i`; concentration form with `SV_i` not recorded: `(q_i * SV_assay) / c_i`, with `SV_assay` the computed `D + R` (Q1, ruled by NADIRA, 8 October 2026: the entered concentration is carried into the assay; `v_i = a_i`, basis not applied, C5-FL-02, ratio withheld); stock-volume form: `q_i` (in µL) | §5.4; Q1 ruling |
| `scaleFactor` | preserve concentration and `SV_i` recorded: the literal 1 if `SV_assay` equals `SV_i`, else `SV_assay / SV_i`; otherwise `null` | C5-UN-11 |
| `volumePerTest_uL` (v_i) | preserve concentration and `SV_i` recorded: `a_i * s_i`; otherwise `a_i` | §5.4 |
| `volumeInCocktail_uL` (V_i) | `v_i * nEff` | §5.4 |
| `diluentPerTest_uL` | `Σv` = left-to-right sum of `v_i` in entered order. If `Σv` equals `D`: the literal 0 and `componentsFillDispensedVolume` = true. If `Σv` exceeds `D`: rejection C5-HI-06 (§3). Else `D - Σv` | §5.4, Task 5 ruling 1 |
| `totalCocktail_uL` | `D * nEff` | §5.4 |
| `diluentTotal_uL` | the literal 0 if `componentsFillDispensedVolume`; else `totalCocktail_uL - ΣV` (ΣV = left-to-right sum of `V_i`) | §5.4 (see note 2) |
| `antibodyFraction` | `ΣV / totalCocktail_uL` | §5.4, DT-06 |
| `concentrationInAssay` | `(c_i * v_i) / SV_assay`, in the stock's base concentration unit | C5-UN-09 |
| `ratio` | `SV_i` not recorded: withheld, reason `C5-FL-02`. Else preserve concentration: the literal 1. Preserve amount: the literal 1 if `SV_i` equals `SV_assay`, else `SV_i / SV_assay`. Basis not required: the literal 1 | C5-UN-09, §5.4 |

`basisApplied`: `not-applied` where `SV_i` is not recorded (C5-DT-03); otherwise the selected basis; `not-required` where the basis is not required (C5-CP-07) and none is selected. Where the basis is not required, every recorded `SV_i` equals `SV_assay`, so both bases give `v_i = a_i`.

**Note 1.** C5-OV-04 gives the dead-volume overage fraction as `V_dead / (n * D)`, and the guide gives `(N_eff - n) / n` for all forms. They are algebraically equal; the contract uses the direct form for each, which avoids the cancellation in `N_eff - n` when the overage is small. Accepted (Task 6a review).

**Note 2.** The literal 0 for the diluent in the cocktail, when the components fill the dispensed volume, extends ruling 1 from the volume per test to the cocktail. Accepted (Task 6a review).

### 2.2 Flags

Listed in the order FL-01, 02, 03, 04, 05, 07, 08, 09, 11, 12; each raised flag once, with the indexes of the components it names in ascending order (`[]` for a panel-level flag). FL-06 is deferred and never appears. Flags never block a result.

| Code | Raised when | `components` | Detail |
|---|---|---|---|
| C5-FL-01 | a recorded `SV_i` differs from `SV_assay` | those components | none |
| C5-FL-02 | `SV_i` not recorded | those components | none |
| C5-FL-03 | the typed overage value is exactly zero (any form) | `[]` | none |
| C5-FL-04 | provenance `vendor` or `not-recorded` | those components | none |
| C5-FL-05 | `V_i` is below the minimum transfer volume (canonical `V_i` < canonical minimum; equal is not below) | those components | none |
| C5-FL-07 | capacity declared and `totalCocktail_uL` exceeds it (canonical; equal does not exceed) | `[]` | none |
| C5-FL-08 | the recorded `SV_i` take two or more distinct canonical values | every component with `SV_i` recorded | `"volumes"`: the distinct canonical volumes in nL, ascending, each with its component indexes: `[{ "nL": 50000, "components": [2] }, ...]`. `"unevaluated"`: the indexes of components with `SV_i` not recorded, ascending, which are excluded from the evaluation and named as unevaluated (URS C5-FL-08, acceptance 14) |
| C5-FL-09 | diluent not recorded | `[]` | none |
| C5-FL-11 | a recorded established cell number differs from the assay's | those components | `"amountPerCell"`: per component, `{ "component": i, "factor": f }` or `{ "component": i, "withheld": true, "reason": r }` |
| C5-FL-12 | established cell number not recorded | those components | none |

FL-11's factor is the change in amount per cell, in the direction of C5-DT-06: preserve concentration (applied): `s_i * (cells_est / cells_assay)`; otherwise `cells_est / cells_assay`. Withheld, never non-finite: reason `"assay-cells-zero"` when the assay cell number is zero (C5-FX-19), else `"established-cells-zero"` when the established cell number is zero (Task 5 ruling 6).

---

## 3. Output when there is no result

```
{ "status": "incomplete", "engineVersion": "0.1.0", "rejections": [], "incomplete": [ entry, ... ] }
{ "status": "rejected",   "engineVersion": "0.1.0", "rejections": [ rejection, ... ], "incomplete": [ ... ] }

entry     = { "field", "component"?: index, "reason", "message" }
rejection = { "code", "component"?: index, "quantity"?: field, "message", ...detail }
```

- **Incomplete** (no result yet; not a rejection): `field` is one of `dispensed`, `residual`, `assayCells`, `samples`, `overage.form`, `overage.value`, `basis`, `diluent`, `minTransfer`, `capacity`, `label`, `intended`, `stock`, `establishedVolume`, `establishedCells`, `provenance`. `reason` is `blank`, `no-unit`, `invalid` (includes a comma), `unrepresentable`, or `not-selected`. `basis` is incomplete only where C5-CP-07 requires it.
- **Rejected**: every rule whose own inputs are present is applied, even while other fields are incomplete; rejected takes precedence. `code` is one of C5-HI-01 to C5-HI-06 and C5-HI-08 to C5-HI-11 (C5-HI-07 is withdrawn and never appears), in that order, by component index within a code, followed by the branches **pending a ruling**: `PENDING-Q2` (a stock volume per test with no stock concentration), `PENDING-Q4` (an established staining volume ≤ 0, an established cell number < 0, or a capacity ≤ 0). `PENDING-*` codes are not URS IDs. (`PENDING-Q1` was removed on NADIRA's Q1 ruling of 8 October 2026; that case is now computed, §2.1.) C5-HI-06 carries `"components": [{ "component": i, "volumePerTest_uL": "<3 s.f.>" }]` and `"total_uL"`, the exact decimal sum of those displayed volumes; it is decided only once validation finds no other rejection.
- **Computed values beyond the range of a double** (Task 6b review, ruling 1). Typed values can each be representable while a value computed from them is not. Every computed value below is checked, in the order shown, as it is computed; the first that is not finite ends the determination with `"status": "incomplete"` and one entry, `reason` `"unrepresentable"`, in the field shown. Not C5-HI-06, whose message lists displayable volumes. No non-finite value is ever returned.

  | Computed value | `field` | `component` |
  |---|---|---|
  | `nEff`, then `overageFraction` | `overage.value` | absent |
  | per component, in entered order: `stockVolumePerTest_uL`, `volumePerTest_uL`, `volumeInCocktail_uL`, `concentrationInAssay.value`, `ratio.value` | `intended` | that component |
  | `Σv`, the sum of the volumes per test (checked before C5-HI-06) | `intended` | absent |
  | `totalCocktail_uL`, `ΣV`, `diluentTotal_uL`, `antibodyFraction` | `dispensed` | absent |
  | C5-FL-11's `factor`, per component | `establishedCells` | that component |

- **Acceptance 3 compares** for a non-result: `status`, the ordered list of `(code, component)` and, for incomplete, the set of `(field, component, reason)`. `message` text is for acceptance 12 and is not compared by value.

---

## 4. Worked example

Built by hand from §2.1, not by running the engine. The inputs are chosen so that every double is exact except two, whose rounding is shown.

### 4.1 Input

```json
{
  "dispensed":   { "value": "50", "unit": "µL" },
  "residual":    { "value": "50", "unit": "µL" },
  "assayCells":  { "value": "1000000", "unit": "cells" },
  "samples":     "96",
  "overage":     { "form": "additional-tests", "value": "4", "unit": "" },
  "basis":       "preserve-concentration",
  "diluent":     { "notRecorded": false, "text": "PBS, 2% FBS" },
  "minTransfer": { "value": "2", "unit": "µL", "defaulted": true },
  "capacity":    { "value": "5", "unit": "mL" },
  "components": [
    { "label": "CD3 BUV395",
      "intended": { "value": "0.5", "unit": "µg" }, "stock": { "value": "0.5", "unit": "mg/mL" },
      "establishedVolume": { "value": "100", "unit": "µL" },
      "establishedCells": { "value": "1", "unit": "× 10⁶ cells" },
      "provenance": "titrated-here", "declaredByPanelControl": false },
    { "label": "CD4 BV421",
      "intended": { "value": "0.25", "unit": "µg" }, "stock": { "value": "0.5", "unit": "mg/mL" },
      "establishedVolume": { "value": "50", "unit": "µL" },
      "establishedCells": { "value": "500000", "unit": "cells" },
      "provenance": "vendor", "declaredByPanelControl": false },
    { "label": "CD8 BV711",
      "intended": { "value": "0.1", "unit": "µg" }, "stock": { "value": "0.2", "unit": "mg/mL" },
      "establishedVolume": { "notRecorded": true },
      "establishedCells": { "notRecorded": true },
      "provenance": "not-recorded", "declaredByPanelControl": false }
  ]
}
```

### 4.2 Arithmetic

**Panel.**
- `D` = 50 µL, `R` = 50 µL. `SV_assay = 50 + 50 = 100` µL (exact). Canonical: 100 000 nL.
- `n` = 96, `k` = 4 (additional tests). `N_eff = 96 + 4 = 100` (exact).
- `overageFraction = k / n = 4 / 96 = 1/24`. Not exact in binary; the result is the double nearest 1/24, `0.041666666666666664`.
- Basis required (C5-CP-07): component 2's `SV_i` = 50 µL = 50 000 nL ≠ 100 000 nL. Yes, and `preserve-concentration` is selected.

**Component 1, CD3 BUV395** (amount form; mass).
- `q` = 0.5 µg, `c` = 0.5 mg/mL = 0.5 µg/µL. `a = 0.5 / 0.5 = 1` µL.
- `SV_1` = 100 µL = 100 000 nL, equal to `SV_assay`, so `s` is the literal 1 (`exactlyOne: true`). `v = 1 * 1 = 1` µL.
- `V = 1 * 100 = 100` µL.
- `c_assay = (0.5 * 1) / 100 = 0.5 / 100`, the double nearest 0.005, `0.005` µg/µL (= 5 µg/mL).
- Ratio: preserve concentration, so the literal 1.
- Cells: established 1 × 10⁶ = 1 000 000 cells, equal to the assay's: FL-11 not raised. Provenance titrated here: no FL-04.

**Component 2, CD4 BV421** (amount form; mass).
- `q` = 0.25 µg, `c` = 0.5 µg/µL. `a = 0.25 / 0.5 = 0.5` µL.
- `SV_2` = 50 µL, differs (50 000 ≠ 100 000 nL): `s = 100 / 50 = 2` (`exactlyOne: false`). `v = 0.5 * 2 = 1` µL.
- `V = 1 * 100 = 100` µL.
- `c_assay = (0.5 * 1) / 100 = 0.005` µg/µL.
- Ratio: the literal 1.
- FL-01 (SV differs); FL-04 (vendor). Cells: 500 000 ≠ 1 000 000, so FL-11, with factor `s * (cells_est / cells_assay) = 2 * (500000 / 1000000) = 2 * 0.5 = 1`. Under preserve concentration the volume per test, and so the amount per test, doubles (`s` = 2), and the assay has twice the cells it was established with, so the amount per cell is unchanged.

**Component 3, CD8 BV711** (amount form; mass; `SV_3` not recorded).
- `q` = 0.1 µg, `c` = 0.2 µg/µL. `a = 0.1 / 0.2`. The double of 0.2 is exactly twice the double of 0.1 (same significand, exponent one higher), so `a = 0.5` exactly.
- `SV_3` not recorded: basis not applied (C5-DT-03), `scaleFactor` null, `v = a = 0.5` µL.
- `V = 0.5 * 100 = 50` µL.
- `c_assay = (0.2 * 0.5) / 100`. `0.2 * 0.5` is exactly the double of 0.1, which is 0.1000000000000000055511151231257827…; divided by 100 the exact quotient is 0.0010000000000000000555111512…. The nearest doubles are 0.00100000000000000002081668… (the double of 0.001) and the next one up, 2⁻⁶² ≈ 2.17 × 10⁻¹⁹ higher. The quotient is 3.47 × 10⁻²⁰ above the first, less than half the spacing, so the result is the double of 0.001, written `0.001` µg/µL.
- Ratio: withheld, reason C5-FL-02 (never shown as 1).
- FL-02; FL-04 (not recorded); FL-12. Not in FL-08, whose set is the recorded volumes only.

**Cocktail.**
- `Σv = 1 + 1 + 0.5 = 2.5` µL. Canonical 2 500 nL < `D`'s 50 000 nL: not HI-06, not filling. `diluentPerTest = 50 - 2.5 = 47.5` µL.
- `totalCocktail = 50 * 100 = 5000` µL.
- `ΣV = 100 + 100 + 50 = 250` µL. `diluentTotal = 5000 - 250 = 4750` µL.
- `antibodyFraction = 250 / 5000`, the double nearest 0.05, `0.05`.

**Flags.**
- FL-01 [2]. FL-02 [3]. FL-03: overage 4, not raised. FL-04 [2, 3].
- FL-05: minimum 2 µL = 2 000 nL; `V` = 100 000, 100 000, 50 000 nL, none below: not raised.
- FL-07: capacity 5 mL = 5 000 000 nL; total 5000 µL = 5 000 000 nL, **equal, so it does not exceed**: not raised (ruling 1's boundary).
- FL-08 [1, 2]: recorded volumes 100 000 nL (component 1) and 50 000 nL (component 2), two distinct values. Component 3 (not recorded) is unevaluated: `"unevaluated": [3]`, and `values.fl08Unevaluated` = [3].
- FL-09: diluent recorded, not raised. FL-11 [2], factor 1. FL-12 [3].

### 4.3 Expected output

```json
{
  "status": "result",
  "engineVersion": "0.1.0",
  "basisRequired": true,
  "values": {
    "svAssay_uL": 100,
    "nEff": 100,
    "overageFraction": 0.041666666666666664,
    "diluentPerTest_uL": 47.5,
    "componentsFillDispensedVolume": false,
    "diluentTotal_uL": 4750,
    "totalCocktail_uL": 5000,
    "antibodyFraction": 0.05,
    "fl08Unevaluated": [3],
    "components": [
      { "index": 1, "form": "amount", "basisApplied": "preserve-concentration",
        "stockVolumePerTest_uL": 1, "scaleFactor": { "value": 1, "exactlyOne": true },
        "volumePerTest_uL": 1, "volumeInCocktail_uL": 100,
        "concentrationInAssay": { "value": 0.005, "unit": "µg/µL" },
        "ratio": { "value": 1 } },
      { "index": 2, "form": "amount", "basisApplied": "preserve-concentration",
        "stockVolumePerTest_uL": 0.5, "scaleFactor": { "value": 2, "exactlyOne": false },
        "volumePerTest_uL": 1, "volumeInCocktail_uL": 100,
        "concentrationInAssay": { "value": 0.005, "unit": "µg/µL" },
        "ratio": { "value": 1 } },
      { "index": 3, "form": "amount", "basisApplied": "not-applied",
        "stockVolumePerTest_uL": 0.5, "scaleFactor": null,
        "volumePerTest_uL": 0.5, "volumeInCocktail_uL": 50,
        "concentrationInAssay": { "value": 0.001, "unit": "µg/µL" },
        "ratio": { "withheld": true, "reason": "C5-FL-02" } }
    ]
  },
  "flags": [
    { "code": "C5-FL-01", "components": [2] },
    { "code": "C5-FL-02", "components": [3] },
    { "code": "C5-FL-04", "components": [2, 3] },
    { "code": "C5-FL-08", "components": [1, 2],
      "volumes": [ { "nL": 50000, "components": [2] }, { "nL": 100000, "components": [1] } ],
      "unevaluated": [3] },
    { "code": "C5-FL-11", "components": [2],
      "amountPerCell": [ { "component": 2, "factor": 1 } ] },
    { "code": "C5-FL-12", "components": [3] }
  ]
}
```

---

## 5. Not in this contract

- The derivation text, statements, register, bench sheet, notebook copy and visuals (Tasks 8 and 9): rendered from the result, compared by acceptance 12 and the headless checks, not by acceptance 3.
- Display values (3 and 6 significant figures, and the displayed total as the exact sum of displayed volumes, C5-DT-04): derived from these unrounded values by `numfmt.js`; tested in Task 6b.
- The comparison tolerance for acceptance 3 is open item 5 (`src/engine/tolerances.js`, PROVISIONAL).
- The proposed Q4 cases, and Q2 (a stock volume per test with no stock concentration), compute nothing until ruled on. Q1 is ruled (NADIRA, 8 October 2026; §2.1).
