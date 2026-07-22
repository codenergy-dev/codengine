# 0014 — C# support (a compiled language *with* reflection)

Status: done

## Context

The second **compiled** language. Its lesson is the mirror image of Dart's: Dart
forced the **generator** into existence for one reason only — AOT has no runtime
reflection, so named binding had to be written as glue at build time. C# is compiled
too, but the default .NET runtime has **full reflection** (`MethodInfo` +
`ParameterInfo.Name`). So the generator is **not needed**: the loader binds named
parameters at runtime, exactly like Python's `inspect.signature`.

This validates the architecture: *the generator is about reflection, not about
compilation*. C#'s family is therefore **analyzer + runner** (the reflection loader
folds into the runner, like Python keeps it in `functions.py`) — the two-package
shape of Python, not the four-package shape of Dart.

There's a north-star bonus over Dart. Dart requires the user's `pubspec.yaml` to
depend on three codengine packages (the glue imports them). With C# reflection,
codengine loads the user's **compiled assembly as data** — so the user's `.csproj`
needs **zero reference to codengine**. They write plain `public static` methods,
list them, and nothing else.

## The model for C# (decided with the user)

The user writes **plain `public static` methods** and lists their files in
`codengine.json` — no adaptation. The tooling resolves the rest:

- **analyzer-cs** parses the source with **Roslyn** (`CSharpSyntaxTree`, never regex)
  → task definitions (method names + params: `kind`, `required`, `nullable`,
  `default`). No clean reflection-based catch-all convention exists, so `acceptsExtra`
  is always `false` and the `catch-all` conformance case is skipped — exactly as Dart
  did (Dart 2/2, not 3/3).
- **runner-cs** is the engine (a faithful port of `runtime.py`) **plus** the loader
  and the subprocess `Main`. Loading (the compiled particularity, decided: *build the
  project + reflect the assembly*):
  1. Shell `dotnet build --getProperty:TargetPath` on the module's `.csproj` (`root`)
     → the user's output DLL (its real NuGet deps resolved by the build).
  2. Load it in an `AssemblyLoadContext` with an `AssemblyDependencyResolver` so the
     user's dependencies resolve.
  3. Reflect the public static methods → a `name -> Func<TaskData, object?>` map,
     duplicate-name = conflict (like the Python/Dart loaders). Each wrapper binds the
     input dict to parameters **by name**, coercing JSON-shaped values to the
     parameter types, dropping extras, and raising a normalized missing-required
     error.

The engine deals in `Func<TaskData, object?>`; the reflection wrappers are the
loader's job (the C# analog of Dart's generated wrappers, done at runtime instead of
build time). `TaskData = Dictionary<string, object?>`.

## Protocol

Same as the others (`python -m codengine_runner`, `dart run codengine_generator:run`):

    in:  { workflows, entry, input, functions: { <module>: { files, root } } }
    out: { result } | { error }

The CLI spawns the prebuilt runner DLL (`dotnet <runner-cs>.dll`); `root` (the
`.csproj`) arrives on stdin. The runner captures the user-project build's stdout
separately, so only the protocol JSON reaches the runner's stdout. Language token
`"cs"`, root marker `*.csproj`.

## Milestones

1. [x] `codengine-runner-cs` — engine + conformance: **16/16**, the same runs as
   TS/Python/Dart (an in-code `Func<TaskData,object?>` catalog, like the Dart test).
   BCL only — no NuGet deps; runs offline.
2. [x] `codengine-runner-cs` — reflection loader (build project + reflect assembly)
   and the `Main` subprocess entrypoint.
3. [x] `codengine-analyzer-cs` — source → task definitions via Roslyn:
   **2/2** against the shared `expected.json` (descriptor parity). One NuGet dep
   (`Microsoft.CodeAnalysis.CSharp` 4.14.0), pinned, `packages.lock.json` committed.
4. [x] `source.cs` fixtures for the `basic` and `optional-and-nullable` analyzer
   cases (catch-all skipped, like Dart).
5. [x] CLI wiring — language `cs`, root marker `*.csproj`, the runner spawns the
   prebuilt runner DLL (env override `CODENGINE_RUNNER_CS_DLL`, else the build
   output). **End-to-end green** (`codengine-cli` 12/12, incl. the C# case) with the
   user writing plain `public static` methods and **no codengine reference in their
   `.csproj`**.

## Outcome / notes

- **Four languages (TS, Python, Dart, C#) now pass the same conformance.** C# joined engine parity (16 runs)
  and descriptor parity (2 analyzer cases). The north star held *more strongly* than
  Dart: the C# user writes ordinary `public static` methods, lists them, and their
  `.csproj` has **zero codengine reference** — reflection loads the compiled assembly
  as data.
- The empirical de-risking that mattered: `dotnet build --getProperty:TargetPath`
  **only evaluates** (does not build), so the loader builds first, then resolves the
  target path; and a built runner DLL invoked as `dotnet <dll>` keeps stdout clean
  because the user-project build's stdout is captured in a separate child process.
- Same known limits as recorded above (assembly-wide method selection; one `root` per
  module; `acceptsExtra` always false). None block the pipeline.
- Manifest gained a glob-aware root marker (`*.csproj`) so `detectRoot` matches a
  project file by pattern, not just an exact filename.

## Notes / risks to de-risk empirically

- `dotnet build --getProperty:TargetPath` prints the DLL path on stdout — capture it
  in a child process whose stdout is separate from the runner's protocol stdout.
- Numbers: System.Text.Json gives `long`/`double`; coerce to the parameter's type.
  `bool` is not an `int` in C#, so `is long`/`is int` cleanly excludes booleans.
  Euclidean index `((n % len) + len) % len` holds for negative `long`.
- Method selection: for the first cut the loader binds **every** eligible public
  static method in the module's assembly (excluding `Main`, accessors, operators),
  with duplicate-name conflict detection. PDB-based source-file filtering (to honour
  the `functions` globs the way Python/TS do) is a documented future refinement.
- Known limits (like Dart / cross-language): one C# project `root` per run; the
  missing-required error is normalized in the wrapper.
