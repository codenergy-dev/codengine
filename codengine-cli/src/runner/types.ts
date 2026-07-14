import type { TaskData, WorkflowIR } from "codengine-runner-ts";

/** A language a runner can execute. */
export type Language = "ts" | "py";

/**
 * Executes an IR. The runner loads the task functions in its own language — the
 * orchestrator only tells it where they are.
 */
export interface Runner {
  run(
    ir: WorkflowIR,
    entry: string,
    input: TaskData,
    files: string[],
  ): Promise<TaskData[] | null>;
}

/** How to run a given language. (The future module manifest maps modules to these.) */
export interface RunnerProfile {
  language: Language;
  /** Python interpreter for `py` (default `python3`); must have codengine-runner installed. */
  python?: string;
}
