// Plain public static C# methods — no adaptation for codengine. The analyzer reads
// the parameter names and the runner binds the input to them by name (reflection).
namespace Greeting;

public static class Tasks
{
    public static Dictionary<string, object?> greet(string name)
        => new() { ["message"] = $"Hello, {name}!" };

    public static Dictionary<string, object?> output(string message)
        => new() { ["message"] = message };
}
