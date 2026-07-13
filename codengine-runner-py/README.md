# codengine-runner-py

Execute the codengine **IR** in Python — the Python counterpart of
[`codengine-runner-ts`](../codengine-runner-ts/). It implements the same
[`codengine-spec/semantics/execution.md`](../codengine-spec/semantics/execution.md)
and passes the *same* conformance runs, which is how cross-language parity is
guaranteed.

Pure standard library — zero third-party dependencies (tests included).

## Usage

```python
from codengine_runner import run

ir = ...  # a parsed workflow.json (dict)

functions = {
    "fetch_user": lambda data: {"user": find_user(data["id"])},
    "greet": lambda data: {"message": f"Hello, {data['user']['name']}"},
    "output": lambda data: data,  # terminal collector
}

result = run(ir, functions, "fetch_user", {"id": 42})
# result: the `output` task's collected output (list[dict]), or None.
```

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
how [`codengine-cli`](../codengine-cli/) executes Python workflows:

```sh
echo '{"ir": {...}, "entry": "task", "input": {...}, "functions": "/path/to/funcs.py"}' \
  | python -m codengine_runner
# -> {"result": [ ... ]}   or   {"error": "..."}
```

The functions module is loaded by its top-level functions, or an explicit
`FUNCTIONS` dict.

## Development

```sh
python3 -m venv .venv
.venv/bin/python -m unittest discover -s tests -t .
```

The tests bind the spec's [test-function catalog](../codengine-spec/conformance/README.md)
and run every `runs/*.json` fixture, asserting the result equals `expectedOutput`.
A `venv` isolates the interpreter even though nothing is installed into it.
