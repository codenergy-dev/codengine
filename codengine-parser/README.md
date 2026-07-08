# codengine-parser

Parse [yUML](https://yuml.me/) workflows into the codengine **IR** (Intermediate
Representation) — the language-neutral task graph defined by
[`codengine-spec`](../codengine-spec/). Includes the **planner** that precomputes
`dependencies`, `executionPlan`, and `entrypoint` so that runners stay dumb.

Written in TypeScript so the VS Code extension can reuse it in-process. Zero
runtime dependencies.

## Library

```ts
import { parseWorkflow } from "codengine-parser";

const ir = parseWorkflow(yumlSource, "my-workflow");
// ir: { version: "1", workflow: "my-workflow", tasks: [...] }
```

## CLI

```sh
codengine-parse <file.yuml | dir> [outDir]
```

Writes `<workflow>.json` next to the input (or into `outDir`). The workflow name
is taken from the file name (`orders.yuml` → workflow `orders`).

## What it maps

yUML → IR, per [`codengine-spec/syntax/yuml.md`](../codengine-spec/syntax/yuml.md):

- nodes → tasks (name, `function`, `module`, `args`);
- edges → `fanIn` / `fanInNullable` / `fanOut` and, for labeled edges
  (`[a]keep->[b]`), `routes` for string routing — which the legacy parser did not
  support;
- the planner → `dependencies`, `executionPlan`, `entrypoint`.

## Development

```sh
pnpm install          # from the monorepo root
pnpm -C codengine-parser test        # tsc + conformance suite
pnpm -C codengine-parser build       # emit dist/
```

`test` runs the [conformance suite](../codengine-spec/conformance/): it parses
every case's `workflow.yuml` and asserts the result deep-equals the committed
`workflow.json`. Tests use Node's built-in runner (`node:test`) — no test-framework
dependency.
