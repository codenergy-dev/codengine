import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { LoadedManifest, Language, Manifest, ModuleConfig, ResolvedModule } from "./types.js";

export const MANIFEST_FILENAME = "codengine.json";

const LANGUAGES: readonly Language[] = ["ts", "py"];

/**
 * Expand glob patterns (relative to `baseDir`, or absolute) into a sorted, deduped
 * list of absolute file paths. Shared by the manifest and the CLI's --functions.
 */
export function resolveFunctionFiles(patterns: string[], baseDir: string): string[] {
  const files = new Set<string>();
  for (const pattern of patterns) {
    for (const match of globSync(pattern, { cwd: baseDir })) {
      files.add(resolve(baseDir, match));
    }
  }
  return [...files].sort();
}

/** Load and validate a manifest from a file path. */
export function loadManifest(path: string): LoadedManifest {
  const absolute = resolve(path);
  const manifest = validate(JSON.parse(readFileSync(absolute, "utf8")), absolute);
  return { manifest, path: absolute, dir: dirname(absolute) };
}

/** Walk up from `startDir` to the nearest codengine.json, or null. */
export function findManifest(startDir: string): LoadedManifest | null {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, MANIFEST_FILENAME);
    if (existsSync(candidate)) return loadManifest(candidate);
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Resolve a module (null = the default module "") to concrete, absolute files. */
export function resolveModule(loaded: LoadedManifest, moduleName: string | null): ResolvedModule {
  const name = moduleName ?? "";
  const config = loaded.manifest.modules[name];
  if (!config) {
    const label = name === "" ? "(default)" : `'${name}'`;
    throw new Error(`Manifest '${loaded.path}' has no module ${label}.`);
  }
  const patterns = Array.isArray(config.functions) ? config.functions : [config.functions];
  const files = resolveFunctionFiles(patterns, loaded.dir);
  return { name, language: config.language, files, python: config.python };
}

function isFunctions(value: unknown): value is string | string[] {
  if (typeof value === "string") return value.length > 0;
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && entry.length > 0)
  );
}

function validate(value: unknown, path: string): Manifest {
  const fail = (message: string): never => {
    throw new Error(`Invalid manifest '${path}': ${message}`);
  };

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("expected a JSON object");
  }
  const record = value as Record<string, unknown>;

  if (record.version !== "1") fail(`version must be "1"`);
  if (typeof record.modules !== "object" || record.modules === null || Array.isArray(record.modules)) {
    fail("`modules` must be an object");
  }
  if (record.workflows !== undefined) {
    if (!Array.isArray(record.workflows) || record.workflows.some((w) => typeof w !== "string")) {
      fail("`workflows` must be an array of strings");
    }
  }

  const modules: Record<string, ModuleConfig> = {};
  for (const [name, raw] of Object.entries(record.modules as Record<string, unknown>)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      fail(`module '${name}' must be an object`);
    }
    const module = raw as Record<string, unknown>;
    if (!LANGUAGES.includes(module.language as Language)) {
      fail(`module '${name}' has invalid language (expected one of ${LANGUAGES.join(", ")})`);
    }
    if (!isFunctions(module.functions)) {
      fail(`module '${name}' \`functions\` must be a non-empty glob string or array of strings`);
    }
    if (module.python !== undefined && typeof module.python !== "string") {
      fail(`module '${name}' \`python\` must be a string`);
    }
    modules[name] = {
      language: module.language as Language,
      functions: module.functions as string | string[],
      ...(module.python !== undefined ? { python: module.python as string } : {}),
    };
  }

  return {
    version: "1",
    modules,
    ...(record.workflows !== undefined ? { workflows: record.workflows as string[] } : {}),
  };
}
