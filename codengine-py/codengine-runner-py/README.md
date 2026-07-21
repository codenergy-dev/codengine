# codengine-runner-py

Execute the codengine **IR** in Python — the Python counterpart of
[`codengine-runner-ts`](../../codengine-ts/codengine-runner-ts/). It implements the same
[`codengine-spec/semantics/execution.md`](../../codengine-spec/semantics/execution.md)
and passes the *same* conformance runs, which is how cross-language parity is
guaranteed.

Pure standard library — zero third-party dependencies (tests included).

## Usage

```python
from codengine_runner import run

# One or more workflows: they load together as a registry and can call each other.
workflows = [...]  # parsed workflow.json documents (dicts)

# Functions are bound per module; "" is the default module.
functions = {
    "": {
        "fetch_user": lambda id: {"user": find_user(id)},
        "greet": lambda user: {"message": f"Hello, {user['name']}"},
        "output": lambda **data: data,  # terminal collector
    },
}

result = run(workflows, functions, "fetch_user", {"id": 42})
# result: the `output` task's collected output (list[dict]), or None.
```

The third argument is an **address** — a task name, which embeds its module and
overload (`images.resize`, `echo:seed`). If that address is an entrypoint in another
workflow of the registry, its whole chain runs and the results are mirrored back;
otherwise the function runs alone.

Inputs are bound as **named arguments** (the
[invocation contract](../../codengine-spec/semantics/execution.md#function-invocation)):
write the parameters you need — `def resize(width, height)` — and unrelated keys
are dropped. Use `**kwargs` to receive everything; a missing required parameter
raises `MissingInputError`.

## Semantics

Identical to the TS runner (see its README and the spec). Output is classified
**by type**, never truthiness — which is exactly where Python and JavaScript
diverge and why the shared conformance suite matters:

- `{}` is falsy in Python but is a valid data object here;
- `bool` is a subclass of `int`, so `True`/`False` are handled before integer
  index routing;
- the Euclidean modulo `((n % L) + L) % L` selects the same branch as in JS.

## Subprocess mode (for the orchestrator)

The runner also runs as a process speaking a JSON protocol over stdio, which is
how [`codengine-cli`](../../codengine-cli/) executes Python workflows:

```sh
echo '{"workflows": [...], "entry": "task", "input": {...},
       "functions": {"": {"files": ["/path/to/funcs.py"], "root": "/path/to/project"}}}' \
  | python -m codengine_runner
# -> {"result": [ ... ]}   or   {"error": "..."}
```

`functions` maps each module to its `files` and its `root` (the project directory).
`root` is put on `sys.path` so the functions' own imports — sibling modules and
installed packages — resolve. Each file contributes its top-level functions, or an
explicit `FUNCTIONS` dict.

## Development

```sh
python3 -m venv .venv
.venv/bin/python -m unittest discover -s tests -t .
```

The tests bind the spec's [test-function catalog](../../codengine-spec/conformance/README.md)
and run every `runs/*.json` fixture, asserting the result equals `expectedOutput`.
A `venv` isolates the interpreter even though nothing is installed into it.
