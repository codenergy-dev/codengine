// Runner conformance: for every codengine-spec case with runs/, load all of its
// workflows as a registry and execute each run, asserting expectedOutput. Binds the
// spec's test-function catalog (conformance/README.md), per module.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { run } from "../src/index.js";
import type { ModuleFunctions, TaskData, TaskFunction, WorkflowIR } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test -> codengine-runner-ts -> repo root -> codengine-spec
const casesDir = resolve(here, "..", "..", "..", "codengine-spec", "conformance", "cases");

// Appends its own name to `trail`, so expectedOutput proves which tasks ran.
const trail =
  (name: string): TaskFunction =>
  (input) => ({ trail: [...((input.trail as unknown[]) ?? []), name] });

const catalog: ModuleFunctions = {
  "": {
    echo: (input) => input,
    pass: () => true,
    nil: () => null,
    emit: (input) => Array.from({ length: Number(input.n) }, (_, i) => ({ i })),
    route: (input) => input.route,
    pick: (input) => input.i,
    output: (input) => input,
    start: trail("start"),
  },
  chain: {
    a: trail("a"),
    b: trail("b"),
    c: trail("c"),
    d: trail("d"),
    e: trail("e"),
  },
};

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of cases) {
  const runsDir = join(casesDir, name, "runs");
  if (!existsSync(runsDir)) continue;

  const workflowsDir = join(casesDir, name, "workflows");
  const workflows = readdirSync(workflowsDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(workflowsDir, file), "utf8")) as WorkflowIR);

  for (const file of readdirSync(runsDir).filter((f) => f.endsWith(".json")).sort()) {
    test(`runner conformance: ${name}/${file}`, () => {
      const { entry, input, expectedOutput } = JSON.parse(
        readFileSync(join(runsDir, file), "utf8"),
      );
      const actual = run(workflows, catalog, entry, input as TaskData);
      assert.deepStrictEqual(actual, expectedOutput);
    });
  }
}
