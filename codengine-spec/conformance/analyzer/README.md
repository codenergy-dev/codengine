# Analyzer conformance

These fixtures pin the **task definition** an analyzer must produce from a source
module, so that every per-language analyzer describes the same signatures. Each
case ships equivalent source in each language and a single expected result:

```
<case>/
  source.ts        # the same task functions in TypeScript
  source.py        # ... and in Python
  expected.json    # the expected `definitions` (neutral, shared across languages)
```

An analyzer is conformant when `analyze(source.<lang>).definitions` deep-equals
`expected.json`. Because `expected.json` is language-neutral (kinds, not native
types), the *same* file validates every language — that shared result is the
parity guarantee, mirroring the runner conformance suite.

`expected.json` holds only the `definitions` array; each analyzer additionally
sets `version: "1"` and its own `language`. Schema:
[`../../schema/task-definition.schema.json`](../../schema/task-definition.schema.json).

## Cases

- `basic` — required, typed params; closed signature (no extras).
- `optional-and-nullable` — a default value, and a nullable (`Optional` / `| null`)
  parameter.
- `catch-all` — a function that accepts extra keys (`**kwargs` / index signature).
