// Subprocess protocol entrypoint: the codengine orchestrator (codengine-cli) spawns
// this built assembly (`dotnet codengine-runner-cs.dll`) to run a C# workflow.
//
//   in:  { "workflows": [<WorkflowIR>], "entry": str, "input": object,
//          "functions": { "<module>": { "files": [<file>], "root": str | null } } }
//   out: { "result": object[] | null }   or   { "error": str }
//
// The user-project build's stdout is captured inside the loader, so only this
// protocol JSON ever reaches our stdout.

using System.Text.Json;
using Codengine.Core;
using Codengine.Loader;
using Codengine.Runner;

using TaskData = System.Collections.Generic.Dictionary<string, object?>;

try
{
    string requestText = Console.In.ReadToEnd();
    using var document = JsonDocument.Parse(requestText);
    var request = document.RootElement;

    var workflows = Ir.ParseWorkflows(request.GetProperty("workflows"));
    string entry = request.GetProperty("entry").GetString()!;

    TaskData input = request.TryGetProperty("input", out var inputElement)
        && inputElement.ValueKind == JsonValueKind.Object
        ? inputElement.Deserialize<TaskData>(Ir.Options) ?? new TaskData()
        : new TaskData();

    var functions = new Dictionary<string, Dictionary<string, TaskFunction>>();
    foreach (var module in request.GetProperty("functions").EnumerateObject())
    {
        var spec = module.Value;
        var files = spec.GetProperty("files").EnumerateArray()
            .Select(f => f.GetString()!).ToList();
        string? root = spec.TryGetProperty("root", out var rootElement)
            && rootElement.ValueKind == JsonValueKind.String
            ? rootElement.GetString()
            : null;
        functions[module.Name] = Loader.LoadModule(files, root);
    }

    var result = Engine.Run(workflows, functions, entry, input);
    WriteResponse(writer => WriteResultProperty(writer, result));
    return 0;
}
catch (Exception error)
{
    var message = error is System.Reflection.TargetInvocationException { InnerException: { } inner }
        ? inner.Message
        : error.Message;
    WriteResponse(writer => writer.WriteString("error", message));
    return 1;
}

static void WriteResultProperty(Utf8JsonWriter writer, List<TaskData>? result)
{
    writer.WritePropertyName("result");
    JsonValueConverter.WriteValue(writer, result);
}

static void WriteResponse(Action<Utf8JsonWriter> writeBody)
{
    using var stdout = Console.OpenStandardOutput();
    using var writer = new Utf8JsonWriter(stdout);
    writer.WriteStartObject();
    writeBody(writer);
    writer.WriteEndObject();
    writer.Flush();
}
