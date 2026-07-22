// Runner conformance: for every codengine-spec case with runs/, load all of its
// workflows as a registry and execute each run, asserting expectedOutput. This is the
// SAME suite codengine-runner-ts / -py / -dart run, so a green result here proves
// cross-language parity. The function catalog is built in-code (like the other
// runners' conformance tests) — the reflection loader is proven end-to-end via the CLI.

using System.Runtime.CompilerServices;
using System.Text.Json;
using Codengine.Core;
using Codengine.Runner;

using TaskData = System.Collections.Generic.Dictionary<string, object?>;

static string SourceDir([CallerFilePath] string path = "") => Path.GetDirectoryName(path)!;

// tests -> codengine-runner-cs -> codengine-cs -> repo root -> codengine-spec
string casesDir = Path.GetFullPath(Path.Combine(
    SourceDir(), "..", "..", "..", "codengine-spec", "conformance", "cases"));

// Trail helper: appends its own name, so expectedOutput proves which tasks ran.
static TaskFunction Trail(string name) => data =>
{
    var trail = data.TryGetValue("trail", out var existing) && existing is IEnumerable<object?> items
        ? new List<object?>(items)
        : new List<object?>();
    trail.Add(name);
    return new TaskData { ["trail"] = trail };
};

// Natural signatures per the invocation contract; functions are bound per module.
var catalog = new Dictionary<string, Dictionary<string, TaskFunction>>
{
    [""] = new()
    {
        ["echo"] = data => data,
        ["pass"] = _ => true,
        ["nil"] = _ => null,
        ["emit"] = data =>
        {
            long n = Convert.ToInt64(data["n"]);
            var list = new List<object?>();
            for (long i = 0; i < n; i++) list.Add(new TaskData { ["i"] = i });
            return list;
        },
        ["route"] = data => data["route"],
        ["pick"] = data => data["i"],
        ["output"] = data => data,
        ["start"] = Trail("start"),
    },
    ["chain"] = new()
    {
        ["a"] = Trail("a"),
        ["b"] = Trail("b"),
        ["c"] = Trail("c"),
        ["d"] = Trail("d"),
        ["e"] = Trail("e"),
    },
};

int passed = 0, failed = 0;
foreach (var caseDir in Directory.GetDirectories(casesDir).OrderBy(d => d))
{
    string runsDir = Path.Combine(caseDir, "runs");
    if (!Directory.Exists(runsDir)) continue;

    var workflows = Directory.GetFiles(Path.Combine(caseDir, "workflows"), "*.json")
        .OrderBy(f => f)
        .Select(f => JsonSerializer.Deserialize<WorkflowIR>(File.ReadAllText(f), Ir.Options)!)
        .ToList();

    foreach (var runFile in Directory.GetFiles(runsDir, "*.json").OrderBy(f => f))
    {
        using var spec = JsonDocument.Parse(File.ReadAllText(runFile));
        var root = spec.RootElement;
        string entry = root.GetProperty("entry").GetString()!;
        TaskData? input = root.TryGetProperty("input", out var ie) && ie.ValueKind == JsonValueKind.Object
            ? ie.Deserialize<TaskData>(Ir.Options)
            : null;
        var expected = root.GetProperty("expectedOutput");

        string label = $"{Path.GetFileName(caseDir)}/{Path.GetFileNameWithoutExtension(runFile)}";
        try
        {
            var actual = Engine.Run(workflows, catalog, entry, input);
            if (JsonMatches(actual, expected))
            {
                passed++;
            }
            else
            {
                failed++;
                Console.Error.WriteLine($"FAIL {label}\n  expected: {expected.GetRawText()}\n  actual:   {ToJson(actual)}");
            }
        }
        catch (Exception error)
        {
            failed++;
            Console.Error.WriteLine($"ERROR {label}: {error.Message}");
        }
    }
}

Console.WriteLine($"conformance: {passed}/{passed + failed} passed");
return failed == 0 ? 0 : 1;

static string ToJson(List<TaskData>? value)
{
    using var stream = new MemoryStream();
    using (var writer = new Utf8JsonWriter(stream)) JsonValueConverter.WriteValue(writer, value);
    return System.Text.Encoding.UTF8.GetString(stream.ToArray());
}

static bool JsonMatches(List<TaskData>? actual, JsonElement expected)
{
    using var actualDocument = JsonDocument.Parse(ToJson(actual));
    return DeepEquals(actualDocument.RootElement, expected);
}

// Deep JSON equality: arrays are order-sensitive (task outputs are ordered); objects
// are order-insensitive (key order is irrelevant).
static bool DeepEquals(JsonElement a, JsonElement b)
{
    if (a.ValueKind != b.ValueKind)
    {
        // Treat integer 3 and real 3 as equal (System.Text.Json keeps them both Number).
        return false;
    }
    switch (a.ValueKind)
    {
        case JsonValueKind.Object:
            var aProps = a.EnumerateObject().ToDictionary(p => p.Name, p => p.Value);
            var bProps = b.EnumerateObject().ToDictionary(p => p.Name, p => p.Value);
            if (aProps.Count != bProps.Count) return false;
            foreach (var (key, value) in aProps)
                if (!bProps.TryGetValue(key, out var other) || !DeepEquals(value, other)) return false;
            return true;
        case JsonValueKind.Array:
            var aItems = a.EnumerateArray().ToList();
            var bItems = b.EnumerateArray().ToList();
            if (aItems.Count != bItems.Count) return false;
            for (int i = 0; i < aItems.Count; i++)
                if (!DeepEquals(aItems[i], bItems[i])) return false;
            return true;
        case JsonValueKind.Number:
            return a.GetDecimal() == b.GetDecimal();
        case JsonValueKind.String:
            return a.GetString() == b.GetString();
        default:
            return a.ValueKind == b.ValueKind; // true/false/null
    }
}
