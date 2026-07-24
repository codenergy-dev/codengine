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

Every module is a directory prefixed `codengine-`. **Neutral / orchestration**
packages live at the repo root; each language's **runtime family** lives grouped
under a `codengine-<lang>/` directory (they are still separate, independently
publishable packages — the grouping is only for navigation, since the family grows
per language: core, analyzer, loader, runner, and optionally generator).

**Root — neutral / orchestration:**

| Module | Role | Language |
|--------|------|----------|
| `codengine-spec` | IR + task-definition + manifest + **package/bundle** schemas, execution & invocation semantics, the packaging model (`packaging.md`), conformance suites. No runtime code — the source of truth. | Language-neutral (JSON + Markdown) |
| `codengine-parser` | Diagram syntax → IR (includes the planner). Library + CLI. | TypeScript |
| `codengine-manifest` | Load/validate/resolve the manifest (`codengine.json`, incl. module `root`/environment); load/validate **module packages and bundles**. Library. | TypeScript |
| `codengine-cli` | Standalone orchestrator: parse + resolve + run through a language runner. | TypeScript |
| `codengine-language-server` | Editing-time assembly: parser + analyzers + manifest → LSP features. Multi-project. *(planned)* | TypeScript |
| `codengine-vscode` | Thin LSP client for the language server. *(planned)* | TypeScript |

**Per-language family (`codengine-<lang>/…`):** the roles are a fixed invariant.
**Four are mandatory** (`core`, `analyzer`, `loader`, `runner`); **`generator` and
`worker` are optional**.

- **core** — the contract, in that language's types: the **execution contract** (IR
  types, `TaskData`, `TaskFunction`, the `Executor` seam, JSON handling, the
  missing-input error) and the **description contract** (task-definition types). The
  code-level mirror of `codengine-spec`. No logic, no I/O.
- **analyzer** — source → task definitions (function signatures) via native tooling.
  *Produces* the description contract.
- **loader** — load the functions into a callable map (and, where the language needs
  it, `invoke` one by named binding — the invocation contract).
- **runner** — execute the IR. Split into an **engine** (graph traversal, the single
  authority for fan-out/routing/fan-in) that calls an **executor** per task.
- **generator** — task definitions → generated glue code. *Consumes* the description
  contract. Only a reflection-less compiled target (Dart AOT) needs it.
- **worker** — a persistent process that executes a module's functions on request
  (`load` / `call` / `callChain`), reusing the loader. It is the *executor* side for a
  **cross-language** run: the orchestrating engine (in another language) keeps the
  module loaded ("warm") and sends cheap calls. A language needs it only to be *called*
  cross-language.

**Task functions may be sync or async** in every language — the invocation point
resolves an awaitable result (Promise / `Task` / `Future` / coroutine) before the
engine classifies it. Python/C# engines block on it; the Dart engine is async (the
language can't block on a `Future`); TS is async (plan 0019).

Dependencies point **inward** to `core` (a shared kernel), never runner↔loader:

```
core  ←  analyzer      (produces the description)
core  ←  loader
core  ←  runner        (engine + executor; may use loader)
core  ←  generator     (consumes the description; optional)
core  ←  worker        (loader + a request loop; optional)
```

| Packages | Roles | Group |
|--------|------|-------|
| `codengine-core-ts` / `codengine-analyzer-ts` / `codengine-loader-ts` / `codengine-runner-ts` / `codengine-worker-ts` | core / analyze / load / run / work | `codengine-ts/` |
| `codengine-core-py` / `codengine-analyzer-py` / `codengine-loader-py` / `codengine-runner-py` / `codengine-worker-py` | core / analyze / load / run / work | `codengine-py/` |
| `codengine-core-dart` / `codengine-analyzer-dart` / `codengine-loader-dart` / `codengine-runner-dart` / `codengine-generator-dart` / `codengine-worker-dart` | core / analyze / load / run / generate / work | `codengine-dart/` |
| `codengine-core-cs` / `codengine-analyzer-cs` / `codengine-loader-cs` / `codengine-runner-cs` / `codengine-worker-cs` | core / analyze / load / run / work | `codengine-cs/` |

**Cross-language** (server): one **engine** (TS) drives; a task in another language
runs in that language's **warm worker** via a **transport**. Two transports exist:
**subprocess** (spawn a local worker, stdio) and **remote** (HTTP — a worker already
running as a service that owns its own code; the module declares
`transport: "remote"` + `url`, and no files are sent over the wire). All four languages
have a worker; a reflective worker (`py`, `cs`) loads the module directly, a
reflection-less one (`dart`) is **generated glue**. The planner-level graph
partitioning was rejected in favour of one authoritative engine + a linear-segment
batching optimization (see plans 0017, 0018, 0020).

The **generator** is about *reflection, not compilation*. Dart (AOT, no reflection)
is the only family with all five roles — its generator writes glue with named-binding
wrappers that the runner executes. C# is compiled too but has full runtime reflection,
so it needs **no generator**: `loader-cs` binds named params at runtime. Interpreted
languages (TS/Py) likewise skip it. A C# module's project needs **no reference to
codengine** — the runner builds it and loads the output assembly by reflection.

`core` weight is asymmetric by design: statically-typed families (TS, C#) carry real
IR + task-definition types (and, for C#, JSON normalization); dict/`Map`-based
families (Python, Dart) carry mostly type aliases + the description shape. The *rule*
is uniform even when the *volume* is not.

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
- **README.md** is the human-friendly documentation and is kept up to date. It
  carries the **roadmap** (done vs planned) — keep that roadmap current: when a plan
  lands (or a new direction is agreed), update the README roadmap in the same change.
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

## NuGet security policy (C#/.NET)

The same supply-chain discipline applies to .NET modules, using NuGet's levers:

- **Minimize dependencies.** Prefer the BCL. `codengine-runner-cs` has **zero** NuGet
  dependencies (it runs offline); `codengine-analyzer-cs` has exactly one
  (`Microsoft.CodeAnalysis.CSharp`, for Roslyn).
- **Pin + lock.** Pin exact versions in the `.csproj` and commit a
  `packages.lock.json` (`RestorePackagesWithLockFile=true`). CI restores with
  `--locked-mode` (the `npm ci` equivalent) — never a mutating restore.
- **Prefer first-party / signed packages.** Roslyn is published by Microsoft; prefer
  packages that ship signed and with source. Review new/updated deps in the PR.
```

