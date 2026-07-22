// The IR (Intermediate Representation) as C# records, deserialized from the JSON
// contract in codengine-spec. These mirror the schema fields a runner reads.

using System.Text.Json;
using System.Text.Json.Serialization;

namespace Codengine.Core;

public sealed record RouteIR(string Label, string Target);

public sealed record TaskIR(
    string Name,
    string Function,
    string? Module,
    Dictionary<string, object?> Args,
    List<string> FanIn,
    List<string> FanInNullable,
    List<string> FanOut,
    List<RouteIR> Routes,
    bool Entrypoint,
    List<string> ExecutionPlan)
{
    public Dictionary<string, object?> Args { get; init; } = Args ?? new();
    public List<string> FanIn { get; init; } = FanIn ?? new();
    public List<string> FanInNullable { get; init; } = FanInNullable ?? new();
    public List<string> FanOut { get; init; } = FanOut ?? new();
    public List<RouteIR> Routes { get; init; } = Routes ?? new();
    public List<string> ExecutionPlan { get; init; } = ExecutionPlan ?? new();
}

public sealed record WorkflowIR(string Workflow, List<TaskIR> Tasks)
{
    public List<TaskIR> Tasks { get; init; } = Tasks ?? new();
}

/// <summary>Shared JSON options: case-insensitive names and the CLR-value converter.</summary>
public static class Ir
{
    public static readonly JsonSerializerOptions Options = Build();

    private static JsonSerializerOptions Build()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        };
        options.Converters.Add(new JsonValueConverter());
        return options;
    }

    public static List<WorkflowIR> ParseWorkflows(JsonElement element) =>
        element.Deserialize<List<WorkflowIR>>(Options) ?? new();
}
