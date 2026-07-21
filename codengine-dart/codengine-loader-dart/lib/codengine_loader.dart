/// Merge a module's per-file task-function maps into one, detecting name conflicts.
library;

typedef TaskFunction = dynamic Function(Map<String, dynamic> input);

/// Merge `(filePath, functions)` entries. A name defined in two files is a conflict
/// (rename one, or split them into separate modules). Called by the generated glue.
Map<String, TaskFunction> mergeFunctions(List<(String, Map<String, TaskFunction>)> files) {
  final merged = <String, TaskFunction>{};
  final origin = <String, String>{};
  for (final (path, functions) in files) {
    functions.forEach((name, fn) {
      if (merged.containsKey(name)) {
        throw StateError("Duplicate task function '$name' in module:\n"
            "  ${origin[name]}\n  $path\n"
            'Rename one, or split them into separate modules.');
      }
      merged[name] = fn;
      origin[name] = path;
    });
  }
  return merged;
}
