# codengine-analyzer-py

Analyze Python task functions into codengine **task definitions** — the neutral
description of each function's signature (named params: kind, required, nullable,
default) that tooling like [`codengine-vscode`](../codengine-vscode/) uses for
autocomplete, intellisense, and validation.

Uses the standard-library `ast` (never regex), so it reads Python the way Python
does. Zero third-party dependencies.

## Library

```python
from codengine_analyzer import analyze_source

doc = analyze_source("tasks.py")
# { "version": "1", "language": "py", "definitions": [ ... ] }
```

## CLI / subprocess

```sh
python -m codengine_analyzer tasks.py
```

Prints the task-definition document as JSON — the process interface the editor
uses to analyze Python modules out-of-process (mirroring the runner protocol).

## What it produces

Per top-level function, per the
[task-definition schema](../codengine-spec/schema/task-definition.schema.json) and
the [analyzer conformance](../codengine-spec/conformance/analyzer/):

- `params` — each declared parameter's neutral `kind`
  (`int`/`float` → `number`, `str` → `string`, …), whether it is `required`
  (no default), `nullable` (`Optional` / `| None`), and its literal `default`;
- `acceptsExtra` — whether the function has `**kwargs`.

This is the static counterpart of what `codengine-runner-py` binds at run time.

## Development

```sh
python3 -m venv .venv
.venv/bin/python -m unittest discover -s tests -t .
```

The tests run the shared [analyzer conformance](../codengine-spec/conformance/analyzer/):
`analyze(source.py).definitions` must deep-equal the language-neutral
`expected.json` — the same file `codengine-analyzer-ts` will match, proving parity.
