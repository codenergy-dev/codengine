// Manifest types. Mirror of codengine-spec/schema/manifest.schema.json.

export type Language = "ts" | "py" | "dart";

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
