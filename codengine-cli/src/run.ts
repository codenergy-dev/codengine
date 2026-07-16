import { readFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import {
  findManifest,
  loadManifest,
  resolveFunctionFiles,
  resolveModules,
  resolveWorkflowFiles,
} from "codengine-manifest";
import type { LoadedManifest } from "codengine-manifest";
import { parseWorkflow } from "codengine-parser";
import type { TaskData, WorkflowIR } from "codengine-runner-ts";
import { selectRunner } from "./runner/select.js";
import type { Language, ModuleFiles } from "./runner/types.js";

export interface RunWorkflowOptions {
  /** Comma-separated glob(s) for the workflows (.yuml parsed, .json loaded as IR). */
  workflows?: string;
  /** Comma-separated glob(s) for the default module's functions. */
  functions?: string;
  /** Runner language (default `ts`). Ignored when resolved from a manifest. */
  language?: Language;
  /** Python interpreter for `language: "py"`. */
  python?: string;
  /** Path to a codengine.json. When omitted, one is searched for upward. */
  manifest?: string;
  /** Entry address (default: the registry's sole entrypoint). */
  entry?: string;
  input?: TaskData;
}

interface RunProfile {
  modules: ModuleFiles;
  language: Language;
  python?: string;
}

/** Load a workflow registry and run it through the language-selected runner. */
export async function runWorkflow(options: RunWorkflowOptions): Promise<TaskData[] | null> {
  const manifest = findProjectManifest(options);
  const workflows = loadWorkflows(options, manifest);
  const profile = resolveProfile(options, manifest);
  const entry = options.entry ?? soleEntrypoint(workflows);
  const runner = selectRunner({ language: profile.language, python: profile.python });
  return runner.run(workflows, entry, options.input ?? {}, profile.modules);
}

function splitPatterns(value: string): string[] {
  return value
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean);
}

function findProjectManifest(options: RunWorkflowOptions): LoadedManifest | null {
  if (options.manifest) return loadManifest(options.manifest);
  // Only look for one when something still has to be resolved from it.
  if (options.functions && options.workflows) return null;
  const start = options.workflows
    ? dirname(resolve(splitPatterns(options.workflows)[0] ?? "."))
    : process.cwd();
  return findManifest(start);
}

function loadWorkflows(options: RunWorkflowOptions, manifest: LoadedManifest | null): WorkflowIR[] {
  let files: string[];
  if (options.workflows) {
    files = resolveFunctionFiles(splitPatterns(options.workflows), process.cwd());
  } else if (manifest) {
    files = resolveWorkflowFiles(manifest);
  } else {
    throw new Error("Provide workflow paths, or a codengine.json declaring `workflows`.");
  }
  if (files.length === 0) throw new Error("No workflows matched.");
  return files.map(loadWorkflow);
}

function loadWorkflow(file: string): WorkflowIR {
  const source = readFileSync(file, "utf8");
  if (extname(file) === ".json") return JSON.parse(source) as WorkflowIR;
  return parseWorkflow(source, basename(file).split(".")[0]) as WorkflowIR;
}

// Where each module's functions are and how to run them: explicit flags, or the manifest.
function resolveProfile(options: RunWorkflowOptions, manifest: LoadedManifest | null): RunProfile {
  if (options.functions) {
    const files = resolveFunctionFiles(splitPatterns(options.functions), process.cwd());
    return { modules: { "": files }, language: options.language ?? "ts", python: options.python };
  }
  if (!manifest) {
    throw new Error(
      "Provide --functions, or a codengine.json (via --manifest or in a parent directory).",
    );
  }

  const resolved = resolveModules(manifest);
  if (resolved.length === 0) throw new Error(`Manifest '${manifest.path}' declares no modules.`);

  const languages = [...new Set(resolved.map((module) => module.language))];
  if (languages.length > 1) {
    throw new Error(
      `Modules span several languages (${languages.join(", ")}). ` +
        "Running one workflow across languages is not supported yet.",
    );
  }

  const modules: ModuleFiles = {};
  for (const module of resolved) modules[module.name] = module.files;
  return {
    modules,
    language: languages[0],
    python: options.python ?? resolved.find((module) => module.python)?.python,
  };
}

function soleEntrypoint(workflows: WorkflowIR[]): string {
  const entrypoints = workflows.flatMap((workflow) =>
    workflow.tasks.filter((task) => task.entrypoint).map((task) => task.name),
  );
  if (entrypoints.length === 1) return entrypoints[0];
  if (entrypoints.length === 0) {
    throw new Error("No entrypoint found; specify one with --entry.");
  }
  throw new Error(`Several entrypoints (${entrypoints.join(", ")}); specify one with --entry.`);
}
