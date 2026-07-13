import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { FunctionMap, TaskFunction } from "codengine-runner-ts";

/**
 * Load TS/JS task functions from a module: its named function exports, and/or a
 * default export that is an object of functions.
 */
export async function loadFunctions(modulePath: string): Promise<FunctionMap> {
  const module: Record<string, unknown> = await import(pathToFileURL(resolve(modulePath)).href);
  const functions: FunctionMap = {};

  const collect = (source: Record<string, unknown>): void => {
    for (const [name, value] of Object.entries(source)) {
      if (name === "default") continue;
      if (typeof value === "function") functions[name] = value as TaskFunction;
    }
  };

  collect(module);
  if (module.default && typeof module.default === "object") {
    collect(module.default as Record<string, unknown>);
  }
  return functions;
}
