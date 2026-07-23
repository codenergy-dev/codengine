# 0017 — Cross-language execution: engine/executor split + transport

Status: done

## Goal (Tier 1, server-first)

Let a single run resolve tasks in **different languages**, marshaling each boundary's
input/output as JSON. Server target, `subprocess` transport first (persistent
workers), `remote` next, all behind a **pluggable transport abstraction**.

## Decision: Option C (one authoritative engine + warm workers)

Chosen with the user, in plain terms:

- **One authoritative engine** owns the whole graph and *all* branching semantics
  (fan-out, routing, fan-in). Never duplicated into a coordinator.
- Each foreign language runs a **persistent worker** (a "warm kitchen"): the module's
  project is loaded **once** and kept alive; the engine sends it many cheap calls.
  This — not the graph model — is what answers the performance worry (no reload per
  call).
- **Per-task** is the primitive: the engine calls an **executor** per task; a foreign
  task's call crosses to its worker. **Linear-segment batching** is the optimization:
  a contiguous, single-in/single-out, same-language, no-args/no-directive stretch is
  sent in one message so the worker runs it end-to-end (continuous execution).

Rejected Option B (partition + coordinator): a fan-out/route/fan-in whose edge crosses
a boundary would force the coordinator to re-implement branching — a "fifth engine".

## Where things live

- **Foreign side — `codengine-worker-<lang>`** (new package per language, under
  `codengine-<lang>/`). A persistent process that loads a module's functions via the
  **loader** and answers `{ call | callChain } → { result | error }`. Depends on
  `loader` + `core`; **not** the engine. An **optional** role (like `generator`) — a
  language needs it only to be *called* cross-language.
- **Orchestrator side** — the **executor** abstraction + **transport** selection live
  with the engine/CLI (where `select.ts` / `subprocess-runner.ts` already are). The
  engine calls `executor.execute(module, fn, input)`; the executor routes per module
  to in-process or a worker transport.

Single-language runs keep their current fast path unchanged (TS in-process; py/dart/cs
whole-workflow subprocess). Only **mixed-language** runs use the engine+worker path.

## Steps

1. [x] **Executor seam (TS engine).** `Executor` type in `core-ts`; `run` is async and
   takes an `Executor`; `inProcessExecutor(ModuleFunctions)` in `runner-ts`. Pure
   refactor — runner-ts conformance **16** + CLI stay green.
2. [x] **Transport abstraction.** A `WorkerClient` (persistent subprocess) + a
   `RoutingExecutor` route each task to in-process (TS) or a warm worker (foreign).
3. [x] **Workers.** `codengine-worker-ts` + `codengine-worker-py`: persistent
   request/response over stdio (line-delimited JSON: `load` / `call` / `callChain`),
   reusing the loader. The Python invocation binding moved to `loader-py` (`invoke`)
   so the worker reuses it without depending on the runner.
4. [x] **Lifted the single-language guard.** A mixed-language manifest builds a routing
   executor (TS in-process, a warm worker per foreign language) driven by the TS
   engine. Cross-language fixture + test (TS engine + Python worker) green.
5. [x] **Linear-segment batching** (`callChain`) — a straight-line, same-module,
   no-args/no-directive segment is sent in one call; the worker feeds each object
   result to the next and hands back the first non-object (with its input) for the
   engine to classify. Guarded; in-process executor has no `executeChain`, so
   single-language conformance is untouched.

Dart/C# workers follow later in the same mold.

## Outcome / notes

- **Cross-language on the server works** (TS engine + Python worker, per-task and
  batched-chain). The engine stayed the single authority for all branching; the worker
  is a warm executor that never sees the graph.
- The engine is async only in the orchestrator (TS); the four ported engines are
  unchanged for single-language fast paths. The wire format is the already-normalized
  JSON `TaskData`.
- The invocation binding now lives in `loader-py` (`invoke`), shared by the runner's
  engine and the worker — one home for the invocation contract.
- Known limits: only `py` has a worker wired into the orchestrator so far (a mixed run
  with `dart`/`cs` errors clearly); the orchestrator engine is TS. Dart/C# workers and
  a `remote` transport are the next increments.
- Batching correctness rests on the static segment guard (no args/directives, strictly
  linear, `output` never an intermediate) + the worker stopping at the first non-object
  and returning its input, so fan-out/routing/halt still resolve in the engine.
