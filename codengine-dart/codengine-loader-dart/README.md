# codengine-loader-dart

Merge a Dart module's per-file task-function maps into one, detecting name
conflicts. Called by the [generated glue](../codengine-generator-dart/). Pure Dart,
no dependencies.

```dart
import 'package:codengine_loader/codengine_loader.dart';

final functions = mergeFunctions([
  ('a.dart', {'greet': (input) => ...}),
  ('b.dart', {'output': (input) => ...}),
]);
// A name defined in two files throws: rename one, or split into separate modules.
```
