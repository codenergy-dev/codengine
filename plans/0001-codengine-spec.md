# 0001 — codengine-spec

Status: done (IR v1 frozen)

## Context

codengine turns a functional diagram (a **workflow** of **tasks**) into
executable software. The whole design rests on one artifact: a language-neutral
**IR (Intermediate Representation)** — the parsed workflow graph as JSON — which
the parser produces and every runner consumes.

The legacy projects proved the architecture but left the two most important
things *implicit in code*:

1. **The IR shape.** `yuml-parser` emitted a JSON array of "pipelines" with
   fields like `fanIn`, `fanOut`, `dependencies`, `executionPlan`
   (see `yuml-parser/yuml_parser/pipeline.py`). It worked, but was never a
   documented, versioned contract.
2. **The execution semantics.** How outputs fan out, how inputs merge, what each
   edge type means, what a `null`/`true` output does — all of this lived only in
   `yuml-runner-js/src/workflows.ts` and, worse, differed from the two competing
   executors in `pypeyuml`. With multiple language runners, divergence is
   guaranteed unless the behavior is specified and tested centrally.

`codengine-spec` fixes both. It is the **foundation and is built first**, before
any parser or runner. It contains no runtime code.

## Goals

- Define the **IR** as a versioned JSON Schema.
- Specify the **execution semantics** precisely, in prose, independent of any
  language.
- Specify the **yUML → IR** mapping (edge types, arg syntax, entrypoints).
- Provide a **conformance suite**: fixtures that pin both parser behavior
  (`yuml → IR`) and runner behavior (`IR + input → output`). Every parser and
  runner in the repo must pass it. This is how we keep N languages honest.

## Non-goals

- No parser or runner implementation (those are `codengine-parser`,
  `codengine-runner-*`, planned next).
- No cross-language orchestration protocol yet. The IR stays pure; the module
  manifest (module → language + runner + environment) is specified in a later
  plan. We only make sure the IR has the `module` hook it will need.

## The IR (first cut, to be finalized during implementation)

One IR document per workflow file:

```jsonc
{
  "version": "1",          // spec version this document conforms to
  "workflow": "example",   // workflow name (from the diagram file name)
  "tasks": [ /* Task[] */ ]
}
```

A **Task**:

```jsonc
{
  "name": "b",             // unique id within the workflow
  "function": "b",         // function name to resolve and call
  "module": null,          // namespace to resolve `function` from; also the
                           // cross-workflow / cross-language routing hook
                           // (was `path` in legacy). null = this workflow.
  "args": {},              // literal args declared on the node in the diagram
  "fanIn": ["a"],          // upstream tasks this one consumes
  "fanInNullable": [],     // subset of fanIn allowed to be absent without blocking
  "fanOut": ["c"],         // downstream tasks, ORDERED (order is the index space
                           // used by int routing)
  "routes": [],            // labeled outgoing edges: [{ "label": "s", "target": "b" }]
                           // empty when no edge is labeled; used by string routing
  "entrypoint": false,     // may this task start an execution?
  "dependencies": ["A","a"],   // transitive upstream, precomputed by the planner
  "executionPlan": ["b","c"]   // order to run from this task, precomputed
}
```

Design decisions carried over deliberately:

- **Rename `pipeline` → `task`** everywhere. **Rename `path` → `module`.**
- **The planner writes `dependencies` and `executionPlan` into the IR once.**
  Runners trust them and stay "dumb". This is the single biggest lever for cheap
  multi-language support. (Legacy `yuml-parser` already computed these; we make
  it contract, not accident.)
- Wrap tasks in a document with `version` + `workflow` (legacy emitted a bare
  array). Versioning the IR lets it evolve without breaking runners silently.

## Execution semantics (to be pinned down with fixtures)

Canonicalized from `yuml-runner-js`. Each rule below becomes one or more
conformance cases.

**Task output types.** The output *type* decides what happens next — this is the
one place a dumb runner branches, so every runner must implement it identically:
- `object` (dict) → a single output item; flows to **all** `fanOut` (normal fan-out).
- `array of objects` → **fan-out**: downstream runs once per item.
- `string` → **string router** (see Routing below): selects one `fanOut` by edge label.
- `integer` → **index router** (see Routing below): selects one `fanOut` by index.
- `null` / falsy → the task produced no output; its branch halts (subject to
  nullable rules downstream).
- `true` → **passthrough**: output equals the input.
- anything else → error.

**Input merging (fanIn):** the **cartesian product** of upstream outputs, each
combination merged into one input object.

**Routing (task output as a selector).** When a task returns a scalar, it acts as
a **router**: instead of passing an output object to every `fanOut`, it selects a
single downstream task and **transfers its own input** to it (the scalar was only
the selector, so there is no output object to pass).
- **string router** — the string is matched against `routes[].label`; the
  matching `target` runs with the router's input. No match → the branch halts
  (treated like `null`). Authored as a labeled edge: `[a]string 1->[b]`.
- **index router** — the integer indexes the **ordered** `fanOut` list, wrapped
  into range with Euclidean modulo so it never goes out of bounds:
  `target = fanOut[((n % L) + L) % L]`, `L = len(fanOut)`. The fixed modulo
  formula is mandatory for cross-language parity (`-1 % 3` is `-1` in JS but `2`
  in Python). Enables index-based or random selection of the next task. Empty
  `fanOut` → nothing runs.

