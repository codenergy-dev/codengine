import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type TaskFunction = (input: Record<string, unknown>) => unknown;
export type FunctionMap = Record<string, TaskFunction>;

/**
 * Load TS/JS task functions from one or more files and merge them. A name defined
 * in two files is a conflict (rename one, or split into separate modules).
 *
 * `.js` / `.mjs` load directly. `.ts` source loads when the running Node process was
 * started with `--experimental-strip-types` (how the codengine orchestrator runs a
 * TS module whose functions are source `.ts`). A module's project `root` is not
 * needed here — Node resolves each file's dependencies from its own location.
 */
export async function loadFunctions(files: string[]): Promise<FunctionMap> {
  const functions: FunctionMap = {};
  const origin = new Map<string, string>();

  for (const file of files) {
    for (const [name, fn] of Object.entries(await loadFile(file))) {
      const previous = origin.get(name);
      if (previous) {
        throw new Error(
          `Duplicate task function '${name}' in module:\n  ${previous}\n  ${file}\n` +
            "Rename one, or split them into separate modules.",
        );
      }
      functions[name] = fn;
      origin.set(name, file);
    }
  }
  return functions;
}

// Named function exports, and/or a default export that is an object of functions.
async function loadFile(file: string): Promise<FunctionMap> {
  const module: Record<string, unknown> = await import(pathToFileURL(resolve(file)).href);
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
