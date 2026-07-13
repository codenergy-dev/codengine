#!/usr/bin/env node
import { parseArgs } from "node:util";
import { runWorkflow } from "./run.js";
import type { Language } from "./runner/types.js";

const USAGE =
  "Usage: codengine run <workflow.yuml|.json> --functions <module> " +
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
      language: { type: "string", short: "l" },
      python: { type: "string" },
      entry: { type: "string", short: "e" },
      input: { type: "string", short: "i" },
    },
  });

  const workflow = positionals[0];
  if (!workflow || !values.functions) {
    console.error(USAGE);
    process.exit(1);
  }

  const result = await runWorkflow({
    workflow,
    functions: values.functions,
    language: (values.language as Language | undefined) ?? "ts",
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
