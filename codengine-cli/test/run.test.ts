// End-to-end: load a workflow registry and run it through both the in-process TS
// runner and the Python subprocess runner. Identical results across languages,
// driven entirely by the CLI, prove multi-language runner selection.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

// Cross-language: one workflow whose modules span two languages. The TS engine
// orchestrates; the TS module runs in-process, the Python module in a warm worker.
// Proves the engine/executor split + the subprocess transport (plan 0017).
test("runs a cross-language workflow (TS engine + Python worker)", { skip: !existsSync(pyPython) }, async () => {
  const result = await runWorkflow({
    manifest: join(fixtures, "cross-language", "codengine.json"),
    python: pyPython,
    entry: "en.greet",
    input: { name: "Cross" },
  });
  assert.deepStrictEqual(result, [{ message: "Hello, Cross!" }]);
});

// A straight-line foreign segment (step_a -> step_b -> output, all Python) is handed
// to the worker as one chain — the linear-segment batching (plan 0017, step 5).
test("runs a cross-language linear segment as one worker chain", { skip: !existsSync(pyPython) }, async () => {
  const result = await runWorkflow({
    manifest: join(fixtures, "cross-language-chain", "codengine.json"),
    python: pyPython,
    entry: "en.greet",
    input: { name: "Cross" },
  });
  assert.deepStrictEqual(result, [{ message: "Hi Cross a b" }]);
});

// Cross-language with the C# worker: it builds the module's project and reflects it
// (C# has reflection), then serves calls warm.
const csWorkerDll = ["Release", "Debug"]
  .map((config) => resolve(repo, "codengine-cs", "codengine-worker-cs", "bin", config, "net10.0", "codengine-worker-cs.dll"))
  .find((dll) => existsSync(dll));
test("runs a cross-language workflow (TS engine + C# worker)", { skip: !csWorkerDll }, async () => {
  if (csWorkerDll) process.env.CODENGINE_WORKER_CS_DLL = csWorkerDll;
  const result = await runWorkflow({
    manifest: join(fixtures, "cross-language-cs", "codengine.json"),
    entry: "en.greet",
    input: { name: "Cross" },
  });
  assert.deepStrictEqual(result, [{ message: "Hello, Cross!" }]);
});

// Cross-language with the Dart worker: Dart AOT has no reflection, so the generator
// writes worker glue with the functions baked in, and that glue serves the calls.
const dartCrossProject = join(fixtures, "cross-language-dart");
test("runs a cross-language workflow (TS engine + Dart worker)", { skip: !existsSync(join(dartCrossProject, ".dart_tool")) }, async () => {
  const result = await runWorkflow({
    manifest: join(dartCrossProject, "codengine.json"),
    entry: "en.greet",
    input: { name: "Cross" },
  });
  assert.deepStrictEqual(result, [{ message: "Hello, Cross!" }]);
});

// Remote transport (plan 0020): the module is served by a worker already running as an
// HTTP service (deployed with its own code). The orchestrator calls it by name over
// the network — no local files, no spawn. Proven for every language's worker.

// Start a worker in HTTP mode; resolve once it prints its bound (ephemeral) port.
function startHttpWorker(command: string, args: string[], cwd: string): Promise<{ url: string; stop: () => void }> {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "inherit"] });
    proc.on("error", reject);
    proc.stdout.setEncoding("utf8");
    let buffer = "";
    proc.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline >= 0) {
        const port = Number(buffer.slice(0, newline).trim());
        resolvePromise({ url: `http://127.0.0.1:${port}`, stop: () => proc.kill() });
      }
    });
  });
}

