import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
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
  if (choice.language === "cs") {
    // A prebuilt runner assembly. It builds each module's project (its `root`, from
    // the protocol) and reflects the output — so the user's .csproj needs no codengine
    // reference and cwd is irrelevant.
    return new SubprocessRunner("dotnet", [resolveCsRunnerDll()]);
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

/** Locate the built codengine-runner-cs assembly (env override, else the monorepo
 * build output). Built once with `dotnet build`; the CLI only spawns it. */
function resolveCsRunnerDll(): string {
  const override = process.env.CODENGINE_RUNNER_CS_DLL;
  if (override) return override;
  // select.js: <repo>/codengine-cli/dist/src/runner/select.js -> up 4 to the repo root.
  const here = dirname(fileURLToPath(import.meta.url));
  const base = join(here, "..", "..", "..", "..", "codengine-cs", "codengine-runner-cs", "bin");
  for (const config of ["Release", "Debug"]) {
    const dll = join(base, config, "net10.0", "codengine-runner-cs.dll");
    if (existsSync(dll)) return dll;
  }
  throw new Error(
    "codengine-runner-cs is not built. Run `dotnet build` in codengine-cs/codengine-runner-cs, " +
      "or set CODENGINE_RUNNER_CS_DLL to the built assembly.",
  );
}
