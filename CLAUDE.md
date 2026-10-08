# C5 Master Mix: development guide for the builder

**For:** Claude Code (the builder)
**From:** Adacs, lead engineer and reviewer, relayed by A.B. (A. Modi, owner)
**Date:** 5 October 2026, revised 7 October 2026 after the Task 2 report
**Release:** 1.0

Save this file as `CLAUDE.md` at the root of the C5 repository, so that every session reads it.

---

## 0. How we work

### 0.1 Roles

- **You** build, and prove each task from the terminal.
- **Adacs** reviews your terminal output, then checks the running build in a real Chrome browser on `localhost`.
- **A.B.** relays messages between us and owns every product decision.
- **NADIRA** (chief scientific officer) owns every scientific ruling.

You cannot use a GUI browser. Every proof you give is a terminal command and its output. Adacs covers the visual and real-browser side.

### 0.2 Sources of truth, in order of precedence

1. **`docs/urs/c5-master-mix-urs-v1_0.md`**, the signed specification. Every requirement has a frozen ID (for example C5-DT-04).
2. **`docs/c5-release-1_0-scope-record.md`**, signed by A. Modi. It defines what release 1.0 implements from the URS.
3. **This guide.** It says how to build. It never overrides 1 or 2.

If this guide seems to conflict with the URS, the URS wins. Stop and report the conflict.

### 0.3 Rules that are not negotiable

1. **Build only what the URS and the scope record require.** No extra features, options, shortcuts, presets, tooltips that suggest values, or "helpful" defaults. If you think something would improve the tool, write it under "Suggestions for 1.1" in your task report and do not build it.
2. **Never resolve an ambiguity in code.** If a requirement can be read two ways, stop, write the question in your task report with the requirement ID, and build the parts that do not depend on it.
3. **Never weaken a test to make it pass.** Do not loosen a tolerance, delete an assertion or skip a case. A failing test is a finding: report it.
4. **Do not edit the files Adacs supplies:** `tests/fixtures/`, `reimpl/` and `docs/`. If you believe one is wrong, report it.
5. **No new runtime dependencies** without asking. The only runtime dependency is the vendored `@ligant/bench-chrome` 1.1.0 tarball carried unchanged from C7 (sha256 `1ca3a885…c197a`). Do not modify that package.
6. **Report raw output, never a summary.** Paste every command and its complete output exactly as printed. Summaries hide what the reviewer needs to see.
7. **Anything touching analytics, the consent banner, the security headers or the privacy text: ask first.** These carry public claims.

### 0.4 Task cycle

Work in numbered tasks, one at a time. Do not start a task until Adacs has accepted the previous one.

Every task ends with a report in this shape:

```
TASK <n> REPORT
1. What I did (one short paragraph)
2. Commands run, each followed by its complete raw output
3. git log --oneline -5 and git diff --stat for the task
4. Questions, by requirement ID (or "none")
5. Suggestions for 1.1 (or "none")
6. Dev server: running at http://localhost:5175/ (or "not applicable")
```

Leave the dev server running at the end of every task that changes anything visible, so Adacs can check it in Chrome.

---

## 1. Recorded decisions

Treat these as settled. Do not revisit them.

