// Default module (C#): the "output" collector, run via a warm C# worker. It is
// `async` — codengine accepts sync and async task functions alike.
namespace Greeting;

public static class Tasks
{
    public static async Task<Dictionary<string, object?>> output(string message)
    {
        await Task.Yield();
        return new() { ["message"] = message };
    }
}
