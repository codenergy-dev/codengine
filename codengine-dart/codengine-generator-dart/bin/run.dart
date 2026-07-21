// Subprocess entrypoint for a Dart module: reads the protocol from stdin, generates
// the glue in <root>/.codengine, runs it (in the root's package context), and relays
// the result. This is how the codengine orchestrator runs Dart — the compiled-language
// shape: the function files are baked into the generated glue, while
// { workflows, entry, input } arrive on stdin.
//
//   in:  { workflows, entry, input, functions: { <module>: { files, root } } }
//   out: { result } | { error }

import 'dart:convert';
import 'dart:io';

import 'package:codengine_generator/src/generate.dart';
import 'package:path/path.dart' as p;

Future<void> main() async {
  try {
    final request = jsonDecode(await stdin.transform(utf8.decoder).join());
    final modules = (request['functions'] as Map).cast<String, dynamic>();

    // One Dart root per run (multi-root Dart is a future limit).
    final roots = modules.values.map((m) => (m as Map)['root'] as String).toSet();
    if (roots.length != 1) {
      throw StateError('Dart modules must share one root; got: ${roots.join(', ')}');
    }
    final root = roots.first;

    final glueDir = Directory(p.join(root, '.codengine'))..createSync(recursive: true);
    final gluePath = p.join(glueDir.path, 'main.dart');
    File(gluePath).writeAsStringSync(generateGlue(modules, glueDir.path));

    final process = await Process.start(
      'dart',
      ['run', p.relative(gluePath, from: root)],
      workingDirectory: root,
    );
    process.stdin.write(jsonEncode({
      'workflows': request['workflows'],
      'entry': request['entry'],
      'input': request['input'],
    }));
    await process.stdin.close();

    final out = await process.stdout.transform(utf8.decoder).join();
    final err = await process.stderr.transform(utf8.decoder).join();
    if (await process.exitCode != 0) {
      stdout.write(jsonEncode({'error': err.trim().isNotEmpty ? err.trim() : 'glue failed'}));
      exitCode = 1;
      return;
    }
    stdout.write(out); // the glue already wrote { "result": ... }
  } catch (error) {
    stdout.write(jsonEncode({'error': error.toString()}));
    exitCode = 1;
  }
}
