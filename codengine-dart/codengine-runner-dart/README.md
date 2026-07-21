# codengine-runner-dart

Execute the codengine **IR** in Dart — the engine, a port of the TS/Python runtime.
It deals with `dynamic Function(Map)`; named-argument binding for Dart source is the
[generator](../codengine-generator-dart/)'s job. Pure Dart, no dependencies.

```dart
import 'package:codengine_runner/codengine_runner.dart';

final result = run(workflows, functions, 'greet', {'name': 'Dart'});
// functions: { '<module>': { '<name>': (Map input) => ... } }
```

`dart test/conformance.dart` runs the shared [spec fixtures](../../codengine-spec/conformance/)
with a Dart catalog — the same 16 runs the TS and Python runners pass, proving parity.
