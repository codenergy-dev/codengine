// Analyzer conformance: analyze each codengine-spec case's source.dart and assert
// the definitions deep-equal the shared expected.json — the same file analyzer-ts
// and analyzer-py match, proving descriptor parity. Dart has no catch-all, so cases
// without a source.dart (e.g. catch-all) are skipped.

import 'dart:convert';
import 'dart:io';

import '../lib/codengine_analyzer.dart';

bool deepEquals(dynamic a, dynamic b) {
  if (a is Map && b is Map) {
    if (a.length != b.length) return false;
    for (final key in a.keys) {
      if (!b.containsKey(key) || !deepEquals(a[key], b[key])) return false;
    }
    return true;
  }
  if (a is List && b is List) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }
  return a == b;
}

void main() {
  // test -> package -> codengine-dart -> repo
  final repo = File.fromUri(Platform.script).parent.parent.parent.parent.path;
  final casesDir = Directory('$repo/codengine-spec/conformance/analyzer');

  var passed = 0;
  var failed = 0;
  final cases = casesDir.listSync().whereType<Directory>().toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  for (final caseDir in cases) {
    final source = File('${caseDir.path}/source.dart');
    if (!source.existsSync()) continue;

    final name = caseDir.path.split('/').last;
    final expected = jsonDecode(File('${caseDir.path}/expected.json').readAsStringSync());
    final document = analyzeSource(source.path);

    if (document['language'] == 'dart' && deepEquals(document['definitions'], expected)) {
      passed++;
    } else {
      failed++;
      print('FAIL $name');
      print('  expected: ${jsonEncode(expected)}');
      print('  actual:   ${jsonEncode(document['definitions'])}');
    }
  }

  print('analyzer-dart conformance: $passed passed, $failed failed');
  if (failed > 0) exitCode = 1;
}
