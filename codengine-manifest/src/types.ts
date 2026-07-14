// Manifest types. Mirror of codengine-spec/schema/manifest.schema.json.

export type Language = "ts" | "py";

export interface ModuleConfig {
  language: Language;
  /** Local path to the functions source, relative to the manifest dir or absolute. */
  functions: string;
  /** Python interpreter for `language: "py"`. */
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
  /** Absolute path to the functions source. */
  functions: string;
  python?: string;
}
