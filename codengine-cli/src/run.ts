import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { findManifest, loadManifest, resolveFunctionFiles, resolveModule } from "codengine-manifest";
import { parseWorkflow } from "codengine-parser";
import type { TaskData, WorkflowIR } from "codengine-runner-ts";
import { selectRunner } from "./runner/select.js";
import type { Language } from "./runner/types.js";

export interface RunWorkflowOptions {
  /** Path to a `.yuml` (parsed) or `.json` (loaded as IR) workflow. */
  workflow: string;
  /** Comma-separated glob pattern(s) for the functions source. Omit to use a manifest. */
  functions?: string;
  /** Runner language (default `ts`). Ignored when resolved from a manifest. */
  language?: Language;
  /** Python interpreter for `language: "py"`. */
  python?: string;
  /** Path to a codengine.json. When omitted (and no `functions`), one is searched for upward. */
  manifest?: string;
  /** Entry task (default: the workflow's sole entrypoint). */
  entry?: string;
  input?: TaskData;
}

interface RunProfile {
  files: string[];
  language: Language;
  python?: string;
}

/** Parse/load a workflow and run it through the language-selected runner. */
export async function runWorkflow(options: RunWorkflowOptions): Promise<TaskData[] | null> {
  const ir = loadIR(options.workflow);
  const entry = options.entry ?? soleEntrypoint(ir);
  const profile = resolveProfile(options);
  const runner = selectRunner({ language: profile.language, python: profile.python });
  return runner.run(ir, entry, options.input ?? {}, profile.files);
}

// Where the functions are and how to run them: from explicit flags, or the manifest.
// Both resolve to a file list the same way — --functions is comma-split into globs.
function resolveProfile(options: RunWorkflowOptions): RunProfile {
  if (options.functions) {
    const patterns = options.functions.split(",").map((p) => p.trim()).filter(Boolean);
    const files = resolveFunctionFiles(patterns, process.cwd());
    return { files, language: options.language ?? "ts", python: options.python };
  }
  const loaded = options.manifest
    ? loadManifest(options.manifest)
    : findManifest(dirname(resolve(options.workflow)));
  if (!loaded) {
    throw new Error(
      "Provide --functions, or a codengine.json (via --manifest or in a parent directory).",
    );
  }
  // v1: the whole run uses the default module (module: null). Per-module
  // cross-language routing is a later plan.
  const resolved = resolveModule(loaded, null);
  return { files: resolved.files, language: resolved.language, python: resolved.python };
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
