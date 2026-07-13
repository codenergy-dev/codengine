"""The codengine IR executor, in Python.

Implements codengine-spec/semantics/execution.md and is a faithful port of
codengine-runner-ts. The runner is "dumb": it trusts the precomputed
executionPlan and only resolves functions and applies the runtime rules.
"""

import inspect
from itertools import product
from typing import Any, Callable, Optional

TaskData = dict[str, Any]
TaskFunction = Callable[..., Any]
FunctionMap = dict[str, TaskFunction]


class MissingInputError(Exception):
    """A required task input (a parameter with no default) was not provided."""


_NAMED_KINDS = (
    inspect.Parameter.POSITIONAL_OR_KEYWORD,
    inspect.Parameter.KEYWORD_ONLY,
)


def _invoke(task: dict, fn: TaskFunction, data: TaskData) -> Any:
    """Call `fn` with `data` bound as named arguments (see the invocation contract).

    Passes only the entries the function declares; if it declares `**kwargs`, passes
    everything. A required parameter (no default) with no matching input raises a
    normalized MissingInputError.
    """
    parameters = inspect.signature(fn).parameters
    named = {name: p for name, p in parameters.items() if p.kind in _NAMED_KINDS}

    missing = [
        name
        for name, p in named.items()
        if p.default is inspect.Parameter.empty and name not in data
    ]
    if missing:
        raise MissingInputError(
            f"Task '{task['name']}': missing required input(s): {', '.join(missing)}"
        )

    if any(p.kind is inspect.Parameter.VAR_KEYWORD for p in parameters.values()):
        return fn(**data)
    return fn(**{name: data[name] for name in named if name in data})


def _euclidean_index(n: int, length: int) -> int:
    return ((n % length) + length) % length


def _cartesian_merge(outputs: list[list[TaskData]]) -> list[TaskData]:
    """Cartesian product of the fanIn outputs, each combination merged into one."""
    merged: list[TaskData] = []
    for combination in product(*outputs):
        item: TaskData = {}
        for part in combination:
            item.update(part)
        merged.append(item)
    return merged


def _format_data(task: dict, data: TaskData, kind: str) -> TaskData:
    """Apply the `^key` (input) / `key$` (output) rename directives from args."""
    directives = [k for k in task["args"] if k.startswith("^") or k.endswith("$")]
    if not directives:
        return data

    result = dict(data)
    for directive in directives:
        is_input = directive.startswith("^")
        source = directive[1:] if is_input else directive[:-1]
        directive_kind = "input" if is_input else "output"
        if directive_kind == kind and source in data:
            target = task["args"][directive]
            result[target] = data[source]
            del result[source]
        result.pop(directive, None)
    return result


def _inject(injected: dict[str, list[TaskData]], target: str, data: TaskData) -> None:
    injected.setdefault(target, []).append(data)


def _classify(
    task: dict,
    result: Any,
    task_input: TaskData,
    outputs: list[TaskData],
    injected: dict[str, list[TaskData]],
) -> bool:
    """Handle one function result. Pushes data outputs, or routes (injecting the
    transferred input into the selected target). Returns True if it routed.

    Classification is by type, never truthiness: {}, 0 and "" are meaningful.
    bool is checked before int (in Python bool is a subclass of int).
    """
    if result is None or result is False:
        return False

    if result is True:
        outputs.append(_format_data(task, task_input, "output"))
        return False

    if isinstance(result, str):
        route = next((r for r in task["routes"] if r["label"] == result), None)
        if route is not None:  # no match -> halt
            _inject(injected, route["target"], task_input)
        return True

    if isinstance(result, int) and not isinstance(result, bool):
        fan_out = task["fanOut"]
        if fan_out:
            target = fan_out[_euclidean_index(result, len(fan_out))]
            _inject(injected, target, task_input)
        return True

    if isinstance(result, list):
        for item in result:
            if not isinstance(item, dict):
                raise ValueError(f"Task '{task['name']}' returned a non-object array item.")
            outputs.append(_format_data(task, item, "output"))
        return False

    if isinstance(result, dict):
        outputs.append(_format_data(task, result, "output"))
        return False

    raise ValueError(
        f"Task '{task['name']}' returned an unsupported value of type {type(result).__name__}."
    )


def run(
    ir: dict,
    functions: FunctionMap,
    entry: str,
    data: Optional[TaskData] = None,
) -> Optional[list[TaskData]]:
    """Run a workflow from `entry` with `data`. Returns the `output` task's
    collected output, or None if it never ran.
    """
    run_input: TaskData = data or {}
    tasks = {task["name"]: task for task in ir["tasks"]}
    if entry not in tasks:
        raise ValueError(f"Unknown entry task '{entry}'.")

    # state: name present -> list[dict] (produced) or None (ran, no data).
    # A name absent from `state` means the task never ran (skipped).
    state: dict[str, Optional[list[TaskData]]] = {}
    injected: dict[str, list[TaskData]] = {}

    for name in tasks[entry]["executionPlan"]:
        task = tasks.get(name)
        if task is None:
            continue

        if name in injected:
            inputs = injected[name]
        else:
            # A required fanIn that ran and produced no data (None) blocks this task.
            blocked = any(
                f not in task["fanInNullable"] and f in state and state[f] is None
                for f in task["fanIn"]
            )
            if blocked:
                continue  # skipped: leave absent
            present = [state[f] for f in task["fanIn"] if isinstance(state.get(f), list)]
            if not present:
                if not task["fanIn"]:
                    inputs = [{}]  # root task
                else:
                    continue  # no producer ran
            else:
                inputs = _cartesian_merge(present)

        # The run input replaces the entry task's declared args.
        args = run_input if name == entry else task["args"]
        fn = functions.get(task["function"])
        if fn is None:
            raise ValueError(f"No function bound for '{task['function']}' (task '{name}').")

        outputs: list[TaskData] = []
        routed = False
        for raw in inputs:
            formatted = _format_data(task, {**raw, **args}, "input")
            if _classify(task, _invoke(task, fn, formatted), formatted, outputs, injected):
                routed = True

        state[name] = None if routed else (outputs if outputs else None)

    return state.get("output")
