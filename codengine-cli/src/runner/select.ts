import { InProcessTsRunner } from "./ts-runner.js";
import { SubprocessRunner } from "./subprocess-runner.js";
import type { Runner, RunnerProfile } from "./types.js";

/** Pick the runner implementation for a language. */
export function selectRunner(profile: RunnerProfile): Runner {
  switch (profile.language) {
    case "ts":
      return new InProcessTsRunner();
    case "py":
      return new SubprocessRunner(profile.python ?? "python3", ["-m", "codengine_runner"]);
    default:
      throw new Error(`Unsupported language '${profile.language satisfies never}'.`);
  }
}
