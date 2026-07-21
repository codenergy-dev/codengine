#!/usr/bin/env node
// Subprocess protocol entrypoint. Reads a request from stdin and writes a response
// to stdout, both JSON:
//   in:  { workflows, entry, input, functions: { <module>: { files, root } } }
//   out: { result } | { error }
// The orchestrator launches this with `node --experimental-strip-types` so a TS
// module's source `.ts` functions load directly — the same subprocess shape as the
// Python runner.

import { loadFunctions } from "codengine-loader-ts";
import { run } from "./index.js";
import type { ModuleFunctions } from "./index.js";

interface ModuleSpec {
  files: string[];
  root: string | null;
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));

  const functions: ModuleFunctions = {};
  for (const [module, spec] of Object.entries(request.functions as Record<string, ModuleSpec>)) {
    functions[module] = await loadFunctions(spec.files);
  }

  const result = run(request.workflows, functions, request.entry, request.input ?? {});
  process.stdout.write(JSON.stringify({ result }));
}

main().catch((error: unknown) => {
  process.stdout.write(
    JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
  );
  process.exitCode = 1;
});
