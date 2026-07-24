/// A persistent Dart worker: the executor side of a cross-language run.
///
/// Dart AOT has no reflection, so the functions cannot be discovered at runtime —
/// they are baked into generated glue (by codengine-generator-dart), which calls
/// [serve] with the resulting map. The worker therefore treats `load` as an
/// acknowledgement. It does not know the workflow graph; all branching stays in the
/// one engine.
library;

import 'dart:convert';
import 'dart:io';

import 'package:codengine_core/codengine_core.dart';

/// Read one JSON request per line and write one JSON response per line.
///
///   { "op": "load",      "module": str, ... }                    -> { "ok": true }
///   { "op": "call",      "module": str, "function": str, "input": obj }
///        -> { "result": any }
///   { "op": "callChain", "module": str, "functions": [str], "input": obj }
///        -> { "result": any, "consumed": int, "input": obj }
Future<void> serve(ModuleFunctions functions, {Stream<List<int>>? input, IOSink? output}) async {
  final sink = output ?? stdout;
  final lines = (input ?? stdin).transform(utf8.decoder).transform(const LineSplitter());
  await for (final line in lines) {
    if (line.trim().isEmpty) continue;
    final request = (jsonDecode(line) as Map).cast<String, dynamic>();
    sink.write('${jsonEncode(await _handle(functions, request))}\n');
    await sink.flush();
  }
}

/// Serve the same requests over HTTP (the `remote` transport). Prints the bound port
/// on the first stdout line, so a caller can use an ephemeral port (`0`).
Future<void> serveHttp(ModuleFunctions functions, int port) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, port);
  stdout.writeln(server.port);
  await for (final request in server) {
    final body = await utf8.decoder.bind(request).join();
    final response = await _handle(functions, (jsonDecode(body) as Map).cast<String, dynamic>());
    request.response
      ..headers.contentType = ContentType.json
      ..write(jsonEncode(response));
    await request.response.close();
  }
}

Future<Map<String, dynamic>> _handle(ModuleFunctions functions, Map<String, dynamic> request) async {
  try {
    final op = request['op'] as String;
    final module = (request['module'] as String?) ?? '';

    switch (op) {
      case 'load':
        // The functions were baked in at generation time; just verify the module.
        if (!functions.containsKey(module)) {
          return {'error': "Module '$module' is not in this worker's generated glue."};
        }
        return {'ok': true};

      case 'call':
        final fn = _resolve(functions, module, request['function'] as String);
        // `await` resolves an async function's Future; a sync value passes through.
        return {'result': await fn(_input(request))};

      case 'callChain':
        var data = _input(request);
        dynamic result = data;
        var fed = data;
        var consumed = 0;
        for (final name in (request['functions'] as List).cast<String>()) {
          final fn = _resolve(functions, module, name);
          fed = data;
          result = await fn(data);
          consumed += 1;
          // Stop at the first non-object result; the engine classifies it.
          if (result is! Map) break;
          data = result.cast<String, dynamic>();
        }
        return {'result': result, 'consumed': consumed, 'input': fed};

      default:
        return {'error': "Unknown op '$op'."};
    }
  } catch (error) {
    return {'error': error.toString()};
  }
}

TaskData _input(Map<String, dynamic> request) =>
    (request['input'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};

TaskFunction _resolve(ModuleFunctions functions, String module, String name) {
  final map = functions[module];
  if (map == null) throw StateError("Module '$module' is not loaded.");
  final fn = map[name];
  if (fn == null) throw StateError("No function '$name' in module '$module'.");
  return fn;
}
