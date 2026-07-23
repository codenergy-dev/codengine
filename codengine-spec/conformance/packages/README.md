# Packaging conformance

Valid example packages the package validator (`codengine-manifest`) must accept. See
[`../../packaging.md`](../../packaging.md) for the format.

- [`module-greeting/`](module-greeting/) — a **module package**: descriptor
  (`codengine-package.json`) + description contract (`definitions.json`) + a source
  artifact driven by the `subprocess` transport.
- [`bundle-app/`](bundle-app/) — a **bundle**: references the `greeting` module
  package and a workflow IR, with no source of its own.
