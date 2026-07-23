# Packaging

How a codengine module is made **portable** — distributable and runnable **without
its source**. This is the connective tissue for the consumer and orchestrator
topologies and for environments where source and toolchains aren't available
(browser, mobile, game engines).

## The model: a package is the build output of a manifest

```
manifest (author: source, globs)  ──build──►  package (portable: descriptor + IR + artifact)
   parser · analyzer · planner                     loader · engine · executor
        (author-time)                                   (run-time)
```

**Author-time** (needs source + toolchain) runs the parser, analyzer and planner to
produce a package. **Run-time** (any environment) consumes it. The
[task-definition](schema/task-definition.schema.json) document — the *description
contract* the analyzer emits — is what makes source-free consumption possible: a
consumer binds and validates against it, and a generator (where a target needs one)
writes glue from it.

## Three concepts

| Concept | What it is | Schema |
|---|---|---|
| **module package** | The atomic distributable of one module: a descriptor + its description contract + one or more artifacts. | [`package.schema.json`](schema/package.schema.json) |
| **workflow** | Just IR JSON — already portable. Shipped loose or inside a bundle. | [`workflow.schema.json`](schema/workflow.schema.json) |
| **bundle** | The orchestrator topology: references module packages + workflows, no source of its own. The resolved equivalent of a manifest. | [`bundle.schema.json`](schema/bundle.schema.json) |

## A module package on disk

```
greeting-0.1.0/                 # a directory (or tarball)
  codengine-package.json        # the descriptor
  definitions.json              # the description contract (task definitions)
  artifacts/                    # source OR compiled code
    tasks.py
```

The descriptor references its files by **relative path + hash** (`integrity`), so a
package is self-contained and verifiable.

### Artifacts and transports

A module ships **one artifact per target/ABI**. Each artifact declares the
**transport** that can drive it; a run-time consumer picks the artifact whose
transport its environment supports. `transport` and `target` are **open strings** —
new transports/targets don't require a format bump.

| transport | environment | `entry` shape (typical) |
|---|---|---|
| `in-process` | same runtime as the engine | `{ symbol }` |
| `subprocess` | server / desktop (open) | `{ command, args?, protocol }` |
| `remote` | anywhere with a network | `{ url, protocol }` |
| `wasm` | browser, or an embedded wasm runtime | `{ exports, abi }` |
| `cffi` | native host via a C ABI | `{ symbol, abi }` |

Feasibility is `(the module's available artifacts) × (the environment's supported
transports)`. Only open environments support `subprocess`; closed ones need an
in-process ABI (`wasm`/`cffi`/`in-process`) or the universal `remote` fallback.

### The IR is not partitioned in the package

A package ships the plain IR plus each task's language. The **consumer's resolver**
partitions the graph by language at deploy time — because which modules are local vs
remote is a property of the deployment, not of the build.

## Server-first slice

The v1 format models the full multi-target future, but the first implementation uses
exactly one artifact: **source files driven by the `subprocess` transport** (what the
CLI already does). Everything else — the builder (manifest → package), the
loader/transport implementations, the engine/executor split, the graph partitioner —
is later work.

See [`conformance/packages/`](conformance/packages/) for validated examples.
