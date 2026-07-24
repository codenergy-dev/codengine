// The persistent worker loop. Reads one JSON request per line from stdin and writes
// one JSON response per line to stdout. The module's project is built and reflected
// once (via the loader) and kept alive — the engine sends many cheap calls without
// reloading. The worker does not know the graph; all branching stays in the engine.
//
//   { "op": "load",      "module": str, "files": [str], "root": str|null } -> { "ok": true }
//   { "op": "call",      "module": str, "function": str, "input": object } -> { "result": any }
//   { "op": "callChain", "module": str, "functions": [str], "input": object }
//        -> { "result": any, "consumed": int, "input": object }

using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Codengine.Core;
using Codengine.Loader;

using TaskData = System.Collections.Generic.Dictionary<string, object?>;

var modules = new Dictionary<string, Dictionary<string, TaskFunction>>();

// --http PORT --config FILE: serve over HTTP (the `remote` transport). The config is
// { "modules": { "<name>": { "files": [...], "root": ... } } }, loaded once at startup.
if (args.Contains("--http"))
{
    int port = int.Parse(args[Array.IndexOf(args, "--http") + 1]);
    LoadModulesFromConfig(modules, args[Array.IndexOf(args, "--config") + 1]);
    ServeHttp(modules, port);
    return;
}

string? line;
while ((line = Console.In.ReadLine()) is not null)
{
    if (string.IsNullOrWhiteSpace(line)) continue;
    string response;
    try
    {
        using var document = JsonDocument.Parse(line);
        response = Handle(modules, document.RootElement);
    }
    catch (Exception error)
    {
        response = Failure(Unwrap(error));
    }
    Console.Out.Write(response);
    Console.Out.Write('\n');
    Console.Out.Flush();
}

static void LoadModulesFromConfig(Dictionary<string, Dictionary<string, TaskFunction>> modules, string path)
{
    using var document = JsonDocument.Parse(File.ReadAllText(path));
    foreach (var module in document.RootElement.GetProperty("modules").EnumerateObject())
    {
        var files = module.Value.GetProperty("files").EnumerateArray().Select(f => f.GetString()!).ToList();
        string? root = module.Value.TryGetProperty("root", out var r) && r.ValueKind == JsonValueKind.String
            ? r.GetString()
            : null;
        modules[module.Name] = Loader.LoadModule(files, root);
    }
}

// Serve the same requests over HTTP. Prints the bound port on the first stdout line.
static void ServeHttp(Dictionary<string, Dictionary<string, TaskFunction>> modules, int port)
{
    if (port == 0)
    {
        var probe = new TcpListener(IPAddress.Loopback, 0);
        probe.Start();
        port = ((IPEndPoint)probe.LocalEndpoint).Port;
        probe.Stop();
    }
    var listener = new HttpListener();
    listener.Prefixes.Add($"http://127.0.0.1:{port}/");
    listener.Start();
    Console.Out.WriteLine(port);
    Console.Out.Flush();

    while (true)
    {
        var context = listener.GetContext();
        using var reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding);
        string body = reader.ReadToEnd();
        string responseText;
        try
        {
            using var document = JsonDocument.Parse(body);
            responseText = Handle(modules, document.RootElement);
        }
        catch (Exception error)
        {
            responseText = Failure(Unwrap(error));
        }
        var buffer = Encoding.UTF8.GetBytes(responseText);
        context.Response.ContentType = "application/json";
        context.Response.ContentLength64 = buffer.Length;
        context.Response.OutputStream.Write(buffer, 0, buffer.Length);
        context.Response.OutputStream.Close();
    }
}

static string Handle(Dictionary<string, Dictionary<string, TaskFunction>> modules, JsonElement request)
{
    try
    {
        string op = request.GetProperty("op").GetString()!;
        string module = request.TryGetProperty("module", out var m) ? m.GetString() ?? "" : "";

        switch (op)
        {
            case "load":
            {
                var files = request.GetProperty("files").EnumerateArray()
                    .Select(file => file.GetString()!).ToList();
                string? root = request.TryGetProperty("root", out var r) && r.ValueKind == JsonValueKind.String
                    ? r.GetString()
                    : null;
                modules[module] = Loader.LoadModule(files, root);
                return Write(writer => writer.WriteBoolean("ok", true));
            }
            case "call":
            {
                var fn = Resolve(modules, module, request.GetProperty("function").GetString()!);
                object? result = fn(ReadInput(request));
                return Write(writer =>
                {
                    writer.WritePropertyName("result");
                    JsonValueConverter.WriteValue(writer, result);
                });
            }
            case "callChain":
            {
                var functions = request.GetProperty("functions").EnumerateArray()
                    .Select(file => file.GetString()!).ToList();
                TaskData data = ReadInput(request);
                object? result = data;
                TaskData fed = data;
                int consumed = 0;
                foreach (var name in functions)
                {
                    var fn = Resolve(modules, module, name);
                    fed = data;
                    result = fn(data);
                    consumed += 1;
                    // Stop at the first non-object result; the engine classifies it.
                    if (result is not System.Collections.IDictionary dictionary) break;
                    data = ToTaskData(dictionary);
                }
                int ran = consumed;
                TaskData lastInput = fed;
                object? last = result;
                return Write(writer =>
                {
                    writer.WritePropertyName("result");
                    JsonValueConverter.WriteValue(writer, last);
                    writer.WriteNumber("consumed", ran);
                    writer.WritePropertyName("input");
                    JsonValueConverter.WriteValue(writer, lastInput);
                });
            }
            default:
                return Failure($"Unknown op '{op}'.");
        }
    }
    catch (Exception error)
    {
        return Failure(Unwrap(error));
    }
}

static TaskFunction Resolve(
    Dictionary<string, Dictionary<string, TaskFunction>> modules, string module, string function)
{
    if (!modules.TryGetValue(module, out var functions))
        throw new InvalidOperationException($"Module '{module}' is not loaded.");
    if (!functions.TryGetValue(function, out var fn))
        throw new InvalidOperationException($"No function '{function}' in module '{module}'.");
    return fn;
}

static TaskData ReadInput(JsonElement request) =>
    request.TryGetProperty("input", out var input) && input.ValueKind == JsonValueKind.Object
        ? input.Deserialize<TaskData>(Ir.Options) ?? new TaskData()
        : new TaskData();

static TaskData ToTaskData(System.Collections.IDictionary source)
{
    if (source is TaskData data) return data;
    var result = new TaskData();
    foreach (System.Collections.DictionaryEntry entry in source)
        result[entry.Key.ToString()!] = entry.Value;
    return result;
}

static string Unwrap(Exception error) =>
    error is System.Reflection.TargetInvocationException { InnerException: { } inner }
        ? inner.Message
        : error.Message;

static string Failure(string message) => Write(writer => writer.WriteString("error", message));

static string Write(Action<Utf8JsonWriter> body)
{
    using var stream = new MemoryStream();
    using (var writer = new Utf8JsonWriter(stream))
    {
        writer.WriteStartObject();
        body(writer);
        writer.WriteEndObject();
    }
    return Encoding.UTF8.GetString(stream.ToArray());
}