| Topic | Decision | Source |
|---|---|---|
| Repository | `github.com/Ligant-AI/C5-Master-Mix`, private until release, Apache-2.0. Local path `benchtools-OS/C5-Master-Mix` | A. Modi, 5 Oct 2026 |
| Stack | C7's lineage: plain ES modules, no framework, no TypeScript, Vite 8.3.0, Node 22 or later, `node --test` | Adacs |
| Dev port | **5175** with `strictPort`. Confirm it is free first: `lsof -nP -iTCP:5175 -sTCP:LISTEN` should print nothing. If it is taken, stop and ask | Adacs |
| Release scope | Standalone. No imports from C3, C4 or C7 (see §2) | Scope record, decision 1 |
| Storage | **Nothing the user enters is ever written to any browser storage or cookie.** All form state lives in memory; a reload clears the form. The only permitted storage key is the shared frame's consent key, `ligant_privacy_choice` | C5-ST-10; Adacs |
| Analytics | **Identical to live C7:** Cloudflare Web Analytics, plus Google Analytics behind the consent banner. Copy C7's frame, banner and security policy unchanged | A. Modi, 5 Oct 2026 |
| Comparison resolution | Volumes compared at **1 nL**, cell numbers at **1 cell**, as canonical integers (C5-UN-10) | Scope record, decision 3 |
| Form | Components entered as spreadsheet-style rows, with one panel-level control (see §6.2) | Scope record, decision 2 |
| Overage forms | **All three forms are built:** percentage, additional tests, dead volume. Open item 3 may later remove one | URS C5-OV-01 |
| Display precision | Volumes 3 significant figures, concentrations 6, rounding half away from zero on the exact binary value | C5-UN-04, 05, 06 |
| Pipetting order | Diluent first, then components in the order entered | C5-DT-05 |
| Frame verification | The frame is verified on the production preview, not the dev server: `npm run build && npm run preview -- --port 4175 --strictPort`. On the dev server the CSP blocks Vite's injected styles, as on C7; that is expected and the CSP is **not** changed for it | Adacs, 7 Oct 2026 |
| Consent banner | Appears only on `*.ligant.ai` and `*.pages.dev`, as on C7. It is checked on a hosted preview at deploy, not locally | Adacs, 7 Oct 2026 |
| Suite navigation | Lives in `@ligant/bench-chrome`. Do not change the package. Adding Master Mix to the suite navigation is a suite-level decision for A.B., outside this build | Adacs, 7 Oct 2026 |

---

## 2. Release 1.0 scope

### 2.1 Deferred to 1.1: do not build

The IDs stay in the URS under their frozen numbers. Do not implement them, stub them or leave placeholder UI for them.

| Kind | IDs |
|---|---|
| Requirements | C5-ST-01, C5-ST-02, C5-ST-03, C5-ST-05, C5-ST-09, C5-VZ-11, C5-FL-06 |
| Fixtures | C5-FX-10, C5-FX-17, C5-FX-25, C5-FX-26 |
| Acceptance | 11, 17a, 31 |

Consequences in 1.0:

- **C5-CP-05 (transport)** is always recorded as `entered`.
- **The "where imported" clauses** of C5-CP-02 and C5-CP-03 never apply.
- **C5-UN-06's directed rounding of a bound** never applies, because no bound can arise. Do not build a bound path.
- **C5-ST-04 and C5-OUT-03** still apply. The structured result object is produced from entered values.

### 2.2 Must never be trimmed

NADIRA names these as the reason the tool exists. They must be complete in 1.0:

- the residual volume, overage and transfer-basis declarations;
- withheld ratios, never shown as 1 when unknown;
- every flag, in words, on the bench sheet.

---

## 3. Known questions, not yet ruled

Do not implement these branches until A.B. relays an answer. Build everything else around them, and make the unbuilt branch reject with a clear "not yet supported" message that names the question, so nothing silently computes.

| # | Question | Affects |
|---|---|---|
| Q1 | An intended quantity expressed as a **concentration** (for example µg/mL) whose established staining volume is **not recorded**. C5-DT-03 says the component is "carried at its entered per-test quantity" with no basis applied, but for a concentration, carrying it into the assay is itself the preserve-concentration basis. What is computed? | C5-DT-03, C5-FL-02 |
| Q2 | An intended quantity expressed as a **stock volume per test** (µL per test), for which C5-CP-01 requires no stock concentration. C5-UN-09 requires the component's concentration in the assay. Is that reported as a fraction of stock (for example 1:50), or withheld with a reason? | C5-UN-09, C5-VZ-03 |
| Q3 | The privacy statement text. URS v1.0 §14.1 will be replaced, in URS v1.0.1, by the statement live C7 shows. Until v1.0.1 is signed, use C7's text exactly as described in Task 2. | C5-NF-03, acceptance 19, 21 |

