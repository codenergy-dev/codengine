# codengine-core-py

The codengine **contract** for the Python family, in code — the code-level mirror of
[`codengine-spec`](../../codengine-spec/). No logic, no I/O.

- `types.py` — the **execution contract**: `TaskData`, `TaskFunction`, `FunctionMap`,
  `ModuleFunctions`, and `MissingInputError`.
- `task_definition.py` — the **description contract**: `Kind`, `Param`,
  `TaskDefinition`, `TaskDefinitions` (the `TypedDict`s the analyzer produces and a
  generator would consume).

`codengine-analyzer`, `codengine-loader`, and `codengine-runner` all depend inward on
this package.
