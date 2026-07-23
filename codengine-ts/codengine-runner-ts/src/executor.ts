import type { Executor, ModuleFunctions } from "codengine-core-ts";

/** The single-language executor: calls the function directly, in-process. This is the
 * default the engine runs on; a cross-language run swaps in a routing executor that
 * sends foreign tasks to a worker. */
export function inProcessExecutor(functions: ModuleFunctions): Executor {
  return {
    async execute(module, fn, input) {
      const f = functions[module]?.[fn];
      if (!f) {
        const label = module === "" ? "the default module" : `module '${module}'`;
        throw new Error(`No function '${fn}' bound in ${label}.`);
      }
      return f(input);
    },
  };
}