**Edge types (yUML → semantics):**
- `[a]->[b]` — **required**: `b` depends on `a`; `b` blocks until `a` produced output.
- `[a]LABEL->[b]` — **labeled required**: same as required, and records
  `{ label: "LABEL", target: "b" }` in `a.routes` for string routing.
- `[a]?->[b]` — **nullable**: `a` is a fanIn of `b`, but `b` runs even if `a` produced nothing.
- `[a]-.->[b]` — **optional (fire-forward trigger)**: `b` is added to `a.fanOut`
  only. `b` does **not** depend on `a` — `a` is not in `b.fanIn` nor in
  `b.dependencies`. Completing `a` triggers `b`, but `a`'s output is **not** passed
  to `b`. (Confirmed against legacy behavior.)
- `[a]^[b]` — **reversal**: reverses the dependency direction.
- `[note: ...]` — ignored.

**Args syntax on a node** (`[name|key=value|...]`):
- literal args become `args`, with typed value parsing (numbers, booleans, strings, ...).
- `^key` renames an **input** key; `key$` renames an **output** key (I/O adapters).

**Entrypoints:** a task is an entrypoint if it can start execution (no required
fanIn within its own workflow, etc.). Exact rule ported from legacy and locked
with fixtures.

> These are the *intended* semantics. The implementation step turns each bullet
> into an executable fixture, and any ambiguity found in the legacy code is
> resolved explicitly here (not rediscovered per runner).

## Conformance suite layout

```
codengine-spec/
├── README.md
├── schema/
│   └── workflow.schema.json      # the IR JSON Schema
├── syntax/
│   └── yuml.md                   # yUML → IR mapping (edges, args, entrypoints)
├── semantics/
│   └── execution.md              # the execution model, prose
└── conformance/
    ├── README.md                 # how a parser/runner consumes the suite
    └── cases/
        └── <case-name>/
            ├── workflow.yuml     # source diagram
            ├── workflow.json     # expected IR  → parser conformance
            └── runs/
                └── <run>.json    # { entry, input, expectedOutput } → runner conformance
```

- A **parser** passes if `parse(workflow.yuml)` deep-equals `workflow.json`.
- A **runner** passes if, for each run, `run(workflow.json, entry, input)`
  deep-equals `expectedOutput`.

## Milestones

1. [x] Scaffold `codengine-spec/` (dirs, `README.md`, `LICENSE`).
2. [x] Draft `schema/workflow.schema.json` (IR v1).
3. [x] Write `semantics/execution.md` and `syntax/yuml.md`.
4. [x] Author the first conformance cases: the ported `example` anchor (parser
   conformance, from the legacy known-good IR) plus focused runner cases —
   `linear-echo`, `passthrough` (`true`), `nil-halts` (`null`), `fan-out`
   (array), `index-routing` (integer; zero / wrap / negative to lock the modulo),
   `string-routing` (string; match / halt-on-null-return / no-match). Test-function
   catalog documented in `conformance/README.md`.
5. [x] Validate every fixture against the schema (structural + referential).
6. [x] Add the remaining focused cases: `nullable` (`?->`), `reversal` (`^`),
   `cartesian-fanin` (two list producers, 2×3 product), `io-rename`
   (`^key` / `key$`). 11 cases / 14 runs total, all schema-valid.
7. [x] **IR v1 frozen** (reviewed). Next: `codengine-parser` (plan 0002).

## Decision: classify task output by type, not truthiness

Building the routing and cartesian cases surfaced a real cross-language hazard.
The legacy `yuml-runner-js` used `if (!output)` to detect "no output", which
treats `0`, `""`, and `{}` as empty. That breaks index routing on `0`, string
routing on `""`, and empty-object outputs — and `{}` is falsy in Python but
truthy in JavaScript, so the two runners would disagree. IR v1 mandates
**type-based classification** (see `codengine-spec/semantics/execution.md`):
`null`/`None`/`undefined` and `false` halt; `true` is passthrough; integers
(incl. `0`, negatives) and strings (incl. `""`) are router selectors; objects and
arrays (incl. empty) are data. This is the kind of ambiguity the spec exists to
remove before it multiplies across runners.

## Resolved decisions (review round 1)

- **`path` → `module`** — approved.
- **`optional` (`-.->`)** — approved as "fire-forward trigger": target is a
  `fanOut` of the source only, with no reverse dependency and no output transfer.
- **IR envelope `{ version, workflow, tasks }`** — approved over the legacy bare
  array.
- **String routing & index routing** — approved and folded into the IR
  (`routes`, ordered `fanOut`) and execution semantics above.

## Open questions for review (round 2)

- **String router, no label match** — proposed: halt the branch (treat like
  `null`). Alternative would be to error. Confirm.
- **Mixing a labeled/required `fanOut` with an optional `-.->` `fanOut` on the
  same task under index routing** — index routing walks the whole ordered
  `fanOut`. Edge case; will be locked with a fixture. Flagging in case you want
  index routing to consider only labeled/required edges.
```

