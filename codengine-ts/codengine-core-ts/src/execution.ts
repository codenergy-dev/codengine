// The execution contract: the data flowing between tasks and the shape of a bound
// task function. Named binding is the loader's job; the engine only calls the function.

/** A single input/output object flowing between tasks. */
export type TaskData = Record<string, unknown>;
export type TaskFunction = (input: TaskData) => unknown;
export type FunctionMap = Record<string, TaskFunction>;
/** Functions bound per module namespace; `""` is the default module. */
export type ModuleFunctions = Record<string, FunctionMap>;
