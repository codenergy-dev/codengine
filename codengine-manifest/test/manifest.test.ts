import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadManifest, findManifest, resolveModule } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url)); // dist/test
const fixtures = resolve(here, "..", "..", "test", "fixtures");
const project = resolve(fixtures, "project", "codengine.json");
const projectDir = resolve(fixtures, "project");
const sharedDir = resolve(fixtures, "shared");
// the shared conformance example in codengine-spec
const specExample = resolve(here, "..", "..", "..", "codengine-spec", "conformance", "manifest", "valid", "codengine.json");

test("loads and validates a manifest", () => {
  const loaded = loadManifest(project);
  assert.equal(loaded.manifest.version, "1");
  assert.deepEqual(Object.keys(loaded.manifest.modules).sort(), ["", "images", "many"]);
  assert.equal(loaded.dir, projectDir);
});

test("resolves the default module (single glob) + auto-detected root", () => {
  const loaded = loadManifest(project);
  const resolved = resolveModule(loaded, null);
  assert.equal(resolved.language, "ts");
  assert.deepEqual(resolved.files, [resolve(projectDir, "src", "tasks.ts")]);
  assert.equal(resolved.root, projectDir); // detected via package.json
});

test("expands a recursive glob to multiple files (sorted)", () => {
  const loaded = loadManifest(project);
  const resolved = resolveModule(loaded, "many");
  assert.deepEqual(resolved.files, [
    resolve(projectDir, "src", "nested", "more.ts"),
    resolve(projectDir, "src", "tasks.ts"),
  ]);
  assert.equal(resolved.root, projectDir);
});

test("an explicit root: globs and python resolve against it, files outside the project", () => {
  const loaded = loadManifest(project);
  const resolved = resolveModule(loaded, "images");
  assert.equal(resolved.language, "py");
  assert.equal(resolved.root, sharedDir);
  assert.deepEqual(resolved.files, [
    resolve(sharedDir, "img.py"),
    resolve(sharedDir, "util.py"),
  ]);
  assert.equal(resolved.python, resolve(sharedDir, ".venv", "bin", "python"));
});

test("finds the manifest by walking up", () => {
  const loaded = findManifest(resolve(projectDir, "nested", "deep"));
  assert.ok(loaded);
  assert.equal(loaded.path, project);
});

test("accepts the spec conformance example", () => {
  const loaded = loadManifest(specExample);
  assert.equal(loaded.manifest.modules[""].language, "ts");
});

test("rejects an unknown module", () => {
  const loaded = loadManifest(project);
  assert.throws(() => resolveModule(loaded, "nope"), /no module 'nope'/);
});

test("rejects an invalid manifest", () => {
  const bad = resolve(fixtures, "invalid-version", "codengine.json");
  assert.throws(() => loadManifest(bad), /version must be/);
});

test("resolves a remote module to its transport + url (no local files)", () => {
  const loaded = loadManifest(resolve(fixtures, "remote", "codengine.json"));
  const resolved = resolveModule(loaded, null);
  assert.equal(resolved.transport, "remote");
  assert.equal(resolved.url, "http://127.0.0.1:9999");
  assert.deepEqual(resolved.files, []);
});

test("a local module is marked transport: local", () => {
  const loaded = loadManifest(project);
  assert.equal(resolveModule(loaded, null).transport, "local");
});

test("rejects a remote module without a url", () => {
  const bad = resolve(fixtures, "remote-no-url", "codengine.json");
  assert.throws(() => loadManifest(bad), /needs a `url`/);
});