---

## 4. Repository layout

Follow C7's skeleton. Names below are the target; adjust only if C7's equivalent file has a different name, and say so in your report.

```
C5-Master-Mix/
  CLAUDE.md                     this guide
  README.md
  LICENSE                       Apache-2.0
  CITATION.cff
  index.html
  styles.css
  package.json                  name "ligant-master-mix"
  vite.config.js                port 5175, strictPort
  public/_headers               copied from C7; comment rewritten to be accurate (Task 2)
  docs/
    urs/c5-master-mix-urs-v1_0.md
    c5-release-1_0-scope-record.md
  src/
    config.js                   tool title "Master Mix", tool ID "C5", engine version
    tokens.css
    shared/
      privacy-statement.js      exact text, with source record (Task 2)
      result-object.js          shared format (copied from C7; see §5.6)
    engine/                     pure functions, no DOM, no browser APIs
      units.js
      compare.js
      validate.js
      determine.js
      flags.js
      format.js
      result.js
    ui/
      chrome.js                 shared frame, from C7
      app.js
      form.js
      render.js
      visuals.js
      bench-sheet.js
      notebook.js
  tests/
    fixtures/                   supplied by Adacs; do not edit
    *.test.js
  reimpl/                       Python reimplementation, supplied by Adacs; do not edit
  verification/
    layout/                     Task 3 measurements
    headless/                   Playwright checks
```

---

## 5. Engine design

### 5.1 Principle

The engine is one pure function:

```
determine(inputs) -> result
```

It has no DOM, no browser APIs, no time dependence and no hidden state (C5-ST-08). Everything the user sees is rendered from `result`: the table, the derivation, the flags, the visuals, the bench sheet, the notebook copy and the structured object (C5-OUT-04, C5-VZ-04). No renderer computes a number of its own.

### 5.2 Inputs

Every numeric input arrives as the **string the user typed** plus an **explicitly selected unit** (C5-UN-01). Keep the string. The comparison rule depends on it (§5.3).

Panel-level inputs:
- dispensed cocktail volume per test (C5-SV-01);
- volume already present with the cells: required, no default, zero accepted, and blank kept distinct from zero (C5-SV-02);
- assay cell number per test (C5-SV-04);
- number of samples, an integer (C5-SV-05);
- overage: form plus value, no default, zero accepted (C5-OV-01 to 03);
- transfer basis: `preserve-concentration`, `preserve-amount` or unselected (C5-CP-06, 07);
- diluent: text or `not-recorded` (C5-DL-01);
- minimum transfer volume: pre-filled 2 µL, marked as a suggestion, with an `entered` or `defaulted` state (C5-PC-01);
- vessel working capacity: optional, no default (C5-PC-02).

Per-component inputs, in entered order:
- label;
- intended per-test quantity plus unit;
- stock concentration plus unit, where required (C5-CP-01);
- established staining volume, or `not-recorded` (C5-CP-02);
- established cell number plus unit, or `not-recorded` (C5-CP-03);
- provenance: `titrated-here`, `vendor`, or `not-recorded` (C5-CP-04);
- transport: always `entered` in 1.0 (C5-CP-05).

Nothing is ever inferred, defaulted or pre-filled for a component (C5-CP-10).

### 5.3 Units and comparison (Task 4)

**Computation** uses IEEE double precision. Normalise volumes to µL and cell numbers to cells. Conversion is exact within floating point, and nothing is rounded before display (C5-UN-03).

**Comparison** (C5-UN-10) does not use floats. Convert the **typed decimal string** and its unit factor to an exact rational value, then to a canonical integer at the resolution (nanolitres for volume, cells for cell number), rounding half away from zero. Use `BigInt` decimal arithmetic. Two quantities are equal exactly when their canonical integers are equal. This rule decides C5-FL-01, C5-FL-08, C5-FL-11 and whether a basis is required under C5-CP-07.

