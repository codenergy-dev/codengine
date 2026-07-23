import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  Bundle,
  BundleModuleRef,
  Language,
  LoadedBundle,
  LoadedPackage,
  ModulePackage,
  PackageArtifact,
  PackageDependency,
} from "./types.js";

export const PACKAGE_FILENAME = "codengine-package.json";

const LANGUAGES: readonly Language[] = ["ts", "py", "dart", "cs"];

/** Load and validate a module package descriptor (`kind: "module"`). */
export function loadPackage(path: string): LoadedPackage {
  const absolute = resolve(path);
  const pkg = validatePackage(JSON.parse(readFileSync(absolute, "utf8")), absolute);
  return { package: pkg, path: absolute, dir: dirname(absolute) };
}

/** Load and validate a bundle descriptor (`kind: "bundle"`). */
export function loadBundle(path: string): LoadedBundle {
  const absolute = resolve(path);
  const bundle = validateBundle(JSON.parse(readFileSync(absolute, "utf8")), absolute);
  return { bundle, path: absolute, dir: dirname(absolute) };
}

function asObject(value: unknown, path: string, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label} '${path}': expected a JSON object`);
  }
  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function validatePackage(value: unknown, path: string): ModulePackage {
  const record = asObject(value, path, "package");
  const fail = (message: string): never => {
    throw new Error(`Invalid package '${path}': ${message}`);
  };

  if (record.package !== "1") fail(`\`package\` must be "1"`);
  if (record.contract !== "1") fail(`\`contract\` must be "1"`);
  if (record.kind !== "module") fail(`\`kind\` must be "module"`);
  if (!isNonEmptyString(record.name)) fail("`name` must be a non-empty string");
  if (!isNonEmptyString(record.version)) fail("`version` must be a non-empty string");
  if (!LANGUAGES.includes(record.language as Language)) {
    fail(`\`language\` must be one of ${LANGUAGES.join(", ")}`);
  }
  if (!isNonEmptyString(record.definitions)) fail("`definitions` must be a non-empty string");
  if (!Array.isArray(record.artifacts) || record.artifacts.length === 0) {
    fail("`artifacts` must be a non-empty array");
  }

  const artifacts = (record.artifacts as unknown[]).map((raw, index) =>
    validateArtifact(raw, index, fail),
  );

  const dependencies = record.dependencies !== undefined
    ? validateDependencies(record.dependencies, fail)
    : undefined;

  return {
    package: "1",
    contract: "1",
    kind: "module",
    name: record.name as string,
    version: record.version as string,
    language: record.language as Language,
    ...(isNonEmptyString(record.description) ? { description: record.description } : {}),
    ...(record.provenance !== undefined
      ? { provenance: record.provenance as ModulePackage["provenance"] }
      : {}),
    definitions: record.definitions as string,
    ...(dependencies ? { dependencies } : {}),
    artifacts,
  };
}

function validateArtifact(
  raw: unknown,
  index: number,
  fail: (message: string) => never,
): PackageArtifact {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail(`artifact #${index} must be an object`);
  }
  const artifact = raw as Record<string, unknown>;
  const where = `artifact #${index}`;

  if (!isNonEmptyString(artifact.id)) fail(`${where} \`id\` must be a non-empty string`);
  if (!isNonEmptyString(artifact.target)) fail(`${where} \`target\` must be a non-empty string`);
  if (!isNonEmptyString(artifact.transport)) fail(`${where} \`transport\` must be a non-empty string`);
  if (typeof artifact.entry !== "object" || artifact.entry === null || Array.isArray(artifact.entry)) {
    fail(`${where} \`entry\` must be an object`);
  }
  if (artifact.language !== undefined && !LANGUAGES.includes(artifact.language as Language)) {
    fail(`${where} \`language\` must be one of ${LANGUAGES.join(", ")}`);
  }
  if (artifact.files !== undefined) {
    if (!Array.isArray(artifact.files) || !artifact.files.every(isNonEmptyString)) {
      fail(`${where} \`files\` must be an array of non-empty strings`);
    }
  }

  return {
    id: artifact.id as string,
    target: artifact.target as string,
    transport: artifact.transport as string,
    ...(artifact.language !== undefined ? { language: artifact.language as Language } : {}),
    ...(artifact.files !== undefined ? { files: artifact.files as string[] } : {}),
    ...(isNonEmptyString(artifact.root) ? { root: artifact.root } : {}),
    entry: artifact.entry as Record<string, unknown>,
    ...(artifact.integrity !== undefined
      ? { integrity: artifact.integrity as PackageArtifact["integrity"] }
      : {}),
  };
}

function validateDependencies(
  value: unknown,
  fail: (message: string) => never,
): PackageDependency[] {
  if (!Array.isArray(value)) fail("`dependencies` must be an array");
  return (value as unknown[]).map((raw, index) => {
    if (typeof raw !== "object" || raw === null) fail(`dependency #${index} must be an object`);
    const dep = raw as Record<string, unknown>;
    if (!isNonEmptyString(dep.name)) fail(`dependency #${index} \`name\` must be a non-empty string`);
    if (!isNonEmptyString(dep.version)) fail(`dependency #${index} \`version\` must be a non-empty string`);
    return { name: dep.name as string, version: dep.version as string };
  });
}

export function validateBundle(value: unknown, path: string): Bundle {
  const record = asObject(value, path, "bundle");
  const fail = (message: string): never => {
    throw new Error(`Invalid bundle '${path}': ${message}`);
  };

  if (record.package !== "1") fail(`\`package\` must be "1"`);
  if (record.contract !== "1") fail(`\`contract\` must be "1"`);
  if (record.kind !== "bundle") fail(`\`kind\` must be "bundle"`);
  if (!isNonEmptyString(record.name)) fail("`name` must be a non-empty string");

  let workflows: string[] | undefined;
  if (record.workflows !== undefined) {
    if (!Array.isArray(record.workflows) || !record.workflows.every(isNonEmptyString)) {
      fail("`workflows` must be an array of non-empty strings");
    }
    workflows = record.workflows as string[];
  }

  let modules: BundleModuleRef[] | undefined;
  if (record.modules !== undefined) {
    if (!Array.isArray(record.modules)) fail("`modules` must be an array");
    modules = (record.modules as unknown[]).map((raw, index) => {
      if (typeof raw !== "object" || raw === null) fail(`module #${index} must be an object`);
      const ref = raw as Record<string, unknown>;
      if (!isNonEmptyString(ref.name)) fail(`module #${index} \`name\` must be a non-empty string`);
      if (!isNonEmptyString(ref.package)) fail(`module #${index} \`package\` must be a non-empty string`);
      return { name: ref.name as string, package: ref.package as string };
    });
  }

  if (!workflows?.length && !modules?.length) {
    fail("a bundle must declare at least one of `modules` or `workflows`");
  }

  return {
    package: "1",
    contract: "1",
    kind: "bundle",
    name: record.name as string,
    ...(isNonEmptyString(record.version) ? { version: record.version } : {}),
    ...(workflows ? { workflows } : {}),
    ...(modules ? { modules } : {}),
  };
}
