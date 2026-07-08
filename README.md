# codengine

**Run software from a functional diagram.**

codengine executes a graph of **tasks** — each task is a function with an input
and an output — described by a diagram (authored in [yUML](https://yuml.me/)).
Connected tasks form `fanIn`/`fanOut` relationships; the whole diagram is a
**workflow**.

The diagram isn't documentation *about* the code. It *is* the orchestration: it
says how, and in what order, your functions run. Living, functional
documentation.

> codengine is a from-scratch consolidation of earlier experiments
> (`pypeyuml`, `yumlabs`, `yuml-parser`, `yuml-runner-js`, and the matching VS
> Code extensions), rebuilt under the [Codenergy](https://codenergy.dev) name.
> The story of the original pipeline:
> [As aventuras das Aventuras de Mumbuquinha](https://codenergy.dev/blog/as-aventuras-das-aventuras-de-mumbuquinha.html).

## Why

The original tool was born during a game jam to automate art generation on a
machine that couldn't run ComfyUI (Intel macOS). The idea outgrew that use case:
a diagram that is *executable* is a general way to organize and visualize code
flow across languages — without opening every function's source.

## Goals

- **Standalone / CLI** — run a workflow from the terminal.
- **Library** — import a runner into your own project.
- **Multi-language** — the same workflow semantics across languages (starting
  with TypeScript, then Python).
- **Cross-language (future)** — connect tasks written in different languages,
  passing input/output as JSON across process boundaries.
- **VS Code extension** — the command center for authoring: autocomplete,
  intellisense, and debugging.

## How it works

```
 workflow.yuml  ──►  codengine-parser  ──►  IR (JSON)  ──►  codengine-runner  ──►  output
```

A **parser** turns the diagram into a language-neutral **IR** (Intermediate
Representation) — the workflow graph as JSON. Language-specific **runners**
execute that IR. The IR is the contract between them, which is what makes
multiple languages possible.

## Status

Early. We are building the foundation first: [`codengine-spec`](codengine-spec/)
— the IR schema, execution semantics, and a conformance suite that every runner
must pass. See [`plans/`](plans/) for the roadmap and the reasoning behind each
step.

## Repository layout

This is a monorepo. Each module is a directory prefixed `codengine-`. See
[AGENTS.md](AGENTS.md) for the full module list and development conventions.

## License

See the `LICENSE` file in each module.
