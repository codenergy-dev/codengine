import { spawn, type ChildProcess } from "node:child_process";
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

function spawnWorker(language: string, module: ResolvedModule, pythonOverride?: string): WorkerClient {
  if (language === "py") {
    const python = pythonOverride ?? module.python ?? "python3";
    return new WorkerClient(python, ["-m", "codengine_worker"]);
  }
  throw new Error(
    `Cross-language runs don't support a '${language}' worker yet. ` +
      "Supported foreign languages: py.",
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
    for (const module of resolved) {
      languageByModule[module.name] = module.language;
      if (module.language === "ts") {
        tsFunctions[module.name] = await loadFunctions(module.files);
      } else {
        let worker = workerByLanguage[module.language];
        if (!worker) {
          worker = spawnWorker(module.language, module, pythonOverride);
          workerByLanguage[module.language] = worker;
        }
        await worker.load(module.name, module.files, module.root);
      }
    }
    const executor = new RoutingExecutor(tsFunctions, languageByModule, workerByLanguage);
    return await run(workflows, executor, entry, input);
  } finally {
    for (const worker of Object.values(workerByLanguage)) worker.close();
  }
}
