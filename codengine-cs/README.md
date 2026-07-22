# codengine-cs

The C# language family for codengine — a **compiled** language *with* full runtime
reflection. Dart forced a **generator** into existence only because its AOT runtime
has no reflection; the default .NET runtime does, so C# needs **no generator**. The
loader binds named parameters at runtime (like Python's `inspect`), which means C#
takes the two-package shape of Python, not the four-package shape of Dart.

| Package | Role |
|---|---|
| [`codengine-analyzer-cs`](codengine-analyzer-cs/) | source → task definitions (via Roslyn / `Microsoft.CodeAnalysis`). |
| [`codengine-runner-cs`](codengine-runner-cs/) | the IR engine (a port of the runtime) + the reflection **loader** + the subprocess entrypoint. BCL only — no NuGet dependencies. |

## How a C# run works

The compiled particularity is *loading*, not *binding*. The orchestrator spawns the
prebuilt runner (`dotnet codengine-runner-cs.dll`), sending
`{ workflows, entry, input, functions: { <module>: { files, root } } }` on stdin. For
each module the runner:

1. builds the module's project (its `root`, a `.csproj`) with `dotnet build`, so the
   user's own NuGet dependencies resolve;
2. loads the output assembly in an `AssemblyLoadContext`;
3. reflects the public static methods into a `name -> Func<TaskData, object?>` map,
   binding the input to each method's parameters **by name** (dropping extras,
   raising a normalized error for a missing required parameter).

The build's stdout is captured internally, so only the protocol JSON reaches the
runner's stdout.

## The north star: zero adaptation, zero codengine reference

Because reflection loads the user's compiled assembly **as data**, the user's
`.csproj` needs **no reference to codengine at all** (better even than Dart, which
adds three pub deps). The user writes ordinary methods and lists them:

```csharp
public static Dictionary<string, object?> greet(string name)
    => new() { ["message"] = $"Hello, {name}!" };
```

The analyzer reads the parameter names; the runner binds `input["name"]` to `name`.

## Known limits

- One project `root` per module (each module builds independently, so a run may span
  several C# projects — unlike Dart's single glue root).
- Method selection is assembly-wide (every eligible public static method, with
  duplicate-name conflict detection). PDB-based source-file filtering — to honour the
  `functions` globs the way the interpreted languages do — is a future refinement.
- C# has no clean reflection-based catch-all, so `acceptsExtra` is always `false`
  (the analyzer `catch-all` conformance case is skipped, like Dart).
