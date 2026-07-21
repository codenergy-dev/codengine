# codengine-manifest

Load, validate, and resolve a codengine **project manifest** (`codengine.json`) —
the file that says where a project's workflows and task functions live, and in
which language. Shared by [`codengine-cli`](../codengine-cli/) and the language
server. Zero runtime dependencies.

## Manifest

```jsonc
{
  "version": "1",
  "workflows": ["workflows/**/*.yuml"],
  "modules": {
    "": { "language": "ts", "functions": "./src/tasks.ts" },
    "images": {
      "language": "py",
      "root": "../shared-py",
      "functions": ["tasks/**/*.py"],
      "python": ".venv/bin/python"
    }
  }
}
```

`modules` maps a namespace to `{ language, root?, functions, python? }`. The empty
key `""` is the default module (tasks with `module: null`).

- **`root`** is the module's project directory — its **dependency environment**.
  Local dir, relative to the manifest or absolute; may point outside the project.
  When omitted, it is auto-detected by walking up from the functions to a project
  marker (`package.json` for ts, `pyproject.toml`/`.venv` for py). The loaders use
  it to make the functions' own imports resolve (Python: `root` on `sys.path`;
  Node resolves per file). `python` auto-derives from `<root>/.venv` when omitted.
- **`functions`** is a **glob pattern or a list of them** — relative to `root` (or
  the manifest dir) or absolute. A module's functions are the union loaded from
  every matched file; a name in two files is a conflict.

Schema: [`../codengine-spec/schema/manifest.schema.json`](../codengine-spec/schema/manifest.schema.json).

## API

```ts
import { loadManifest, findManifest, resolveModule } from "codengine-manifest";

const loaded = findManifest(process.cwd());        // walk up to the nearest codengine.json
const mod = resolveModule(loaded!, null);          // default module -> { language, functions (absolute), python? }
```

- `loadManifest(path)` → validated manifest + its absolute dir.
- `findManifest(startDir)` → nearest `codengine.json` walking up, or `null`
  (multi-project: each document resolves to its owning manifest).
- `resolveModule(loaded, moduleName)` → `{ language, files: string[], python? }` —
  the module's globs expanded to absolute files.
- `resolveModules(loaded)` → every declared module, resolved.
- `resolveWorkflowFiles(loaded)` → the `workflows` globs expanded to absolute
  diagram paths (all of them load together as one registry).
- `resolveFunctionFiles(patterns, baseDir)` → the shared glob resolver (also used
  by the CLI's `--functions` and workflow globs).

## Development

```sh
pnpm -C codengine-manifest test
```
