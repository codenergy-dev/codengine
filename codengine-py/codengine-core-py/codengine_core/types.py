"""The codengine execution contract in Python: the data and function types."""

from typing import Any, Callable

#: A single input/output object flowing between tasks.
TaskData = dict[str, Any]
#: A task function; called with named arguments (the invocation contract).
TaskFunction = Callable[..., Any]
FunctionMap = dict[str, TaskFunction]
#: Functions bound per module namespace; "" is the default module.
ModuleFunctions = dict[str, FunctionMap]


class MissingInputError(Exception):
    """A required task input (a parameter with no default) was not provided."""
