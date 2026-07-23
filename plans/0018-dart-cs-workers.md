# 0018 — Dart and C# workers

Status: done

## Context

Plan 0017 delivered cross-language execution on the server: one authoritative engine
(TS) + a **warm worker** per foreign language, over the subprocess transport. Only
`py` was wired. This plan adds the `dart` and `cs` workers, completing the four
languages as *callable* participants in a mixed run.

## The shape per language (the reflection split again)

- **C# — reflects.** `codengine-worker-cs` is a console app that reuses
  `loader-cs` (build the module's project + reflect its assembly) and serves
  `load` / `call` / `callChain`. Straightforward, exactly like `worker-py`.
- **Dart — no reflection (AOT).** The functions cannot be discovered at runtime, so
  the worker must be **generated glue**, just like the Dart runner. Split:
  - `codengine-worker-dart` — a library exposing `serve(ModuleFunctions)`: the
    line-delimited request loop. Knows nothing about the user's code.
  - `codengine-generator-dart` gains `bin/worker.dart`: writes glue that imports the
    user's files, builds the function map (via the loader's `mergeFunctions`), and
    calls `serve(...)`. It prints the glue path so the orchestrator can spawn it.
  So for Dart, `load` is an acknowledgement — the functions were baked in at
  generation time.

## Orchestrator wiring

`spawnWorker` becomes async and grows two cases:

- `cs` → `dotnet <codengine-worker-cs.dll>` (env override `CODENGINE_WORKER_CS_DLL`,
  else the monorepo build output — same resolution the C# runner uses).
- `dart` → run the generator's worker entrypoint to write the glue into
  `<root>/.codengine/`, then spawn `dart run <glue>` in the module's package.

## Steps

1. [x] `codengine-worker-cs` (Exe; ProjectReference `core-cs` + `loader-cs`).
2. [x] `codengine-worker-dart` (`serve`) + `codengine-generator-dart/bin/worker.dart`
   (refactored the generator to share the binding machinery between run-glue and
   worker-glue).
3. [x] CLI: async `spawnWorker` grouping modules per language; the `cs`
   (`dotnet <worker>.dll`, env override `CODENGINE_WORKER_CS_DLL`) and `dart`
   (generate worker glue, then `dart run <glue>`) cases.
4. [x] Cross-language fixtures + tests: TS engine + C# worker, TS engine + Dart worker.
   **CLI 16/16, all four cross-language tests run (0 skipped).**
5. [x] Docs: AGENTS module table + cross-language note, README roadmap, worker READMEs.

## Outcome / notes

- **All four languages are now callable in a mixed run.** The reflection split held:
  `worker-cs` mirrors `worker-py` (load + reflect); `worker-dart` is a `serve(...)`
  library driven by generated glue, since Dart AOT can't discover functions.
- `spawnWorker` groups a language's modules so its worker starts once — required for
  Dart (all its modules are baked into one glue) and cheaper for the others.
- Known limits unchanged: the orchestrator engine is TS; the transport is subprocess
  (a `remote` transport and non-TS orchestrators are the next increments).

## Notes

- The workers are proven **end-to-end through the CLI** (like `generator-dart`), since
  a standalone test would have to build a user project anyway.
- The `callChain` semantics are identical everywhere: feed each object result forward,
  stop at the first non-object and hand it back with its input for the engine to
  classify. All branching stays in the one engine.
