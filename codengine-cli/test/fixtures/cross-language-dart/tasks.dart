// Default module (Dart): the "output" collector, run via a warm Dart worker whose
// glue is generated (Dart AOT has no reflection).
Map<String, dynamic> output({required String message}) => {'message': message};
