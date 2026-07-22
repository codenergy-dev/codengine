// The TS/JS function loader now lives in codengine-loader-ts (shared with the
// runner-ts subprocess entrypoint). Re-exported for convenience and tests.
export { loadFunctions } from "codengine-loader-ts";
export type { FunctionMap, TaskFunction } from "codengine-core-ts";
