# 0007 — Analyzers and task definitions

Status: done (analyzers built; vscode is a later plan)

## Context

For `codengine-vscode` to offer autocomplete / intellisense / validation over a
workflow, it needs each referenced function's **signature** — the named
parameters (kind, required, nullable, default). This is the static counterpart of
the [invocation contract](0006-function-invocation-contract.md): the runner binds
declared parameters at run time; the editor must discover the same parameters
statically.

This must use each language's **native tooling** (TypeScript Compiler API, Python
`ast`, Dart `analyzer`, C# Roslyn), never regex — so it mirrors the runner
architecture: per-language **analyzer** modules emitting a neutral artifact, a
**task definition**, orchestrated by the editor (in-process for TS, subprocess for
others). The analyzers are libraries in their own right (the CLI could validate a
workflow before running; CI could check it).

Design decisions locked with the user: split into per-language analyzers; the
neutral schema lives in `codengine-spec`; modules named `codengine-analyzer-<lang>`;
the artifact is a **task definition**.

## The task definition (neutral artifact)

An analyzer reads a functions module and emits, per exported/top-level task
function, a task definition:

```jsonc
{
  "version": "1",
  "language": "py",            // which analyzer produced it
  "definitions": [
    {
      "name": "resize",
      "params": [
        { "name": "width",  "kind": "number", "required": true,  "nullable": false },
        { "name": "height", "kind": "number", "required": false, "nullable": false, "default": 100 },
        { "name": "ratio",  "kind": "number", "required": false, "nullable": true,  "default": null }
      ],
      "acceptsExtra": false     // has a catch-all (**kwargs / index signature)
    }
  ]
}
```

- `kind` is a **neutral** vocabulary — `number | boolean | string | array |
  object | any` — mapped from each language's types (Python `int`/`float` →
  `number`, TS `number` → `number`, `str`/`string` → `string`, …). Keeping it
  neutral is what lets one `expected.json` be shared across languages (true parity).
- `required` = has no default. `nullable` = the type admits null/None (separate
  axis from optional). `acceptsExtra` = the function receives keys beyond its
  declared params (Python `**kwargs`; TS index signature / `Record` / rest).
- What counts as a "task function" mirrors the runner's discovery (Python
  top-level functions; TS exported functions) — the analyzer describes exactly
  what the runner would bind.

Native display types, docstrings, and source locations are deferred (a
`codengine-vscode` enhancement); v1 is the neutral signature only.

## Build order

Spec first, then analyzers, then the editor — as before. Implementing
`analyzer-py` first (stdlib `ast`, simplest) validates the schema and fixtures
quickly; `analyzer-ts` (TS Compiler API) follows and proves parity against the
same `expected.json`. `source.ts` fixtures are written now so they are ready.

## Milestones

1. [x] `codengine-spec`: `schema/task-definition.schema.json` + analyzer
   conformance (`conformance/analyzer/<case>/{source.ts, source.py, expected.json}`)
   for `basic`, `optional-and-nullable`, `catch-all`.
2. [x] `codengine-analyzer-py` (`ast`) — **3/3** conformance; `python -m
   codengine_analyzer` subprocess entrypoint verified.
3. [x] `codengine-analyzer-ts` (TS Compiler API) — **3/3** against the same
   `expected.json` (parity with analyzer-py). CLI subprocess verified.
4. [ ] `codengine-vscode` consumes task definitions. *(next plan)*

## Outcome

- **Descriptor parity proven.** `analyzer-ts` and `analyzer-py` both produce the
  identical language-neutral `definitions` for `basic`, `optional-and-nullable`,
  `catch-all` — the analyzer analogue of the runners passing the same `runs/`.
- Task-definition v1 is neutral (kind vocabulary, not native types); `required` =
  no default, `nullable` = type admits null, `acceptsExtra` = `**kwargs` / index
  signature. This is the static counterpart of what the runners bind at run time.
- `analyzer-py`: stdlib `ast`, zero deps, `unittest` in a venv, `python -m
  codengine_analyzer` subprocess.
- `analyzer-ts`: **first module with a third-party runtime dependency**
  (`typescript`, pinned exact) — unavoidable and appropriate, since parsing TS
  correctly means using the TS compiler. Still governed by the pnpm supply-chain
  policy (cooldown, exact pin, no install scripts).
- Both expose the same lib + subprocess shape as the runners, so `codengine-vscode`
  will orchestrate analyzers exactly like the CLI orchestrates runners.

## Non-goals (now)

- Return-shape / connection validation (needs richer per-language type inference).
- Dart/C# analyzers (codegen / Roslyn) — the contract is written down; modules later.
