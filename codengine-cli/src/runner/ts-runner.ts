import { run as executeTs } from "codengine-runner-ts";
import type { TaskData, WorkflowIR } from "codengine-runner-ts";
import { loadFunctions } from "../load-functions.js";
import type { Runner } from "./types.js";

/** Runs TypeScript/JS workflows in-process (the CLI is itself a Node process). */
export class InProcessTsRunner implements Runner {
  async run(
    ir: WorkflowIR,
    entry: string,
    input: TaskData,
    functions: string,
  ): Promise<TaskData[] | null> {
    const map = await loadFunctions(functions);
    return executeTs(ir, map, entry, input);
  }
}
