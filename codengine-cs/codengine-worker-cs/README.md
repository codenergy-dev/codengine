# codengine-worker-cs

A **persistent C# worker** — the *executor* side of a cross-language run. The
orchestrating engine (in another language) spawns it once, `load`s the module (which
builds its project and reflects the assembly, via
[`codengine-loader-cs`](../codengine-loader-cs/)), and then sends many cheap `call`
requests without rebuilding or reloading.

Because C# **has reflection**, the worker needs no generated glue — it is the
straightforward shape, like `codengine-worker-py`. It does not know the workflow
graph; all branching stays in the one engine.

Line-delimited JSON over stdio:

```
{ "op": "load", "module": "", "files": ["Tasks.cs"], "root": "." } -> { "ok": true }
{ "op": "call", "module": "", "function": "output", "input": {…} } -> { "result": … }
{ "op": "callChain", "module": "", "functions": ["a","b"], "input": {…} }
    -> { "result": …, "consumed": n, "input": {…} }
```

BCL only; ProjectReferences `codengine-core-cs` + `codengine-loader-cs`, never the
engine. The orchestrator finds it via `CODENGINE_WORKER_CS_DLL` or the build output.
