"""Subprocess protocol entrypoint: `python -m codengine_runner`.

Reads a request from stdin and writes a response to stdout, both JSON:

    in:  { "workflows": [<WorkflowIR>], "entry": str, "input": object,
           "functions": { "<module>": { "files": [<file>], "root": str | null } } }
    out: { "result": object[] | null }   or   { "error": str }

This is how the codengine orchestrator (codengine-cli) runs a Python workflow as a
subprocess — the generalization of the pypeyuml venv/JSON pattern.
"""

import json
import sys

from codengine_loader import load_functions

from .runtime import run


def main() -> int:
    try:
        request = json.load(sys.stdin)
        functions = {
            module: load_functions(spec["files"], spec.get("root"))
            for module, spec in request["functions"].items()
        }
        result = run(
            request["workflows"],
            functions,
            request["entry"],
            request.get("input") or {},
        )
        json.dump({"result": result}, sys.stdout)
        return 0
    except Exception as error:  # noqa: BLE001 - report any failure over the protocol
        json.dump({"error": str(error)}, sys.stdout)
        return 1


if __name__ == "__main__":
    sys.exit(main())
