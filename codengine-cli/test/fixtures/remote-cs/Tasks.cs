namespace Greeting;

public static class Tasks
{
    public static Dictionary<string, object?> greet(string name)
        => new() { ["message"] = $"Hello, {name}!" };

    public static Dictionary<string, object?> output(string message)
        => new() { ["message"] = message };
}
