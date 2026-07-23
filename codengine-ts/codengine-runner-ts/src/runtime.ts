// The codengine IR executor. Implements codengine-spec/semantics/execution.md.
// The runner is "dumb": it trusts the precomputed executionPlan and only resolves
// functions and applies the runtime rules.

import type { Task, WorkflowIR, TaskData, Executor } from "codengine-core-ts";

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
 * Index every entrypoint address to the workflow that owns it. An address may be an
 * entrypoint in at most one workflow — otherwise the chain to trigger is ambiguous.
 */
function buildEntrypointIndex(workflows: WorkflowIR[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const workflow of workflows) {
    for (const task of workflow.tasks) {
      if (!task.entrypoint) continue;
      const owner = index.get(task.name);
      if (owner) {
        throw new Error(
          `Address '${task.name}' is an entrypoint in more than one workflow:\n` +
            `  ${owner}\n  ${workflow.workflow}\n` +
            "An address may be an entrypoint in at most one workflow.",
        );
      }
      index.set(task.name, workflow.workflow);
    }
  }
  return index;
}

function isPlainObject(value: unknown): value is TaskData {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasDirectives(task: Task): boolean {
  return Object.keys(task.args).some((k) => k.startsWith("^") || k.endsWith("$"));
}

// The maximal straight-line, same-module segment starting at `first`: each task has a
// single fanOut to the next, the next has a single fanIn from it, no args/directives
// between, no routing before the last, no cross-workflow hop. Such a segment can be
// handed to the executor as one chain — all branching still resolves in this engine.
function linearSegment(
  tasks: Map<string, Task>,
  entrypoints: Map<string, string>,
  first: Task,
  workflowName: string,
): Task[] {
  const module = first.module ?? "";
  const segment = [first];
  let current = first;
  while (
    current.name !== "output" &&
    current.routes.length === 0 &&
    current.fanOut.length === 1 &&
    !hasDirectives(current)
  ) {
    const next = tasks.get(current.fanOut[0]);
    if (!next) break;
    if ((next.module ?? "") !== module) break;
    if (next.fanIn.length !== 1 || next.fanIn[0] !== current.name) break;
    if (Object.keys(next.args).length > 0 || hasDirectives(next)) break;
    const owner = entrypoints.get(next.name);
    if (owner && owner !== workflowName) break;
    segment.push(next);
    current = next;
  }
  return segment;
}

/**
 * Run a workflow registry from the `entry` address with `input`. Returns the
 * `output` task's collected output of the workflow that owns the entry, or `null`.
 *
 * The engine calls `executor.execute(module, function, input)` for every task; the
 * executor decides how — a direct in-process call, or a message to a worker in
 * another language. All graph semantics stay here, in the one engine.
 */
export async function run(
  workflows: WorkflowIR[],
  executor: Executor,
  entry: string,
  input: TaskData = {},
): Promise<TaskData[] | null> {
  const registry = new Map(workflows.map((workflow) => [workflow.workflow, workflow]));
  const entrypoints = buildEntrypointIndex(workflows);

  const owner = entrypoints.get(entry);
  let target = owner;
  let isolated = false;
  if (!target) {
    // Not an entrypoint anywhere: a unit call of that address, wherever it is declared.
    for (const [name, ir] of registry) {
      if (ir.tasks.some((task) => task.name === entry)) {
        target = name;
        isolated = true;
        break;
      }
    }
  }
  if (!target) throw new Error(`Unknown entry address '${entry}'.`);

  const state = await executeWorkflow(registry, executor, entrypoints, target, entry, input, isolated);
  const result = state.get("output");
  return result === undefined ? null : result;
}

async function executeWorkflow(
  registry: Map<string, WorkflowIR>,
  executor: Executor,
  entrypoints: Map<string, string>,
  workflowName: string,
  entryTask: string,
  input: TaskData,
  isolated: boolean,
): Promise<Map<string, State>> {
  const ir = registry.get(workflowName);
  if (!ir) throw new Error(`Unknown workflow '${workflowName}'.`);
  const tasks = new Map(ir.tasks.map((task) => [task.name, task]));
  const entry = tasks.get(entryTask);
  if (!entry) throw new Error(`Unknown task '${entryTask}' in workflow '${workflowName}'.`);

  // An isolated entry is a unit call: only that task, ignoring its fanIn.
  const plan = isolated ? [entryTask] : entry.executionPlan;
  const state = new Map<string, State>();
  const injected = new Map<string, TaskData[]>();

  for (const name of plan) {
    const task = tasks.get(name);
    if (!task) continue;
    if (state.has(name)) continue; // already resolved (e.g. mirrored from a sub-run)

    let inputs: TaskData[];
    const injectedInputs = injected.get(name);
    if (injectedInputs) {
      inputs = injectedInputs;
    } else if (isolated && name === entryTask) {
      inputs = [{}];
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
    const args = name === entryTask ? input : task.args;

    // Cross-workflow call: this address is an entrypoint in another workflow, so
    // that workflow's chain runs and its results are mirrored back here.
    const chainOwner = entrypoints.get(name);
    if (chainOwner && chainOwner !== workflowName) {
      const mirrored = new Map<string, TaskData[]>();
      for (const raw of inputs) {
        const subInput = formatData(task, { ...raw, ...args }, "input");
        const subState = await executeWorkflow(
          registry,
          executor,
          entrypoints,
          chainOwner,
          name,
          subInput,
          false,
        );
        for (const [subName, subOutput] of subState) {
          if (!tasks.has(subName) || !Array.isArray(subOutput)) continue;
          const accumulated = mirrored.get(subName) ?? [];
          accumulated.push(...subOutput);
          mirrored.set(subName, accumulated);
        }
      }
      for (const [mirroredName, outputs] of mirrored) {
        if (!state.has(mirroredName)) state.set(mirroredName, outputs);
      }
      if (!state.has(name)) state.set(name, null);
      continue;
    }

    const module = task.module ?? "";

    // Linear-segment batching: hand a straight-line same-module segment to the
    // executor in one call (fewer boundary crossings). Only when a single plain-object
    // flows in; the executor feeds each object result to the next and hands back the
    // first non-object result — with its input — for this engine to classify.
    if (executor.executeChain && inputs.length === 1 && isPlainObject(inputs[0])) {
      const segment = linearSegment(tasks, entrypoints, task, workflowName);
      if (segment.length > 1) {
        const formatted = formatData(task, { ...inputs[0], ...args }, "input");
        const { result, consumed, input: fed } = await executor.executeChain(
          module,
          segment.map((segmentTask) => segmentTask.function),
          formatted,
        );
        // Tasks that ran and fed an object forward are private intermediates.
        for (let i = 0; i < consumed - 1; i++) state.set(segment[i].name, null);
        const stopped = segment[consumed - 1];
        const chainOutputs: TaskData[] = [];
        const chainRouted = classify(stopped, result, fed, chainOutputs, injected);
        state.set(stopped.name, chainRouted ? null : chainOutputs.length > 0 ? chainOutputs : null);
        continue;
      }
    }

    const outputs: TaskData[] = [];
    let routed = false;
    for (const raw of inputs) {
      const formatted = formatData(task, { ...raw, ...args }, "input");
      const result = await executor.execute(module, task.function, formatted);
      routed = classify(task, result, formatted, outputs, injected) || routed;
    }

    state.set(name, routed ? null : outputs.length > 0 ? outputs : null);
  }

  return state;
}
