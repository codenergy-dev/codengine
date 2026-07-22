// Analyzer conformance: for every codengine-spec analyzer case that has a source.cs,
// assert AnalyzeSource's definitions deep-equal the shared expected.json (the same
// file analyzer-ts / -py / -dart match). C# has no catch-all, so that case has no
// source.cs and is skipped — exactly like Dart (2/2, not 3/3).

using System.Runtime.CompilerServices;
using System.Text.Json;
using Codengine.Analyzer;
using Codengine.Core;

static string SourceDir([CallerFilePath] string path = "") => Path.GetDirectoryName(path)!;

// tests -> codengine-analyzer-cs -> codengine-cs -> repo root -> codengine-spec
string analyzerDir = Path.GetFullPath(Path.Combine(
    SourceDir(), "..", "..", "..", "codengine-spec", "conformance", "analyzer"));

int passed = 0, failed = 0;
foreach (var caseDir in Directory.GetDirectories(analyzerDir).OrderBy(d => d))
{
    string sourcePath = Path.Combine(caseDir, "source.cs");
    if (!File.Exists(sourcePath)) continue; // no C# fixture (e.g. catch-all): skip

    string label = Path.GetFileName(caseDir);
    string actual = TaskDefinitions.SerializeDefinitions(Analyze.AnalyzeSource(sourcePath));
    string expected = File.ReadAllText(Path.Combine(caseDir, "expected.json"));

    using var actualDocument = JsonDocument.Parse(actual);
    using var expectedDocument = JsonDocument.Parse(expected);
    if (DeepEquals(actualDocument.RootElement, expectedDocument.RootElement))
    {
        passed++;
    }
    else
    {
        failed++;
        Console.Error.WriteLine($"FAIL {label}\n  expected: {expectedDocument.RootElement.GetRawText()}\n  actual:   {actual}");
    }
}

Console.WriteLine($"analyzer conformance: {passed}/{passed + failed} passed");
return failed == 0 ? 0 : 1;

// Arrays order-sensitive (definitions/params are ordered); objects order-insensitive.
static bool DeepEquals(JsonElement a, JsonElement b)
{
    if (a.ValueKind != b.ValueKind) return false;
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
            return true; // true/false/null already matched on ValueKind
    }
}
