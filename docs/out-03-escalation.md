# Escalation (C5-OUT-03): no shared result format exists

**Raised** 8 October 2026, by the builder, in the Task 7 report. **Recorded** at Adacs's ruling (Tasks 7b to 10 brief, §1, ruling 1), for A.B. and NADIRA.

C5-OUT-03 requires a structured result object "in the shared format", expressing cell number and residual volume, and requires that "if the format cannot, stop and escalate rather than extending it locally". Acceptance 4 is met by a structured object validating against the shared format "or the escalation of C5-OUT-03 is recorded". This file is that record.

## Finding

No tool-independent shared schema exists for C5 to produce or for acceptance 4 to validate against. Each tool that produces a structured object validates against its own schema, and the two that share a name disagree on fields.

## Evidence (read at source, 8 October 2026; nothing was modified)

| Where | What it is |
|---|---|
| `bench-chrome` (`@ligant/bench-chrome` 1.1.0, `src/`: `index.js`, `consent.js`, `react.js`, `chrome.css`) | The shared frame. No result schema, no validator, no format definition. |
| C1, Molarity Converter (`Ligant.ai-Molarity-Converter/src/lib/serialise.ts`) | The only live producer. Its own schema, `ligant-benchtools-c1-conversion`. Its header records that the format C1-OUT-04 required, the Antigen Density Calculator's, "does not exist". |
| Antigen Density Calculator (`Ligant.ai-Antigen-Density-Calculator`) | Exports CSV and SVG only. No JSON result object, no schema (as C4's finding below also records). |
| C3, Dilution Planner (`src/shared/result-object.js`) | `ligant.bench-tools.result`, version `1-c3`, with the schema as a string. Its header: the shared format "was NOT in the build package"; it validates its own draft "until open item 8 is closed". |
| C4, Antibody Titration Planner (`src/lib/serialise.ts`, `src/lib/schema.test.ts`, `docs/open-item-08-shared-format-finding.md`) | Its own schema, `ligant-benchtools-c4-series`. Escalated on 14 September 2026: "the shared result object cannot express a series"; "the schema this validates against is C4's own". |
| C7, Reconstitution (`src/shared/result-object.js`, `docs/escalation-tool-field.md`) | `ligant.bench-tools.result`, version `2.0.0-draft.c7`, "draft until outstanding item 8 publishes the version". Escalated on 28 September 2026: `tool` is an object in C1 and C7 and a string in C3; `schema` is `{ name, version }` in C1, C4 and C7 and a string in C3; the format name is unagreed; and `{ value, unit }` carries an unrounded double in C1 and C4 but entered text in C3 and C7. |

## Consequence for C5, and what is built instead

C5 does not invent a shared schema and does not extend any tool's schema locally. Following the C1 and C4 precedent, and only on A.B.'s approval (given 8 October 2026, relayed with the brief), C5 produces a **tool-specific, versioned** object:

- schema `ligant-benchtools-c5-master-mix`, version `1.0.0-draft`, published as `docs/schema/c5-master-mix-1.0.0-draft.schema.json`;
- it expresses cell number and residual volume, with zero distinct from blank, every unrounded value with its unit, and every flag with component-level scope.

It is not the shared format. Acceptance 4 is recorded as **met by recorded escalation**, with the C5 object's validation against its own schema as supporting evidence.

## Decision needed (A.B. and NADIRA; open item 8 of the tool set)

Whether, and when, a shared format is published; and, once it is, whether C5's object is migrated to it at a new schema version.
