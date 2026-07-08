# codengine-spec

The foundation of codengine: the language-neutral definition that every parser
and runner must agree on. This module contains **no runtime code** — it is the
source of truth.

## Contents

- [`schema/workflow.schema.json`](schema/workflow.schema.json) — the **IR**
  (Intermediate Representation): the workflow task graph as JSON, v1. This is the
  contract a parser emits and a runner consumes.
- [`semantics/execution.md`](semantics/execution.md) — how the IR is executed
  (task input/output, fanIn merging, routing, edge types). Every runner must
  implement exactly this.
- [`syntax/yuml.md`](syntax/yuml.md) — how yUML source maps to the IR.
- [`conformance/`](conformance/) — fixtures that pin behavior. A parser or runner
  is conformant when it passes them.

## Key ideas

- **task** = a node = a function with input/output. **workflow** = the graph.
  **fanIn/fanOut** = connections. **module** = the namespace a function resolves
  from (and the cross-language routing hook).
- The **planner** precomputes `dependencies` and `executionPlan` into the IR, so
  runners stay "dumb" and are cheap to port to new languages.
- A task's runtime behavior is decided by the **type** of its output
  (object / array / string / integer / null / true). Scalars act as **routers**.

## Status

IR **v1 frozen**. 11 conformance cases / 14 runs. See
[`../plans/0001-codengine-spec.md`](../plans/0001-codengine-spec.md) for the
reasoning. Next: `codengine-parser` (plan 0002), built and validated against this
suite.
