# 0020 — Remote transport (HTTP)

Status: done

## Context

Plan 0017 gave cross-language execution over the **subprocess** transport (a local
worker per foreign language). The **remote** transport is the same conversation over
the network: instead of spawning a local worker, the orchestrator calls a worker that
is **already running** somewhere, over HTTP. It reuses the exact worker handler
(`load`/`call`/`callChain`) — only the pipe changes (stdio → HTTP) — and needs **no new
dependencies** (stdlib HTTP in every language).

Decided with the user: **HTTP** (not WebSocket) for v1; prove it with the **Python**
server first, then the others follow the same mold.

## The model: a remote service owns its own code

A local worker is handed file **paths** (`files`, `root`). That can't work remotely —
the paths are on the orchestrator's machine, not the server's. So a remote worker
**already has its functions loaded** (it was deployed with them); the orchestrator
references it by **name + URL** and never sends code over the wire. This matches the
package/bundle model (0016): a remote module is a deployed package the bundle
references by coordinate + URL.

The server loads its modules at startup from its own config; the orchestrator's
manifest marks a module `{ "transport": "remote", "url": "…" }` (no `functions` needed
for it).

## Security

A remote worker executes code and accepts calls over the network. v1 is
**server-first on a trusted network, no auth** — enough to prove the mechanics.
**Auth + TLS are required before exposing publicly** (documented, not implemented).

## Steps

1. [x] Manifest — a module may declare `transport: "local" | "remote"` (+ `url` when
   remote; `functions` optional when remote). Types, schema (if/then/else),
   validation, resolution. **manifest 19/19** (+3 remote tests).
2. [x] Python worker — `serve_http(modules, port)` (stdlib `http.server`, reusing
   `_handle`); `python -m codengine_worker --http PORT --config worker.json` loads its
   modules at startup and prints the bound port.
3. [x] CLI — a `RemoteWorkerClient` (HTTP `fetch`) and a `Worker` interface both it and
   the subprocess `WorkerClient` satisfy; `RoutingExecutor` now routes per **module**
   (in-process / worker). `runCrossLanguage` → `runRouted`, taken whenever a run is not
   pure-local-single-language (a lone remote module triggers it too).
4. [x] Test — start the Python HTTP worker on an ephemeral port, run a workflow served
   entirely by it. **CLI 17/17, 0 skipped.**
5. [x] Docs: AGENTS, README roadmap, worker-py README, plan done.

TS/Dart/C# HTTP servers follow later in the same mold.

## Outcome / notes

- **The remote transport works**: a workflow served entirely by a Python HTTP worker,
  called by the TS orchestrator over the network, by module name — no local files.
- The routing generalized cleanly: `RoutingExecutor` keys on the **module** (not the
  language), so local-TS / local-foreign-worker / remote-worker compose in one run.
- Security is deliberately deferred: no auth/TLS. The worker binds `127.0.0.1` and the
  docs state auth + TLS are required before public exposure.
- Next: non-TS orchestrators; auth/TLS for remote workers.

### Addendum — HTTP mode for the other three workers

All four workers now serve HTTP (same mold):

- `worker-ts` — `node cli.js --http PORT --config worker.json` (`node:http`).
- `worker-cs` — `dotnet …dll --http PORT --config worker.json` (`HttpListener`;
  ephemeral port via a probe `TcpListener`).
- `worker-dart` — the generated glue's `main` handles `--http PORT` (`dart:io`
  `HttpServer`); functions are baked in, so no `--config`.

Verified end-to-end through the CLI (a temp manifest marks the module remote):
**CLI 20/20, 0 skipped** — a remote worker in each of Python, TS, C#, and Dart.

## Notes

- The wire shape is unchanged: `{ op, module, function|functions, input } ->
  { result | error }` (JSON), just as an HTTP body instead of a stdio line.
- The remote client has nothing to spawn or `close`; `load` is a no-op (the server
  owns its code).
