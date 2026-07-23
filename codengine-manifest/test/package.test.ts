import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadPackage, loadBundle, validatePackage, validateBundle } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url)); // dist/test
// dist/test -> dist -> codengine-manifest -> repo -> codengine-spec/conformance/packages
const packages = resolve(here, "..", "..", "..", "codengine-spec", "conformance", "packages");
const modulePackage = resolve(packages, "module-greeting", "codengine-package.json");
const bundlePackage = resolve(packages, "bundle-app", "codengine-package.json");

test("loads and validates the example module package", () => {
  const loaded = loadPackage(modulePackage);
  assert.equal(loaded.package.kind, "module");
  assert.equal(loaded.package.name, "greeting");
  assert.equal(loaded.package.language, "py");
  assert.equal(loaded.package.artifacts.length, 1);
  assert.equal(loaded.package.artifacts[0].transport, "subprocess");
  assert.equal(loaded.dir, resolve(packages, "module-greeting"));
});

test("loads and validates the example bundle", () => {
  const loaded = loadBundle(bundlePackage);
  assert.equal(loaded.bundle.kind, "bundle");
  assert.equal(loaded.bundle.name, "greeting-app");
  assert.deepEqual(loaded.bundle.modules, [{ name: "greeting", package: "greeting@0.1.0" }]);
  assert.deepEqual(loaded.bundle.workflows, ["workflows/greeting.json"]);
});

const validPackage = {
  package: "1",
  contract: "1",
  kind: "module",
  name: "m",
  version: "0.0.1",
  language: "ts",
  definitions: "definitions.json",
  artifacts: [{ id: "a", target: "any", transport: "subprocess", entry: {} }],
};

test("rejects a package with the wrong format version", () => {
  assert.throws(() => validatePackage({ ...validPackage, package: "2" }, "x"), /`package` must be "1"/);
});

test("rejects a package with an unknown language", () => {
  assert.throws(() => validatePackage({ ...validPackage, language: "go" }, "x"), /`language` must be one of/);
});

test("rejects a package with no artifacts", () => {
  assert.throws(() => validatePackage({ ...validPackage, artifacts: [] }, "x"), /non-empty array/);
});

test("rejects an artifact missing its entry", () => {
  const bad = { ...validPackage, artifacts: [{ id: "a", target: "any", transport: "subprocess" }] };
  assert.throws(() => validatePackage(bad, "x"), /`entry` must be an object/);
});

test("rejects a module descriptor loaded as a bundle (wrong kind)", () => {
  assert.throws(() => validateBundle(validPackage, "x"), /`kind` must be "bundle"/);
});

test("rejects a bundle with neither modules nor workflows", () => {
  const bad = { package: "1", contract: "1", kind: "bundle", name: "b" };
  assert.throws(() => validateBundle(bad, "x"), /at least one of `modules` or `workflows`/);
});
