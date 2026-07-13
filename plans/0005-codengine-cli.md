# 0005 — codengine-cli

Status: done

## Context

The standalone orchestrator — the "pypeyuml" command-line experience — founded on
**multi-language runner selection** from day one. It parses a `.yuml` with
[`codengine-parser`](../codengine-parser/) and executes it through a **pluggable
runner selected by language**: the TypeScript runner in-process, and any other
language (starting with Python) as a **subprocess speaking a JSON protocol**. This
is the generalization of pypeyuml's `args.json`/`result.json` venv pattern.

Scope decision (option A): prove selection *now* by actually running a workflow
through the Python runner as a subprocess, not just designing the seam.

## The founding principle

The CLI hands a runner `(ir, entry, input, functions-location)` and gets back the
result. **Each runner loads the functions in its own language** — the CLI never
imports Python functions. The CLI orchestrates and (in the future) marshals task
I/O between runners.

### Runner abstraction

```ts
interface Runner {
  run(ir, entry, input, functions): Promise<TaskData[] | null>;
}
```

- `InProcessTsRunner` — imports `codengine-runner-ts` and the TS functions module.
- `SubprocessRunner` — spawns a language runner, exchanging JSON over stdio.

### Subprocess JSON protocol

- CLI → runner (stdin): `{ "ir": WorkflowIR, "entry": string, "input": object, "functions": string }`
- runner → CLI (stdout): `{ "result": object[] | null }` or `{ "error": string }`

`codengine-runner-py` gains a `python -m codengine_runner` entrypoint implementing
this. (A matching TS subprocess entrypoint is deferred — TS runs in-process for
now; it is only needed when even TS tasks run out-of-process in a cross-language
workflow.)

### Module manifest (foundation for cross-language)

The future manifest maps `module → { language, runner, functions, environment }`,
letting one workflow mix languages. The MVP builds a single-profile manifest from
flags (all current tasks are `module: null`), and routes the whole run to one
language — enough to prove selection; per-module routing + filesystem-JSON
marshaling come later.

## Function discovery per language

- TS: a module whose named exports (and/or a default object) are the functions.
- Python: a module whose top-level functions are the functions, or an explicit
  `FUNCTIONS` dict (needed for task names that are Python keywords, e.g. `pass`).

## Layout

```
codengine-cli/
├── package.json              # bin: codengine; deps: parser + runner-ts (workspace)
├── src/
│   ├── runner/{types,ts-runner,subprocess-runner,select}.ts
│   ├── load-functions.ts     # TS dynamic import -> FunctionMap
│   ├── run.ts                # runWorkflow: loadIR + selectRunner + run
│   ├── cli.ts                # args (node:util parseArgs)
│   └── index.ts
├── test/
│   ├── run.test.ts           # run linear-echo + index-routing through BOTH ts and py
│   └── fixtures/{catalog.ts, catalog.py}
├── examples/greeting/        # runnable sample
└── README.md
```

Also in `codengine-runner-py`: `codengine_runner/__main__.py` (the protocol
entrypoint) and `load_functions`.

## Milestones

1. [x] Add the `python -m codengine_runner` protocol entrypoint to runner-py
   (`__main__.py` + `functions.py`), smoke-tested via stdin JSON.
2. [x] Scaffold codengine-cli (workspace deps on parser + runner-ts).
3. [x] Runner abstraction (`InProcessTsRunner`, `SubprocessRunner`, `selectRunner`).
4. [x] `run` + `cli` (arg parsing via `node:util`).
5. [x] Proof test: the same workflows through `ts` (in-process) and `py`
   (subprocess) — **4/4 pass, identical results**.
6. [x] Runnable `examples/greeting`; verified the real `codengine` bin in both
   languages. README.

## Outcome / notes

- **Multi-language selection proven.** `codengine run … --language ts|py` produces
  identical output for the same workflow: TS in-process, Python as a subprocess.
  The founding seam (the `Runner` interface + JSON protocol) is real, not
  theoretical.
- **Division of labor is the cross-language architecture in miniature:** parsing
  happens once in Node (the canonical TS parser), the IR crosses the process
  boundary as JSON, and the Python runner executes it — exactly how a future mixed
  workflow will marshal task I/O between runners.
- The Python runner is invoked as `python -m codengine_runner`; the interpreter
  (`--python`) just needs `codengine-runner` installed (real UX: `pip install`).
- Deferred (documented seams): a TS subprocess entrypoint (only needed when TS
  runs out-of-process), convention-based function discovery, and the full
  per-module manifest with filesystem-JSON marshaling for mixed-language workflows.
