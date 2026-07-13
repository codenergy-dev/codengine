# codengine-cli

The standalone orchestrator — run a workflow from the command line. It parses a
yUML workflow with [`codengine-parser`](../codengine-parser/) and executes it
through a **runner selected by language**: TypeScript in-process, or another
language (e.g. Python) as a subprocess.

## Usage

```sh
codengine run <workflow.yuml | .json> --functions <module> [options]
```

| Option | |
|---|---|
| `--functions, -f` | Module with the task functions, in the chosen language (required). |
| `--language, -l` | `ts` (default) or `py`. |
| `--python` | Python interpreter for `--language py` (must have `codengine-runner` installed). |
| `--entry, -e` | Entry task (default: the workflow's sole entrypoint). |
| `--input, -i` | Input as a JSON object (default `{}`). |

The result (the `output` task's collected output) is printed as JSON.

## Example

[`examples/greeting/`](examples/greeting/) — the same workflow, two languages:

```sh
# TypeScript (in-process)
codengine run examples/greeting/workflow.yuml \
  -f examples/greeting/functions.mjs -i '{"name":"Mumbuquinha"}'

# Python (subprocess) — after `pip install codengine-runner`
codengine run examples/greeting/workflow.yuml \
  -f examples/greeting/functions.py --language py -i '{"name":"Mumbuquinha"}'
```

Both print `[{ "message": "Hello, Mumbuquinha!" }]`.

## How runner selection works

The CLI hands a runner `(ir, entry, input, functions)` and gets back the result.
Each runner loads the task functions **in its own language** — the CLI never
imports Python functions.

- **TypeScript** → in-process ([`InProcessTsRunner`](src/runner/ts-runner.ts)): the
  CLI imports the functions module and calls `codengine-runner-ts` directly.
- **Other languages** → subprocess ([`SubprocessRunner`](src/runner/subprocess-runner.ts))
  speaking a JSON protocol over stdio (`{ ir, entry, input, functions }` →
  `{ result }` / `{ error }`). Python implements it via `python -m codengine_runner`.
  This generalizes pypeyuml's venv/JSON pattern.

Selection is by language today; the future **module manifest**
(`module → { language, runner, functions, environment }`) will let a single
workflow mix languages, with the orchestrator marshaling task I/O between runners.

## Function modules

- **TS/JS**: named function exports, and/or a default export that is an object of
  functions.
- **Python**: the module's top-level functions, or an explicit `FUNCTIONS` dict
  (needed when a task name is a Python keyword, e.g. `pass`).

## Development

```sh
pnpm install
pnpm -r build                     # parser + runner-ts must be built first
pnpm -C codengine-cli test        # e2e: same workflow through ts and py runners
```

The Python leg of the test requires `codengine-runner` installed in a venv (see
[`codengine-runner-py`](../codengine-runner-py/)); it is skipped if absent.
