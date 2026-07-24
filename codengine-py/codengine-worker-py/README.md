# codengine-worker-py

A **persistent Python worker** — the *executor* side of a cross-language run. The
orchestrator's engine (in another language) spawns `python -m codengine_worker` once,
loads the module's functions into it (via the [loader](../codengine-loader-py/)), and
then sends many cheap `call` requests without ever reloading the project.

It is the "warm kitchen": open once, cook many dishes. It does **not** know the
workflow graph — all branching (fan-out, routing, fan-in) stays in the one engine.

Protocol — one JSON request/response per line over stdio:

```
{ "op": "load", "module": "", "files": ["tasks.py"], "root": "." }  -> { "ok": true }
{ "op": "call", "module": "", "function": "greet", "input": {…} }   -> { "result": … }
{ "op": "callChain", "module": "", "functions": ["c","d"], "input": {…} }
    -> { "result": …, "consumed": n }   # linear-segment optimization
```

Two modes:

- **stdio** (default) — the local `subprocess` transport (the orchestrator spawns it).
- **HTTP** — the `remote` transport: `python -m codengine_worker --http PORT --config
  worker.json` starts a long-running service that loads its modules at startup (from
  `{ "modules": { "<name>": { "files": […], "root": … } } }`) and dispatches POSTed
  requests through the same handler. Port `0` picks an ephemeral port, printed on the
  first stdout line. (No auth/TLS yet — trusted networks only.)

Depends on `codengine-core` + `codengine-loader`; never on the engine.
