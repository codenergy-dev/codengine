// Normalize JSON into plain CLR values, so the engine and the reflection loader see
// one uniform shape regardless of where a value came from (the protocol, a task's
// args, or a function result). The mapping mirrors Python's json module:
//   null -> null, true/false -> bool, integer -> long, real -> double,
//   string -> string, array -> List<object?>, object -> Dictionary<string, object?>.

using System.Text.Json;
using System.Text.Json.Serialization;

namespace Codengine.Core;

/// <summary>Reads any JSON token into a plain CLR value (never a JsonElement).</summary>
public sealed class JsonValueConverter : JsonConverter<object?>
{
    public override object? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.Null:
                return null;
            case JsonTokenType.True:
                return true;
            case JsonTokenType.False:
                return false;
            case JsonTokenType.String:
                return reader.GetString();
            case JsonTokenType.Number:
                // An exact integer becomes long; anything else becomes double — the
                // same int/float split the other runners rely on for routing.
                if (reader.TryGetInt64(out long l)) return l;
                return reader.GetDouble();
            case JsonTokenType.StartArray:
            {
                var list = new List<object?>();
                while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
                    list.Add(Read(ref reader, typeof(object), options));
                return list;
            }
            case JsonTokenType.StartObject:
            {
                var map = new Dictionary<string, object?>();
                while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
                {
                    string key = reader.GetString()!;
                    reader.Read();
                    map[key] = Read(ref reader, typeof(object), options);
                }
                return map;
            }
            default:
                throw new JsonException($"Unexpected token {reader.TokenType}.");
        }
    }

    public override void Write(Utf8JsonWriter writer, object? value, JsonSerializerOptions options)
    {
        WriteValue(writer, value);
    }

    /// <summary>Serialize a plain CLR value back to JSON (the reverse mapping).</summary>
    public static void WriteValue(Utf8JsonWriter writer, object? value)
    {
        switch (value)
        {
            case null:
                writer.WriteNullValue();
                break;
            case bool b:
                writer.WriteBooleanValue(b);
                break;
            case string s:
                writer.WriteStringValue(s);
                break;
            case long l:
                writer.WriteNumberValue(l);
                break;
            case int i:
                writer.WriteNumberValue(i);
                break;
            case double d:
                writer.WriteNumberValue(d);
                break;
            case IReadOnlyDictionary<string, object?> map:
                writer.WriteStartObject();
                foreach (var (key, item) in map)
                {
                    writer.WritePropertyName(key);
                    WriteValue(writer, item);
                }
                writer.WriteEndObject();
                break;
            case System.Collections.IEnumerable list:
                writer.WriteStartArray();
                foreach (var item in list) WriteValue(writer, item);
                writer.WriteEndArray();
                break;
            default:
                throw new JsonException($"Cannot serialize value of type {value.GetType().Name}.");
        }
    }
}
