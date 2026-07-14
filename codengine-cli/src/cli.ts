#!/usr/bin/env node
import { parseArgs } from "node:util";
import { runWorkflow } from "./run.js";
import type { Language } from "./runner/types.js";

// fs.globSync (used to resolve --functions/manifest globs) emits a one-time
// experimental warning; suppress just that, and keep every other warning.
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && /\bglob/i.test(warning.message)) return;
  console.error(warning.stack ?? `${warning.name}: ${warning.message}`);
});

const USAGE =
  "Usage: codengine run <workflow.yuml|.json> [--functions <module> | --manifest <codengine.json>] " +
  "[--language ts|py] [--python <path>] [--entry <task>] [--input <json>]";

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (command !== "run") {
    console.error(USAGE);
    process.exit(1);
  }

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      functions: { type: "string", short: "f" },
      manifest: { type: "string", short: "m" },
      language: { type: "string", short: "l" },
      python: { type: "string" },
      entry: { type: "string", short: "e" },
      input: { type: "string", short: "i" },
    },
  });

  const workflow = positionals[0];
  if (!workflow) {
    console.error(USAGE);
    process.exit(1);
  }

  const result = await runWorkflow({
    workflow,
    functions: values.functions,
    manifest: values.manifest,
    language: values.language as Language | undefined,
    python: values.python,
    entry: values.entry,
    input: values.input ? (JSON.parse(values.input) as Record<string, unknown>) : {},
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
