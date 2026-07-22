# codengine-core-cs

The codengine **contract** for the C# family, in code — the code-level mirror of
[`codengine-spec`](../../codengine-spec/). BCL only; no logic, no I/O.

- **Execution contract** — `Ir` (IR records + JSON options), `JsonValueConverter`
  (JSON ↔ CLR normalization), `TaskFunction`, `MissingInputError`.
- **Description contract** — `TaskDefinition` / `ParamDefinition` /
  `TaskDefinitionDocument` and their canonical serialization (the shape the analyzer
  produces and a generator would consume).

`codengine-analyzer-cs`, `codengine-loader-cs`, and `codengine-runner-cs` all
ProjectReference this package (no NuGet — still offline).