**Scale factor** (C5-UN-11): where two volumes compare equal, the scale factor between them is the literal `1`, not a computed ratio.

**Dimensions** (C5-CP-09):
- mass, molar, activity (IU), activity (U) and volume are separate dimensions;
- IU and U are never interconverted;
- a quantity whose dimension cannot be reduced to a volume of its stock is rejected per C5-HI-05, naming both units;
- no specific activity, molecular weight or density is ever supplied or inferred.

### 5.4 Determination (Tasks 6 and 7)

These relations restate the URS for implementation. If any line here disagrees with the URS, the URS wins: stop and report.

Panel:

```
SV_assay    = D + R                       (C5-SV-03)
              D = dispensed per test, R = volume present with cells
N_eff       = n * (1 + p/100)             percentage form
            = n + k                       additional-tests form
            = n + V_dead / D              dead-volume form   (C5-OV-04)
overage fraction = (N_eff - n) / n        stated per C5-DT-06
```

`N_eff` is used unrounded (§11 convention).

Per component `i`, the amount per test it was established with is its intended quantity, reduced to a stock volume per test `a_i` where a stock concentration applies. Then:

```
basis: preserve amount        v_i = a_i
basis: preserve concentration v_i = a_i * s_i,  s_i = SV_assay / SV_i
       s_i is exactly 1 when SV_assay and SV_i compare equal (C5-UN-11)
SV_i not recorded             v_i = a_i, basis not applied, stated (C5-DT-03)
```

Cocktail:

```
V_i            = v_i * N_eff                    component volume in cocktail
diluent/test   = D - sum(v_i)                   reject per C5-HI-06 if negative
total          = D * N_eff
diluent total  = total - sum(V_i)
antibody fraction = sum(V_i) / total            stated per C5-DT-06
```

Concentration and ratio (C5-UN-09):

```
c_assay_i = c_stock_i * v_i / SV_assay
c_est_i   = c_stock_i * a_i / SV_i
ratio_i   = c_assay_i / c_est_i
            = 1 under preserve concentration
            = SV_i / SV_assay under preserve amount
withheld, with the reason in the cell, when SV_i is not recorded (never shown as 1)
```

The concentration-type quantity with SV not recorded is Q1, and the stock-volume quantity's concentration is Q2. Do not build either until answered.

### 5.5 Display (Task 6)

- Reuse C7's `numfmt.js` and `decimal.js` for half-away-from-zero rounding on the exact binary value. (C7's `format.js` is its notebook renderer and is not reused.) C7 has no standalone rounding tests, so Task 4 adds them: exact binary ties, values just below a decimal tie (for example 2.675, which is stored below 2.675), and each significant-figure boundary.
- C7's directed-rounding functions (`roundDecDirected`, `sigDirected`, `signedPctUp`, `gridDistance`) serve the upper-bound path, which is deferred. Remove them. Keep `parseEntered`; Task 4 reviews it against §5.3.
- Each pipetted volume is rounded from its own unrounded value (C5-DT-04).
- **The displayed total is the exact decimal sum of the displayed pipetted volumes** (C5-DT-04, C5-IV-01). Sum the displayed decimals with exact decimal arithmetic, not floats, and display that sum. It may carry more digits than 3 significant figures; that is correct.
- Every ratio, factor and fraction is stated in the direction of its physical consequence and labelled with the two quantities it compares (C5-DT-06). Half the established concentration reads as a ratio below 1.

### 5.6 Structured result (Task 7)

- C7's `src/shared/result-object.js` is C7-specific (tool ID, codes, schema `2.0.0-draft.c7`, bound label). Build C5's object on the same structure, with C5's codes and a C5 schema identifier. **If no tool-independent shared format exists for C5 to validate against (acceptance 4), that is the C5-OUT-03 escalation: stop and report in Task 7.**
- Every quantity carries its unit and its unrounded value (C5-UN-07).
- Flag scope must resolve to individual components (C5-OUT-03).
- It must express cell number and residual volume, with zero distinct from blank. **If the shared format cannot express these, stop and report. Do not extend it locally** (C5-OUT-03).

