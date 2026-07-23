"""codengine-loader-py: load a Python module's task functions into a function map,
and invoke one by named binding (the invocation contract)."""

from .functions import invoke, load_functions

__all__ = ["load_functions", "invoke"]
