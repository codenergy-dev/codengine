import { fileURLToPath } from "node:url";
import { InProcessTsRunner } from "./ts-runner.js";
import { SubprocessRunner } from "./subprocess-runner.js";
import type { Language, Runner } from "./types.js";

export interface RunnerChoice {
  language: Language;
  python?: string;
  /** For TS: run source `.ts` in a strip-types subprocess instead of in-process. */
  tsSubprocess: boolean;
}

/** Pick the runner: TS in-process (`.js`/`.mjs`), TS strip-types subprocess (`.ts`),
 * or the Python subprocess. */
export function selectRunner(choice: RunnerChoice): Runner {
  if (choice.language === "py") {
    return new SubprocessRunner(choice.python ?? "python3", ["-m", "codengine_runner"]);
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
