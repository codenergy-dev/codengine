// The codengine IR executor, in Dart. Implements
// codengine-spec/semantics/execution.md and is a faithful port of
// codengine-runner-ts / codengine-runner-py. The runner is "dumb": it trusts the
// precomputed executionPlan and only resolves functions and applies the rules.

import 'package:codengine_core/codengine_core.dart';

int _euclideanIndex(int n, int length) => ((n % length) + length) % length;

// Cartesian product of the fanIn outputs, each combination merged into one map.
List<TaskData> _cartesianMerge(List<List<TaskData>> outputs) {
  var combinations = <List<TaskData>>[[]];
  for (final list in outputs) {
    final next = <List<TaskData>>[];
    for (final combination in combinations) {
      for (final item in list) {
        next.add([...combination, item]);
      }
    }
    combinations = next;
  }
  return combinations.map((combination) {
    final merged = <String, dynamic>{};
    for (final part in combination) {
      merged.addAll(part);
    }
    return merged;
  }).toList();
}

// Apply the `^key` (input) / `key$` (output) rename directives declared in args.
TaskData _formatData(Map task, TaskData data, String type) {
  final args = (task['args'] as Map).cast<String, dynamic>();
  final directives = args.keys.where((k) => k.startsWith('^') || k.endsWith(r'$')).toList();
  if (directives.isEmpty) return data;

  final result = Map<String, dynamic>.from(data);
  for (final directive in directives) {
    final isInput = directive.startsWith('^');
    final source =
        isInput ? directive.substring(1) : directive.substring(0, directive.length - 1);
    final kind = isInput ? 'input' : 'output';
    if (kind == type && data.containsKey(source)) {
      final target = args[directive] as String;
      result[target] = data[source];
      result.remove(source);
    }
    result.remove(directive);
  }
  return result;
}

void _inject(Map<String, List<TaskData>> injected, String target, TaskData input) {
  injected.putIfAbsent(target, () => []).add(input);
}

// Handle one function result. Pushes data outputs, or routes (injecting the
// transferred input into the selected target). Returns true if it routed.
// Classify by type, never truthiness: {}, 0 and "" are meaningful. bool is not an
// int in Dart, so `is int` excludes booleans.
bool _classify(
  Map task,
  dynamic result,
  TaskData input,
  List<TaskData> outputs,
  Map<String, List<TaskData>> injected,
) {
  if (result == null || result == false) return false;

  if (result == true) {
    outputs.add(_formatData(task, input, 'output'));
    return false;
  }

  if (result is String) {
    final routes = (task['routes'] as List).cast<Map>();
    for (final route in routes) {
      if (route['label'] == result) {
        _inject(injected, route['target'] as String, input); // no match -> halt
        break;
      }
    }
    return true;
  }

  if (result is int) {
    final fanOut = (task['fanOut'] as List).cast<String>();
    if (fanOut.isNotEmpty) {
      _inject(injected, fanOut[_euclideanIndex(result, fanOut.length)], input);
    }
    return true;
  }

  if (result is List) {
    for (final item in result) {
      if (item is! Map) {
        throw StateError("Task '${task['name']}' returned a non-object array item.");
      }
      outputs.add(_formatData(task, item.cast<String, dynamic>(), 'output'));
    }
    return false;
  }

  if (result is Map) {
    outputs.add(_formatData(task, result.cast<String, dynamic>(), 'output'));
    return false;
  }

  throw StateError(
      "Task '${task['name']}' returned an unsupported value of type ${result.runtimeType}.");
}

// Index every entrypoint address to the workflow that owns it. An address may be an
// entrypoint in at most one workflow — otherwise the chain to trigger is ambiguous.
Map<String, String> _buildEntrypointIndex(List workflows) {
  final index = <String, String>{};
  for (final workflow in workflows) {
    for (final task in workflow['tasks']) {
      if (task['entrypoint'] != true) continue;
      final name = task['name'] as String;
      if (index.containsKey(name)) {
        throw StateError("Address '$name' is an entrypoint in more than one workflow:\n"
            "  ${index[name]}\n  ${workflow['workflow']}\n"
            'An address may be an entrypoint in at most one workflow.');
      }
      index[name] = workflow['workflow'] as String;
    }
  }
  return index;
}

TaskFunction _resolveFunction(ModuleFunctions functions, Map task) {
  final module = (task['module'] as String?) ?? '';
  final fn = functions[module]?[task['function']];
  if (fn == null) {
    final label = module == '' ? 'the default module' : "module '$module'";
    throw StateError("No function '${task['function']}' bound in $label (task '${task['name']}').");
  }
  return fn;
}

