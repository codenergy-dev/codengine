# codengine-analyzer-ts

Analyze TypeScript task functions into codengine **task definitions** — the neutral
description of each function's signature (named params: kind, required, nullable,
default) that tooling like [`codengine-vscode`](../../codengine-vscode/) uses for
autocomplete, intellisense, and validation.

Uses the **TypeScript Compiler API** (never regex): the type checker reads the code
the way TypeScript does. Runtime dependency: `typescript`.

## Library

```ts
import { analyzeSource } from "codengine-analyzer-ts";

const doc = analyzeSource("tasks.ts");
// { version: "1", language: "ts", definitions: [ ... ] }
```

## CLI / subprocess

```sh
codengine-analyze-ts tasks.ts
```

Prints the task-definition document as JSON — the process interface the editor uses
to analyze TS modules (mirroring the runner protocol).

## What it reads

A codengine TS task function takes one object parameter (structured binding). The
analyzer reads that parameter's **type** for the params and its **binding pattern**
for defaults:

- each property → a param, with a neutral `kind` (`number`, `string`, …),
  `required` (not optional and no default), `nullable` (`| null`), and its literal
  `default` (from `{ x = 5 }`);
- an index signature (`… & Record<string, unknown>`) or a rest element
  (`{ a, ...rest }`) → `acceptsExtra: true`.

The result deep-equals the language-neutral `expected.json` in the
[analyzer conformance](../../codengine-spec/conformance/analyzer/) — the same file
`codengine-analyzer-py` matches, which is the parity guarantee.

## Development

```sh
pnpm install
pnpm -C codengine-analyzer-ts test   # tsc + analyzer conformance
```
