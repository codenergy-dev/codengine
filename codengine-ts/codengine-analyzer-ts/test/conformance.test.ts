// Analyzer conformance: analyze each codengine-spec case's source.ts and assert the
// definitions deep-equal the shared expected.json — the same file analyzer-py
// matches, proving cross-language parity of the descriptor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { analyzeSource } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test -> codengine-analyzer-ts -> codengine-ts -> repo root -> codengine-spec
const casesDir = resolve(here, "..", "..", "..", "..", "codengine-spec", "conformance", "analyzer");

const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const name of cases) {
  const source = join(casesDir, name, "source.ts");
  if (!existsSync(source)) continue;
  test(`analyzer conformance: ${name}`, () => {
    const expected = JSON.parse(readFileSync(join(casesDir, name, "expected.json"), "utf8"));
    const doc = analyzeSource(source);
    assert.equal(doc.version, "1");
    assert.equal(doc.language, "ts");
    assert.deepStrictEqual(doc.definitions, expected);
  });
}
