// The execution contract's core primitives: a bound task function and the normalized
// missing-required error. `TaskData` is just `Dictionary<string, object?>` — a BCL
// type each file aliases; it needs no declaration here.

namespace Codengine.Core;

using TaskData = Dictionary<string, object?>;

/// <summary>A bound task function: takes the input map, returns a raw result. Named
/// binding is the loader's job; the engine only calls this delegate.</summary>
public delegate object? TaskFunction(TaskData data);

/// <summary>A required task input (a parameter with no default) was not provided.</summary>
public sealed class MissingInputError : Exception
{
    public MissingInputError(string message) : base(message) { }
}
