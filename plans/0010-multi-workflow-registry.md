# 0010 — Multi-workflow registry and cross-workflow calls

Status: done

## Context

Until now a run is a single workflow. `yuml-runner-js` supported many workflows in
one instance, with cross-workflow calls via dotted tasks. We are bringing that in
**consolidated** — not ported verbatim, because the legacy model is more confusing
than it needs to be (its own author included).

## The model (aligned with the user)

Refined from the legacy, and simpler:

1. **Modules export functions**; **workflows chain functions**. They are
   **independent** — a workflow is *not* a module (the legacy coupled them via
   `module = path ?? workflow`; we drop that).
2. **Address** = `(module, task name)`, where the name embeds the **overload**:
   `images.echo:seed` ≠ `images.echo` ≠ `echo:seed`. The **function** executed is
   derived from the address (before `:`, after the last `.`); `module: null` → the
   manifest's default module `""`.
3. **Overloads are allowed**: several aliases of the same function may each be an
   entrypoint (e.g. `echo:seed` and `echo:origin` in `reversal`).
4. **Absolute rule**: an address may be an entrypoint in **at most one** workflow
   in the whole project. Duplicate names are fine *except* when they collide on an
   entrypoint — that would make the chain ambiguous. Conflict → loud error, like
   duplicate function names (plan 0009).
5. **Calling an address that is an entrypoint** triggers that workflow's chain.
   **Non-entrypoint, or not declared in any workflow** → a unit call (just that
   function). The chain's workflow is **discovered** by the entrypoint index — it
   is never named explicitly.
6. Sub-run results are **mirrored back** into the calling workflow's tasks at the
   same addresses, so the caller's graph can consume them.

### Dropped from the legacy

- **The dotted-entrypoint special rule** (`entrypoint and module and (fanIn > 0 or
  fanOut == 0) → false`). It existed only to encode the legacy's *shape-based*
  event trigger (a dotted task with no fanIn = "trigger"). Events become explicit
  syntax later (see below), so entrypoint is now uniform: **no fanIn → entrypoint**,
  dotted or not. No current fixture has a dotted task, so nothing changes today.
- **The event emitter as glue.** The legacy mirrored sub-run results through
  events + run ids + a `SKIP` state. We instead have the sub-run **return** its
  task outputs and the caller copy them in — deterministic, and portable to Python
  with no event system.

### Deferred (with a distinction we must not lose)

- **Event syntax** (e.g. `[a]+->[b]`): "whenever `a` runs anywhere, replicate its
  output to `b`" — a broadcast/subscription, not a call. This replaces the legacy's
  shape-based trigger.
- **Events, later, serve two different needs — do not conflate them:**
  - *Observability* (debug, stream, audit) → a passive observer over the engine;
  - *Synchronization* (make a workflow wait for one or more executions before
    continuing its `executionPlan`) → this **changes the engine**, it is not an
    observer. Sizing it as "just an event" would be a mistake.

## Changes

1. **Parser**: drop the dotted-entrypoint rule.
2. **Runners (ts + py)**: a **registry** of workflows. `run` takes many IR
   documents, plus functions keyed **by module**. Resolve an address → its
   entrypoint workflow (or a unit call); mirror sub-run results back.
3. **Manifest/CLI**: `workflows` becomes live — a glob list, exactly like
   `functions`. The CLI takes a list of workflows (comma-separated globs,
   positional) and `--entry <address>`; `--entry` may be omitted only when the
   registry has exactly one entrypoint.
4. **Conformance**: multi-workflow cases (several IRs per case) + `runs/*.json`
   gaining the entry address. Assert **by output**, using trail-accumulating
   catalog functions (`export const a = ({ trail = [] }) => ({ trail: [...trail, "a"] })`)
   so "which tasks ran" is provable language-neutrally, without a trace API.

## Milestones

1. [x] Parser: dropped the dotted-entrypoint rule; entrypoint is uniform. No
   fixture changed.
2. [x] Spec: conformance moved to `cases/<case>/workflows/<name>.{yuml,json}`
   (uniform — a single-workflow case is the trivial registry, and the "dir name =
   workflow name" hack is gone). Added `cross-workflow-entrypoint` and
   `cross-workflow-unit`, the two behaviors the legacy `path.test.ts` pins.
   Semantics + catalog documented.
3. [x] `codengine-runner-ts`: registry, entrypoint index (with the uniqueness
   conflict), address resolution, delegation + mirroring, per-module functions —
   **16/16**.
4. [x] `codengine-runner-py`: same, against the same fixtures — **parity**.
5. [x] CLI + manifest: workflow globs (`workflows` is now live), `--entry` as an
   address, all manifest modules resolved — `codengine-cli` **8/8**,
   `codengine-manifest` **8/8**, `codengine-parser` **15/15**.

## Outcome / notes

- **The two legacy behaviors are reproduced and proven by output**, not by a trace
  API: `cross-workflow-entrypoint` → `trail: [start, a, b]` (an entrypoint address
  runs its whole chain); `cross-workflow-unit` → `trail: [start, d]` (a
  non-entrypoint address runs alone).
- **A task that is not an entrypoint elsewhere just executes locally** — so the
  legacy's "unit call" needed no special machinery: a local task and a reference to
  a non-entrypoint address are the same thing. This fell out of the decoupled model.
- Verified on the real bin: a project whose manifest declares two workflows and two
  modules runs end-to-end with only `--manifest` and `--entry`.
- Subprocess protocol is now `{ workflows, entry, input, functions: { <module>: [files] } }`.
- **Gotcha found:** a bare directory in `workflows` does not expand to files —
  patterns must be globs (`workflows/**/*.yuml`). Schema/docs/examples corrected.
- Runs whose manifest modules span several languages are rejected with a clear
  message; that is the future cross-language bridge, not this plan.
