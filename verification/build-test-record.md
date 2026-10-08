# C5 Master Mix: build test record

**Release:** 1.0 (engine 0.1.0, development). **Run:** 8 October 2026, by the builder (Claude Code), Tasks 7b to 10 brief §5.
**Against:** the production build, served by `vite preview` on http://localhost:4175/, headless Chromium 153 at 1366 × 650 unless stated.
**Evidence files:** every command's complete output is in `verification/acceptance-run/` (one file per command), committed with this record.
**Deferred, not run:** acceptance 11, 17a and 31 (release 1.0 scope record).

Results: **pass**, **fail**, or **pending** (needs a person, a deployment or Adacs's Chrome check; the headless evidence so far is given).

## Acceptance 22 (reported first)

| # | Item | Result | Evidence | Date |
|---|---|---|---|---|
| 22 | A first-time user produces a correct four-component cocktail in under two minutes without instruction | **pending: A.B. user test** | Not simulated. Needs a first-time human user (C5-FX-01 or C5-REF-01 is a suitable panel). | — |

## Every other item

| # | Item | Result | Evidence | Date |
|---|---|---|---|---|
| 1 | Reference four-component cocktail against hand calculation, tie properties recorded | pass | `tests/fixtures.test.js`, fixture C5-REF-01 (supplied by Adacs; its `assumptions` record the tie properties): displays 100, 50.0, 250, 80.0 µL, diluent 4520 µL, total 5000.0 µL, no flags. `npm-test.txt` | 8 Oct 2026 |
| 2 | Non-round case C5-FX-01 against hand calculation | pass | C5-FX-01 `display3sf`: 18.6, 95.7, 44.7, 25.4 µL, diluent 1770 µL, total 1954.4 µL, no flags. `npm-test.txt`; also entered through the page in `headless-form.txt` (acceptance 20) | 8 Oct 2026 |
| 3 | Independent reimplementation agrees on unrounded values over the full fixture set | pass | `npm run test:reimpl`: 46 fixtures, 1763 numbers compared, **0 differences** (exact; tolerance 2⁻⁴⁸ PROVISIONAL). `test-reimpl.txt` | 8 Oct 2026 |
| 4 | Structured object against the shared format, or the C5-OUT-03 escalation recorded | **pass: met by recorded escalation** | `docs/out-03-escalation.md` (no shared format exists: C1, C3, C4, C7, bench-chrome, ADC). Supporting: C5's own object (`ligant-benchtools-c5-master-mix` 1.0.0-draft, `docs/schema/…schema.json`) validates for all 46 fixtures, with per-component flag scope, cell number and residual volume, zero distinct from blank (`tests/result.test.js`). `npm-test.txt` | 8 Oct 2026 |
| 5 | Displayed total equals the sum of displayed pipetted volumes, against C5-FX-04 | pass | C5-FX-04: displayed total 2001.6 µL, not the rounded unrounded total 2000; C5-IV-01 over 400 seeded panels (`tests/determine.test.js`). `npm-test.txt` | 8 Oct 2026 |
| 6 | Unrounded total equals D × N_eff within the tolerance | pass | C5-IV-02 (`tests/determine.test.js`): total exactly D × N_eff; diluent in the cocktail against diluent per test × N_eff within 2.03 × 10⁻¹⁶ of the total (tolerance 2⁻⁴⁸, PROVISIONAL). `npm-test.txt` | 8 Oct 2026 |
| 7 | Target → volume → recomputed concentration returns the target | pass | C5-IV-03 over 1715 components, recomputed from the pipetted cocktail volume: largest relative difference 4.52 × 10⁻¹⁶; fixture C5-FX-03. `npm-test.txt` | 8 Oct 2026 |
| 8 | Where no recorded volume differs, both bases give identical unrounded results | pass | C5-IV-05 (151 panels including the C5-FX-13 pair); fixtures C5-FX-07a, 07b, 07c (`sameNumbersAs`). `npm-test.txt` | 8 Oct 2026 |
| 9 | Invariance tests fail under an inserted clamp, floor and nudge, each above the tolerance | pass | `verification/iv-04-record.md`: clamp 0.919, floor 0.0166, nudge 9.10 × 10⁻¹³, each detected and above 2⁻⁴⁸. `iv04.txt`. Wider: 54 of 54 single planted faults caught, `mutation.txt` | 8 Oct 2026 |
| 10 | C5-FX-09 produces a cocktail with no flags | pass | C5-FX-09 `flags: []`. `npm-test.txt` | 8 Oct 2026 |
| 12 | Every §7 condition rejected with the quantity and the physical reason; C5-HI-06 lists the components | pass | `tests/validate.test.js` asserts each message's content (C5-HI-01 to 06, 08 to 11; C5-HI-07 withdrawn and never raised); C5-FX-16, 27b, 27c. `npm-test.txt` | 8 Oct 2026 |
| 13 | Every §8 condition computes a cocktail and raises a flag with a reason code resolvable to the component | pass | Fixtures C5-FX-05a (FL-01, 08), 11 (FL-02), 18b (FL-05), 18e (FL-07), 12a (FL-11), 19; `tests/flag-text.test.js` (FL-03, 04, 09, 12); every case of `measure-layout-page.txt` raises all ten (or nine) on the real page. Component scope in the structured object | 8 Oct 2026 |
| 14 | No established volume: ratio withheld in the cell, unevaluated for FL-08, named separately under CP-07 | pass | C5-FX-11 (`tests/fixtures.test.js`); on the page, `headless-outputs.txt` "acceptance 14": the cell reads "withheld: established staining volume not recorded (C5-FL-02)"; FL-08 "Not evaluated … Component 3"; CP-07 names Component 3 | 8 Oct 2026 |
| 15 | Cell-number disagreement raises C5-FL-11 under both bases | pass | C5-FX-12a and 12b, factor 0.200 each. `npm-test.txt` | 8 Oct 2026 |
| 16 | The C5-FX-13 pairs, non-identical after normalisation, compare equal; FL-01 and FL-11 not raised; no basis demanded | pass | Measurement in `tests/compare.test.js` (10.1 + 11.2 µL against 21.3 µL; 1.0000001 × 10⁶ cells against 1000000 cells); fixture C5-FX-13. `npm-test.txt` | 8 Oct 2026 |
| 17 | No cocktail without every required declaration | pass | `headless-form.txt` "acceptance 17": each of 15 required declarations removed in turn prevents a result and says what is needed, never as an error; `tests/validate.test.js` | 8 Oct 2026 |
| 17b | Changing any declaration recomputes every component; nothing survives unmarked | pass | `headless-form.txt` "acceptance 17b": 14 declarations changed in turn, each page identical to a fresh page given the same inputs | 8 Oct 2026 |
| 18 | C5-NF-01 verified in a real browser against the deployed address | **pending: deploy** | Local evidence: `headless-form.txt` "network": a sentinel typed into all 28 text fields; 9 requests, all to localhost:4175, none carrying it. Not the deployed address, so not this test | — |
| 19 | Privacy claims checked at the deployed address; closing the page verified by tab and session restore | **pending: deploy** | Local evidence: `headless-form.txt` "storage": no localStorage keys, sessionStorage empty, no cookies; `tests/storage-guard.test.js`; nothing survives a reload (acceptance 20) | — |
| 20 | Reloading and re-entering reproduces the cocktail exactly, including pipetting order | pass | `headless-form.txt` "acceptance 20": C5-FX-01 typed, reloaded (form empty), re-typed; identical output and pipetting order | 8 Oct 2026 |
| 21 | Register with value, basis and status; failure classes; privacy statement verbatim | pass, privacy text **pending URS v1.0.1** | `headless-outputs.txt` "acceptance 21": 21 register rows each with one status, 10 failure classes, privacy text byte-equal to the recorded C7 statement (pending URS v1.0.1, question Q3) | 8 Oct 2026 |
| 23 | No component visible without the declarations and every flag, full scroll range, maximum count, at least four flags | **pending: Adacs's Chrome check** | Headless: `measure-layout-page.txt`, real page, N = 4 to 60 with all ten flags and the 400-character diluent: 0 violations, block at most 239.7 px (bound 260), slack 22.2 px at 1351 px | — |
| 24 | Every displayed ratio asserted in both directions (C5-FX-14) | pass | C5-FX-14a (0.5 and 2), 14b; FL-01 and FL-11 payload directions (`tests/flag-text.test.js`, with inverted-direction mutations caught). `npm-test.txt` | 8 Oct 2026 |
| 25 | Bench sheet legible without the application, every flag in words | pass | `headless-outputs.txt` "acceptance 25": in print media only the sheet shows; every flag's words, the residual row (zero included) and the visuals, for five fixtures including C5-FX-23 | 8 Oct 2026 |
| 26 | Notebook copy with every declaration, every flag in words, each volume and concentration, the effective test count | pass | `headless-outputs.txt` "acceptance 26", five fixtures | 8 Oct 2026 |
| 27 | Every visual agrees with the table and object on the full fixture set | pass | `headless-outputs.txt` "acceptance 27": 592 labels over 37 result fixtures, 0 misses | 8 Oct 2026 |
| 28 | No visual draws a withheld value (C5-FX-20) | pass | `headless-outputs.txt` "acceptance 28": no mark, an empty labelled row with C5-FL-02 | 8 Oct 2026 |
| 29 | Log symmetry of the ratio marks (C5-FX-21) | pass | `headless-outputs.txt` "acceptance 29": 0.5 and 2 at −208.65 and +208.65 px, asymmetry 3 × 10⁻⁵ px | 8 Oct 2026 |
| 30 | Visuals on the greyscale bench sheet legible without the application (C5-FX-24) | **pending: Adacs's Chrome check** | `verification/print/C5-FX-24-bench-sheet-greyscale.png` and `.pdf` | — |
