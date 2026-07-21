# AGENTS.md

Development guide for **codengine**. This file is the source of truth for how we
work in this repository. `CLAUDE.md` points here.

## What codengine is

codengine turns a **functional diagram** into executable software. A diagram
(currently authored in [yUML](https://yuml.me/)) describes a graph of **tasks**;
each task is a function with an input and an output. Connected tasks form
`fanIn`/`fanOut` relationships. The whole diagram is a **workflow**.

The diagram is not documentation *about* the code — it *is* the code's
orchestration. It says how and in what order functions run ("living, functional
documentation").

The project is a from-scratch consolidation of six legacy projects (kept in this
repo for reference): `pypeyuml`, `pypeyuml-vscode`, `yumlabs`, `yuml-parser`,
`yuml-runner-js`, `yuml-runner-vscode`.

## Core architecture

Everything is built around a language-neutral **IR (Intermediate
Representation)**: the parsed workflow graph, serialized as JSON.

```
 .yuml (or other syntax)                          function implementations
        │                                                    │
        ▼                                                    ▼
   codengine-parser  ──►  IR (JSON)  ──►  codengine-runner-<lang>  ──►  output
   (+ planner)            the contract      (dumb executor)
```

- The **parser** only knows how to turn a diagram syntax into the IR.
- The **runners** only know how to execute the IR. They are intentionally
  "dumb": all graph reasoning (dependencies, execution plan) is precomputed once
  by the planner and written into the IR. This keeps porting a runner to a new
  language cheap.
- Neither side knows about the other. That decoupling is what makes multiple
  languages — and eventually cross-language workflows — possible.
- Cross-language execution reuses the proven `pypeyuml` pattern: a runner is a
  process that speaks JSON over the filesystem/stdio; the orchestrator marshals
  each task's input/output between runners. Which runner handles a task is
  decided by a **module manifest** (module/namespace → language + runner +
  environment), never baked into the IR.

## Terminology (use these exact words)

| Term | Meaning |
|------|---------|
| **task** | A node in the diagram = one function with input/output. (Legacy code called this "pipeline" — do not reuse that name.) |
| **workflow** | The diagram/graph that orchestrates tasks. |
| **function** | The concrete implementation of a task in some language. |
| **fanIn / fanOut** | A task's incoming / outgoing connections. |
| **IR** | Intermediate Representation — the workflow graph as JSON; the contract between parser and runners. |
| **task definition** | The neutral description of a task function's signature (named params) an analyzer emits; the contract between analyzers and editor tooling. |
| **module** | Namespace a function is resolved from; also the hook for cross-workflow and cross-language routing. |

## Modules

Each module is a top-level directory prefixed `codengine-`. Planned layout
(built in this order):

| Module | Role | Language |
|--------|------|----------|
| `codengine-spec` | IR + task-definition schemas, execution & invocation semantics, conformance suites. No runtime code — the source of truth. | Language-neutral (JSON + Markdown) |
| `codengine-parser` | Diagram syntax → IR (includes the planner). Library + CLI. | TypeScript |
| `codengine-runner-ts` | Executes the IR. Library, reused in-process by the extension. | TypeScript |
| `codengine-runner-py` | Executes the IR, idiomatic Python (inherits yumlabs image pipelines). | Python |
| `codengine-analyzer-ts` | Source → task definitions (TS Compiler API). Library + subprocess. | TypeScript |
| `codengine-analyzer-py` | Source → task definitions (`ast`). Library + subprocess. | Python |
| `codengine-loader-ts` | Load TS/JS task functions (a module's files) into a function map. Library. | TypeScript |
| `codengine-manifest` | Load/validate/resolve the project manifest (`codengine.json`, incl. module `root`/environment). Library. | TypeScript |
| `codengine-cli` | Standalone orchestrator: parse + pick runner(s) + run. | TypeScript |
| `codengine-language-server` | Editing-time assembly: parser + analyzers + manifest → LSP features. Multi-project. | TypeScript |
| `codengine-vscode` | Thin LSP client for the language server. | TypeScript |

Every runner and analyzer MUST pass its `codengine-spec` conformance suite (the
runner `runs/`, the analyzer `expected.json`). Those suites are how we keep
behavior identical across languages. Runners execute the IR; analyzers describe
the task functions that the runners bind — two views of the same functions.

## Repository conventions

- **Monorepo.** All `codengine-*` modules live in this repo.
- **Language:** all code, comments, identifiers, commit messages, and docs
  (including `plans/`) are written in **English**.
- **Plans:** every non-trivial change starts with a plan in [`plans/`](plans/)
  (English). Plans record *what*, *why*, and *how* — a living history of
  decisions. Filename: `NNNN-short-slug.md`. Keep a `Status:` line
  (`draft` / `in progress` / `done`) at the top.
- **README.md** is the human-friendly documentation and is kept up to date.
- **This file (AGENTS.md)** is kept up to date so any agent can follow project
  standards.

## Node.js / npm security policy

npm is a live supply-chain target (install-script worms, compromised popular
packages). Every TypeScript/Node module in this repo MUST follow this baseline.
It is documented now and applied when the first TS module is scaffolded.

- **Package manager: pnpm** (workspaces for the monorepo). Chosen for its
  security levers, not just performance.
- **Quarantine new releases.** Enable a release-age cooldown
  (`minimumReleaseAge`, e.g. 7 days) so freshly published versions — the window
  in which most compromises are caught and yanked — are not installed.
- **No install scripts by default.** Lifecycle scripts (`postinstall`, etc.) are
  the primary attack vector. Disable them globally; allow only an explicit,
  reviewed allowlist (`onlyBuiltDependencies`) for packages that genuinely need
  them (e.g. `esbuild`).
- **Pin everything.** `save-exact=true` (no `^`/`~` ranges). Commit the
  lockfile. CI installs with `--frozen-lockfile` (the `npm ci` equivalent) — never
  a mutating install.
- **Pin the toolchain.** `engine-strict=true`, a pinned Node version
  (`.nvmrc`), and the `packageManager` field pinning the pnpm version.
- **Minimize dependencies.** Prefer the standard library. `yuml-runner-js` shipped
  with zero runtime dependencies — keep runtime deps at or near zero.
- **Review + audit.** New/updated dependencies get reviewed in the PR; CI runs
  `pnpm audit`. Prefer packages that publish provenance/signatures.
```

