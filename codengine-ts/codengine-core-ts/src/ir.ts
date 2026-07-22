// IR v1 types. Mirror of codengine-spec/schema/workflow.schema.json.
// The contract between the parser (produces) and the runner (executes).

export interface Route {
  label: string;
  target: string;
}

export interface Task {
  name: string;
  function: string;
  module: string | null;
  args: Record<string, unknown>;
  fanIn: string[];
  fanInNullable: string[];
  fanOut: string[];
  routes: Route[];
  entrypoint: boolean;
  dependencies: string[];
  executionPlan: string[];
}

export interface WorkflowIR {
  version: "1";
  workflow: string;
  tasks: Task[];
}
