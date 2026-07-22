# codengine-runner-cs

The C# **engine + subprocess entrypoint**. BCL only — no NuGet dependencies, so it
restores and runs offline. It ProjectReferences [`codengine-core-cs`](../codengine-core-cs/)
(the contract) and [`codengine-loader-cs`](../codengine-loader-cs/) (reflection loading).

- `Engine.cs` — executes the IR (`codengine-spec/semantics/execution.md`), a faithful
  port of `runtime.py` / `codengine-runner-ts`. Classifies a function result by type,
  never truthiness. A `TaskFunction` (from core) is a `Func<TaskData, object?>`; named
  binding is the loader's job.
- `Program.cs` — the subprocess entrypoint the orchestrator spawns
  (`dotnet codengine-runner-cs.dll`): reads
  `{ workflows, entry, input, functions: { <module>: { files, root } } }` from stdin,
  runs, and writes `{ result }` or `{ error }`.

## Conformance

```
dotnet run --project tests/codengine-runner-cs.tests.csproj
```

Runs the **same** `codengine-spec` cases as the TS / Python / Dart runners (an
in-code `Func<TaskData, object?>` catalog) — **16/16** proves cross-language engine
parity. The reflection loader is proven end-to-end via `codengine-cli`.
