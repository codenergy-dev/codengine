// End-to-end: load a workflow registry and run it through both the in-process TS
// runner and the Python subprocess runner. Identical results across languages,
// driven entirely by the CLI, prove multi-language runner selection.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadFunctions, runWorkflow } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url)); // dist/test
const repo = resolve(here, "..", "..", "..");
const cases = resolve(repo, "codengine-spec", "conformance", "cases");
const fixtures = resolve(repo, "codengine-cli", "test", "fixtures");

const tsCatalog = resolve(here, "fixtures", "catalog.js"); // compiled from catalog.ts
const pyCatalog = join(fixtures, "catalog.py");
const pyPython = resolve(repo, "codengine-py", "codengine-runner-py", ".venv", "bin", "python");

const specWorkflow = (name: string) => join(cases, name, "workflows", `${name}.yuml`);

const workflows: Record<string, { entry: string; input: Record<string, unknown>; expected: unknown }> = {
  "linear-echo": { entry: "echo", input: { msg: "hi" }, expected: [{ msg: "hi" }] },
  "index-routing": { entry: "pick", input: { i: 4 }, expected: [{ i: 4 }] },
};

for (const [name, spec] of Object.entries(workflows)) {
  test(`ts in-process: ${name}`, async () => {
    const result = await runWorkflow({
      workflows: specWorkflow(name),
      functions: tsCatalog,
      language: "ts",
      entry: spec.entry,
      input: spec.input,
    });
    assert.deepStrictEqual(result, spec.expected);
  });

  test(`py subprocess: ${name}`, { skip: !existsSync(pyPython) }, async () => {
    const result = await runWorkflow({
      workflows: specWorkflow(name),
      functions: pyCatalog,
      language: "py",
      python: pyPython,
      entry: spec.entry,
      input: spec.input,
    });
    assert.deepStrictEqual(result, spec.expected);
  });
}

const manifestProject = join(fixtures, "manifest-project");

test("runs from an explicit manifest (default module)", async () => {
  const result = await runWorkflow({
    workflows: join(manifestProject, "greeting.yuml"),
    manifest: join(manifestProject, "codengine.json"),
    entry: "greet",
    input: { name: "Manifest" },
  });
  assert.deepStrictEqual(result, [{ message: "Hello, Manifest!" }]);
});

test("finds the manifest by walking up from the workflow", async () => {
  const result = await runWorkflow({
    workflows: join(manifestProject, "greeting.yuml"),
    entry: "greet",
    input: { name: "Auto" },
  });
  assert.deepStrictEqual(result, [{ message: "Hello, Auto!" }]);
});

test("loading functions from multiple files rejects a name conflict", async () => {
  const conflict = join(fixtures, "conflict");
  await assert.rejects(
    loadFunctions([join(conflict, "a.mjs"), join(conflict, "b.mjs")]),
    /Duplicate task function 'greet'/,
  );
});

// A project whose manifest declares several workflows and several modules: the
// caller's `chain.a` is an entrypoint of the `chain` workflow, so calling it runs
// that whole chain and mirrors the results back.
test("runs a multi-workflow project with a cross-workflow call", async () => {
  const result = await runWorkflow({
    manifest: join(fixtures, "cross-project", "codengine.json"),
    entry: "start",
    input: {},
  });
  assert.deepStrictEqual(result, [{ trail: ["start", "a", "b"] }]);
});

// Source `.ts` functions run via the strip-types subprocess; `tasks.ts` imports a
// sibling `.ts`, proving deps resolve at runtime.
test("runs TypeScript source (.ts) importing a sibling, via strip-types", async () => {
  const result = await runWorkflow({
    manifest: join(fixtures, "ts-source", "codengine.json"),
    entry: "greet",
    input: { name: "TS" },
  });
  assert.deepStrictEqual(result, [{ message: "Hello, TS (from sibling .ts)" }]);
});

// A Python function that imports a sibling module resolves it because the module's
// `root` is put on sys.path — the dependency environment.
test("runs a Python module whose function imports a sibling via its root", { skip: !existsSync(pyPython) }, async () => {
  const result = await runWorkflow({
    manifest: join(fixtures, "py-root", "codengine.json"),
    python: pyPython,
    entry: "greet",
    input: { name: "root" },
  });
  assert.deepStrictEqual(result, [{ message: "root:sibling-ok" }]);
});

// End-to-end Dart (a compiled language): the user writes plain top-level functions;
// the analyzer finds them, the generator writes glue with named-binding wrappers, and
// it runs. Requires the Dart SDK + `dart pub get` in the fixture.
const dartProject = join(fixtures, "dart-project");
test("runs a Dart module (analyze -> generate glue -> run)", { skip: !existsSync(join(dartProject, ".dart_tool")) }, async () => {
  const result = await runWorkflow({
    manifest: join(dartProject, "codengine.json"),
    entry: "greet",
    input: { name: "Dart" },
  });
  assert.deepStrictEqual(result, [{ message: "Hello, Dart!" }]);
});
