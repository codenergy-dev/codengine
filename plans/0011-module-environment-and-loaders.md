# 0011 — Module environment (root) and loaders

Status: done

## Context

Task functions have **dependencies** (installed libraries, sibling modules).
Loading them correctly means loading them **within their project's dependency
environment** — which the manifest does not yet describe (it says where the source
is, not where the project config / node_modules / venv is).

The two languages resolve dependencies differently, and this asymmetry is the
whole point:

- **Node/TS**: `import()` resolves external deps by walking up from the **file** to
  `node_modules`. Deps resolve **per file location** — a function inside its project
  tree just works.
- **Python**: `spec_from_file_location` loads a file but resolves its `import`s via
  the **interpreter's** `sys.path`. Deps resolve **per interpreter** (the venv), and
  the loaded file's own directory is *not* on the path — a sibling import fails
  unless we establish it. This is exactly where pypeyuml "got tangled".

The unifying keystone (the user's insight): a module points to a **project root**
(where its dependency config lives), and loading happens within that environment.

## Design

### 1. Manifest: `root` (the module's environment)

```jsonc
"images": {
  "language": "py",
  "root": "../shared-py",           // the dependency environment (may be outside the project)
  "functions": ["tasks/**/*.py"],   // globs resolve relative to root when present, else the manifest dir
  "python": ".venv/bin/python"      // optional; auto-derived from <root>/.venv when omitted
}
```

- `root` is a local dir, relative to the manifest or absolute; it may point outside
  the project (another local repo).
- **Explicit or auto-detected**: when `root` is omitted, walk up from the first
  matched functions file to a project marker (`package.json` for ts,
  `pyproject.toml` for py); fall back to the manifest dir. Explicit = robust
  control; auto = pypeyuml-style flexibility.

### 2. Environment establishment (per language)

- **py**: interpreter = explicit `python`, else `<root>/.venv/bin/python`, else
  `python3`; add `root` to the subprocess `PYTHONPATH` so the project's own modules
  and installed deps import.
- **ts**: Node already resolves external deps per file; `root` is recorded (used by
  the analyzer for type resolution, and reserved for the future `.ts`
  compile/glue). No per-file work needed at runtime.

### 3. Loaders (a first-class role, the seam for compiled languages)

Extract the "files (+ environment) → function map" responsibility into per-language
loaders, so it is not scattered across the runner and CLI, and so compiled
languages have a home:

- `codengine-loader-py`: env-aware loading — puts `root` on `sys.path`, loads each
  file, merges with the duplicate-name conflict check. `codengine-runner-py` uses
  it. (Moves today's `functions.py`.)
- `codengine-loader-ts`: loads `.mjs`/`.js` within Node's resolution. `codengine-cli`
  uses it. (Moves today's `load-functions.ts`.)

Interpreted languages load by dynamic import. The loader is **designed** so a
compiled language plugs in a *generate-glue-then-compile* strategy (the CLI-written
"glue" idea) — optional for interpreted, mandatory for Dart/C# AOT.

### `.ts` source at runtime (now in scope)

Closes the fonte-vs-runtime gap. **Validated empirically:** Node 22 with
`--experimental-strip-types` dynamically imports a `.ts` file (including a sibling
`.ts` import) — native, no third-party dependency. So:

- `.js` / `.mjs` functions → **in-process** (fast; unchanged; the language server's
  path).
- `.ts` source functions → a **Node subprocess** launched with
  `--experimental-strip-types` — the same shape as the Python subprocess. This needs
  a `codengine-runner-ts` protocol entrypoint (a bin, like runner-py's `__main__`).

The subprocess `functions` payload carries each module's `root`, so the loader can
establish the environment per module (Python: `root` on `sys.path`; Node resolves
deps per file). One subprocess uses one interpreter — modules needing *different*
venvs in one run stay a future limit (like cross-language).

## Deferred (design accommodates; not built here)

- **Compiled-language loaders** (Dart via build_runner/`dart compile`, C# via
  Roslyn) — the loader abstraction (generate-glue-then-compile) is shaped for them.
- **Analyzer `root` wiring** (resolving types from installed deps) — the runtime
  dependency story comes first.

## Proofs (real, cheap — no external package installs)

- **Python deps via root**: a task function that imports a **sibling helper** under
  its `root`; loads when `root` is on `sys.path`, fails without.
- **`.ts` source runtime**: a task function written in `.ts` (importing a sibling
  `.ts`), run through the strip-types subprocess.

## Milestones

1. [x] Manifest `root` + environment resolution (+ auto-detect via project markers)
   + tests — `codengine-manifest` **8/8**.
2. [x] Env-aware Python loading (`root` on `sys.path`) in `codengine-runner-py`'s
   `functions.py` + sibling-import proof; protocol carries per-module
   `{ files, root }` — `codengine-runner-py` **23**.
3. [x] `codengine-loader-ts` extracted (handles `.js`/`.mjs`/`.ts`) + a
   `codengine-runner-ts` subprocess entrypoint (`codengine-run-ts`, launched with
   `--experimental-strip-types`).
4. [x] `codengine-cli`: `root` → environment; **TS in-process for `.js`/`.mjs`,
   strip-types subprocess for `.ts`**; Python subprocess with the chosen
   interpreter — `codengine-cli` **10/10**.
5. [x] Verify: whole suite green; both proofs committed and run through the real
   flow.

## Outcome / notes

- **Both complex cases proven** and committed:
  - Python function importing a **sibling** module resolves because `root` is on
    `sys.path` (`py-root` fixture → `root:sibling-ok`).
  - TypeScript **source `.ts`** (importing a sibling `.ts`) runs via the
    strip-types subprocess (`ts-source` fixture → `Hello, TS (from sibling .ts)`).
    Validated empirically that Node 22 imports `.ts` natively — no third-party
    toolchain.
- **`.ts` runtime = the same subprocess shape as Python** (and the future compiled
  glue). `.js`/`.mjs` stay in-process (fast; the language server's path).
- **Loader extraction, honestly:** `codengine-loader-ts` was extracted because it is
  genuinely **shared** (the CLI in-process path *and* the runner-ts subprocess).
  The Python loader stays in `codengine-runner-py` (`functions.py`, now root-aware)
  because it is used only there; extracting `codengine-loader-py` earns its keep
  only when a second consumer appears (or the compiled-glue design lands).
- **Deferred, unchanged:** compiled-language loaders (Dart/C# via generate-then-
  compile — the loader shape is ready), and analyzer `root` wiring (types from
  installed deps).
- Known limit (documented, like cross-language): one run uses one Python
  interpreter; modules needing different venvs error with a clear message.
