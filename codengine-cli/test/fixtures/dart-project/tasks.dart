// Plain top-level Dart functions — no adaptation for codengine. `output` is `async`
// (returns a Future); codengine accepts sync and async task functions alike.
Map<String, dynamic> greet({required String name}) => {'message': 'Hello, $name!'};

Future<Map<String, dynamic>> output(Map<String, dynamic> input) async => input;
