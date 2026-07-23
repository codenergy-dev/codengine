# 0016 — The module package format

Status: done

## Context

The cross-language / multi-environment discussion (see the reflection preceding this
plan) concluded that a **module package format** is the connective tissue: it lets a
consumer bind and run a module's tasks **without its source**, which is what unblocks
the consumer/orchestrator topologies and every "closed" environment (browser, mobile,
game engines) where source + toolchains aren't available.

Decisions taken with the user:

1. The **planner partitions the graph by language**; the boundary is crossed only on
   edges between partitions. (Future work; shapes the executor protocol.)
2. Split **engine** (graph traversal, neutral) from **executor** (invoke a function),
   so the engine is transport-agnostic. (Future work.)
3. Cross-language starts on the **server** (subprocess transport); browser/WASM later.
4. **Remote** transport is in scope, behind a **pluggable transport abstraction**.
5. **Define the package format first** — it unblocks the rest. ← *this plan*.

## The model: a package is the *build output* of a manifest

```
manifest (author: source, globs)  ──build──►  package (portable: descriptor + IR + artifact)
   parser · analyzer · planner                     loader · engine · executor
        (author-time)                                   (run-time)
```

Author-time (needs source + toolchain) produces the package; run-time (any
environment) consumes it. The description contract (`definitions.json`, the
task-definitions the analyzer already emits) is what makes source-free consumption
possible; the generator (where needed) consumes that same description.

## The format (v1)

Three concepts, mapped onto what already exists:

- **module package** — the atomic distributable. A directory/tarball with a
  `codengine-package.json` descriptor + `definitions.json` (the description contract)
  + `artifacts/` (source **or** compiled, one entry per target/ABI).
- **workflow** — just IR JSON (already portable); shipped loose or inside a bundle.
- **bundle** — the orchestrator topology: a descriptor that *references* module
  packages (by `name@version`) + workflows. The "compiled manifest".

`codengine-package.json` (module):

```jsonc
{
  "package": "1", "contract": "1", "kind": "module",
  "name": "greeting", "version": "0.1.0", "language": "py",
  "definitions": "definitions.json",
  "dependencies": [ { "name": "geometry", "version": "^1.2.0" } ],
  "artifacts": [
    { "id": "py-source", "target": "any", "transport": "subprocess",
      "files": ["artifacts/tasks.py"], "root": "artifacts",
      "entry": { "command": "python", "args": ["-m", "codengine_worker"], "protocol": "1" },
      "integrity": { "sha256": { "artifacts/tasks.py": "…" } } }
  ]
}
```

Design decisions (each locked with the user):

1. **Granularity** — the module is the atomic package; workflows are loose IR; a
   bundle references both.
2. **Multi-artifact** — the format models **N** artifacts tagged `target` +
   `transport`; the server-first slice uses exactly one (source / `subprocess`).
3. **Self-contained** — a package is a directory/tarball; the descriptor references
   its files by **relative path + hash**.
4. **Integrity now, signing later** — `integrity.sha256` per file; signatures are a
   future hook.
5. **IR stays unpartitioned in the package** — ship plain IR + each task's language;
   the *consumer's* resolver partitions by language at deploy time (it depends on
   what is local vs remote there), not at build time.

`transport` and `target` are **open strings** (known values documented) so new
transports/targets don't require a format bump — the point of the transport
abstraction.

## Milestones

1. [x] `codengine-spec` — `schema/package.schema.json` + `schema/bundle.schema.json` +
   `packaging.md` (the model, the per-transport `entry` shapes, the author→consume
   split). Fixed `manifest.schema.json`'s stale language enum (`ts`/`py` → +`dart`/`cs`).
2. [x] `codengine-spec/conformance/packages/` — a valid module package
   (`module-greeting/`) + a valid bundle (`bundle-app/`), the validator's fixtures.
3. [x] `codengine-manifest` — `loadPackage`/`loadBundle` + `validatePackage`/
   `validateBundle` (mirroring the manifest validator), types, exports. Tests: load
   the examples + reject malformed. **manifest 16/16**.

## Outcome / notes

- The format is **defined and machine-checkable**: schemas + doc in `codengine-spec`,
  validated examples, and a validator in `codengine-manifest`.
- `transport`/`target` are open strings (known values documented), so the transport
  abstraction can grow without a format bump.
- Deliberately *not* built here (later plans): the builder (manifest → package), the
  loader/transport implementations, the engine/executor split, the graph partitioner.

Out of scope here (later plans): the **builder** (manifest → package), the
**loader/transport** implementations, the **engine/executor split**, and the
graph partitioner. This plan only *defines and validates* the format.

## Notes

- The wire format is already solved: `TaskData` is JSON-normalized across runners, so
  a package's artifacts exchange plain JSON.
- `core-<lang>` is where the description types live; a package's `definitions.json`
  is exactly what `analyzer-<lang>` emits.
