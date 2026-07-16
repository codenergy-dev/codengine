import type { TaskData, WorkflowIR } from "codengine-runner-ts";

/** A language a runner can execute. */
export type Language = "ts" | "py";

/** Module namespace -> the resolved files holding its functions. */
export type ModuleFiles = Record<string, string[]>;

/**
 * Executes a workflow registry. The runner loads the task functions in its own
 * language — the orchestrator only tells it where they are, per module.
 */
export interface Runner {
  run(
    workflows: WorkflowIR[],
    entry: string,
    input: TaskData,
    modules: ModuleFiles,
  ): Promise<TaskData[] | null>;
}

/** How to run a given language. */
export interface RunnerProfile {
  language: Language;
  /** Python interpreter for `py` (default `python3`); must have codengine-runner installed. */
  python?: string;
}