// Run the fixture's greeting workflow against a remote worker, via a temp manifest that
// marks the module `transport: "remote"`.
async function runRemote(url: string, dir: string, language: string) {
  const temp = mkdtempSync(join(tmpdir(), "codengine-remote-"));
  try {
    const manifestPath = join(temp, "codengine.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({
        version: "1",
        workflows: [join(dir, "greeting.yuml")],
        modules: { "": { language, transport: "remote", url } },
      }),
    );
    return await runWorkflow({ manifest: manifestPath, entry: "greet", input: { name: "Remote" } });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test("remote Python worker (HTTP)", { skip: !existsSync(pyPython) }, async () => {
  const dir = join(fixtures, "remote-python");
  const worker = await startHttpWorker(pyPython, ["-m", "codengine_worker", "--http", "0", "--config", "worker-config.json"], dir);
  try {
    assert.deepStrictEqual(await runRemote(worker.url, dir, "py"), [{ message: "Hello, Remote!" }]);
  } finally {
    worker.stop();
  }
});

const workerTsCli = resolve(repo, "codengine-ts", "codengine-worker-ts", "dist", "src", "cli.js");
test("remote TS worker (HTTP)", { skip: !existsSync(workerTsCli) }, async () => {
  const dir = join(fixtures, "remote-ts");
  const worker = await startHttpWorker("node", [workerTsCli, "--http", "0", "--config", "worker-config.json"], dir);
  try {
    assert.deepStrictEqual(await runRemote(worker.url, dir, "ts"), [{ message: "Hello, Remote!" }]);
  } finally {
    worker.stop();
  }
});

const csWorkerHttpDll = ["Release", "Debug"]
  .map((config) => resolve(repo, "codengine-cs", "codengine-worker-cs", "bin", config, "net10.0", "codengine-worker-cs.dll"))
  .find((dll) => existsSync(dll));
test("remote C# worker (HTTP)", { skip: !csWorkerHttpDll }, async () => {
  const dir = join(fixtures, "remote-cs");
  const worker = await startHttpWorker("dotnet", [csWorkerHttpDll!, "--http", "0", "--config", "worker-config.json"], dir);
  try {
    assert.deepStrictEqual(await runRemote(worker.url, dir, "cs"), [{ message: "Hello, Remote!" }]);
  } finally {
    worker.stop();
  }
});

// Dart's worker is generated glue (no reflection): generate it, then run with --http.
const remoteDartDir = join(fixtures, "remote-dart");
function generateDartWorkerGlue(dir: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn("dart", ["run", "codengine_generator:worker"], { cwd: dir, stdio: ["pipe", "pipe", "inherit"] });
    let out = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => (out += chunk));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolvePromise(out.trim()) : reject(new Error("glue generation failed"))));
    proc.stdin.end(JSON.stringify({ functions: { "": { files: [join(dir, "tasks.dart")], root: dir } } }));
  });
}
test("remote Dart worker (HTTP)", { skip: !existsSync(join(remoteDartDir, ".dart_tool")) }, async () => {
  const glue = await generateDartWorkerGlue(remoteDartDir);
  const worker = await startHttpWorker("dart", ["run", glue, "--http", "0"], remoteDartDir);
  try {
    assert.deepStrictEqual(await runRemote(worker.url, remoteDartDir, "dart"), [{ message: "Hello, Remote!" }]);
  } finally {
    worker.stop();
  }
});

// End-to-end C# (a compiled language *with* reflection): the user writes plain public
// static methods and their .csproj has NO codengine reference. The runner builds the
// project, loads the assembly, and binds parameters by reflection — no generator.
// Requires the .NET SDK and the built runner-cs assembly.
const csRunnerDll = ["Release", "Debug"]
  .map((config) => resolve(repo, "codengine-cs", "codengine-runner-cs", "bin", config, "net10.0", "codengine-runner-cs.dll"))
  .find((dll) => existsSync(dll));
test("runs a C# module (build project -> reflect assembly -> run)", { skip: !csRunnerDll }, async () => {
  if (csRunnerDll) process.env.CODENGINE_RUNNER_CS_DLL = csRunnerDll;
  const result = await runWorkflow({
    manifest: join(fixtures, "cs-project", "codengine.json"),
    entry: "greet",
    input: { name: "CSharp" },
  });
  assert.deepStrictEqual(result, [{ message: "Hello, CSharp!" }]);
});
