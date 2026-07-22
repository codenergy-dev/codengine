// The description contract: the neutral task-definition types an analyzer produces and
// a generator consumes (codengine-spec/schema/task-definition.schema.json). Living in
// core is what lets both sides — analyzer (produce) and generator (consume) — share
// one definition of the shape.

using System.Text.Json;
using System.Text.Json.Serialization;

namespace Codengine.Core;

/// <summary>A named parameter. <see cref="Default"/> is meaningful only when the
/// parameter is optional (<c>Required == false</c>) and may itself be null.</summary>
public sealed class ParamDefinition
{
    public required string Name { get; init; }
    public required string Kind { get; init; } // number | boolean | string | array | object | any
    public required bool Required { get; init; }
    public required bool Nullable { get; init; }
    public object? Default { get; init; }
}

public sealed class TaskDefinition
{
    public required string Name { get; init; }
    public required IReadOnlyList<ParamDefinition> Params { get; init; }
    public required bool AcceptsExtra { get; init; }
}

public sealed class TaskDefinitionDocument
{
    public string Version { get; init; } = "1";
    public required string Language { get; init; }
    public required IReadOnlyList<TaskDefinition> Definitions { get; init; }
}

public static class TaskDefinitions
{
    public static readonly JsonSerializerOptions JsonOptions = Build();

    private static JsonSerializerOptions Build()
    {
        var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        options.Converters.Add(new ParamDefinitionConverter());
        return options;
    }

    /// <summary>Serialize a document's definitions array (the shape conformance checks).</summary>
    public static string SerializeDefinitions(TaskDefinitionDocument document) =>
        JsonSerializer.Serialize(document.Definitions, JsonOptions);
}

/// <summary>Writes a param as `{ name, kind, required, nullable }`, adding `default`
/// (possibly null) only when the parameter is optional — the canonical shape.</summary>
public sealed class ParamDefinitionConverter : JsonConverter<ParamDefinition>
{
    public override ParamDefinition Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var document = JsonDocument.ParseValue(ref reader);
        var element = document.RootElement;
        bool required = element.GetProperty("required").GetBoolean();
        object? defaultValue = null;
        if (!required && element.TryGetProperty("default", out var d))
            defaultValue = d.Deserialize<object?>(Ir.Options);
        return new ParamDefinition
        {
            Name = element.GetProperty("name").GetString()!,
            Kind = element.GetProperty("kind").GetString()!,
            Required = required,
            Nullable = element.GetProperty("nullable").GetBoolean(),
            Default = defaultValue,
        };
    }

    public override void Write(Utf8JsonWriter writer, ParamDefinition value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteString("name", value.Name);
        writer.WriteString("kind", value.Kind);
        writer.WriteBoolean("required", value.Required);
        writer.WriteBoolean("nullable", value.Nullable);
        if (!value.Required)
        {
            writer.WritePropertyName("default");
            JsonValueConverter.WriteValue(writer, value.Default);
        }
        writer.WriteEndObject();
    }
}
