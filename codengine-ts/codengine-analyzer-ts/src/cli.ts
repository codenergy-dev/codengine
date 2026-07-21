#!/usr/bin/env node
import { analyzeSource } from "./index.js";

const [file] = process.argv.slice(2);
if (!file) {
  console.error("Usage: codengine-analyze-ts <file.ts>");
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(analyzeSource(file), null, 2)}\n`);
