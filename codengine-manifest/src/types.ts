// Manifest types. Mirror of codengine-spec/schema/manifest.schema.json.

export type Language = "ts" | "py" | "dart" | "cs";

export interface ModuleConfig {
  language: Language;
  /**
   * The module's project root (its dependency environment). Local dir, relative to
   * the manifest or absolute; may point outside the project. Functions globs resolve
   * against it. When omitted, it is auto-detected from the functions' location.
   */
  root?: string;
  /** Glob pattern(s) for the functions source, relative to `root` (or the manifest dir). */
  functions: string | string[];
  /** Python interpreter for `language: "py"`; relative to `root`, or absolute. */
  python?: string;
}

export interface Manifest {
  version: "1";
  workflows?: string[];
  /** Namespace -> config. The empty key "" is the default module (module: null). */
  modules: Record<string, ModuleConfig>;
}

export interface LoadedManifest {
  manifest: Manifest;
  /** Absolute path to the manifest file. */
  path: string;
  /** Absolute directory containing the manifest. */
  dir: string;
}

export interface ResolvedModule {
  name: string;
  language: Language;
  /** Absolute project root — the module's dependency environment. */
  root: string;
  /** Absolute paths to the functions source files (globs expanded). */
  files: string[];
  /** Absolute Python interpreter for `py` (explicit or `<root>/.venv`), if any. */
  python?: string;
}

// --- Module package format (mirror of package.schema.json / bundle.schema.json) ---

/** One artifact of a module package: source or compiled code, bound to a transport.
 * `transport` and `target` are open strings so new transports/targets need no format
 * bump (known transports: "in-process", "subprocess", "remote", "wasm", "cffi"). */
export interface PackageArtifact {
  id: string;
  target: string;
  transport: string;
  language?: Language;
  files?: string[];
  root?: string;
  /** Transport-specific reach info (e.g. subprocess: { command, args?, protocol }). */
  entry: Record<string, unknown>;
  integrity?: { sha256?: Record<string, string> };
}

export interface PackageDependency {
  name: string;
  version: string;
}

/** A portable, source-free distributable of one module. */
export interface ModulePackage {
  package: "1";
  contract: "1";
  kind: "module";
  name: string;
  version: string;
  language: Language;
  description?: string;
  provenance?: { builtAt?: string; sourceHash?: string; tool?: string };
  /** Relative path to the task-definition document (the description contract). */
  definitions: string;
  dependencies?: PackageDependency[];
  artifacts: PackageArtifact[];
}

export interface BundleModuleRef {
  /** The module namespace, as referenced by the workflows. */
  name: string;
  /** The module package coordinate ("name@version") or a relative path. */
  package: string;
}

/** The orchestrator topology: references module packages + workflows, no own source. */
export interface Bundle {
  package: "1";
  contract: "1";
  kind: "bundle";
  name: string;
  version?: string;
  workflows?: string[];
  modules?: BundleModuleRef[];
}

export interface LoadedPackage {
  package: ModulePackage;
  /** Absolute path to the package descriptor file. */
  path: string;
  /** Absolute directory containing the package (its self-contained root). */
  dir: string;
}

export interface LoadedBundle {
  bundle: Bundle;
  path: string;
  dir: string;
}
