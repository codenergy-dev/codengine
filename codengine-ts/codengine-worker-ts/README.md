# codengine-worker-ts

A **persistent TS/JS worker** — the *executor* side of a cross-language run when a
non-TS engine orchestrates a TypeScript/JavaScript module. The orchestrator spawns it
once, loads the module's functions (via the [loader](../codengine-loader-ts/)), and
sends many cheap `call` requests without reloading.

It does **not** know the workflow graph — all branching stays in the one engine.
Same line-delimited stdio protocol as [`codengine-worker-py`](../../codengine-py/codengine-worker-py/):

```
{ "op": "load", "module": "", "files": ["tasks.mjs"] }              -> { "ok": true }
{ "op": "call", "module": "", "function": "greet", "input": {…} }   -> { "result": … }
{ "op": "callChain", "module": "", "functions": ["a","b"], "input": {…} }
    -> { "result": …, "consumed": n }
```

Two modes: **stdio** (default, the local `subprocess` transport) and **HTTP**
(`node cli.js --http PORT --config worker.json`, the `remote` transport — loads its
modules at startup and serves POSTed requests; port `0` prints the chosen port).

Depends on `codengine-core-ts` + `codengine-loader-ts`; never on the engine.
