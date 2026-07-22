"""The codengine description contract: the task-definition types an analyzer produces
and a generator consumes. Mirror of
codengine-spec/schema/task-definition.schema.json."""

from typing import Any, Literal, TypedDict

Kind = Literal["number", "boolean", "string", "array", "object", "any"]


class Param(TypedDict, total=False):
    """A named parameter. `default` is present only for an optional parameter."""

    name: str
    kind: Kind
    required: bool
    nullable: bool
    default: Any


class TaskDefinition(TypedDict):
    name: str
    params: list[Param]
    acceptsExtra: bool


class TaskDefinitions(TypedDict):
    version: str
    language: str
    definitions: list[TaskDefinition]
