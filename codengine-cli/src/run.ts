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
import type { TaskData, WorkflowIR } from "codengine-core-ts";
import { selectRunner } from "./runner/select.js";
import { runCrossLanguage } from "./runner/cross-language.js";
import type { Language, ModuleBinding } from "./runner/types.js";

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

interface Bindings {
  modules: Record<string, ModuleBinding>;
  language: Language;
  python?: string;
  dartRoot?: string;
}

/** Load a workflow registry and run it through the language-selected runner. */
export async function runWorkflow(options: RunWorkflowOptions): Promise<TaskData[] | null> {
  const manifest = findProjectManifest(options);
  const workflows = loadWorkflows(options, manifest);
  const entry = options.entry ?? soleEntrypoint(workflows);

  // Cross-language: a manifest whose modules span several languages. One TS engine
  // drives; TS modules run in-process, each other language via a warm worker.
  if (!options.functions && manifest) {
    const resolved = resolveModules(manifest);
    const languages = [...new Set(resolved.map((module) => module.language))];
    if (languages.length > 1) {
      return runCrossLanguage(workflows, resolved, entry, options.input ?? {}, options.python);
    }
  }

  const { modules, language, python, dartRoot } = resolveBindings(options, manifest);
  const tsSubprocess =
    language === "ts" &&
    Object.values(modules).some((binding) => binding.files.some((f) => extname(f) === ".ts"));
  const runner = selectRunner({ language, python, tsSubprocess, dartRoot });
  return runner.run(workflows, entry, options.input ?? {}, modules);
}

function splitPatterns(value: string): string[] {
  return value.split(",").map((p) => p.trim()).filter(Boolean);
}

function findProjectManifest(options: RunWorkflowOptions): LoadedManifest | null {
  if (options.manifest) return loadManifest(options.manifest);
  if (options.functions && options.workflows) return null; // nothing left to resolve
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

// Where each module's functions are (files + env), from explicit flags or the manifest.
function resolveBindings(options: RunWorkflowOptions, manifest: LoadedManifest | null): Bindings {
  if (options.functions) {
    const files = resolveFunctionFiles(splitPatterns(options.functions), process.cwd());
    return {
      modules: { "": { files, root: null } },
      language: options.language ?? "ts",
      python: options.python,
    };
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

  const interpreters = [...new Set(resolved.map((m) => m.python).filter((p): p is string => !!p))];
  if (interpreters.length > 1) {
    throw new Error(
      `Modules use different Python interpreters (${interpreters.join(", ")}). ` +
        "Not supported in one run yet.",
    );
  }

  const modules: Record<string, ModuleBinding> = {};
  for (const module of resolved) modules[module.name] = { files: module.files, root: module.root };

  let dartRoot: string | undefined;
  if (languages[0] === "dart") {
    const roots = [...new Set(resolved.map((module) => module.root))];
    if (roots.length > 1) {
      throw new Error(`Dart modules must share one package root; got: ${roots.join(", ")}.`);
    }
    dartRoot = roots[0];
  }

  return { modules, language: languages[0], python: options.python ?? interpreters[0], dartRoot };
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
