# Execution semantics

This document specifies how a workflow **IR** is executed. It is language
neutral. Every `codengine-runner-*` must implement exactly this behavior and pass
the [conformance suite](../conformance/README.md); the schema of the IR is in
[`../schema/workflow.schema.json`](../schema/workflow.schema.json).

Runners are intentionally **dumb**: all graph reasoning (`dependencies`,
`executionPlan`) is precomputed by the planner and written into the IR. A runner
resolves functions and executes tasks in the given plan, honoring the rules
below.

## Model

- A **run** is invoked with a workflow, an **entry** task, and an **input**
  object. The input is applied as the entry task's `args` (replacing any args
  declared on the entry node), so it merges into the entry's input like any other
  args.
- Execution follows the entry task's `executionPlan`, in order. A task runs only
  when its `fanIn` requirements are satisfied (see *fanIn*); otherwise it is
  skipped.
- The special task named **`output`** is the terminal collector. Its input
  (after fanIn merging) is the run's result. A run yields `output`'s output, or
  `null` if `output` never ran.

## Task input

A task's input is built from the outputs of its `fanIn` tasks, merged with its
literal `args`:

- **fanIn merge = cartesian product.** If a task has multiple `fanIn` producers,
  and each produced one or more output items, the inputs are the cartesian
  product of those item lists, each combination shallow-merged into one object.
  A task therefore runs once per input combination.
- `args` are merged on top of each resulting input object.
- A producer listed in `fanInNullable` may be absent (produced nothing) without
  blocking the task; it simply contributes nothing to the merge. A producer in
  `fanIn` but not in `fanInNullable` that produced nothing prevents the task from
  running.

## Task output

A task's behavior downstream is decided by the **type** of what its function
returns. This is the single branch point a runner must get right.

**Classify by type, never by truthiness.** This is a hard rule. An empty object
`{}`, an empty array `[]`, the integer `0`, and the empty string `""` are all
meaningful values and must **not** be treated as "no output". (A naive
`if (!output)` check is wrong: `0` and `""` are valid router selectors, and `{}`
is falsy in Python but truthy in JavaScript — exactly the kind of divergence this
spec exists to prevent.)

| Returned value | Meaning |
|---|---|
| object / dict (including empty `{}`) | A single output item. Flows to **all** `fanOut`. |
| array of objects (including empty `[]`) | **Fan-out**: one output per item; downstream runs once per item. Empty array = zero downstream runs. |
| string (including `""`) | **String router** — selects one `fanOut` by edge label (see Routing). |
| integer (including `0` and negatives) | **Index router** — selects one `fanOut` by index (see Routing). |
| `null` / `None` / `undefined` | No output. The branch halts; downstream tasks that required this one are skipped. |
| `false` | No output (halts), same as `null`. |
| `true` | **Passthrough**: the output equals the task's input. |
| any other value (e.g. a float) | Error. |

> A runner must classify the return value by type, precisely and identically
> across languages. Booleans are checked before object/dict; the scalar router
> types (string, integer) are distinct from object/array.

## Routing (output as a selector)

When a task returns a **scalar** it acts as a **router**. Instead of passing an
output object to every `fanOut`, it selects a single downstream task and
**transfers its own input** to it — the scalar was only the selector, so there is
no output object to pass on.

### String router

The returned string is matched against this task's `routes` (`{ label, target }`
entries). The `target` of the matching entry runs, receiving the router's input.

- **No matching label → the branch halts** (treated exactly like a `null`
  output). No error is raised.

Authored in yUML as a labeled edge: `[route]keep->[echo]`.

### Index router

The returned integer indexes the task's **ordered** `fanOut` list. The index is
wrapped into range so it can never go out of bounds:

```
L = length(fanOut)
if L == 0: nothing runs
target = fanOut[ ((n mod L) + L) mod L ]
```

The doubled modulo is **mandatory** and part of the contract, because the sign of
the modulo of a negative number differs by language (`-1 % 3` is `-1` in
JavaScript but `2` in Python). The formula above yields the same non-negative
index in `[0, L)` in every language. The selected `target` runs, receiving the
router's input.

This enables index-based or random selection of the next task (e.g. return a
random integer to pick a random branch) with no out-of-range failure.

## Edge types

How yUML edges map to structure and semantics (full syntax in
[`../syntax/yuml.md`](../syntax/yuml.md)):

| yUML | Name | Structure | Semantics |
|---|---|---|---|
| `[a]->[b]` | required | `b`∈`a.fanOut`, `a`∈`b.fanIn` | `b` runs after `a` produced output. |
| `[a]LABEL->[b]` | labeled required | as required, plus `{label,target:b}` in `a.routes` | enables string routing on `a`. |
| `[a]?->[b]` | nullable | as required, plus `a`∈`b.fanInNullable` | `b` runs even if `a` produced nothing. |
| `[a]-.->[b]` | optional | `b`∈`a.fanOut` only (no reverse dependency) | fire-forward trigger: completing `a` triggers `b`, but `a`'s output is **not** passed and `a` is **not** in `b.fanIn`/`b.dependencies`. |
| `[a]^[b]` | reversal | reverses the dependency direction | |
| `[note: ...]` | note | none | ignored by the parser. |
