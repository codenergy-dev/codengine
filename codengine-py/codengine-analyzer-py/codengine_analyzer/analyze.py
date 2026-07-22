"""Analyze a Python functions module into codengine task definitions.

Uses the standard-library `ast` (never regex) to read each top-level function's
signature and emit the neutral task-definition document defined by
codengine-spec/schema/task-definition.schema.json.
"""

import ast
from typing import Any, Optional

from codengine_core import Param, TaskDefinition, TaskDefinitions

# Native type name -> neutral kind.
_KIND_BY_NAME = {
    "int": "number",
    "float": "number",
    "complex": "number",
    "bool": "boolean",
    "str": "string",
    "list": "array",
    "List": "array",
    "tuple": "array",
    "Tuple": "array",
    "Sequence": "array",
    "set": "array",
    "Set": "array",
    "dict": "object",
    "Dict": "object",
    "Mapping": "object",
}


def analyze_source(path: str) -> TaskDefinitions:
    """Parse the module at `path` and return its task-definition document."""
    with open(path, encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=path)

    definitions = [
        _analyze_function(node)
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and not node.name.startswith("_")
    ]
    return {"version": "1", "language": "py", "definitions": definitions}


def _analyze_function(node: ast.FunctionDef) -> TaskDefinition:
    args = node.args
    params: list[Param] = []

    # positional-or-keyword (posonly are excluded: they can't be bound by name)
    default_offset = len(args.args) - len(args.defaults)
    for index, arg in enumerate(args.args):
        default = args.defaults[index - default_offset] if index >= default_offset else None
        params.append(_param(arg, default, index >= default_offset))

    # keyword-only
    for arg, default in zip(args.kwonlyargs, args.kw_defaults):
        params.append(_param(arg, default, default is not None))

    return {
        "name": node.name,
        "params": params,
        "acceptsExtra": args.kwarg is not None,
    }


def _param(arg: ast.arg, default: Optional[ast.expr], has_default: bool) -> Param:
    kind, nullable = _annotation(arg.annotation)
    param: Param = {
        "name": arg.arg,
        "kind": kind,
        "required": not has_default,
        "nullable": nullable,
    }
    if has_default and isinstance(default, ast.Constant):
        param["default"] = default.value
    return param


def _annotation(node: Optional[ast.expr]) -> tuple[str, bool]:
    """Return (kind, nullable) for a parameter annotation."""
    if node is None:
        return ("any", False)
    inner, nullable = _unwrap_optional(node)
    name = _base_name(inner)
    return (_KIND_BY_NAME.get(name or "", "any"), nullable)


def _unwrap_optional(node: ast.expr) -> tuple[ast.expr, bool]:
    """Strip `Optional[X]` / `Union[X, None]` / `X | None`, returning (inner, nullable)."""
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        if _is_none(node.right):
            return (_unwrap_optional(node.left)[0], True)
        if _is_none(node.left):
            return (_unwrap_optional(node.right)[0], True)
        return (node, False)

    if isinstance(node, ast.Subscript):
        base = _base_name(node.value)
        if base == "Optional":
            return (_unwrap_optional(node.slice)[0], True)
        if base == "Union":
            elements = node.slice.elts if isinstance(node.slice, ast.Tuple) else [node.slice]
            non_none = [e for e in elements if not _is_none(e)]
            nullable = any(_is_none(e) for e in elements)
            if len(non_none) == 1:
                inner, inner_nullable = _unwrap_optional(non_none[0])
                return (inner, nullable or inner_nullable)
            return (node, nullable)

    return (node, False)


def _is_none(node: ast.expr) -> bool:
    return (isinstance(node, ast.Constant) and node.value is None) or (
        isinstance(node, ast.Name) and node.id == "None"
    )


def _base_name(node: Any) -> Optional[str]:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    if isinstance(node, ast.Subscript):
        return _base_name(node.value)
    return None
