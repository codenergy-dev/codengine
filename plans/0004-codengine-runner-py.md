# 0004 — codengine-runner-py

Status: done

## Context

The second runner, in Python. Its whole purpose is **parity**: it executes the
same IR ([plan 0001](0001-codengine-spec.md)) and must pass the *same* conformance
runs as [`codengine-runner-ts`](../codengine-runner-ts/) (plan 0003). This is what
proves the spec + conformance suite actually keep two languages identical — the
reason codengine-spec exists.

It depends only on the spec/IR (consumes IR JSON), never on the parser or the TS
runner.

## Why parity is non-trivial (the traps this run hits)

Python and JavaScript disagree exactly where the spec's **type-based**
classification matters:

- `{}` is falsy in Python, truthy in JS — a truthiness check would halt on an
  empty-object output in one language only. We classify `{}` as a data object in
  both.
- `bool` is a subclass of `int` in Python (`isinstance(True, int)` is `True`), so
  the boolean check must come **before** the integer/index-router check, or `True`
  would be treated as `fanOut[1 % L]`.
- Modulo of a negative differs by language; the Euclidean `((n % L) + L) % L`
  yields the same index in both. The `index-negative` fixture (`i = -1`) locks it.

## Goals

- `run(ir, functions, entry, data)` → `list[dict] | None`, a faithful port of the
  TS runtime with identical semantics.
- Pass every `runs/*.json` fixture with the shared test-function catalog.

## Non-goals

- No cross-language `module` routing yet; functions resolve by `task.function`.
- No CLI (later, `codengine-cli`).

## Environment

- Pure standard library — **zero third-party dependencies**, tests included
  (`unittest`). A `venv` isolates the interpreter per the project's Python
  practice, even though nothing is installed into it.
- `requires-python >= 3.10`.

## Layout

```
codengine-runner-py/
├── pyproject.toml
├── codengine_runner/
│   ├── __init__.py     # exports run
│   └── runtime.py      # the executor (port of runtime.ts)
└── tests/
    └── test_conformance.py  # bind the catalog, run every runs/*.json
```

## Milestones

1. [x] Scaffold the package + venv.
2. [x] Port the executor (mind the bool/int and {} traps).
3. [x] Conformance test against the shared `runs/*.json` — **14/14 pass**, matching
   runner-ts exactly.
4. [x] Verify in the venv; README.

## Outcome / notes

- **Parity achieved.** The same 14 runs are green in Python and TypeScript. The
  traps above were handled explicitly: bool checked before int, `{}`/`0`/`""`
  classified as data/selectors (not halts), Euclidean modulo shared.
- Zero third-party deps; tests use `unittest`. A `venv` isolates the interpreter
  (nothing installed into it — the runner is stdlib-only).
- Same three-valued task state as runner-ts, expressed as: present key → produced
  list, key set to `None` → ran with no data, key absent → never ran. (`None` had
  to mean "ran, no data" distinctly from "absent", so skipped tasks are left out
  of the state dict rather than set to `None`.)
- Package name `codengine-runner` (import `codengine_runner`); directory keeps the
  `codengine-runner-py` module convention. Depends on the spec/IR only.
