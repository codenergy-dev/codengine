# Conformance suite

These fixtures pin codengine's behavior so that every parser and every language
runner behaves identically. A parser or runner is **conformant** when it passes
all cases here.

## Layout

```
cases/
  <case-name>/
    workflow.yuml     # source diagram (yUML)
    workflow.json     # expected IR for workflow.yuml   → parser conformance
    runs/             # optional; present for runner conformance
      <run>.json      # { "entry": task, "input": {...}, "expectedOutput": ... }
```

## Two kinds of conformance

**Parser conformance** — `parse(workflow.yuml)` must deep-equal `workflow.json`
(validated against [`../schema/workflow.schema.json`](../schema/workflow.schema.json)).

**Runner conformance** — for each file in `runs/`, executing `workflow.json` from
`entry` with `input` must produce `expectedOutput` (deep-equal). `expectedOutput`
is the `output` task's output — an array of objects, or `null` if `output` never
ran. See [`../semantics/execution.md`](../semantics/execution.md).

## Test-function catalog

Runner cases reference a small, fixed set of functions whose behavior is
specified here (not shipped as code — each runner implements this catalog once,
idiomatically, then runs every fixture). Keeping the functions abstract is what
lets the `runs/` fixtures stay language neutral.

Functions are defined by **behavior**, not signature — each runner implements them
idiomatically per the [invocation contract](../semantics/execution.md#function-invocation)
(named binding where the language allows, structured otherwise), so the `input`
below means "the named input" however it is delivered.

| Function | Behavior |
|---|---|
| `echo` | Returns its input unchanged (a single object). Identity. |
| `pass` | Returns `true` (passthrough — output equals input). |
| `nil` | Returns `null` (halts the branch). |
| `emit` | Returns an array of `n` objects, the i-th being `{ "i": i }` (fan-out). |
| `route` | Returns the string input `route` (drives a string router). |
| `pick` | Returns the integer input `i` (drives an index router). |
| `output` | Terminal collector: returns its input; the run's result is this task's output. |

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
