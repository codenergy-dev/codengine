import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadFunctions } from "codengine-loader-ts";
import { run } from "codengine-runner-ts";
import type { ChainResult, Executor, FunctionMap, TaskData, WorkflowIR } from "codengine-core-ts";
import type { ResolvedModule } from "codengine-manifest";

function isPlainObject(value: unknown): value is TaskData {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * A persistent worker client: one long-lived process per foreign language, speaking
 * line-delimited JSON. The module is loaded once ("warm kitchen"); calls are cheap.
 * The engine awaits each call in turn, so responses match requests in FIFO order.
 */
class WorkerClient {
  private readonly child: ChildProcess;
  private readonly pending: { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }[] = [];
  private buffer = "";
  private exited: Error | null = null;

  constructor(command: string, args: string[], cwd?: string) {
    this.child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "inherit"] });
    this.child.stdout!.setEncoding("utf8");
    this.child.stdout!.on("data", (chunk: string) => this.onData(chunk));
    this.child.on("error", (error) => this.fail(error));
    this.child.on("close", () => this.fail(new Error("worker exited unexpectedly")));
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let newline: number;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      const waiter = this.pending.shift();
      if (!waiter) continue;
      const response = JSON.parse(line) as Record<string, unknown>;
      if (response.error !== undefined) waiter.reject(new Error(String(response.error)));
      else waiter.resolve(response);
    }
  }

  private fail(error: Error): void {
    this.exited = error;
    while (this.pending.length) this.pending.shift()!.reject(error);
  }

  private send(request: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (this.exited) return Promise.reject(this.exited);
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
      this.child.stdin!.write(`${JSON.stringify(request)}\n`);
    });
  }

  async load(module: string, files: string[], root: string | null): Promise<void> {
    await this.send({ op: "load", module, files, root });
  }

  async call(module: string, fn: string, input: TaskData): Promise<unknown> {
    const response = await this.send({ op: "call", module, function: fn, input });
    return response.result;
  }

  async callChain(module: string, functions: string[], input: TaskData): Promise<ChainResult> {
    const response = await this.send({ op: "callChain", module, functions, input });
    return {
      result: response.result,
      consumed: response.consumed as number,
      input: response.input as TaskData,
    };
  }

  close(): void {
    this.child.stdin!.end();
    this.child.kill();
  }
}

// Route each task to its module's runtime: TS runs in-process (the orchestrator is
// TS); a foreign module goes to its language's warm worker. All graph semantics stay
// in the one engine — this only decides *where* a task's function runs.
class RoutingExecutor implements Executor {
  constructor(
    private readonly tsFunctions: Record<string, FunctionMap>,
    private readonly languageByModule: Record<string, string>,
    private readonly workerByLanguage: Record<string, WorkerClient>,
  ) {}

  async execute(module: string, fn: string, input: TaskData): Promise<unknown> {
    const language = this.languageByModule[module];
    if (language === "ts") return this.tsFunction(module, fn)(input);
    return this.workerByLanguage[language].call(module, fn, input);
  }

  // Run a straight-line same-module segment in one call. Foreign modules use the
  // worker's callChain (one boundary crossing); TS runs the chain in-process.
  async executeChain(module: string, functions: string[], input: TaskData): Promise<ChainResult> {
    const language = this.languageByModule[module];
    if (language !== "ts") return this.workerByLanguage[language].callChain(module, functions, input);

    let data: unknown = input;
    let result: unknown = data;
    let fed: TaskData = input;
    let consumed = 0;
    for (const fn of functions) {
      fed = data as TaskData;
      result = this.tsFunction(module, fn)(data as TaskData);
      consumed += 1;
      if (!isPlainObject(result)) break;
      data = result;
    }
    return { result, consumed, input: fed };
  }

  private tsFunction(module: string, fn: string) {
    const f = this.tsFunctions[module]?.[fn];
    if (!f) {
      const label = module === "" ? "the default module" : `module '${module}'`;
      throw new Error(`No function '${fn}' bound in ${label}.`);
    }
    return f;
  }
}

