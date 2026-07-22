# codengine-dart

The Dart language family for codengine — the first **compiled** language. Because
Dart AOT has no runtime reflection, the full pipeline is needed; the user still
writes **plain top-level functions** and only lists them in `codengine.json`.

| Package | Role |
|---|---|
| [`codengine-core-dart`](codengine-core-dart/) | the contract: the execution typedefs (`TaskData`/`TaskFunction`/`ModuleFunctions`) and the description typedefs. |
| [`codengine-analyzer-dart`](codengine-analyzer-dart/) | source → task definitions (via the `analyzer` package). |
| [`codengine-generator-dart`](codengine-generator-dart/) | task definitions → generated **glue**: `(Map input) => fn(name: input['name'])` wrappers (named binding, no reflection, extras dropped). Also the subprocess entrypoint (`dart run codengine_generator:run`) that generates, runs, and relays. |
| [`codengine-loader-dart`](codengine-loader-dart/) | merge a module's per-file function maps, detecting name conflicts (called by the glue). |
| [`codengine-runner-dart`](codengine-runner-dart/) | execute the IR (a port of the runtime); deals with `dynamic Function(Map)`. |

## How a Dart run works

The orchestrator runs `dart run codengine_generator:run` in the module's package
`root`, sending `{ workflows, entry, input, functions: { <module>: { files, root } } }`
on stdin. The generator analyzes the files, writes glue in `<root>/.codengine/`
that imports the user's functions + the runner + the loader, runs it, and relays
`{ result }`. The compiled shape: the **files are baked into the glue**; only the
run payload flows over stdin.

A Dart project using codengine adds three dev dependencies (`codengine_runner`,
`codengine_loader`, `codengine_generator`) and writes ordinary functions:

```dart
Map<String, dynamic> greet({required String name}) => {'message': 'Hello, $name!'};
Map<String, dynamic> output(Map<String, dynamic> input) => input; // whole-input collector
```

Both are bound automatically — named params via `fn(name: …)`, a whole-`Map`
positional param via `fn(input)`.
