// IR v1 types. Mirror of codengine-spec/schema/workflow.schema.json.

/** A labeled outgoing edge, used by string routing. */
export interface Route {
  label: string;
  target: string;
}

/** A task (node): a function with input/output and its graph relationships. */
export interface Task {
  /** Unique task id within the workflow. */
  name: string;
  /** Function name to resolve and call. */
  function: string;
  /** Namespace the function resolves from; null means this workflow. */
  module: string | null;
  /** Literal args declared on the node. */
  args: Record<string, unknown>;
  /** Upstream tasks whose output this task consumes. */
  fanIn: string[];
  /** Subset of fanIn allowed to be absent without blocking. */
  fanInNullable: string[];
  /** Downstream tasks, ordered (the index space for index routing). */
  fanOut: string[];
  /** Labeled outgoing edges, used by string routing. */
  routes: Route[];
  /** Whether this task may start an execution. */
  entrypoint: boolean;
  /** Transitive upstream tasks, precomputed by the planner. */
  dependencies: string[];
  /** Ordered set of tasks to run from this task, precomputed by the planner. */
  executionPlan: string[];
}

/** A parsed workflow: the IR document a runner consumes. */
export interface WorkflowIR {
  version: "1";
  workflow: string;
  tasks: Task[];
}
