# codengine-analyzer-cs

Analyze C# task functions into codengine **task definitions**, using Roslyn
(`Microsoft.CodeAnalysis`, never regex) — it reads C# the way the compiler does.
Produces the neutral document from
[`task-definition.schema.json`](../../codengine-spec/schema/task-definition.schema.json):
each public static method's params (`kind`, `required`, `nullable`, `default`).

```csharp
var doc = Codengine.Analyzer.Analyze.AnalyzeSource("Tasks.cs");
```

C# parameters are all bindable by name, so every parameter becomes a named param.
C# has no clean reflection-based catch-all convention, so `acceptsExtra` is always
`false`.

## Conformance

```
dotnet run --project tests/codengine-analyzer-cs.tests.csproj
```

Asserts the definitions deep-equal the shared `expected.json` (the same files
analyzer-ts / -py / -dart match) — **2/2**. The `catch-all` case has no `source.cs`
and is skipped, exactly like Dart.

## Dependencies

One pinned NuGet dependency (`Microsoft.CodeAnalysis.CSharp`). A committed
`packages.lock.json` plus locked-mode restore keep it reproducible — the NuGet
analogue of the repo's pnpm supply-chain policy.
