#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parseWorkflow } from "./index.js";

// Workflow name from a file path: everything before the first dot of the
// basename (mirrors the legacy behavior).
function workflowName(file: string): string {
  return basename(file).split(".")[0];
}

function parseFile(file: string, outDir?: string): void {
  const source = readFileSync(file, "utf8");
  const ir = parseWorkflow(source, workflowName(file));
  const target = outDir
    ? join(outDir, `${workflowName(file)}.json`)
    : file.replace(/\.yuml$/, ".json");
  writeFileSync(target, `${JSON.stringify(ir, null, 2)}\n`);
  console.log(`✅ ${file} → ${target}`);
}

function main(argv: string[]): void {
  const [inputPath, outDir] = argv;
  if (!inputPath) {
    console.error("Usage: codengine-parse <file.yuml | dir> [outDir]");
    process.exit(1);
  }

  const stat = statSync(inputPath);
  if (stat.isDirectory()) {
    const files = readdirSync(inputPath).filter((f) => f.endsWith(".yuml"));
    if (files.length === 0) {
      console.error(`No .yuml files found in ${inputPath}`);
      process.exit(1);
    }
    for (const file of files) parseFile(join(inputPath, file), outDir);
  } else {
    parseFile(inputPath, outDir);
  }
}

main(process.argv.slice(2));
