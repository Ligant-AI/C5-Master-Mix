# C5 fixtures (supplied by Adacs; do not edit)

Written from URS v1.0 §10 and the accepted engine I/O contract (`docs/engine-io.md`, with the Task 6a amendment). Each file is one fixture:

```
{ "id", "title", "standard", "assumptions", "ui", "input", "expect" }
```

- `input` is exactly the contract's input object (§1.3).
- `assumptions` is the C5-FX-15 statement: exact ties at displayed precision, power-of-two ratios, symmetric inputs, and a note.
- `ui: true` marks the Task 9 fixtures (C5-FX-20 to 24). For those, the engine assertions below still apply; the visual standards are checked by the Task 9 headless checks and Adacs in Chrome.
- Deferred fixtures (C5-FX-10, 17, 25, 26) are not supplied. `PENDING-Q*` files are not URS fixtures; they pin the held branches for acceptance 3.

## `expect` keys (all optional except `status`)

| Key | Meaning |
|---|---|
| `status` | `result`, `incomplete` or `rejected` |
| `basisRequired` | exact boolean |
| `flags` | the complete flag list, compared on `code` and `components` only |
| `flagCodes` | `{code: components}`: these flags present with exactly these components |
| `flagsAbsent` | these codes not raised |
| `flagDetail` | `{code: {key: value}}`: exact match on the named detail keys |
| `values` | `{path: value}` into `values`, e.g. `components[2].ratio`; exact equality (these are literals or exact binary values) |
| `rejections` | the ordered list of `{code, component?}` |
| `incomplete` | the set of `{field, reason, component?}` |
| `display3sf` | hand-calculated displays at 3 s.f.: `volumeInCocktail_uL` (entered order), `diluentTotal_uL`, `displayedTotal_uL`. **Compare as decimal numbers, not strings** (`"1770"` equals a display of `1770` or `1.77 × 10³`) |
| `displayedTotalMustDifferFrom` | the display of the unrounded total, which the displayed total must NOT equal (C5-FX-04) |
| `sameValuesAs` | every unrounded number in `values` equal to the named fixture's (C5-IV-06), except concentration units |
| `sameNumbersAs` | the panel and component volumes equal to the named fixture's (C5-IV-05); `basisApplied` and `scaleFactor` may differ |
| `relations` | named invariance checks to run on this fixture, e.g. `C5-IV-03` |
| `allFinite` | every number in the output is finite |
| `minFlagCount` | at least this many distinct flags |

## Acceptance 3 (with `reimpl/`)

For every fixture, run the engine and `python3 reimpl/c5_reimpl.py --fixture <file>`, and compare:
- results: every unrounded number in `values` and in flag details, relative difference within the PROVISIONAL tolerance (open item 5); booleans, strings, nulls and withheld markers exactly; flags on `code`, `components` and detail;
- non-results: `status`, the ordered `(code, component)` list and the `(field, component, reason)` set (contract §3). Messages are not compared.

Report every difference, however small, with its magnitude. Exact agreement is expected wherever the contract fixes the order of computation. **A difference is a finding, not something to tune away.** Never edit `reimpl/` or a fixture to make a test pass.
