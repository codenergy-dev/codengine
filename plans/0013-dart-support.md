# 0013 — Dart support (a compiled language)

Status: done

## Context

The first **compiled** language, to exercise the particularities we designed for.
The pipeline is analyzer → generator → loader → runner, and Dart's AOT constraint
(no runtime reflection) is what makes the generator mandatory.

## The model for Dart (aligned with the user)

The user writes **plain top-level functions** with named params and just lists the
files in `codengine.json` — **no adaptation for codengine**. The tooling resolves
the rest:

- **analyzer-dart** reads the source (via the `analyzer` package) → task
  definitions (function names + params).
- **generator-dart** takes the task definitions and writes the **glue** `.dart`:
  imports the user's function files, and for each function writes a
  `(Map input) => userFn(name: input['name'], …)` wrapper — **named binding with no
  reflection**, extras dropped, using the param names the analyzer found. It also
  imports the runner engine and reads the protocol from stdin.
- **loader-dart** merges the per-file dispatch maps with the duplicate-name
  conflict check (a small library the glue calls).
- **runner-dart** is the engine (a port of the runtime); it deals with
  `dynamic Function(Map)` — the named-binding wrappers are the generator's job.

The generated glue lives under `<root>/.codengine/` (the module's Dart package, so
`pub` deps and relative imports resolve). Protocol divergence (the compiled shape):
the function **files are baked into the generated glue**, while `{workflows, entry,
input}` arrive on stdin.

## Milestones

1. [x] `codengine-runner-dart` — engine + conformance: **16/16**, the same runs as
   TS/Python (a Dart `(Map)=>…` catalog). Runs offline (no third-party deps).
2. [x] `codengine-analyzer-dart` — source → task definitions via the `analyzer`
   package: **2/2** against the shared `expected.json` (descriptor parity). Also
   marks a whole-`Map` positional param as `acceptsExtra` (Dart's catch-all).
3. [x] `codengine-generator-dart` — task definitions → glue (named-binding wrappers);
   `bin/run.dart` is the `dart run codengine_generator:run` subprocess entrypoint.
4. [x] `codengine-loader-dart` — `mergeFunctions` with the duplicate-name conflict.
5. [x] CLI wiring — language `dart`, root marker `pubspec.yaml`, the Dart runner
   spawns `dart run codengine_generator:run` in the module root. **End-to-end
   green** (`codengine-cli` 11/11) and via the real bin, with the user writing
   plain top-level functions.

## Outcome / notes

- **Four languages now pass the same conformance.** Dart joined engine parity (16
  runs) and descriptor parity (2 analyzer cases). The north star held: the Dart user
  writes ordinary functions (`greet({required String name})`, `output(Map input)`)
  and only lists them — **no adaptation for codengine**; analyzer + generator do the
  rest, giving named binding with no reflection.
- The compiled particularity is real and contained: the **generator** is mandatory
  (glue), the loader collapses into the glue's merge, and the protocol bakes the
  files into the glue while the run payload flows on stdin.
- Known limits (documented, like cross-language / cross-venv): one Dart package
  `root` per run; the missing-required error is Dart's own (not yet normalized).
- A Dart project depends on `codengine_runner` + `codengine_loader` +
  `codengine_generator` (dev) and needs `dart pub get`. Dart artifacts
  (`.dart_tool/`, `pubspec.lock`, `.codengine/`) are gitignored; the CLI test skips
  if the fixture isn't `pub get`-ready.

## Notes

- Numbers: `jsonDecode` gives `int` for `3`, `double` for `3.5` — distinct, like
  Python. `(-1) % 3 == 2` — Euclidean parity holds. (Verified.)
- `bool` is not an `int` in Dart, so `is int` cleanly excludes booleans.