### 5.7 Validation and flags (Tasks 5 and 7)

- **Rejections:** C5-HI-01 to HI-11, except HI-07 which is withdrawn. Each message names the quantity and the physical reason. Generic messages fail acceptance 12. HI-06 lists every component and its volume. Zero assay cells is legal (a no-cell control).
- **Flags:** C5-FL-01, 02, 03, 04, 05, 07, 08, 09, 11 and 12. FL-06 is deferred. Flags never block the result. Each carries a machine-readable reason code and component scope. Payload wording follows the URS "Flag states" column.
- **Zero assay cells:** C5-FL-11's amount-per-cell ratio is withheld with its reason, and no non-finite value appears anywhere (C5-FX-19).
- **Cell-number consequence for FL-11:**
  - preserve amount: amount per cell changes by `cells_est / cells_assay`;
  - preserve concentration: amount per cell changes by `(SV_assay / SV_i) * (cells_est / cells_assay)`.

---

## 6. User interface

### 6.1 Page frame

Copy C7's frame unchanged: the header, the tool navigation, the footer, the consent banner, the fonts and the tokens. Then set:

- `<title>`: "Ligant · Master Mix";
- product and tool identification exactly as C5-NF-10 states.

Do not add Master Mix to the shared tool navigation; see §1.

### 6.2 Form (Task 8)

- **Spreadsheet-style rows.** One row per component, in entered order. Each row has a label, the intended quantity and unit, the stock concentration and unit, the established staining volume, the established cell number, and provenance.
- **One panel-level control:** "All components established at these assay conditions." It must behave as follows:
  1. It starts **unselected**. Nothing is filled until the user acts.
  2. When used, it sets **established staining volume and established cell number** on every row to the assay values, and shows those values in each row.
  3. Any row can then be overridden individually.
  4. The derivation records that the values were declared through this control.
  5. **It never sets provenance.** Provenance stays per row.
- **No default** for residual volume, overage or transfer basis. The basis control appears as required only when C5-CP-07 makes it required. When a declaration change makes the basis required, no cocktail is shown until it is selected (C5-ST-07).
- **Recompute on every change.** Nothing computed under a previous declaration survives unmarked (C5-ST-07, acceptance 17b).

### 6.3 The bounded block (Tasks 3 and 8)

At the reference viewport of 1366 × 650 CSS px (C5-NF-06), whenever any component is visible, the declaration summary and every raised flag must also be visible without scrolling (C5-NF-04). Implement this as a block that stays fixed in view above the component list.

- A flag naming components appears in the block as its **reason code and a count**, for example "C5-FL-01, 7 components". The names go below the component list (C5-NF-05).
- The block's height has a **stated upper bound** that holds for every combination of flags that can co-occur. Task 3 measures it.

### 6.4 Outputs (Task 9)

- Result table, per C5-UN-09.
- Derivation and relations, per C5-DT-02, C5-OUT-01 and C5-OUT-02.
- Ordered pipetting list, per C5-DT-05.
- On-page statements:
  - scope, per C5-OUT-05;
  - precision and rounding, per C5-OUT-06 and C5-UN-08;
  - composition not verified, per C5-OUT-07;
  - the two-cocktail note, per C5-CP-08;
  - the basis-not-required statement, per C5-CP-07.
- The §11 register, listing every constant with its value, basis and status, and the §9 failure list (C5-CN-01, C5-FC-01, acceptance 21).
- Printable bench sheet, with every flag in words and the residual volume shown even when zero (C5-OUT-09).
- Notebook copy, per C5-OUT-10.
- Visuals C5-VZ-01 to VZ-10, drawn as SVG from `result` only:
  - placed below the bounded block;
  - no animation;
  - colour for identity only;
  - legible in greyscale;
  - a withheld value drawn as a labelled gap, never at 1.
