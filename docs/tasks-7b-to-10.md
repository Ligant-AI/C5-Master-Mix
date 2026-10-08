# C5 Master Mix: Tasks 7b to 10, one continuous run

**From:** Adacs, lead engineer, relayed by A.B.
**Date:** 8 October 2026
**Applies on top of:** `CLAUDE.md` (revised 7 October), the accepted engine I/O contract, and every earlier review ruling.

Save this file as `docs/tasks-7b-to-10.md`, commit it, and work from it.

---

## 0. How this run works

You run **Tasks 7b, 8, 9 and 10 in order without waiting for a review between them.** Each task still has its own checks, its own commits and its own section in the final report. Adacs reviews once, at the end, in the terminal output and in Chrome.

The rules in `CLAUDE.md` §0.3 still apply in full. Two of them matter most in a long run:

- **Never resolve an ambiguity in code.** Log it as a question in the final report, with the requirement ID, and build around it. Keep going.
- **Never weaken a test.** A failing check stays failing and goes in the report.

### 0.1 Stop the run only for these

If any of these happens, stop, commit what you have, and report up to that point:

1. A change would touch analytics, the consent banner, the security headers or the privacy text.
2. A new runtime dependency seems necessary.
3. A requirement cannot be met as written, and building around it would leave a later task unbuildable.
4. Any acceptance 3 difference appears (`npm run test:reimpl` must stay at 0 differences after every engine change).
5. The layout assertions (block ≤ 260 px, slack ≥ 16 px at 1351 px) fail on the real page and the fix would mean changing a requirement rather than the layout.

### 0.2 Provisional items

Some decisions are still with A.B. or NADIRA. Build each one as stated below. Keep each in **one place in the code**, marked `PROVISIONAL` or `PENDING` with the item it waits for, so that it can be changed in one edit at the final review.

| Item | Build it as | Waiting for |
|---|---|---|
| Diluent length (bounded block) | No cap and no clamp. Keep the 400-character case in `measure.mjs` | A.B. and NADIRA |
| Q1, Q2 (no stock concentration), Q4 | Held, as now | NADIRA |
| Diluent exactly 0 at the 1 nL boundary | As built | NADIRA to confirm |
| FL-11 withheld at zero established cells | As built | NADIRA to confirm |
| Display precision of ratios and fractions | 3 significant figures | NADIRA, open item 8 |
| Unit catalogue | As built | NADIRA to confirm |
| FL-08 "unevaluated" when FL-08 is not raised | Show it in the derivation (§6.4 of `CLAUDE.md`), not in the bounded block, as: "Not evaluated for C5-FL-08 (established volume not recorded): …" | NADIRA |
| Privacy text | The current copy from C7, as Task 2 recorded | URS v1.0.1 |
| Tagline and meta description | Empty | A.B. |
| Engine version | 0.1.0 | A.B., at release |

---

## 1. Rulings on the Task 7 report

1. **The shared format: C5-OUT-03 escalation.** Your finding is correct: no tool-independent shared schema exists. Acceptance 4 is met by **recording the escalation**. Its own text says "or the escalation of C5-OUT-03 is recorded".
   - Record it in `docs/out-03-escalation.md`, citing the evidence you gathered (C1, C3, C4, C7, bench-chrome and the ADC).
   - Then build Task 7b **only if A.B. has approved it** (A.B. will tell you when relaying this file). If he has not, skip Task 7b, mark acceptance 4 as "met by recorded escalation" in the build test record, and carry on with Task 8.
2. **Typed input passed as an argument** to the concentration display and the flag wording: accepted until Task 7b, or permanently if 7b is skipped. Either way, document it in `docs/engine-io.md` only if the contract's output changes; otherwise not.
3. **FL-05 and FL-07 figures in the payload:** accepted. They are figures, not judgements, and they serve C5-DT-06.

---

## 2. Task 7b: C5's own structured result object (only if A.B. approves)

The suite has no shared format, as C1 and C4 already recorded. C5 does what they did: a **tool-specific, versioned** object with a published schema, and the escalation recorded. Do not invent a shared schema, and do not reuse C7's draft schema id.