/// Run a workflow registry from the `entry` address with `input`. Returns the
/// `output` task's collected output of the workflow that owns the entry, or null.
///
/// Async because a user's task function may be `async` (return a `Future`), which Dart
/// cannot resolve synchronously — the engine `await`s each call. A synchronous
/// function is awaited transparently.
Future<List<TaskData>?> run(
    List workflows, ModuleFunctions functions, String entry, [TaskData? input]) async {
  final runInput = input ?? <String, dynamic>{};
  final registry = {for (final w in workflows) w['workflow'] as String: w as Map};
  final entrypoints = _buildEntrypointIndex(workflows);

  var target = entrypoints[entry];
  var isolated = false;
  if (target == null) {
    for (final entryPair in registry.entries) {
      if ((entryPair.value['tasks'] as List).any((t) => t['name'] == entry)) {
        target = entryPair.key;
        isolated = true;
        break;
      }
    }
  }
  if (target == null) throw StateError("Unknown entry address '$entry'.");

  final state =
      await _executeWorkflow(registry, functions, entrypoints, target, entry, runInput, isolated);
  return state['output'];
}

Future<Map<String, List<TaskData>?>> _executeWorkflow(
  Map registry,
  ModuleFunctions functions,
  Map<String, String> entrypoints,
  String workflowName,
  String entryTask,
  TaskData runInput,
  bool isolated,
) async {
  final ir = registry[workflowName];
  if (ir == null) throw StateError("Unknown workflow '$workflowName'.");
  final tasks = {for (final t in ir['tasks']) t['name'] as String: t as Map};
  final entry = tasks[entryTask];
  if (entry == null) throw StateError("Unknown task '$entryTask' in workflow '$workflowName'.");

  // An isolated entry is a unit call: only that task, ignoring its fanIn.
  final plan = isolated ? [entryTask] : (entry['executionPlan'] as List).cast<String>();

  // state: name present -> list (produced) or null (ran, no data). A name absent
  // from `state` means the task never ran (skipped).
  final state = <String, List<TaskData>?>{};
  final injected = <String, List<TaskData>>{};

  for (final name in plan) {
    final task = tasks[name];
    if (task == null) continue;
    if (state.containsKey(name)) continue; // already resolved (e.g. mirrored)

    List<TaskData> inputs;
    if (injected.containsKey(name)) {
      inputs = injected[name]!;
    } else if (isolated && name == entryTask) {
      inputs = [<String, dynamic>{}];
    } else {
      final fanIn = (task['fanIn'] as List).cast<String>();
      final nullable = (task['fanInNullable'] as List).cast<String>();
      // A required fanIn that ran and produced no data (null) blocks this task.
      final blocked =
          fanIn.any((f) => !nullable.contains(f) && state.containsKey(f) && state[f] == null);
      if (blocked) continue; // skipped: leave absent

      final present = <List<TaskData>>[];
      for (final f in fanIn) {
        final out = state[f];
        if (out != null) present.add(out);
      }
      if (present.isEmpty) {
        if (fanIn.isEmpty) {
          inputs = [<String, dynamic>{}]; // root task
        } else {
          continue; // no producer ran
        }
      } else {
        inputs = _cartesianMerge(present);
      }
    }

    // The run input replaces the entry task's declared args.
    final args = name == entryTask ? runInput : (task['args'] as Map).cast<String, dynamic>();

    // Cross-workflow call: this address is an entrypoint in another workflow, so that
    // workflow's chain runs and its results are mirrored back here.
    final chainOwner = entrypoints[name];
    if (chainOwner != null && chainOwner != workflowName) {
      final mirrored = <String, List<TaskData>>{};
      for (final raw in inputs) {
        final subInput = _formatData(task, {...raw, ...args}, 'input');
        final subState = await _executeWorkflow(
            registry, functions, entrypoints, chainOwner, name, subInput, false);
        subState.forEach((subName, subOutput) {
          if (!tasks.containsKey(subName) || subOutput == null) return;
          mirrored.putIfAbsent(subName, () => []).addAll(subOutput);
        });
      }
      mirrored.forEach((mirroredName, outs) {
        state.putIfAbsent(mirroredName, () => outs);
      });
      state.putIfAbsent(name, () => null);
      continue;
    }

    final fn = _resolveFunction(functions, task);
    final outputs = <TaskData>[];
    var routed = false;
    for (final raw in inputs) {
      final formatted = _formatData(task, {...raw, ...args}, 'input');
      // `await` resolves an async task function's Future; a sync value passes through.
      if (_classify(task, await fn(formatted), formatted, outputs, injected)) routed = true;
    }
    state[name] = routed ? null : (outputs.isNotEmpty ? outputs : null);
  }

  return state;
}
