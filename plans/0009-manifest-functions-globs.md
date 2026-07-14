# 0009 — Manifest `functions` globs

Status: done

## Context

A manifest module currently points to a single functions file (the yuml-runner-js
"many functions per file" style). The pypeyuml style — a directory of
one-function-per-file — is also valuable. Both should work, so a module's
`functions` becomes a **string or a list of glob patterns**; a module's functions
are the union loaded from every matched file.

Decisions locked with the user: list of globs (not comma-split in the manifest —
more explicit); accept `string | string[]`; glob with Node's stdlib `fs.globSync`
(keeps `codengine-manifest` zero-dep); **duplicate function names across a module's
files raise an exception** (rename or split into modules), no silent last-wins.

**Normalized behavior for the CLI flag:** `--functions` and the manifest resolve
the same way — a list of glob patterns → files. Since the CLI flag is a single
string, it is **comma-split** into patterns. Both paths share one glob resolver.

## Changes

1. **Spec**: `functions` → `string | string[]` in `manifest.schema.json`.
2. **`codengine-manifest`**: `ModuleConfig.functions: string | string[]`; a shared
   `resolveFunctionFiles(patterns, baseDir)` (glob relative to `baseDir`, absolute
   allowed, `..` allowed; sorted, deduped, absolute); `resolveModule` returns
   `files: string[]`.
3. **`codengine-cli`**: `--functions` is comma-split into patterns and resolved via
   `resolveFunctionFiles(patterns, cwd)` — same mechanism as the manifest.
4. **Loaders merge multiple files with conflict detection**:
   - `codengine-cli` `loadFunctions(files[])` (TS);
   - `codengine-runner-py` `load_functions(paths)` (Python).
   Duplicate name → `Duplicate task function '<name>' in module: <fileA> / <fileB>`.
5. **Subprocess protocol**: the `functions` field becomes `string[]`.

## Separate, deferred (noted, not in this plan)

The TS **source vs runtime** tension: the analyzer wants `.ts` source; the runner
needs runnable code (Node can't import `.ts` without type-stripping/compilation).
Python has no such gap. To be resolved on its own (likely Node's native TS
support). Tracked here so we don't conflate it with globbing.

## Milestones

1. [x] Spec schema (`functions: string | string[]`) + example.
2. [x] `codengine-manifest` `resolveFunctionFiles` (via `fs.globSync`) +
   `resolveModule` returning `files: string[]` — **8/8** (single glob, recursive
   `**`, outside-dir globs).
3. [x] CLI `--functions` comma-split via the shared resolver; multi-file loaders +
   conflict detection — `codengine-cli` **7/7**, `codengine-runner-py` **20**
   (added load/conflict tests).
4. [x] Verify: whole suite green; real bin runs from a glob (manifest and
   `--functions '…/*.mjs'`).

## Outcome / notes

- Both worlds unified: a directory of one-function files (`tasks/**/*.py`) and a
  multi-function file (`tasks.ts`) load the same way. `--functions` and the
  manifest share one resolver, so behavior is identical.
- `codengine-manifest` stays zero-dep — `fs.globSync` (Node 22 stdlib). It emits a
  one-time `ExperimentalWarning`; the CLI suppresses just that on stderr.
- Duplicate function names across a module's files raise a clear error in both the
  TS and Python loaders (`Duplicate task function '<name>' … rename or split`).
- Subprocess protocol `functions` is now `string[]`.
