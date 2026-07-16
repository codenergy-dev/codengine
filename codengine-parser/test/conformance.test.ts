// Parser conformance: parse every workflow of every codengine-spec case and assert
// it deep-equals the committed IR. A case may hold several workflows (a registry);
// the file name is the workflow name.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import { parseWorkflow } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test -> codengine-parser -> repo root -> codengine-spec
const casesDir = resolve(here, "..", "..", "..", "codengine-spec", "conformance", "cases");

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of cases) {
  const workflowsDir = join(casesDir, name, "workflows");
  const sources = readdirSync(workflowsDir)
    .filter((file) => file.endsWith(".yuml"))
    .sort();

  for (const file of sources) {
    const workflow = basename(file, ".yuml");
    test(`parser conformance: ${name}/${workflow}`, () => {
      const source = readFileSync(join(workflowsDir, file), "utf8");
      const expected = JSON.parse(readFileSync(join(workflowsDir, `${workflow}.json`), "utf8"));
      assert.deepStrictEqual(parseWorkflow(source, workflow), expected);
    });
  }
}