- Engine version on the output (C5-NF-09).

---

## 7. Testing

### 7.1 Commands

```
npm test              # all engine, invariance, mutation, storage-guard tests
npm run test:reimpl   # Python reimplementation agreement (acceptance 3)
npm run test:headless # Playwright headless checks in verification/headless
```

### 7.2 Test families

| Family | What it proves | URS |
|---|---|---|
| Units and comparison | Canonical integers; FX-13 pairs measured non-identical as floats and equal under the rule, with the measurement printed | C5-UN-10, UN-11, FX-13 |
| Rejections | Every HI condition, with message content asserted | §7, acceptance 12 |
| Fixtures | FX-01 to FX-24 and FX-27, except the deferred ones, against the standards in `tests/fixtures/` | §10 |
| Invariance | IV-01 to IV-06 | §6, acceptance 5 to 8 |
| Mutation | Inserted clamp, floor and nudge each detected | C5-IV-04, acceptance 9 |
| Reimplementation | JS and Python agree on unrounded values across the fixture set | Acceptance 3 |
| Storage guard | Source contains no `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie`, except the shared frame's `ligant_privacy_choice` | C5-ST-10 |
| Headless | After filling a full form: storage holds only the consent key, no cookies before consent, no request carries entered data | C5-ST-10, C5-NF-01 |
| Layout | Bounded block height and visibility at 1366 × 650 | C5-NF-04, NF-05, VZ-09, acceptance 23 |

### 7.3 Tolerances

The round-trip and unit-normalisation tolerances are open item 5, which precedes ship. Put them in one file, `src/engine/tolerances.js`. Mark each value `PROVISIONAL`, with a comment citing open item 5. Do not tune them to make a test pass.

### 7.4 Independence

Adacs writes the fixtures and the Python reimplementation. You do not read `reimpl/` to write the engine, and you do not change it to agree with the engine. Disagreement is a finding to report.

---

## 8. Tasks

Each task: build, run the listed checks, report in the §0.4 shape, and wait for acceptance.

### Task 2: Scaffold

1. **Repository.** Wait for A.B. to confirm `Ligant-AI/C5-Master-Mix` exists, then run `git init` in the empty `C5-Master-Mix/` folder.
2. **Copy C7's scaffold.** Use the layout in §4. Do not copy `.git`, `node_modules`, `dist`, C7's engine, UI logic, tests or `reimpl`. Keep the frame, tokens, fonts, `result-object.js`, `format.js` and its tests.
3. **Package and config.** Set `package.json` name to `ligant-master-mix`, the port to 5175 with `strictPort`, `config.js` to "Master Mix", ID "C5" and engine version `0.1.0`, and update the LICENSE and CITATION details for C5.
4. **Privacy text.** In the C7 repo, find the file the live privacy statement comes from (`grep -rn "Cloudflare Web Analytics"`). Copy the statement into `src/shared/privacy-statement.js` byte-for-byte. Record:
   - the source path;
   - C7's commit hash (`git rev-parse HEAD`);
   - the SHA-256 of the copied text.

   Add a comment saying the text is pending URS v1.0.1.
5. **Security headers.** Copy C7's `public/_headers` and its meta Content-Security-Policy unchanged in effect. **Rewrite the header comment** so it accurately lists what the policy allows: Cloudflare Web Analytics, and Google Analytics behind consent. C7's comment says "and nothing else", which is no longer true. Do not copy that line.
6. **Storage guard test.** Add the storage guard test, and one trivial engine test, so `npm test` runs.
7. **Headless smoke check.** Add `verification/headless/smoke.mjs`. It loads the page and prints:
   - the title;
   - any console errors;
   - all localStorage keys;
   - the sessionStorage length;
   - the cookie count.
8. **Commit and push.**

