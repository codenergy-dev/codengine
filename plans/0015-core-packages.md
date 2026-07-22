# 0015 — `core` packages: the contract, per language

Status: done

## Context

The role invariant is now explicit: every language family has **analyze + load +
run** (mandatory) and **generate** (optional — only reflection-less compiled targets
need it). But packaging drifted: TS/Dart extracted a `loader-*` package while Py/C#
folded loading into the runner, and the neutral contract types had no single home
(e.g. the CLI imports `TaskData`/`WorkflowIR` from `codengine-runner-ts` **just for
the types**, dragging the whole engine along).

The fix is a **`codengine-core-<lang>` package**: the code-level mirror of
`codengine-spec`. `spec` is the neutral contract as JSON/Markdown; `core-<lang>` is
the same contract as that language's types. Both of the system's contracts live
there:

- **Execution contract** — the IR types (WorkflowIR/TaskIR/RouteIR), `TaskData`,
  `TaskFunction`, JSON normalization, `MissingInputError`.
- **Description contract** — the *task definition* types (`Kind`, `Param`,
  `TaskDefinition`, the document shape). These are shared because the **generator
  consumes the description** the analyzer produces (proven today:
  `generator-dart` reads `def['name']`/`def['params']`).

## The standard family (decided with the user)

```
codengine-<lang>/
  codengine-core-<lang>       (mandatory)  — both contracts
  codengine-analyzer-<lang>   (mandatory)  → core   (produces the description)
  codengine-loader-<lang>     (mandatory)  → core
  codengine-runner-<lang>     (mandatory)  → core
  codengine-generator-<lang>  (optional)   → core   (consumes the description)
```

Dependencies point **inward** to `core` (a shared kernel), replacing the implicit
"loader/CLI depend on the runner's types" coupling. `analyzer` and the execution
side become siblings on `core`, not a chain.

Per-language weight is asymmetric and that's expected: **TS and C# are statically
typed**, so their `core` is substantial (real IR + task-definition types, and for C#
the JSON normalization). **Python and Dart** use the IR as a native dict/`Map`, so
their `core` is thinner (type aliases/typedefs + `MissingInputError` + the
description types). The *rule* is uniform even when the *volume* is not.

## Invariant to protect

- `core` = the contract (both halves). No graph logic, no reflection, no I/O.
- `analyzer` = description contract (produce). Independent of the execution side.
- `loader` = bind functions into a callable map (uses `core`).
- `runner` = execute the IR (uses `core`; may use `loader`).
- `generator` = write glue from the description (uses `core`); only when the target
  runtime lacks reflection.

Behaviour must not change: every runner/analyzer keeps passing its **existing
conformance suite** — that is the safety net for the whole refactor.

## Milestones (one language at a time, conformance-gated)

1. [x] **C#** — the exemplar fat core. `core-cs` = `Ir` + `JsonValue` + `TaskFunction`
   + `MissingInputError` + task-definition records/converter. Extracted `loader-cs`.
   Wired `analyzer-cs`/`loader-cs`/`runner-cs` → `core-cs` (ProjectReferences, no
   NuGet, still offline). Conformance **16/16 + 2/2**, CLI C# end-to-end green.
2. [x] **TS** — pure type move. `core-ts` = `ir.ts` + `execution.ts` +
   `task-definition.ts`. Deleted runner-ts/analyzer-ts `types.ts`; repointed
   runner-ts/loader-ts/analyzer-ts/CLI imports; the CLI no longer pulls the runner
   just for types. All JS suites green (parser 15, manifest 8, runner-ts 16,
   analyzer-ts 3, cli 12).
3. [x] **Python** — `codengine_core` (type aliases + `MissingInputError` +
   `TaskDefinition` TypedDicts). Extracted `codengine_loader` (+ its test/fixtures).
   Editable installs in the venvs. runner-py **20** + loader-py **3** + analyzer-py
   **3** (the 26 redistributed).
4. [x] **Dart** — `codengine_core` (execution typedefs + description typedefs). Wired
   runner/loader/analyzer/generator → core via pubspec path deps; the runner
   re-exports the types so the glue is unchanged. `dart analyze` clean; conformance
   **16/16 + 2/2**, CLI Dart end-to-end green.
5. [x] **Docs** — AGENTS.md: the role/packaging invariant, the inward DAG, and the
   updated per-language table. New package READMEs; family READMEs (cs/dart) updated.
   `pnpm-workspace.yaml` needed no change (core-ts under `codengine-ts/*`). Fixed
   0014's "five languages" → four.

## Outcome / notes

- The role invariant is now real *and* documented: **core + analyzer + loader + runner
  mandatory, generator optional**, with dependencies pointing inward to `core`. The
  loader is a first-class package in every language (Python/C# no longer fold it into
  the runner).
- `core` carries **both** contracts — execution and description — so the generator
  (which consumes task definitions) and the analyzer (which produces them) share one
  definition of the shape. Proven by wiring `analyzer`→`core` and `generator`→`core`.
- Behaviour was preserved throughout: every conformance suite that passed before still
  passes, unchanged.
- `core` volume is asymmetric as predicted: fat for TS/C# (real IR + task-definition
  types, C# also JSON normalization), thin for Python/Dart (aliases/typedefs).

## Notes / risks

- Keep each step behaviour-preserving; run that language's conformance before moving on.
- C#: `runner-cs` gains ProjectReferences to `core-cs` + `loader-cs` — still no NuGet,
  still offline. The subprocess `Main` stays in `runner-cs`.
- Python: three installable packages now (`codengine_core`, `codengine_loader`,
  `codengine_runner`); the runner venv installs all three editable so
  `python -m codengine_runner` resolves them.
- Dart: the fixture pubspec transitively pulls `codengine_core`; re-run `pub get`.
