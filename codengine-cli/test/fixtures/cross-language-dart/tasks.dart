// Default module (Dart): the "output" collector, run via a warm Dart worker whose
// glue is generated (Dart AOT has no reflection). It is `async` — codengine accepts
// sync and async task functions alike.
Future<Map<String, dynamic>> output({required String message}) async => {'message': message};
