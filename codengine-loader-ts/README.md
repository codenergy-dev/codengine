# codengine-loader-ts

Load TS/JS **task functions** (a module's files) into a function map. Shared by
[`codengine-cli`](../codengine-cli/) (in-process) and the
[`codengine-runner-ts`](../codengine-runner-ts/) subprocess entrypoint. Zero
runtime dependencies.

```ts
import { loadFunctions } from "codengine-loader-ts";

const functions = await loadFunctions(["tasks.mjs", "more.ts"]);
```

- Collects a file's **named function exports**, and/or a **default export that is an
  object** of functions.
- A name defined in two files is a **conflict** (rename one, or split into modules).
- `.js` / `.mjs` load directly. **`.ts` source** loads when the process was started
  with Node's `--experimental-strip-types` — how the orchestrator runs a TS module
  whose functions are source `.ts` (no third-party toolchain, no build step).

Node resolves each file's own dependencies (siblings, installed packages) from the
file's location, so a module's project `root` is not needed here — it is used by the
Python loader (`sys.path`) and by the analyzers.
