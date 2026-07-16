# Conformance suite

These fixtures pin codengine's behavior so that every parser and every language
runner behaves identically. A parser or runner is **conformant** when it passes
all cases here.

## Layout

```
cases/
  <case-name>/
    workflows/
      <workflow>.yuml   # source diagram (yUML); the file name is the workflow name
      <workflow>.json   # expected IR for it            → parser conformance
    runs/               # optional; present for runner conformance
      <run>.json        # { "entry": address, "input": {...}, "expectedOutput": ... }
```

A case holds **one or more** workflows: they are all loaded into one registry, so a
single-workflow case is just the trivial registry. `entry` is an **address** — a
task name, which embeds its module and overload (`chain.a`, `echo:seed`).

## Two kinds of conformance

**Parser conformance** — for each `workflows/<name>.yuml`, `parse(source, "<name>")`
must deep-equal `workflows/<name>.json` (validated against
[`../schema/workflow.schema.json`](../schema/workflow.schema.json)).

**Runner conformance** — for each file in `runs/`, executing the case's workflows
(all of them, as a registry) from `entry` with `input` must produce
`expectedOutput` (deep-equal). `expectedOutput` is the `output` task's output — an
array of objects, or `null` if `output` never ran. See
[`../semantics/execution.md`](../semantics/execution.md).

## Test-function catalog

Runner cases reference a small, fixed set of functions whose behavior is
specified here (not shipped as code — each runner implements this catalog once,
idiomatically, then runs every fixture). Keeping the functions abstract is what
lets the `runs/` fixtures stay language neutral.

Functions are defined by **behavior**, not signature — each runner implements them
idiomatically per the [invocation contract](../semantics/execution.md#function-invocation)
(named binding where the language allows, structured otherwise), so the `input`
below means "the named input" however it is delivered.

Functions are bound **per module** (the manifest's namespaces): `{ "": { … },
"chain": { … } }`. A task resolves its function from `module ?? ""`.

### Module `""` (default)

| Function | Behavior |
|---|---|
| `echo` | Returns its input unchanged (a single object). Identity. |
| `pass` | Returns `true` (passthrough — output equals input). |
| `nil` | Returns `null` (halts the branch). |
| `emit` | Returns an array of `n` objects, the i-th being `{ "i": i }` (fan-out). |
| `route` | Returns the string input `route` (drives a string router). |
| `pick` | Returns the integer input `i` (drives an index router). |
| `output` | Terminal collector: returns its input; the run's result is this task's output. |
| `start` | **Trail**: returns `{ trail: [...trail, "start"] }`. |

### Module `chain`

| Function | Behavior |
|---|---|
| `a` `b` `c` `d` `e` | **Trail**: each returns `{ trail: [...trail, "<its own name>"] }`. |

**Why a trail.** Cross-workflow cases must prove *which tasks ran* — e.g. that
calling an entrypoint runs its whole chain, while a non-entrypoint runs alone.
Rather than expose a trace API (which every runner would have to implement), the
trail functions accumulate their own name in the data, so `expectedOutput` proves
the execution path and the fixtures stay language-neutral.

## Bootstrapping order

`workflow.json` for a case is the IR the future `codengine-parser` must emit.
Until that parser exists, the `workflow.json` fixtures in this suite were
generated with the legacy `yuml-parser` (which implements the same planner
algorithm) and then adapted to IR v1 (`path`→`module`, added `routes`, wrapped in
the `{ version, workflow, tasks }` envelope; routing labels for `string-routing`
added by hand). When `codengine-parser` lands, it is validated by regenerating
these fixtures and diffing against the committed files — that diff is the parser
conformance test.

`runs/*` `expectedOutput` values are derived by hand from
[`../semantics/execution.md`](../semantics/execution.md) and are the source of
truth for runner behavior.
