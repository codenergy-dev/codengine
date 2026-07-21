// Runner conformance: for every codengine-spec case with runs/, load all of its
// workflows as a registry and execute each run, asserting expectedOutput. This is
// the SAME suite the TS and Python runners run, so a green result proves Dart
// parity. Hand-rolled (no third-party test package) to stay dependency-free.

import 'dart:convert';
import 'dart:io';

import '../lib/codengine_runner.dart';

// Appends its own name to `trail`, so expectedOutput proves which tasks ran.
TaskFunction trail(String name) =>
    (input) => {'trail': [...(input['trail'] as List? ?? []), name]};

final catalog = <String, Map<String, TaskFunction>>{
  '': {
    'echo': (input) => input,
    'pass': (input) => true,
    'nil': (input) => null,
    'emit': (input) => List.generate(input['n'] as int, (i) => {'i': i}),
    'route': (input) => input['route'],
    'pick': (input) => input['i'],
    'output': (input) => input,
    'start': trail('start'),
  },
  'chain': {
    'a': trail('a'),
    'b': trail('b'),
    'c': trail('c'),
    'd': trail('d'),
    'e': trail('e'),
  },
};

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
  final casesDir = Directory('$repo/codengine-spec/conformance/cases');

  var passed = 0;
  var failed = 0;
  final cases = casesDir.listSync().whereType<Directory>().toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  for (final caseDir in cases) {
    final runsDir = Directory('${caseDir.path}/runs');
    if (!runsDir.existsSync()) continue;

    final workflows = Directory('${caseDir.path}/workflows')
        .listSync()
        .where((f) => f.path.endsWith('.json'))
        .map((f) => jsonDecode(File(f.path).readAsStringSync()))
        .toList();

    final runFiles = runsDir.listSync().where((f) => f.path.endsWith('.json')).toList()
      ..sort((a, b) => a.path.compareTo(b.path));

    for (final runFile in runFiles) {
      final name = '${caseDir.path.split('/').last}/${runFile.path.split('/').last}';
      final spec = jsonDecode(File(runFile.path).readAsStringSync());
      final actual = run(
        workflows,
        catalog,
        spec['entry'] as String,
        (spec['input'] as Map).cast<String, dynamic>(),
      );
      if (deepEquals(actual, spec['expectedOutput'])) {
        passed++;
      } else {
        failed++;
        print('FAIL $name');
        print('  expected: ${jsonEncode(spec['expectedOutput'])}');
        print('  actual:   ${jsonEncode(actual)}');
      }
    }
  }

  print('runner-dart conformance: $passed passed, $failed failed');
  if (failed > 0) exitCode = 1;
}
