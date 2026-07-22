using System.Collections.Generic;

public static class Tasks
{
    public static Dictionary<string, object?> resize(int width, int height = 100, int? ratio = null)
        => new() { ["width"] = width, ["height"] = height, ["ratio"] = ratio };
}
