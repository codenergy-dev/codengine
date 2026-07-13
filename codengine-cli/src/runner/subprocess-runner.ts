import { spawn } from "node:child_process";
import type { TaskData, WorkflowIR } from "codengine-runner-ts";
import type { Runner } from "./types.js";

interface Response {
  result?: TaskData[] | null;
  error?: string;
}

/**
 * Runs a workflow in another language's runner as a subprocess, exchanging JSON
 * over stdio:
 *   in:  { ir, entry, input, functions }
 *   out: { result } | { error }
 */
export class SubprocessRunner implements Runner {
  constructor(
    private readonly command: string,
    private readonly args: string[],
  ) {}

  run(
    ir: WorkflowIR,
    entry: string,
    input: TaskData,
    functions: string,
  ): Promise<TaskData[] | null> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, this.args, { stdio: ["pipe", "pipe", "inherit"] });
      let stdout = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.on("error", reject);
      child.on("close", (code) => {
        let response: Response;
        try {
          response = JSON.parse(stdout) as Response;
        } catch {
          reject(new Error(`Runner produced invalid output (exit ${code}): ${stdout.slice(0, 200)}`));
          return;
        }
        if (response.error !== undefined) reject(new Error(response.error));
        else resolve(response.result ?? null);
      });
      child.stdin.end(JSON.stringify({ ir, entry, input, functions }));
    });
  }
}
