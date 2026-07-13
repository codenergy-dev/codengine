// Runner conformance: for every codengine-spec case with runs/, execute each run
// against the committed IR and assert it deep-equals expectedOutput. Binds the
// spec's test-function catalog (conformance/README.md).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { run } from "../src/index.js";
import type { FunctionMap, TaskData, WorkflowIR } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test -> codengine-runner-ts -> repo root -> codengine-spec
const casesDir = resolve(here, "..", "..", "..", "codengine-spec", "conformance", "cases");

const catalog: FunctionMap = {
  echo: (input) => input,
  pass: () => true,
  nil: () => null,
  emit: (input) => Array.from({ length: Number(input.n) }, (_, i) => ({ i })),
  route: (input) => input.route,
  pick: (input) => input.i,
  output: (input) => input,
};

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of cases) {
  const runsDir = join(casesDir, name, "runs");
  if (!existsSync(runsDir)) continue;

  const ir = JSON.parse(readFileSync(join(casesDir, name, "workflow.json"), "utf8")) as WorkflowIR;
  const runFiles = readdirSync(runsDir).filter((f) => f.endsWith(".json")).sort();

  for (const file of runFiles) {
    test(`runner conformance: ${name}/${file}`, () => {
      const { entry, input, expectedOutput } = JSON.parse(
        readFileSync(join(runsDir, file), "utf8"),
      );
      const actual = run(ir, catalog, entry, input as TaskData);
      assert.deepStrictEqual(actual, expectedOutput);
    });
  }
}