/** Locate the built codengine-worker-cs assembly (env override, else the build output). */
function resolveCsWorkerDll(): string {
  const override = process.env.CODENGINE_WORKER_CS_DLL;
  if (override) return override;
  // cross-language.js: <repo>/codengine-cli/dist/src/runner/… -> up 4 to the repo root.
  const here = dirname(fileURLToPath(import.meta.url));
  const base = join(here, "..", "..", "..", "..", "codengine-cs", "codengine-worker-cs", "bin");
  for (const config of ["Release", "Debug"]) {
    const dll = join(base, config, "net10.0", "codengine-worker-cs.dll");
    if (existsSync(dll)) return dll;
  }
  throw new Error(
    "codengine-worker-cs is not built. Run `dotnet build` in codengine-cs/codengine-worker-cs, " +
      "or set CODENGINE_WORKER_CS_DLL to the built assembly.",
  );
}

/** Run a one-shot process, feeding stdin and collecting stdout. */
function runOnce(command: string, args: string[], cwd: string, stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (out += chunk));
    child.stderr.on("data", (chunk: string) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(err.trim() || `${command} exited with ${code}`));
      else resolve(out.trim());
    });
    child.stdin.end(stdin);
  });
}

/** Start one warm worker for a language, given all of that language's modules. */
async function spawnWorker(
  language: string,
  modules: ResolvedModule[],
  pythonOverride?: string,
): Promise<WorkerClient> {
  if (language === "py") {
    const python = pythonOverride ?? modules.find((module) => module.python)?.python ?? "python3";
    return new WorkerClient(python, ["-m", "codengine_worker"]);
  }
  if (language === "cs") {
    // Reflection: the worker builds each module's project and reflects it on `load`.
    return new WorkerClient("dotnet", [resolveCsWorkerDll()]);
  }
  if (language === "dart") {
    // No reflection: generate the worker glue (functions baked in), then run it.
    const roots = [...new Set(modules.map((module) => module.root))];
    if (roots.length > 1) {
      throw new Error(`Dart modules must share one package root; got: ${roots.join(", ")}.`);
    }
    const root = roots[0];
    const spec = JSON.stringify({
      functions: Object.fromEntries(
        modules.map((module) => [module.name, { files: module.files, root: module.root }]),
      ),
    });
    const glue = await runOnce("dart", ["run", "codengine_generator:worker"], root, spec);
    return new WorkerClient("dart", ["run", glue], root);
  }
  throw new Error(
    `Cross-language runs don't support a '${language}' worker yet. ` +
      "Supported foreign languages: py, cs, dart.",
  );
}

/**
 * Run a workflow whose modules span several languages: TS in-process, each other
 * language via a warm persistent worker, all driven by the one TS engine.
 */
export async function runCrossLanguage(
  workflows: WorkflowIR[],
  resolved: ResolvedModule[],
  entry: string,
  input: TaskData,
  pythonOverride?: string,
): Promise<TaskData[] | null> {
  const tsFunctions: Record<string, FunctionMap> = {};
  const languageByModule: Record<string, string> = {};
  const workerByLanguage: Record<string, WorkerClient> = {};

  try {
    // TS runs in-process; every other language is grouped so its worker starts once
    // with all of that language's modules (Dart bakes them into the glue).
    const foreign = new Map<string, ResolvedModule[]>();
    for (const module of resolved) {
      languageByModule[module.name] = module.language;
      if (module.language === "ts") {
        tsFunctions[module.name] = await loadFunctions(module.files);
      } else {
        const group = foreign.get(module.language) ?? [];
        group.push(module);
        foreign.set(module.language, group);
      }
    }

    for (const [language, modules] of foreign) {
      const worker = await spawnWorker(language, modules, pythonOverride);
      workerByLanguage[language] = worker;
      for (const module of modules) await worker.load(module.name, module.files, module.root);
    }

    const executor = new RoutingExecutor(tsFunctions, languageByModule, workerByLanguage);
    return await run(workflows, executor, entry, input);
  } finally {
    for (const worker of Object.values(workerByLanguage)) worker.close();
  }
}
