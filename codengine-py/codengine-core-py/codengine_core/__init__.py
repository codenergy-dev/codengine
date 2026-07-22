"""codengine-core-py: the codengine contract in Python — the code-level mirror of
codengine-spec. The execution contract (data + function types) and the description
contract (task definitions). No logic, no I/O."""

from .task_definition import Kind, Param, TaskDefinition, TaskDefinitions
from .types import (
    FunctionMap,
    MissingInputError,
    ModuleFunctions,
    TaskData,
    TaskFunction,
)

__all__ = [
    "TaskData",
    "TaskFunction",
    "FunctionMap",
    "ModuleFunctions",
    "MissingInputError",
    "Kind",
    "Param",
    "TaskDefinition",
    "TaskDefinitions",
]
