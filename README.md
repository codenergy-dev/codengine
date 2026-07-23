# codengine

**Run software from a functional diagram.**

codengine executes a graph of **tasks** — each task is a function with an input
and an output — described by a diagram (authored in [yUML](https://yuml.me/)).
Connected tasks form `fanIn`/`fanOut` relationships; the whole diagram is a
**workflow**.

The diagram isn't documentation *about* the code. It *is* the orchestration: it
says how, and in what order, your functions run. Living, functional documentation.

> codengine is a from-scratch consolidation of earlier experiments
> (`pypeyuml`, `yumlabs`, `yuml-parser`, `yuml-runner-js`, and the matching VS
> Code extensions), rebuilt under the [Codenergy](https://codenergy.dev) name.
> The story of the original pipeline:
> [As aventuras das Aventuras de Mumbuquinha](https://codenergy.dev/blog/as-aventuras-das-aventuras-de-mumbuquinha.html).

## How it works

```
 workflow.yuml  ──►  codengine-parser  ──►  IR (JSON)  ──►  codengine-runner  ──►  output
```

A **parser** turns the diagram into a language-neutral **IR** (Intermediate
Representation) — the workflow graph as JSON. Language-specific **runners** execute
that IR. The IR is the contract between them, which is what makes multiple languages
possible. You write **plain functions** in your language and never adapt them for
codengine — the tooling binds them to the diagram for you.

## Languages

The same workflow semantics run in **TypeScript/JavaScript, Python, Dart, and C#** —
every runner passes the same conformance suite, so a diagram behaves identically
whichever language its functions are in.

## Using it

### 1. Write plain functions

```python
# tasks.py
def greet(name):
    return {"message": f"Hello, {name}!"}

def output(message):
    return {"message": message}
```

### 2. Draw the workflow

```
# greeting.yuml
[greet]->[output]
```

### 3. Declare a manifest (`codengine.json`)

```json
{
  "version": "1",
  "workflows": ["*.yuml"],
  "modules": { "": { "language": "py", "functions": ["tasks.py"] } }
}
```

The manifest maps each module (namespace) to a language and its function files, and
finds each module's project **root** (its dependency environment) automatically.

### 4. Run it

```sh
codengine run --entry greet --input '{"name":"world"}'
# → [ { "message": "Hello, world!" } ]
```

`codengine run` finds the nearest `codengine.json`, parses the workflows, and
executes them through the runner for that language. You can also point at files
directly, without a manifest:

```sh
codengine run greeting.yuml --functions tasks.py --language py --entry greet --input '{"name":"world"}'
```

### As a library

Each language's **runner** is also an ordinary library you can embed in your own
project to execute an IR in-process — the CLI is just one orchestrator over it.

### Ways to integrate

- **Standalone** — one language, self-contained (the example above).
- **Consumer** — your project has its own workflows/functions *and* consumes others'.
- **Orchestrator** — no code of its own; references external workflows/modules and
  runs them.

For source-free distribution (consuming a module without its source, across projects
or environments), see the **[module package format](codengine-spec/packaging.md)**.

## Roadmap

Done so far:

- [x] **Spec-first foundation** — the IR, execution & invocation semantics, and a
  conformance suite every runner/analyzer must pass ([`codengine-spec`](codengine-spec/)).
- [x] **Parser + planner** — yUML → IR ([`codengine-parser`](codengine-parser/)).
- [x] **Four language families** — `core` / `analyzer` / `loader` / `runner`
  (+ `generator` for Dart) in TS/JS, Python, Dart, and C#, all passing the same
  conformance.
- [x] **Manifest** — project config, module resolution, per-module environments
  ([`codengine-manifest`](codengine-manifest/)).
- [x] **CLI orchestrator** — parse + resolve + run; multi-workflow, with
  cross-workflow calls ([`codengine-cli`](codengine-cli/)).
- [x] **`core` contract packages** — each language's code-level mirror of the spec.
- [x] **Module package format** — portable, source-free distribution of a module
  ([`packaging.md`](codengine-spec/packaging.md)).
- [x] **Cross-language on the server** — one authoritative **engine** drives; a task
  in another language runs in that language's **warm worker** over a transport
  (subprocess). Split engine/executor + a linear-segment batching optimization
  ([plan 0017](plans/0017-cross-language-execution.md)). Working today: a TS engine
  calling a Python worker.

Next / planned:

- [ ] **More workers + a remote transport** — Dart/C# workers; a `remote`
  (HTTP/gRPC) transport so a module can live anywhere; non-TS orchestrators.
- [ ] **Package builder + loaders** — build a package from a manifest; load/run a
  package through a transport.
- [ ] **Browser / WASM** — run workflows where processes aren't available.
- [ ] **Language server + VS Code extension** — authoring-time autocomplete,
  intellisense, and debugging.
- [ ] **Event syntax** and **more languages**.

See [`plans/`](plans/) for the reasoning behind each step.

## Repository layout

This is a monorepo. Each module is a directory prefixed `codengine-`; each language's
family lives under `codengine-<lang>/`. See [AGENTS.md](AGENTS.md) for the full module
list and development conventions.

## License

See the `LICENSE` file in each module.
