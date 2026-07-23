// Default module (C#): the "output" collector, run via a warm C# worker.
namespace Greeting;

public static class Tasks
{
    public static Dictionary<string, object?> output(string message)
        => new() { ["message"] = message };
}
