# codengine-generator-dart

Generate the Dart **glue** that binds a module's plain functions for the runner, and
serve as the Dart subprocess entrypoint.

- `lib/src/generate.dart` — task definitions (from the [analyzer](../codengine-analyzer-dart/))
  → glue source: for each function a `(Map input) => fn(name: input['name'])` wrapper
  (named binding, no reflection, extras dropped) or `fn(input)` for a whole-`Map`
  function.
- `bin/run.dart` — `dart run codengine_generator:run`: reads
  `{ workflows, entry, input, functions: { <module>: { files, root } } }` from stdin,
  writes glue in `<root>/.codengine/`, runs it in the root's package context, and
  relays `{ result }`. This is what the codengine orchestrator spawns for Dart.

The generated glue imports `package:codengine_runner`, `package:codengine_loader`,
and the user's files — so a Dart project depends on those three packages.
