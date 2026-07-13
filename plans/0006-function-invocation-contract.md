# 0006 — Function invocation contract

Status: done

## Context

How a task's input reaches its function must feel native in each language, not
force a generic untyped map everywhere. The legacy tools already diverged on this:
pypeyuml spread the merged dict as Python `**kwargs` (named params), while
yuml-runner-js passed a plain object destructured in the signature. codengine
should formalize that intent as a contract so it scales to Dart and C# without
inventing a parallel calling convention per language.

This does **not** change the IR (schema unchanged); it specifies how a runner
invokes a resolved function.

## The contract

Input is delivered as **named arguments**. The runner binds the (merged, formatted)
input to the function's declared parameters:

- declared parameter ← input entry of the same name;
- input entries with no matching parameter are **ignored**, unless the function
  declares a language-native catch-all (e.g. Python `**kwargs`), which receives them;
- a **required** parameter (no default / non-nullable) with no matching input is a
  **missing-input error**, normalized as
  `Task '<name>': missing required input(s): <names>`;
- an optional parameter with no matching input uses its default.

Two realization families, each using only native language features:

- **Named binding** — Python (signature inspection / `**kwargs`), Dart (generated
  adapters via build_runner — no runtime mirrors in AOT), C# (reflection). Extras
  dropped; missing required → the normalized error.
- **Structured binding** — JS/TS: the whole input is one object, destructured in
  the signature. Extras ignored; missing input is `undefined` (JS cannot introspect
  parameter names, so this is the natural path).

Decisions locked (with the user): filter-and-drop extras (no forced catch-all);
normalize the missing-required error; accept both binding families.

## Changes

1. Spec: add a "Function invocation" section to `codengine-spec/semantics/execution.md`;
   note the per-language binding in `conformance/README.md`.
2. `codengine-runner-py`: bind via `inspect.signature` (drop extras, `**kwargs`
   gets all, normalized `MissingInputError`). Rewrite its conformance catalog with
   natural signatures (`def emit(n)`, `def route(route)`, `def pick(i)`, …).
   Add a unit test for the binding/missing-input behavior.
3. `codengine-runner-ts`: no code change (structured binding already conforms);
   document it.
4. Update the Python function fixtures/examples in `codengine-cli` to named params
   (e.g. `def greet(name)`), and the greeting `.mjs` to destructuring for parity.

## Non-goals

- Dart/C# runners (future) — this plan only writes down the contract they will
  follow. Their binding is codegen (Dart) / reflection (C#).
- Output-side symmetry (returning typed records instead of maps) — a later idea.

## Milestones

1. [x] Spec section (`## Function invocation`) + conformance note.
2. [x] runner-py binding (`_invoke` + `MissingInputError`), natural catalog
   signatures, unit test — runner-py now **18 tests** (14 conformance + 4 invocation).
3. [x] Update cli Python fixtures/examples to named params; the `.mjs` example to
   destructuring.
4. [x] Verify: parser 11, runner-ts 14, cli 4, runner-py 18 — all green; the
   greeting example runs in both languages with `greet(name)` / `greet({ name })`.

## Outcome / notes

- **IR unchanged** — this is a runtime/invocation contract, not a schema change.
- Python functions are now written naturally: `def emit(n)`, `def route(route)`,
  `def pick(i)`; `**kwargs` receives everything (used by `echo`/`output`). Extras
  are dropped; a missing required parameter raises the normalized
  `Task '<name>': missing required input(s): …`.
- TS keeps structured binding (whole object + destructuring) — already conformant.
- The two later runners follow the contract with native tools: **Dart** via
  build_runner codegen (no AOT mirrors), **C#** via reflection. Documented so they
  don't invent a parallel calling convention.
