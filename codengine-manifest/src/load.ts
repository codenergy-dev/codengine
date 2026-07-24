import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { LoadedManifest, Language, Manifest, ModuleConfig, ResolvedModule } from "./types.js";

export const MANIFEST_FILENAME = "codengine.json";

const LANGUAGES: readonly Language[] = ["ts", "py", "dart", "cs"];

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

/** Expand the manifest's `workflows` globs into absolute diagram file paths. */
export function resolveWorkflowFiles(loaded: LoadedManifest): string[] {
  return resolveFunctionFiles(loaded.manifest.workflows ?? [], loaded.dir);
}

/** Resolve every module declared in the manifest. */
export function resolveModules(loaded: LoadedManifest): ResolvedModule[] {
  return Object.keys(loaded.manifest.modules).map((name) => resolveModule(loaded, name));
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

const ROOT_MARKERS: Record<Language, string[]> = {
  ts: ["package.json"],
  py: ["pyproject.toml", "setup.py", ".venv"],
  dart: ["pubspec.yaml"],
  cs: ["*.csproj"], // the module's .NET project (its dependency environment)
};

// A marker matches a directory by exact filename, or by glob when it contains `*`.
function hasMarker(dir: string, marker: string): boolean {
  return marker.includes("*")
    ? globSync(marker, { cwd: dir }).length > 0
    : existsSync(join(dir, marker));
}

// Walk up from the functions' location to the nearest project marker.
function detectRoot(files: string[], language: Language): string | null {
  if (files.length === 0) return null;
  const markers = ROOT_MARKERS[language];
  let dir = dirname(files[0]);
  for (;;) {
    if (markers.some((marker) => hasMarker(dir, marker))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Resolve a module (null = the default module "") to concrete files + environment. */
export function resolveModule(loaded: LoadedManifest, moduleName: string | null): ResolvedModule {
  const name = moduleName ?? "";
  const config = loaded.manifest.modules[name];
  if (!config) {
    const label = name === "" ? "(default)" : `'${name}'`;
    throw new Error(`Manifest '${loaded.path}' has no module ${label}.`);
  }

  // A remote module is reached at its URL; no local files/root/environment apply.
  if (config.transport === "remote") {
    return { name, language: config.language, transport: "remote", url: config.url, root: loaded.dir, files: [] };
  }

  // Functions globs resolve against the explicit root, else the manifest dir.
  const globBase = config.root ? resolve(loaded.dir, config.root) : loaded.dir;
  const patterns = Array.isArray(config.functions) ? config.functions : [config.functions ?? []].flat();
  const files = resolveFunctionFiles(patterns, globBase);

  // The environment: explicit root, else auto-detected from the files, else the base.
  const root = config.root
    ? resolve(loaded.dir, config.root)
    : (detectRoot(files, config.language) ?? globBase);

  let python = config.python ? resolve(root, config.python) : undefined;
  if (!python && config.language === "py") {
    const candidate = join(root, ".venv", "bin", "python");
    if (existsSync(candidate)) python = candidate;
  }

  return {
    name,
    language: config.language,
    transport: "local",
    root,
    files,
    ...(python !== undefined ? { python } : {}),
  };
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
    const isRemote = module.transport === "remote";
    if (module.transport !== undefined && module.transport !== "local" && module.transport !== "remote") {
      fail(`module '${name}' \`transport\` must be "local" or "remote"`);
    }
    if (isRemote) {
      if (typeof module.url !== "string" || module.url.length === 0) {
        fail(`module '${name}' with \`transport: "remote"\` needs a \`url\` string`);
      }
    } else if (!isFunctions(module.functions)) {
      fail(`module '${name}' \`functions\` must be a non-empty glob string or array of strings`);
    }
    if (module.python !== undefined && typeof module.python !== "string") {
      fail(`module '${name}' \`python\` must be a string`);
    }
    if (module.root !== undefined && typeof module.root !== "string") {
      fail(`module '${name}' \`root\` must be a string`);
    }
    modules[name] = {
      language: module.language as Language,
      ...(isRemote
        ? { transport: "remote" as const, url: module.url as string }
        : { functions: module.functions as string | string[] }),
      ...(module.root !== undefined ? { root: module.root as string } : {}),
      ...(module.python !== undefined ? { python: module.python as string } : {}),
    };
  }

  return {
    version: "1",
    modules,
    ...(record.workflows !== undefined ? { workflows: record.workflows as string[] } : {}),
  };
}
