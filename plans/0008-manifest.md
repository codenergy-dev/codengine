# 0008 — Project manifest

Status: done

## Context

The **manifest** is the connective tissue we deferred: it tells codengine where a
project's workflows and task functions live, and in which language. It is what the
future language server and the CLI use to resolve a task's `module` to concrete
source + a runner/analyzer. Built now (schema + a shared lib + CLI retrofit) so it
is validated by a real consumer before the server depends on it.

Decisions locked with the user: schema in `codengine-spec`; a separate
`codengine-manifest` lib shared by the CLI and the server; local files only (no
remote repos / package managers); functions may live **outside** the manifest's
directory (relative or absolute local paths — e.g. functions from another local
repo).

## The manifest

`codengine.json`, at the main project's root:

```jsonc
{
  "version": "1",
  "workflows": ["workflows"],          // where the .yuml diagrams are (for the server)
  "modules": {
    "": {                               // default module: tasks with module: null
      "language": "ts",
      "functions": "./src/tasks.ts"
    },
    "images": {
      "language": "py",
      "functions": "../shared-py/image_tasks.py",   // outside the project dir
      "python": ".venv/bin/python"
    }
  }
}
```

- `modules` maps a namespace → `{ language, functions, python? }`. The empty key
  `""` is the default module (for `module: null` tasks).
- `functions` is a local path, resolved against the manifest dir, or absolute; it
  may point outside the project.
- Same config drives both the analyzer (editing) and the runner (execution).

## `codengine-manifest` (shared lib)

- `loadManifest(path)` → validated manifest + its absolute dir.
- `findManifest(startDir)` → walk up to the nearest `codengine.json` (multi-project:
  each document resolves to its owning manifest).
- `resolveModule(loaded, moduleName)` → `{ language, functions: <absolute>, python? }`.
- Lightweight structural validation (no schema-validator dependency); zero runtime deps.

## CLI retrofit

`codengine run <workflow> [--manifest <path>]`: when `--functions` is omitted, find
the manifest (explicit or by walking up from the workflow) and resolve the default
module for the run. Explicit `--functions/--language` still work. Per-module
cross-language routing within one run stays future (the real bridge).

## Non-goals

- No remote sources / package managers. No per-module cross-language execution yet.
- The language server and the VS Code client are later plans (0009, 0010).

## Milestones

1. [x] `codengine-spec`: `schema/manifest.schema.json` + a valid conformance example.
2. [x] `codengine-manifest`: types, load/find/resolve, structural validation — **7/7**.
3. [x] Retrofit `codengine-cli` to run from a manifest (explicit `--manifest` or
   walk-up auto-discovery); CLI **6/6**. Real bin verified: `codengine run
   <workflow>` with no `--functions`/`--entry`/`--language` resolves everything
   from `codengine.json` + sole-entrypoint detection.
4. [x] Verify: manifest lib + CLI + whole suite green; `--frozen-lockfile` OK.

## Outcome / notes

- `codengine-manifest` is zero-dep (lightweight structural validation, no
  schema-validator). `findManifest` walks up from a start dir — the multi-project
  primitive the language server will use (each document → its owning manifest).
- Functions paths resolve relative to the manifest dir **or** absolute, and may
  point outside the project (tested) — the "other local repo" case.
- The CLI now has a declarative path; explicit flags still work. Per-module
  cross-language routing within one run remains future (the real bridge). The
  language server (plan 0009) reuses this same lib.
