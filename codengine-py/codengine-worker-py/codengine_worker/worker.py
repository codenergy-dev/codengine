"""The persistent worker loop. Reads one JSON request per line from stdin and writes
one JSON response per line to stdout (flushed). The project is loaded once (via the
loader) and kept alive — the engine sends many cheap calls without reloading.

Requests (each may carry an "id", echoed back):
  { "op": "load", "module": str, "files": [str], "root": str | null }
      -> { "ok": true } | { "error": str }
  { "op": "call", "module": str, "function": str, "input": object }
      -> { "result": any } | { "error": str }
  { "op": "callChain", "module": str, "functions": [str], "input": object }
      -> { "result": any, "consumed": int } | { "error": str }
      Runs the functions in order, feeding each object result to the next; stops at
      the first non-object result (which the engine classifies) — "consumed" is how
      many ran. This is the linear-segment optimization; all branching stays in the
      engine.
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import IO

from codengine_core import ModuleFunctions
from codengine_loader import invoke, load_functions


def serve(stdin: IO[str] = sys.stdin, stdout: IO[str] = sys.stdout) -> None:
    modules: ModuleFunctions = {}
    for line in stdin:
        line = line.strip()
        if not line:
            continue
        request = json.loads(line)
        response = _handle(modules, request)
        if "id" in request:
            response["id"] = request["id"]
        stdout.write(json.dumps(response) + "\n")
        stdout.flush()


def _handle(modules: ModuleFunctions, request: dict) -> dict:
    try:
        op = request["op"]
        if op == "load":
            modules[request["module"]] = load_functions(request["files"], request.get("root"))
            return {"ok": True}
        if op == "call":
            fn = _resolve(modules, request["module"], request["function"])
            return {"result": invoke(fn, request.get("input") or {}, request["function"])}
        if op == "callChain":
            data = request.get("input") or {}
            result = data
            fed_input = data  # the input given to the function that produced `result`
            consumed = 0
            for name in request["functions"]:
                fn = _resolve(modules, request["module"], name)
                fed_input = data
                result = invoke(fn, data, name)
                consumed += 1
                if not isinstance(result, dict):
                    break  # the engine classifies a non-object result (with its input)
                data = result
            return {"result": result, "consumed": consumed, "input": fed_input}
        return {"error": f"Unknown op '{op}'."}
    except Exception as error:  # noqa: BLE001 - report any failure over the protocol
        return {"error": str(error)}


def serve_http(modules: ModuleFunctions, port: int = 0) -> None:
    """Serve the same requests over HTTP (the `remote` transport). The modules are
    already loaded (this service owns its code); each POST body is one request. Prints
    the bound port on the first stdout line, so a caller can use an ephemeral port.
    """

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            length = int(self.headers.get("content-length", 0))
            request = json.loads(self.rfile.read(length).decode("utf-8"))
            body = json.dumps(_handle(modules, request)).encode("utf-8")
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args: object) -> None:  # keep stdout clean
            pass

    server = HTTPServer(("127.0.0.1", port), Handler)
    print(server.server_address[1], flush=True)
    server.serve_forever()


def _resolve(modules: ModuleFunctions, module: str, function: str):
    functions = modules.get(module)
    if functions is None:
        raise ValueError(f"Module '{module}' is not loaded.")
    fn = functions.get(function)
    if fn is None:
        raise ValueError(f"No function '{function}' in module '{module}'.")
    return fn
