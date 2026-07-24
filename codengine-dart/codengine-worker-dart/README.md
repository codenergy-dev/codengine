# codengine-worker-dart

A **persistent Dart worker** — the *executor* side of a cross-language run. It exposes
`serve(functions)`: the line-delimited JSON request loop (`load` / `call` /
`callChain`). It does not know the workflow graph; all branching stays in the engine.

Because Dart AOT has **no reflection**, the functions can't be discovered at runtime —
they are baked in at generation time. So this library is driven by **generated glue**:
[`codengine-generator-dart`](../codengine-generator-dart/)'s `bin/worker.dart` writes
glue that imports the user's files, builds the function map (via the loader's
`mergeFunctions`), and calls `serve(...)`. For Dart, `load` is therefore just an
acknowledgement.

```
{ "op": "call", "module": "", "function": "output", "input": {…} } -> { "result": … }
{ "op": "callChain", "module": "", "functions": ["a","b"], "input": {…} }
    -> { "result": …, "consumed": n, "input": {…} }
```

The generated glue's `main` serves **stdio** by default (the `subprocess` transport)
or **HTTP** with `--http PORT` (the `remote` transport, via `dart:io` `HttpServer`;
port `0` prints the chosen port). The functions are baked in, so no `--config`.

Depends on `codengine_core`; never on the engine.
