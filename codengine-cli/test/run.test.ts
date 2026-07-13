// End-to-end: parse a yUML workflow and run it through both the in-process TS
// runner and the Python subprocess runner. Identical results across languages,
// driven entirely by the CLI, prove multi-language runner selection.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runWorkflow } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url)); // dist/test
const repo = resolve(here, "..", "..", "..");
const cases = resolve(repo, "codengine-spec", "conformance", "cases");

const tsCatalog = resolve(here, "fixtures", "catalog.js"); // compiled from catalog.ts
const pyCatalog = resolve(repo, "codengine-cli", "test", "fixtures", "catalog.py");
const pyPython = resolve(repo, "codengine-runner-py", ".venv", "bin", "python");

const workflows: Record<string, { entry: string; input: Record<string, unknown>; expected: unknown }> = {
  "linear-echo": { entry: "echo", input: { msg: "hi" }, expected: [{ msg: "hi" }] },
  "index-routing": { entry: "pick", input: { i: 4 }, expected: [{ i: 4 }] },
};

for (const [name, spec] of Object.entries(workflows)) {
  test(`ts in-process: ${name}`, async () => {
    const result = await runWorkflow({
      workflow: resolve(cases, name, "workflow.yuml"),
      functions: tsCatalog,
      language: "ts",
      entry: spec.entry,
      input: spec.input,
    });
    assert.deepStrictEqual(result, spec.expected);
  });

  test(`py subprocess: ${name}`, { skip: !existsSync(pyPython) }, async () => {
    const result = await runWorkflow({
      workflow: resolve(cases, name, "workflow.yuml"),
      functions: pyCatalog,
      language: "py",
      python: pyPython,
      entry: spec.entry,
      input: spec.input,
    });
    assert.deepStrictEqual(result, spec.expected);
  });
}
