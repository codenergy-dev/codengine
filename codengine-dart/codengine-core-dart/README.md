# codengine-core-dart

The codengine **contract** for the Dart family, in code — the code-level mirror of
[`codengine-spec`](../../codengine-spec/). No logic, no I/O; just the typedefs the
rest of the family shares.

- Execution contract: `TaskData`, `TaskFunction`, `ModuleFunctions`.
- Description contract: `TaskDefinition`, `TaskDefinitions` (the dict-shaped documents
  the analyzer produces and the generator consumes).

`codengine_runner` (which re-exports these), `codengine_loader`, `codengine_analyzer`,
and `codengine_generator` all depend inward on this package.
