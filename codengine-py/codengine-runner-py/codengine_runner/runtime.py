"""The codengine IR executor, in Python.

Implements codengine-spec/semantics/execution.md and is a faithful port of
codengine-runner-ts. The runner is "dumb": it trusts the precomputed
executionPlan and only resolves functions and applies the runtime rules.
"""

from itertools import product
from typing import Any, Optional

from codengine_core import FunctionMap, ModuleFunctions, TaskData, TaskFunction
from codengine_loader import invoke


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


def _build_entrypoint_index(workflows: list[dict]) -> dict[str, str]:
    """Index every entrypoint address to the workflow that owns it. An address may be
    an entrypoint in at most one workflow — otherwise the chain is ambiguous.
    """
    index: dict[str, str] = {}
    for workflow in workflows:
        for task in workflow["tasks"]:
            if not task["entrypoint"]:
                continue
            owner = index.get(task["name"])
            if owner is not None:
                raise ValueError(
                    f"Address '{task['name']}' is an entrypoint in more than one workflow:\n"
                    f"  {owner}\n  {workflow['workflow']}\n"
                    "An address may be an entrypoint in at most one workflow."
                )
            index[task["name"]] = workflow["workflow"]
    return index


def _resolve_function(functions: ModuleFunctions, task: dict) -> TaskFunction:
    module = task["module"] or ""
    fn = functions.get(module, {}).get(task["function"])
    if fn is None:
        label = "the default module" if module == "" else f"module '{module}'"
        raise ValueError(
            f"No function '{task['function']}' bound in {label} (task '{task['name']}')."
        )
    return fn


def run(
    workflows: list[dict],
    functions: ModuleFunctions,
    entry: str,
    data: Optional[TaskData] = None,
) -> Optional[list[TaskData]]:
    """Run a workflow registry from the `entry` address with `data`. Returns the
    `output` task's collected output of the workflow that owns the entry, or None.
    """
    run_input: TaskData = data or {}
    registry = {workflow["workflow"]: workflow for workflow in workflows}
    entrypoints = _build_entrypoint_index(workflows)

    target = entrypoints.get(entry)
    isolated = False
    if target is None:
        # Not an entrypoint anywhere: a unit call of that address, wherever declared.
        for name, ir in registry.items():
            if any(task["name"] == entry for task in ir["tasks"]):
                target = name
                isolated = True
                break
    if target is None:
        raise ValueError(f"Unknown entry address '{entry}'.")

    state = _execute_workflow(
        registry, functions, entrypoints, target, entry, run_input, isolated
    )
    return state.get("output")


def _execute_workflow(
    registry: dict[str, dict],
    functions: ModuleFunctions,
    entrypoints: dict[str, str],
    workflow_name: str,
    entry_task: str,
    run_input: TaskData,
    isolated: bool,
) -> dict[str, Optional[list[TaskData]]]:
    ir = registry.get(workflow_name)
    if ir is None:
        raise ValueError(f"Unknown workflow '{workflow_name}'.")
    tasks = {task["name"]: task for task in ir["tasks"]}
    entry = tasks.get(entry_task)
    if entry is None:
        raise ValueError(f"Unknown task '{entry_task}' in workflow '{workflow_name}'.")

    # An isolated entry is a unit call: only that task, ignoring its fanIn.
    plan = [entry_task] if isolated else entry["executionPlan"]

    # state: name present -> list (produced) or None (ran, no data).
    # A name absent from `state` means the task never ran (skipped).
    state: dict[str, Optional[list[TaskData]]] = {}
    injected: dict[str, list[TaskData]] = {}

    for name in plan:
        task = tasks.get(name)
        if task is None:
            continue
        if name in state:
            continue  # already resolved (e.g. mirrored from a sub-run)

        if name in injected:
            inputs = injected[name]
        elif isolated and name == entry_task:
            inputs = [{}]
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
        args = run_input if name == entry_task else task["args"]

        # Cross-workflow call: this address is an entrypoint in another workflow, so
        # that workflow's chain runs and its results are mirrored back here.
        chain_owner = entrypoints.get(name)
        if chain_owner is not None and chain_owner != workflow_name:
            mirrored: dict[str, list[TaskData]] = {}
            for raw in inputs:
                sub_input = _format_data(task, {**raw, **args}, "input")
                sub_state = _execute_workflow(
                    registry, functions, entrypoints, chain_owner, name, sub_input, False
                )
                for sub_name, sub_output in sub_state.items():
                    if sub_name not in tasks or not isinstance(sub_output, list):
                        continue
                    mirrored.setdefault(sub_name, []).extend(sub_output)
            for mirrored_name, outputs in mirrored.items():
                if mirrored_name not in state:
                    state[mirrored_name] = outputs
            if name not in state:
                state[name] = None
            continue

        fn = _resolve_function(functions, task)
        outputs = []
        routed = False
        for raw in inputs:
            formatted = _format_data(task, {**raw, **args}, "input")
            if _classify(task, invoke(fn, formatted, task["name"]), formatted, outputs, injected):
                routed = True

        state[name] = None if routed else (outputs if outputs else None)

    return state
