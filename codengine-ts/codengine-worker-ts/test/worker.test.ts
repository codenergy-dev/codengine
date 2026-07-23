import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url)); // dist/test
const cli = resolve(here, "..", "src", "cli.js");
const tasks = resolve(here, "..", "..", "test", "fixtures", "tasks.mjs");

function roundtrip(requests: unknown[]): Promise<Record<string, unknown>[]> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("node", [cli], { stdio: ["pipe", "pipe", "inherit"] });
    let out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (out += chunk));
    child.on("error", reject);
    child.on("close", () => {
      resolvePromise(
        out
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>),
      );
    });
    child.stdin.end(`${requests.map((r) => JSON.stringify(r)).join("\n")}\n`);
  });
}

test("worker-ts: load then call", async () => {
  const responses = await roundtrip([
    { op: "load", module: "", files: [tasks] },
    { op: "call", module: "", function: "greet", input: { name: "TS" } },
  ]);
  assert.deepEqual(responses[0], { ok: true });
  assert.deepEqual(responses[1], { result: { message: "Hello, TS!" } });
});

test("worker-ts: callChain feeds forward", async () => {
  const responses = await roundtrip([
    { op: "load", module: "", files: [tasks] },
    { op: "callChain", module: "", functions: ["stepA", "stepB"], input: { x: 1 } },
  ]);
  // stepA({x:1}) -> {x:2}; stepB({x:2}) -> {x:4}; input fed to stepB was {x:2}
  assert.deepEqual(responses[1], { result: { x: 4 }, consumed: 2, input: { x: 2 } });
});
