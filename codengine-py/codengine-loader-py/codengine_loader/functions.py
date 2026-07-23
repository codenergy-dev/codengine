"""Load a user's task functions from one or more Python module paths, within the
module's project environment (its `root`), and invoke one by named binding."""

import asyncio
import importlib.util
import inspect
import sys
from typing import Any, Optional, Union

from codengine_core import FunctionMap, MissingInputError, TaskData, TaskFunction

_NAMED_KINDS = (
    inspect.Parameter.POSITIONAL_OR_KEYWORD,
    inspect.Parameter.KEYWORD_ONLY,
)


def invoke(fn: TaskFunction, data: TaskData, label: Optional[str] = None) -> Any:
    """Call `fn` with `data` bound as named arguments (the invocation contract).

    Passes only the entries the function declares; if it declares `**kwargs`, passes
    everything. A required parameter (no default) with no matching input raises a
    normalized MissingInputError. `label` names the caller (a task or a function) in
    that error. Used by both the runner's engine and the worker's executor.
    """
    label = label or getattr(fn, "__name__", "function")
    parameters = inspect.signature(fn).parameters
    named = {name: p for name, p in parameters.items() if p.kind in _NAMED_KINDS}

    missing = [
        name
        for name, p in named.items()
        if p.default is inspect.Parameter.empty and name not in data
    ]
    if missing:
        raise MissingInputError(
            f"Task '{label}': missing required input(s): {', '.join(missing)}"
        )

    if any(p.kind is inspect.Parameter.VAR_KEYWORD for p in parameters.values()):
        result = fn(**data)
    else:
        result = fn(**{name: data[name] for name in named if name in data})

    # Accept both sync and async task functions: resolve a coroutine to its value.
    if inspect.isawaitable(result):
        result = asyncio.run(result)
    return result


def load_functions(paths: Union[str, list[str]], root: Optional[str] = None) -> FunctionMap:
    """Load task functions from one or more files and merge them.

    `root` is the module's project directory (its dependency environment); it is put
    on `sys.path` so the functions' own imports — sibling modules and installed
    packages — resolve. A name defined in two files is a conflict (rename one, or
    split into separate modules).
    """
    if isinstance(paths, str):
        paths = [paths]
    if root and root not in sys.path:
        sys.path.insert(0, root)

    functions: FunctionMap = {}
    origin: dict[str, str] = {}
    for path in paths:
        for name, fn in _load_file(path).items():
            if name in functions:
                raise ValueError(
                    f"Duplicate task function '{name}' in module:\n"
                    f"  {origin[name]}\n  {path}\n"
                    "Rename one, or split them into separate modules."
                )
            functions[name] = fn
            origin[name] = path
    return functions


def _load_file(path: str) -> FunctionMap:
    """Load one module's functions: an explicit `FUNCTIONS` dict, or its top-level
    functions keyed by name.
    """
    spec = importlib.util.spec_from_file_location("_codengine_user_functions", path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load functions module '{path}'.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    explicit = getattr(module, "FUNCTIONS", None)
    if isinstance(explicit, dict):
        return dict(explicit)

    functions: FunctionMap = {}
    for name, value in vars(module).items():
        if name.startswith("_"):
            continue
        if inspect.isfunction(value) and value.__module__ == module.__name__:
            functions[name] = value
    return functions
