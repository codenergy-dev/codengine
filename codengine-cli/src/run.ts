import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseWorkflow } from "codengine-parser";
import type { TaskData, WorkflowIR } from "codengine-runner-ts";
import { selectRunner } from "./runner/select.js";
import type { Language } from "./runner/types.js";

export interface RunWorkflowOptions {
  /** Path to a `.yuml` (parsed) or `.json` (loaded as IR) workflow. */
  workflow: string;
  /** Path to the functions module, in the chosen language. */
  functions: string;
  /** Runner language (default `ts`). */
  language?: Language;
  /** Python interpreter for `language: "py"`. */
  python?: string;
  /** Entry task (default: the workflow's sole entrypoint). */
  entry?: string;
  input?: TaskData;
}

/** Parse/load a workflow and run it through the language-selected runner. */
export async function runWorkflow(options: RunWorkflowOptions): Promise<TaskData[] | null> {
  const ir = loadIR(options.workflow);
  const entry = options.entry ?? soleEntrypoint(ir);
  const runner = selectRunner({ language: options.language ?? "ts", python: options.python });
  return runner.run(ir, entry, options.input ?? {}, options.functions);
}

function loadIR(path: string): WorkflowIR {
  const source = readFileSync(path, "utf8");
  if (path.endsWith(".json")) return JSON.parse(source) as WorkflowIR;
  return parseWorkflow(source, basename(path).split(".")[0]) as WorkflowIR;
}

function soleEntrypoint(ir: WorkflowIR): string {
  const entrypoints = ir.tasks.filter((task) => task.entrypoint);
  if (entrypoints.length === 1) return entrypoints[0].name;
  if (entrypoints.length === 0) {
    throw new Error("No entrypoint task found; specify one with --entry.");
  }
  const names = entrypoints.map((task) => task.name).join(", ");
  throw new Error(`Multiple entrypoints (${names}); specify one with --entry.`);
}
