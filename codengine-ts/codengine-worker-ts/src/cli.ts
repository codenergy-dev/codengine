#!/usr/bin/env node
// Entrypoint: the persistent worker the orchestrator spawns for a TS/JS module in a
// cross-language run.
import { serve } from "./worker.js";

serve().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
