import { fileURLToPath } from "node:url";
import { InProcessTsRunner } from "./ts-runner.js";
import { SubprocessRunner } from "./subprocess-runner.js";
import type { Language, Runner } from "./types.js";

export interface RunnerChoice {
  language: Language;
  python?: string;
  /** For TS: run source `.ts` in a strip-types subprocess instead of in-process. */
  tsSubprocess: boolean;
  /** For Dart: the module's package root (cwd for the Dart tool). */
  dartRoot?: string;
}

/** Pick the runner: TS in-process (`.js`/`.mjs`), TS strip-types subprocess (`.ts`),
 * the Python subprocess, or the Dart subprocess (analyze + generate glue + run). */
export function selectRunner(choice: RunnerChoice): Runner {
  if (choice.language === "py") {
    return new SubprocessRunner(choice.python ?? "python3", ["-m", "codengine_runner"]);
  }
  if (choice.language === "dart") {
    // Runs in the module's Dart package, which depends on codengine_generator.
    return new SubprocessRunner("dart", ["run", "codengine_generator:run"], choice.dartRoot);
  }
  if (choice.tsSubprocess) {
    const cli = fileURLToPath(import.meta.resolve("codengine-runner-ts/dist/src/cli.js"));
    return new SubprocessRunner("node", [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      cli,
    ]);
  }
  return new InProcessTsRunner();
}
