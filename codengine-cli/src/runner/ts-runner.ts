import { loadFunctions } from "codengine-loader-ts";
import { run as executeTs } from "codengine-runner-ts";
import type { ModuleFunctions, TaskData, WorkflowIR } from "codengine-runner-ts";
import type { ModuleBinding, Runner } from "./types.js";

/** Runs TypeScript/JS workflows in-process (used for pre-built `.js`/`.mjs`). */
export class InProcessTsRunner implements Runner {
  async run(
    workflows: WorkflowIR[],
    entry: string,
    input: TaskData,
    modules: Record<string, ModuleBinding>,
  ): Promise<TaskData[] | null> {
    const functions: ModuleFunctions = {};
    for (const [module, binding] of Object.entries(modules)) {
      functions[module] = await loadFunctions(binding.files);
    }
    return executeTs(workflows, functions, entry, input);
  }
}
