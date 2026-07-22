using System.Collections.Generic;

public static class Tasks
{
    public static Dictionary<string, object?> greet(string name)
        => new() { ["message"] = name };

    public static Dictionary<string, object?> add(int a, int b)
        => new() { ["sum"] = a + b };
}
