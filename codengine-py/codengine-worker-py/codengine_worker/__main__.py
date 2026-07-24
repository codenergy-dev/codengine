"""Entrypoint: `python -m codengine_worker` — the persistent worker the orchestrator
spawns for a Python module in a cross-language run.

Modes:
  (default)                  serve over stdio (the local `subprocess` transport).
  --http PORT --config FILE  serve over HTTP (the `remote` transport). The config is
                             { "modules": { "<name>": { "files": [...], "root": ... } } };
                             those modules are loaded once at startup. PORT 0 picks an
                             ephemeral port (printed on the first stdout line).
"""

import json
import sys

from codengine_loader import load_functions

from .worker import serve, serve_http


def main() -> None:
    args = sys.argv[1:]
    if "--http" in args:
        port = int(args[args.index("--http") + 1])
        with open(args[args.index("--config") + 1], encoding="utf-8") as f:
            config = json.load(f)
        modules = {
            name: load_functions(spec["files"], spec.get("root"))
            for name, spec in config["modules"].items()
        }
        serve_http(modules, port)
    else:
        serve()


if __name__ == "__main__":
    main()
