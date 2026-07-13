# codengine-runner-ts

Execute the codengine **IR** in TypeScript/Node. This is the reference runner: it
implements [`codengine-spec/semantics/execution.md`](../codengine-spec/semantics/execution.md)
and passes the spec's conformance runs.

It consumes IR JSON (from [`codengine-parser`](../codengine-parser/) or any parser)
and only needs you to bind the functions your tasks call. Zero runtime
dependencies.

## Usage

```ts
import { run } from "codengine-runner-ts";
import type { FunctionMap, WorkflowIR } from "codengine-runner-ts";

const ir: WorkflowIR = /* parse a .yuml, or load a workflow.json */;

const functions: FunctionMap = {
  fetchUser: (input) => ({ user: findUser(input.id) }),
  greet: (input) => ({ message: `Hello, ${input.user.name}` }),
  output: (input) => input, // terminal collector
};

const result = run(ir, functions, "fetchUser", { id: 42 });
// result: the `output` task's collected output (an array of objects), or null.
```

## Semantics (summary)

The runner is "dumb": it trusts the precomputed `executionPlan` and applies the
runtime rules. A task's function return value is classified **by type**, never by
truthiness:

| Return | Effect |
|---|---|
| object / array of objects | data output(s); downstream fans out |
| `string` | **string router**: selects a `routes` target by label; transfers input |
| integer | **index router**: selects `fanOut[((n % L) + L) % L]`; transfers input |
| `true` | passthrough (output = input) |
| `null` / `false` | no output; the branch halts |

`fanIn` inputs are merged as a cartesian product; `^key` / `key$` rename input /
output keys. The run result is the `output` task's collected output. Full rules
live in the spec.

## Development

```sh
pnpm install                              # from the monorepo root
pnpm -C codengine-runner-ts test          # tsc + conformance runs
```

`test` binds the spec's [test-function catalog](../codengine-spec/conformance/README.md)
and executes every `runs/*.json` fixture, asserting the result deep-equals
`expectedOutput`. Tests use Node's built-in runner (`node:test`).
