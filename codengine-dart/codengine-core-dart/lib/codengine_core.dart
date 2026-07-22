/// The codengine contract for Dart, in code - the code-level mirror of
/// codengine-spec. The execution contract (data + function types) and the
/// description contract (task definitions). No logic, no I/O.
library;

/// A single input/output object flowing between tasks.
typedef TaskData = Map<String, dynamic>;

/// A task function. The engine calls it structurally with one map; named-argument
/// binding for Dart source is done by the generated glue, not here.
typedef TaskFunction = dynamic Function(TaskData input);

/// Functions bound per module namespace; `""` is the default module.
typedef ModuleFunctions = Map<String, Map<String, TaskFunction>>;

/// The description contract: a single task definition and the document of them, as
/// the analyzer produces and a generator consumes them (dict-shaped:
/// `{ name, params, acceptsExtra }` / `{ version, language, definitions }`).
typedef TaskDefinition = Map<String, dynamic>;
typedef TaskDefinitions = Map<String, dynamic>;
