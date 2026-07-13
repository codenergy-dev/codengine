// The codengine IR executor. Implements codengine-spec/semantics/execution.md.
// The runner is "dumb": it trusts the precomputed executionPlan and only resolves
// functions and applies the runtime rules.

import type { Task, WorkflowIR } from "./types.js";

/** A single input/output object flowing between tasks. */
export type TaskData = Record<string, unknown>;
export type TaskFunction = (input: TaskData) => unknown;
export type FunctionMap = Record<string, TaskFunction>;

// Per-task run state:
//   TaskData[]  ran and produced these outputs
//   null        ran but produced no data (a halt, or a router)
//   undefined   never ran (skipped)
type State = TaskData[] | null | undefined;

function euclideanIndex(n: number, length: number): number {
  return ((n % length) + length) % length;
}

// Cartesian product of the fanIn outputs, each combination merged into one object.
function cartesianMerge(outputs: TaskData[][]): TaskData[] {
  return outputs
    .reduce<TaskData[][]>((acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])), [[]])
    .map((combination) => Object.assign({}, ...combination));
}

// Apply the `^key` (input) / `key$` (output) rename directives declared in args.
function formatData(task: Task, data: TaskData, type: "input" | "output"): TaskData {
  const directives = Object.keys(task.args).filter((k) => k.startsWith("^") || k.endsWith("$"));
  if (directives.length === 0) return data;

  const result: TaskData = { ...data };
  for (const directive of directives) {
    const isInput = directive.startsWith("^");
    const source = isInput ? directive.slice(1) : directive.slice(0, -1);
    const kind = isInput ? "input" : "output";
    if (kind === type && source in data) {
      const target = task.args[directive] as string;
      result[target] = data[source];
      delete result[source];
    }
    delete result[directive];
  }
  return result;
}

function inject(injected: Map<string, TaskData[]>, target: string, input: TaskData): void {
  const existing = injected.get(target) ?? [];
  existing.push(input);
  injected.set(target, existing);
}

// Handle one function result. Pushes data outputs, or routes (injecting the
// transferred input into the selected target). Returns true if it routed.
function classify(
  task: Task,
  result: unknown,
  input: TaskData,
  outputs: TaskData[],
  injected: Map<string, TaskData[]>,
): boolean {
  // No data (halts the branch). Classify by type, never truthiness: 0, "" and {}
  // are meaningful and handled below.
  if (result === null || result === undefined || result === false) return false;

  if (result === true) {
    // Passthrough: output equals the input.
    outputs.push(formatData(task, input, "output"));
    return false;
  }

  if (typeof result === "string") {
    const route = task.routes.find((r) => r.label === result);
    if (route) inject(injected, route.target, input); // no match -> halt
    return true;
  }

  if (typeof result === "number" && Number.isInteger(result)) {
    if (task.fanOut.length > 0) {
      const target = task.fanOut[euclideanIndex(result, task.fanOut.length)];
      inject(injected, target, input);
    }
    return true;
  }

  if (Array.isArray(result)) {
    for (const item of result) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        throw new Error(`Task '${task.name}' returned an array with a non-object item.`);
      }
      outputs.push(formatData(task, item as TaskData, "output"));
    }
    return false;
  }

  if (typeof result === "object") {
    outputs.push(formatData(task, result as TaskData, "output"));
    return false;
  }

  throw new Error(`Task '${task.name}' returned an unsupported value of type ${typeof result}.`);
}

/**
 * Run a workflow from `entry` with `input`. Returns the `output` task's collected
 * output, or `null` if it never ran.
 */
export function run(
  ir: WorkflowIR,
  functions: FunctionMap,
  entry: string,
  input: TaskData = {},
): TaskData[] | null {
  const tasks = new Map(ir.tasks.map((task) => [task.name, task]));
  const entryTask = tasks.get(entry);
  if (!entryTask) throw new Error(`Unknown entry task '${entry}'.`);

  const state = new Map<string, State>();
  const injected = new Map<string, TaskData[]>();

  for (const name of entryTask.executionPlan) {
    const task = tasks.get(name);
    if (!task) continue;

    let inputs: TaskData[];
    const injectedInputs = injected.get(name);
    if (injectedInputs) {
      inputs = injectedInputs;
    } else {
      // A required fanIn that ran and produced no data blocks this task.
      const blocked = task.fanIn.some(
        (f) => !task.fanInNullable.includes(f) && state.get(f) === null,
      );
      if (blocked) {
        state.set(name, undefined);
        continue;
      }
      const present = task.fanIn
        .map((f) => state.get(f))
        .filter((output): output is TaskData[] => Array.isArray(output));
      if (present.length === 0) {
        if (task.fanIn.length === 0) {
          inputs = [{}]; // root task
        } else {
          state.set(name, undefined); // no producer ran
          continue;
        }
      } else {
        inputs = cartesianMerge(present);
      }
    }

    // The run input replaces the entry task's declared args.
    const args = name === entry ? input : task.args;
    const fn = functions[task.function];
    if (!fn) throw new Error(`No function bound for '${task.function}' (task '${name}').`);

    const outputs: TaskData[] = [];
    let routed = false;
    for (const raw of inputs) {
      const formatted = formatData(task, { ...raw, ...args }, "input");
      routed = classify(task, fn(formatted), formatted, outputs, injected) || routed;
    }

    state.set(name, routed ? null : outputs.length > 0 ? outputs : null);
  }

  const result = state.get("output");
  return result === undefined ? null : result;
}
