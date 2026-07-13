# 0003 — codengine-runner-ts

Status: done

## Context

The first runner. It executes the IR ([plan 0001](0001-codengine-spec.md))
produced by [`codengine-parser`](../codengine-parser/) (plan 0002). It is the
reference implementation of the execution semantics
(`codengine-spec/semantics/execution.md`) and must pass the spec's `runs/`
fixtures (14 runs across 7 cases).

The runner is **dumb**: it trusts the precomputed `executionPlan` and only
resolves functions and applies the runtime rules. It depends on the **spec**, not
on the parser — it consumes IR JSON, so it mirrors the IR types itself rather than
importing them from `codengine-parser` (keeping parser and runner independent, as
the architecture requires).

## Goals

- `run(ir, functions, entry, input)` → `TaskData[] | null` (the `output` task's
  collected output, or `null`).
- Implement the full v1 semantics: cartesian fanIn merge, `fanInNullable`,
  **type-based** output classification (object / array / string / integer /
  null / false / true), string & index **routing** (Euclidean modulo, input
  transfer, no-match halt), passthrough, `^key` / `key$` I/O renaming.
- Pass every `runs/*.json` fixture.

## Non-goals

- Cross-workflow / cross-language `module` routing (future plan). v1 fixtures use
  `module: null`. The engine resolves functions by `task.function`.
- A workflow CLI (needs user-supplied functions) — later, likely in
  `codengine-cli`.

## Execution model (how the rules map to code)

Process the entry task's `executionPlan` in order. Each task ends in one of three
states: `TaskData[]` (ran, produced outputs), `null` (ran, produced no data — a halt
or a router), or absent/`undefined` (skipped, never ran). The distinction matters:

- A **required** fanIn that *ran and produced no data* (`null`) **blocks** the
  task (it is skipped). A fanIn that *never ran* (`undefined`) is treated as
  absent and does not block. This is what lets routing work: unselected router
  targets never run, so downstream joins proceed with whoever did.
- Inputs = cartesian product of the present (`TaskData[]`) fanIn outputs, each
  combination merged, plus the task's `args` (the run input replaces the entry
  task's args). A root task (no fanIn) runs once with `{}`.
- Output is classified **by type**, never truthiness (per the spec decision in
  plan 0001). Scalars route: a **string** selects a `routes[]` entry by label; an
  **integer** indexes `fanOut` with `((n % L) + L) % L`. The router transfers its
  own (input-formatted) input to the selected target; no match halts the branch.
- The `output` task is an ordinary task bound to identity; the run result is its
  collected output.

## Layout

```
codengine-runner-ts/
├── package.json / tsconfig.json
├── src/
│   ├── types.ts     # IR types (mirror of the JSON Schema; independent of parser)
│   ├── runtime.ts   # the executor
│   └── index.ts     # public API
└── test/
    └── conformance.test.ts  # bind the spec test-function catalog, run every runs/*.json
```

## Milestones

1. [x] Scaffold the module (pnpm workspace member, tsconfig).
2. [x] Implement the executor.
3. [x] Conformance test: bind the catalog, run every `runs/*.json` — **14/14 pass**.
4. [x] Verify: install + `--frozen-lockfile`, `tsc` (strict), tests green. README.

## Outcome / notes

- Zero runtime deps; dev deps `typescript` + `@types/node` (exact), shared via the
  pnpm workspace store. Tests via `node:test`.
- **Public data type named `TaskData`**: as an exported API type it reads
  self-documented in consumer code and ties to the "task" terminology.
- The three-valued task state — `TaskData[]` (produced), `null` (ran, no data),
  `undefined` (never ran) — is what makes routing compose with fanIn joins: an
  unselected router target never runs (`undefined`, absent, non-blocking), while a
  producer that ran and returned `null` blocks its required consumers. Both the
  string no-match and index-selection fixtures exercise this.
- IR types are mirrored locally (`src/types.ts`), so the runner depends on the
  spec/IR only — never on `codengine-parser`. (A future shared IR-types package
  could remove the small duplication between the two modules.)
