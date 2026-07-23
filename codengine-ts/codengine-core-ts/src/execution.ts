// The execution contract: the data flowing between tasks and the shape of a bound
// task function. Named binding is the loader's job; the engine only calls the function.

/** A single input/output object flowing between tasks. */
export type TaskData = Record<string, unknown>;
export type TaskFunction = (input: TaskData) => unknown;
export type FunctionMap = Record<string, TaskFunction>;
/** Functions bound per module namespace; `""` is the default module. */
export type ModuleFunctions = Record<string, FunctionMap>;

/** The result of running a linear segment as one call: the last computed value, how
 * many functions actually ran, and the input fed to that last function (so the engine
 * can classify a branching result). */
export interface ChainResult {
  result: unknown;
  consumed: number;
  input: TaskData;
}

/**
 * Runs a task's function, possibly in another language/process. The engine calls this
 * for every task instead of invoking the function directly — the seam that lets a
 * foreign task cross to a worker while all graph semantics stay in the one engine.
 *
 * `executeChain` is an optional optimization: run a straight-line same-module segment
 * in one call (fewer boundary crossings). The worker feeds each object result to the
 * next and stops at the first non-object, handing it back for the engine to classify.
 * An executor without it (e.g. in-process) simply makes the engine run per task.
 */
export interface Executor {
  execute(module: string, fn: string, input: TaskData): Promise<unknown>;
  executeChain?(module: string, functions: string[], input: TaskData): Promise<ChainResult>;
}
