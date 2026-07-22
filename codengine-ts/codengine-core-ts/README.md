# codengine-core-ts

The codengine **contract** for the TS/JS family, in code — the code-level mirror of
[`codengine-spec`](../../codengine-spec/). No logic, no I/O; just the types every
other package in the family shares.

- `ir.ts` — the **execution contract**'s graph types: `Route`, `Task`, `WorkflowIR`
  (mirror of `workflow.schema.json`).
- `execution.ts` — `TaskData`, `TaskFunction`, `FunctionMap`, `ModuleFunctions`.
- `task-definition.ts` — the **description contract**: `Kind`, `Param`,
  `TaskDefinition`, `TaskDefinitions` (mirror of `task-definition.schema.json`), the
  types the analyzer produces and a generator would consume.

Every other TS package depends inward on this one: `analyzer`/`loader`/`runner` and
the CLI import their types from here instead of from each other.
