"""Load a user's task functions from a Python module path."""

import importlib.util
import inspect
from typing import Any

from .runtime import FunctionMap


def load_functions(path: str) -> FunctionMap:
    """Import the module at `path` and build a function map.

    Uses the module-level `FUNCTIONS` dict if present (needed when a task name is a
    Python keyword, e.g. `pass`); otherwise collects the module's own top-level
    functions, keyed by name.
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
