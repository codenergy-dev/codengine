import { run as executeTs } from "codengine-runner-ts";
import type { ModuleFunctions, TaskData, WorkflowIR } from "codengine-runner-ts";
import { loadFunctions } from "../load-functions.js";
import type { ModuleFiles, Runner } from "./types.js";

/** Runs TypeScript/JS workflows in-process (the CLI is itself a Node process). */
export class InProcessTsRunner implements Runner {
  async run(
    workflows: WorkflowIR[],
    entry: string,
    input: TaskData,
    modules: ModuleFiles,
  ): Promise<TaskData[] | null> {
    const functions: ModuleFunctions = {};
    for (const [module, files] of Object.entries(modules)) {
      functions[module] = await loadFunctions(files);
    }
    return executeTs(workflows, functions, entry, input);
  }
}
