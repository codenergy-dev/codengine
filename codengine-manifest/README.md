# codengine-manifest

Load, validate, and resolve a codengine **project manifest** (`codengine.json`) —
the file that says where a project's workflows and task functions live, and in
which language. Shared by [`codengine-cli`](../codengine-cli/) and the language
server. Zero runtime dependencies.

## Manifest

```jsonc
{
  "version": "1",
  "workflows": ["workflows"],
  "modules": {
    "": { "language": "ts", "functions": "./src/tasks.ts" },
    "images": {
      "language": "py",
      "functions": "../shared-py/image_tasks.py",
      "python": ".venv/bin/python"
    }
  }
}
```

`modules` maps a namespace to `{ language, functions, python? }`. The empty key
`""` is the default module (tasks with `module: null`). `functions` is a local
path — relative to the manifest dir or absolute — and **may point outside the
project directory** (e.g. functions from another local repo).

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
- `resolveModule(loaded, moduleName)` → concrete, absolute source for a module.

## Development

```sh
pnpm -C codengine-manifest test
```
