# codengine-loader-cs

Load a C# module's task functions by reflection — build the module's project and
reflect the output assembly, binding the input to each public static method's
parameters by name. Depends on [`codengine-core-cs`](../codengine-core-cs/) for the
contract types. BCL only.

The compiled particularity lives here, not in a generator: C# has full runtime
reflection, so the user's `.csproj` needs **no reference to codengine** — the loader
loads its built assembly as data. See the [family README](../README.md) for the
build → load → reflect flow.
