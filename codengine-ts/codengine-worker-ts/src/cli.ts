#!/usr/bin/env node
// Entrypoint: the persistent worker the orchestrator spawns for a TS/JS module.
//   (default)                  serve over stdio (the local `subprocess` transport).
//   --http PORT --config FILE  serve over HTTP (the `remote` transport); the config is
//                              { "modules": { "<name>": { "files": [...] } } }.
import { loadModulesFromConfig, serve, serveHttp } from "./worker.js";

function fail(error: unknown): never {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("--http")) {
  const port = Number(args[args.indexOf("--http") + 1]);
  loadModulesFromConfig(args[args.indexOf("--config") + 1])
    .then((modules) => serveHttp(modules, port))
    .catch(fail);
} else {
  serve().catch(fail);
}
