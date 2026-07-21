# codengine-analyzer-dart

Analyze Dart task functions into codengine **task definitions**, using the
`analyzer` package (never regex). Produces the neutral document from
[`task-definition.schema.json`](../../codengine-spec/schema/task-definition.schema.json):
each function's named params (`kind`, `required`, `nullable`, `default`), and
`acceptsExtra` for a whole-`Map` positional param.

```dart
import 'package:codengine_analyzer/codengine_analyzer.dart';

final doc = analyzeSource('tasks.dart');
```

`dart test/conformance.dart` asserts the definitions deep-equal the shared
`expected.json` (the same file analyzer-ts / analyzer-py match). Dart has no
catch-all, so that case has no `source.dart` and is skipped.
