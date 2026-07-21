# 0012 — Per-language directory reorg

Status: done

## Context

The repo root was getting crowded, and it grows ~4 packages per new language
(analyzer, generator, loader, runner). To keep navigation sane before adding Dart,
the per-language runtime packages are grouped under `codengine-<lang>/` directories
— still **separate, independently publishable packages** (the grouping is only
organizational; it preserves the thin-dependency benefit).

Decided with the user; done as its own mechanical step (kept green) so Dart is born
in the new structure.

## Layout

```
codengine-spec/  codengine-parser/  codengine-manifest/  codengine-cli/   ← neutral / orchestration (root)
codengine-ts/  { codengine-runner-ts, codengine-loader-ts, codengine-analyzer-ts }
codengine-py/  { codengine-runner-py, codengine-analyzer-py }
```

Future: `codengine-<lang>/codengine-generator-<lang>`, and `codengine-dart/…`. The
language server and VS Code client stay at the root (editor/orchestration).

## What changed (mechanical)

- `git mv` the five language packages under `codengine-ts/` and `codengine-py/`.
- `pnpm-workspace.yaml`: `packages` now lists the root packages + `codengine-ts/*` +
  `codengine-py/*`.
- Test path-walks to the repo root gained one level (`../../../` → `../../../../`
  in TS; an extra `dirname` in the Python `REPO`).
- `codengine-cli` test: the Python venv path is now `codengine-py/codengine-runner-py/.venv`.
- README cross-links to root packages fixed (`../codengine-spec` → `../../codengine-spec`);
  same-language sibling links unchanged; the one cross-language link
  (runner-py → runner-ts) now goes through `../../codengine-ts/…`.
- Regenerated: `node_modules` + `pnpm-lock.yaml` (via install); the Python venvs
  recreated at their new paths (`pip install -e`), since a moved venv's absolute
  paths break.
- `AGENTS.md` module section rewritten around the root + per-language grouping.

## Verification

Whole suite green after the move: parser 15, runner-ts 16, analyzer-ts 3,
manifest 8, cli 10; runner-py 23, analyzer-py 3. `--frozen-lockfile` OK; the real
`codengine` bin still runs the greeting example.

Nothing about behavior changed — package names, workspace-dep resolution (by name),
and `import.meta.resolve("codengine-runner-ts/...")` are all location-independent.
