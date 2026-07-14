"""Load a user's task functions from one or more Python module paths."""

import importlib.util
import inspect
from typing import Union

from .runtime import FunctionMap


def load_functions(paths: Union[str, list[str]]) -> FunctionMap:
    """Load task functions from one or more files and merge them.

    A name defined in two files is a conflict (rename one, or split into separate
    modules).
    """
    if isinstance(paths, str):
        paths = [paths]

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