- **Schema id** `ligant-benchtools-c5-master-mix`, version `1.0.0-draft`. Write the JSON Schema to `docs/schema/c5-master-mix-1.0.0-draft.schema.json`. Validate with Node only (a small validator written for this schema's subset, or none). **No new dependency.**
- **It carries** (C5-OUT-03, C5-ST-04, C5-UN-07):
  - every declaration exactly as typed plus unit, with blank, zero and "not recorded" distinguishable. This includes residual volume and cell numbers;
  - the transport (`entered`) and provenance per component;
  - every unrounded value of the contract's §2 output, with units;
  - every flag with component-level scope and its detail;
  - the selected stock units.

  Retire the extra arguments from 6c and 7 by reading them from this object.
- **It is built from `determine()`'s result and the input only.** It never recomputes a number (C5-OUT-04).
- **Tests:**
  - every result fixture produces an object that validates;
  - zero and blank residual are distinguishable (FX-08a and FX-08a-blank);
  - the FL-08 unevaluated list is present;
  - add a mutation that drops a flag's component scope.

---

## 3. Task 8: the form and the bounded block

Follow `CLAUDE.md` §6.2 and §6.3, and the Task 3 measurements.

### 3.1 Build

- **Move the mock's layout into the real page.** Use `mock.css` in `styles.css`, with the same `data-*` hooks. The real page must satisfy the same measurement as the mock.
- **Spreadsheet rows:**
  - "not recorded" is a choice in the unit dropdown;
  - transport is shown as a static "entered";
  - components can be added and removed;
  - **adding a 61st component is refused with a stated reason** (the component cap of 60, in the §11 register).
- **The panel control, "All components established at these assay conditions":**
  1. It starts unselected.
  2. When used, it sets the established staining volume and cell number on every row and shows them.
  3. Any row can then be overridden individually.
  4. Its use is recorded (`declaredByPanelControl`).
  5. It never sets provenance.
- **No defaults** for residual volume, overage or basis.
  - The basis control appears as required only when C5-CP-07 requires it.
  - When a change makes the basis required, no cocktail is shown until a basis is selected (C5-ST-07).
- **The minimum transfer volume** is pre-filled with 2 µL, marked as a suggestion, and records `defaulted` (C5-PC-01).
- **Recompute on every change** (C5-ST-07, acceptance 17b).
- **Incomplete, rejected and pending states** each show their messages. A blank field is never shown as an error.
- **Nothing the user enters is stored anywhere** (C5-ST-10). In-memory state only.

### 3.2 Bounded block

- **The block holds:**
  - the declaration summary;
  - every raised flag as its code plus count;
  - the CP-07 statement when the basis is not required.
- **Flagged component names** go below the component list.
- **Rerun `measure.mjs` against the real page**, with N = 4, 10, 20, 30, 40 and 60 and the 400-character diluent. The block must be ≤ 260 px, slack ≥ 16 px at 1351 px wide, with no truncated field, no horizontal overflow and no violations.

### 3.3 Headless checks (`verification/headless/form.mjs`, failing on any miss)

- **Panel control:** all five behaviours above.
- **Basis gating:** changing a declaration so the basis becomes required hides the cocktail until a basis is selected.
- **Recompute (acceptance 17b):** change each declaration in turn; no stale value remains unmarked.
- **Acceptance 17:** each required declaration, removed in turn, prevents a result.
- **Acceptance 20:** fill FX-01's input through the UI, record the output, reload, re-enter, and get an identical output, including the pipetting order.
- **Storage:** after a full session, localStorage holds only `ligant_privacy_choice` (if anything), sessionStorage is empty, and there are no cookies before consent.
- **Network (local, ahead of acceptance 18):** with request monitoring started before page load, type a sentinel value into every field, and confirm no request carries it.
- **Component cap:** the 61st add is refused with its reason.

---

## 4. Task 9: outputs and visuals

Follow `CLAUDE.md` §6.4. Everything is rendered from the result (and from the Task 7b object if it was built). **No renderer computes a number.**

### 4.1 Outputs

- **Result table** (C5-UN-09):
  - per component: volume per test, volume in the cocktail, concentration in the assay in the stock's unit, and the ratio, or the withheld reason in the cell;
  - the diluent;
  - the total, as the exact sum of the displayed volumes.
- **Derivation and relations** (C5-DT-02, OUT-01, OUT-02):
  - every declaration and every relation used, in words and symbols;
  - "the components fill the dispensed volume; no diluent" when it applies;
  - the FL-08 "not evaluated" line (§0.2).
- **The ordered pipetting list:** diluent first, then components in the order entered (C5-DT-05).
- **On-page statements:**
  - scope (OUT-05);
  - precision and rounding (OUT-06, UN-08);
  - composition not verified (OUT-07);
  - two cocktails (CP-08);
  - basis not required (CP-07, naming separately any component whose basis cannot be applied).
- **The §11 register** on the page, every row with its value, basis and status, including the 260 px block bound and the 60-component cap. Plus the **§9 failure list** (acceptance 21).
- **The bench sheet** (C5-OUT-09):
  - print stylesheet;
  - every flag in words;
  - the residual volume shown even when zero;
  - legible with the application closed.
- **The notebook copy** (C5-OUT-10, acceptance 26): every declaration, every flag in words, each component's volume and concentration, and the effective test count.

### 4.2 Visuals (C5-VZ-01 to VZ-10), SVG, below the bounded block

- **VZ-01, tube composition:** the declared zero residual drawn as a labelled zero-width segment.
- **VZ-02, cocktail composition:** to scale, with a **legend that grows with N and carries the C5-VZ-06 reason codes**, because segments become too thin to label at 60. No threshold, band or colour judgement.
- **VZ-03, ratio strip:**
  - log axis centred on 1, symmetric ticks;
  - the axis range is the §11 convention (0.25 to 4, extended to the next power of two beyond the data);
  - **the axis stays readable at N = 60**, either pinned (sticky within the strip) or repeated every 15 rows. Say which you chose;
  - a withheld ratio is an empty labelled row with its reason, never a mark at 1 (VZ-05).
- **VZ-06:** each flagged component carries its reason codes on every visual where it appears.
- **VZ-07:** colour encodes identity only, and never alone. No red-amber-green, gauges or scores.
- **VZ-08:** greyscale-legible, and present on the bench sheet.
- **VZ-10:** no animation and no progress indicator.

### 4.3 Headless checks (`verification/headless/outputs.mjs`)

- **Acceptance 27:** for every fixture, every value a visual labels equals the table's value for it.
- **Acceptance 28:** in FX-20, the withheld component has no mark in VZ-03, and a labelled empty row.
- **Acceptance 29:** in FX-21, ratios r and 1/r sit equidistant from 1, within 0.5 px.
- **VZ-01:** in FX-22, the zero segment exists and is labelled.
- **FX-23 at N = 60:** reason codes are present on every flagged component in every visual; the VZ-03 axis labels are in view whenever any VZ-03 row is; the VZ-02 legend lists every component.
- **Acceptance 25 and 26:** in print media, the bench sheet contains every flag's words; the notebook copy contains every required item.
- **Greyscale, ahead of acceptance 30:** emulate print media with a grayscale filter, and save screenshots of FX-24's bench sheet to `verification/print/` for Adacs.

---

## 5. Task 10: the acceptance run and the build test record

Fixtures v3 (supplied with this file) adds `C5-REF-01`, the four-component reference case for acceptance 1. Install it unchanged, as before, and rerun `npm run test:reimpl` (expected: 46 fixtures, 0 differences).

Write `verification/build-test-record.md`. It has **one row per acceptance item, 1 to 30**, excluding 11, 17a and 31 (deferred). Each row gives: the item, the result (pass / fail / pending), the evidence (the command, plus the output file or commit), and the date.

- **Acceptance 22 is reported first.** It needs a first-time human user. Mark it **pending: A.B. user test**. Do not simulate it.
- **These items are marked pending, not passed:**
  - **acceptance 18 and 19:** pending deploy (the deployed-address checks);
  - **acceptance 23:** pending Adacs's Chrome check;
  - **acceptance 30:** pending Adacs's Chrome check.

  Your headless evidence for each still goes in the row.
- **Acceptance 4:** "met by recorded escalation" (and the schema validation, if Task 7b was built).
- **Acceptance 21:** the register and failure list are on the page; the privacy text is marked "pending URS v1.0.1".
- **Every other item** must show pass with evidence, or fail with the output.

Then build the production bundle, start the preview on 4175, and leave it running with the real page (not the mock).

---

## 6. The final report

Use one report, in the `CLAUDE.md` §0.4 shape, with a section for each of Tasks 7b, 8, 9 and 10. Each section includes:

- the commands and their raw output;
- the commits;
- the questions;
- anything you built differently from this file, and why.

End with:

- `npm test`, `npm run test:reimpl`, `node verification/mutation/run.mjs`, `npm run measure:layout`, and both headless scripts: counts and exit codes;
- the build test record table;
- the list of `PROVISIONAL` and `PENDING` markers in the code (`grep -rn "PROVISIONAL\|PENDING" src`);
- the preview URL.
