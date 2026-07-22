import type { TaskData, WorkflowIR } from "codengine-core-ts";

/** A language a runner can execute. */
export type Language = "ts" | "py" | "dart" | "cs";

/** A module's resolved functions files and its project root (dependency env). */
export interface ModuleBinding {
  files: string[];
  root: string | null;
}

/**
 * Executes a workflow registry. The runner loads the task functions in its own
 * language, per module — the orchestrator only tells it where they are and each
 * module's environment (`root`).
 */
export interface Runner {
  run(
    workflows: WorkflowIR[],
    entry: string,
    input: TaskData,
    modules: Record<string, ModuleBinding>,
  ): Promise<TaskData[] | null>;
}
