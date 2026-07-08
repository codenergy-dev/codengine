# 0002 — codengine-parser

Status: done

## Context

With IR v1 frozen ([plan 0001](0001-codengine-spec.md)), `codengine-parser` is the
first executable module: it turns yUML source into the IR and runs the **planner**
(`dependencies` / `executionPlan` / `entrypoint`). It is the canonical IR
producer — written in TypeScript so the VS Code extension can reuse it in-process,
and shipped as both a library and a CLI.

The legacy `yuml-parser` (Python) implements the same planner algorithm and was
used to generate the conformance fixtures, so this parser is a faithful port of
that algorithm plus the IR v1 additions the legacy never had:

- `path` → `module`, and the `{ version, workflow, tasks }` envelope.
- **`routes`**: labeled edges (`[a]keep->[b]`) for string routing. The legacy
  edge detector (`]->[` etc.) did not recognize a label between `]` and `->`, so
  it silently dropped labeled edges. The new edge parser reads the connector
  substring between the two nodes and extracts the label.

## Goals

- `parse(source, workflow)` → `WorkflowIR`, a faithful port of the legacy planner.
- A CLI (`codengine-parse <file.yuml | dir> [outDir]`) that writes `.json`.
- **Parser conformance**: parse every `codengine-spec` case's `workflow.yuml` and
  deep-equal the committed `workflow.json` (all 11 cases, including reproducing
  the hand-authored `routes` of `string-routing`).

## Non-goals

- No runner (that is `codengine-runner-ts`, plan 0003). This module does not
  execute anything.

## Toolchain & security (first application of the policy)

- **Package manager: pnpm 10** via corepack, pinned with `packageManager`.
- **Zero runtime dependencies.** Pure string/graph work.
- **One devDependency: `typescript`** (exact version). Tests use Node's built-in
  runner (`node:test`) — no Jest, no test-framework dependency.
- Root workspace hardening: `save-exact`, `engine-strict`, `onlyBuiltDependencies: []`
  (no install scripts), release-age cooldown (`minimumReleaseAge`), committed
  lockfile, `--frozen-lockfile` in CI.
- ESM, `NodeNext`, compiled with `tsc` to `dist/`.

## Layout

```
codengine-parser/
├── package.json        # lib (main/types) + bin (codengine-parse)
├── tsconfig.json
├── src/
│   ├── types.ts        # IR types (mirror of the JSON Schema)
│   ├── parse-value.ts  # port of the legacy value/type inference
│   ├── parse.ts        # yUML → raw graph → planner → IR
│   ├── index.ts        # public API
│   └── cli.ts          # CLI entry
└── test/
    └── conformance.test.ts  # parse each spec case, deep-equal its workflow.json
```

## Milestones

1. [x] Scaffold monorepo pnpm workspace + `codengine-parser` (config, tsconfig).
2. [x] Port the parser + planner + value inference to TypeScript.
3. [x] Add the label-aware edge parser and `routes`.
4. [x] Conformance test against all 11 `codengine-spec` cases — **11/11 pass**.
5. [x] CLI (`codengine-parse`), verified end-to-end against a spec fixture.
6. [x] Verify: `pnpm install` + `--frozen-lockfile`, `tsc`, tests green. README.

## Outcome / notes

- **Zero runtime deps.** Dev deps: `typescript` (5.9.2) and `@types/node` (22.20.1),
  both exact. Tests via `node:test` — no framework.
- **pnpm supply-chain config lands here.** `saveExact` (pnpm 10 moves this to
  `pnpm-workspace.yaml`; a root `.npmrc` `save-exact` alone did not apply to
  `pnpm add`), `minimumReleaseAge` (7 days), `onlyBuiltDependencies: []`, pinned
  `packageManager`, committed `pnpm-lock.yaml`, `--frozen-lockfile` verified.
- **Corepack note:** the corepack bundled with Node 22.12 (0.29.4) could not verify
  recent pnpm signatures ("Cannot find matching keyid"); fixed by
  `npm i -g corepack@latest` (0.35.0). Signature verification was kept on.
- **Workflow naming:** the CLI derives the workflow name from the file name; the
  library takes it as an argument. The conformance fixtures use the case
  (directory) name, so the suite calls the library API directly.
- Runner semantics are unaffected here — next is `codengine-runner-ts` (plan 0003),
  which executes this IR and must pass the spec's `runs/` fixtures.

## Verification note

Before writing the fixture-dependent test, confirmed the legacy `yuml-parser`
output for the committed `example.yuml` deep-equals the committed `example.json`
(modulo field renames). So a faithful port reproduces the anchor.
