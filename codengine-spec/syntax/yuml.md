# yUML syntax → IR mapping

codengine authors workflows as [yUML](https://yuml.me/) class diagrams. yUML is
one *frontend*; the parser maps it to the language-neutral
[IR](../schema/workflow.schema.json). The runtime meaning of the resulting graph
is in [`../semantics/execution.md`](../semantics/execution.md).

A yUML file that renders as an SVG on GitHub is also, unchanged, an executable
workflow — this is the "living, functional documentation" idea.

## Lines

Only lines whose first non-space character is `[` are significant. Everything
else (yUML directives like `// {type:class}`, blank lines) is ignored.

## Nodes → tasks

A node is `[<name>|<arg>|<arg>...]`.

- `<name>` is the task **name** (unique within the workflow).
- The **function** is derived from the name: the segment before any `:` and
  after any `.`. So `[pkg.fn:alias]` → function `fn`, module `pkg`.
- Aliasing: two tasks may share a function via distinct names, e.g. `[echo:a]`
  and `[echo:b]` both call function `echo`.
- **module** is the dotted prefix of the name, or `null` when there is none. It
  is the hook for cross-workflow and cross-language routing.

### Node args

`|key=value` pairs become the task's `args`, with typed value parsing (integers,
floats, booleans, and strings). Two keys have special meaning as I/O adapters:

- `^key` renames an **input** key before the function runs.
- `key$` renames an **output** key after the function runs.

## Edges

An edge connects two nodes on one line: `[left]<op>[right]`. The operator sets
the edge type:

| Operator | Edge |
|---|---|
| `->` | required |
| `LABEL->` (text between `]` and `->`) | labeled required — records `{ label: "LABEL", target: right }` in `left.routes` |
| `?->` | nullable |
| `-.->` | optional (fire-forward) |
| `^` | reversal |

`[note: ...]` nodes are ignored.

See [`../semantics/execution.md`](../semantics/execution.md#edge-types) for what
each edge type means at run time.

## The planner

After building the raw graph (nodes + typed edges), the parser runs the
**planner**, which precomputes and writes into each task:

- `dependencies` — its transitive upstream tasks.
- `executionPlan` — the ordered set of tasks to run starting from it.
- `entrypoint` — whether it may start an execution: a task with **no required
  fanIn**. The rule is uniform — a module-qualified (dotted) task is no different.

Runners never recompute these; they trust the IR. This is what keeps porting a
runner to a new language cheap, and it is why the plan lives in the IR rather
than in each runner.
