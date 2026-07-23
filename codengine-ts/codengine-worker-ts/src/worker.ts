// The persistent worker loop. Reads one JSON request per line from stdin and writes
// one JSON response per line to stdout. The module's functions are loaded once (via
// the loader) and kept alive — the engine sends many cheap calls without reloading.
// The worker does not know the graph; all branching stays in the one engine.

import { createInterface } from "node:readline";
import { loadFunctions } from "codengine-loader-ts";
import type { FunctionMap, TaskData, TaskFunction } from "codengine-core-ts";

type Modules = Record<string, FunctionMap>;

export async function serve(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<void> {
  const modules: Modules = {};
  const rl = createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const request = JSON.parse(trimmed) as Record<string, unknown>;
    const response = await handle(modules, request);
    if ("id" in request) response.id = request.id;
    output.write(`${JSON.stringify(response)}\n`);
  }
}

async function handle(
  modules: Modules,
  request: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    switch (request.op) {
      case "load": {
        modules[request.module as string] = await loadFunctions(request.files as string[]);
        return { ok: true };
      }
      case "call": {
        const fn = resolve(modules, request.module as string, request.function as string);
        return { result: await fn((request.input ?? {}) as TaskData) };
      }
      case "callChain": {
        let data: unknown = request.input ?? {};
        let result: unknown = data;
        let fedInput: unknown = data; // the input given to the function that produced `result`
        let consumed = 0;
        for (const name of request.functions as string[]) {
          const fn = resolve(modules, request.module as string, name);
          fedInput = data;
          result = await fn(data as TaskData);
          consumed += 1;
          // Stop at the first non-object result; the engine classifies it (with its input).
          if (result === null || typeof result !== "object" || Array.isArray(result)) break;
          data = result;
        }
        return { result, consumed, input: fedInput };
      }
      default:
        return { error: `Unknown op '${String(request.op)}'.` };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function resolve(modules: Modules, module: string, fn: string): TaskFunction {
  const functions = modules[module];
  if (!functions) throw new Error(`Module '${module}' is not loaded.`);
  const f = functions[fn];
  if (!f) throw new Error(`No function '${fn}' in module '${module}'.`);
  return f;
}
