// Parser conformance: parse every codengine-spec case's workflow.yuml and assert
// it deep-equals the committed workflow.json (the expected IR).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { parseWorkflow } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test -> codengine-parser -> repo root -> codengine-spec
const casesDir = resolve(here, "..", "..", "..", "codengine-spec", "conformance", "cases");

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of cases) {
  test(`parser conformance: ${name}`, () => {
    const source = readFileSync(join(casesDir, name, "workflow.yuml"), "utf8");
    const expected = JSON.parse(readFileSync(join(casesDir, name, "workflow.json"), "utf8"));
    const actual = parseWorkflow(source, name);
    assert.deepStrictEqual(actual, expected);
  });
}