**Report includes:**
- the C7 commit hash you copied from;
- `git ls-files`;
- the privacy-text source path and hash;
- `npm test` output;
- the smoke output;
- `curl -sI http://localhost:5175/ | head -1`.

Leave the server running.

**Adacs checks in Chrome:** the frame on the production preview (port 4175) matches C7, and the CSP is identical in effect. The banner is checked at deploy.

### Task 3: Layout measurement (build gate)

1. **Static mock.** Build a mock of the page at 1366 × 650 with synthetic content. No engine yet.
2. **Worst-case bounded block.** Fill it with the full declaration summary and all ten 1.0 flags raised at once: FL-01, 02, 03, 04, 05, 07, 08, 09, 11 and 12, each shown as code plus count.
3. **Component rows and visuals.** Use placeholder component rows and the three visuals placed below the block.
4. **Headless measurement script.** Write `verification/layout/measure.mjs`. It sets the viewport to 1366 × 650, scrolls through the full range, and prints as JSON:
   - the block's height;
   - the viewport height left for components;
   - whether any declaration or flag ever leaves view.
5. **Proposals.** Propose:
   - a stated height bound for the block;
   - the maximum component count the layout can honestly present.

   A cap below real panel sizes is a design finding, so say so if that happens.

**Adacs checks in Chrome** at the same viewport. A.B. and NADIRA then set the bound and the cap. **The build gate closes here.**

### Task 4: Units and comparison

Implement `units.js` and `compare.js` per §5.3.

**Tests:**
- unit families and dimension rejection, including FX-27's three cases;
- canonical integers at 1 nL and 1 cell;
- the FX-13 measurement: find a pair that is non-identical as floats after normalisation but equal under the rule, and print the measurement;
- the UN-11 exact 1.

### Task 5: Validation (rejections)

Implement `validate.js` for HI-01 to HI-11, with message tests per acceptance 12.

### Task 6: Determination and display

Implement `determine.js`, `format.js` use and the display rules per §5.4 and §5.5. Leave out the Q1 and Q2 branches until they are answered.

**Tests:**
- fixtures from `tests/fixtures/`;
- invariance;
- mutation;
- `npm run test:reimpl` agreement with Adacs's Python.

**Acceptance 3 must pass before Task 8 begins.**

### Task 7: Flags and structured result

Implement `flags.js` and `result.js` per §5.6 and §5.7. Tests cover every flag, FX-09 (no flags), FX-11, FX-12, FX-19 and the shared-format validation.

### Task 8: Form and bounded block

Build the form per §6.2 and §6.3, using the bound set in Task 3.

**Headless checks:**
- the panel control's five behaviours;
- recompute on change;
- the basis-required gating;
- the storage and cookie checks;
- acceptance 20 (reload and re-enter reproduces exactly).

**Adacs then checks in Chrome**, including the two-minute first-use run (acceptance 22).

### Task 9: Outputs and visuals

Build the result table, the derivation, the statements, the register, the failure list, the bench sheet, the notebook copy and the visuals per §6.4.

**Headless checks:**
- every visual's labels equal the result's values (acceptance 27);
- no withheld value is drawn (acceptance 28);
- log symmetry of the ratio strip (acceptance 29);
- the bench sheet in print media contains every flag in words (acceptance 25).

**Adacs checks greyscale print in Chrome** (acceptance 30).

### Task 10: Acceptance run and build test record

Run the full acceptance list (§16), excluding 11, 17a and 31. Produce `verification/build-test-record.md`, reporting acceptance 22 first. Deploy steps and the deployed-address checks (acceptance 18 and 19) follow on A.B.'s instruction.

---

## 9. Git

- One commit per logical step.
- Each commit message cites requirement IDs, for example `C5-DT-04: displayed total as exact sum of displayed volumes`.
- Push to the private remote. Never force-push, and never rewrite history.
- Do not commit generated files, `node_modules`, `dist` or test output.
