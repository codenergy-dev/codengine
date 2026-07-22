// Load a C# module's task functions by reflection — the invocation contract done at
// runtime instead of build time (C# has full reflection, unlike Dart's AOT, so no
// generator/glue is needed). The compiled particularity: we build the module's
// project and load its output assembly, so the user's own dependencies resolve and
// their .csproj needs no reference to codengine.

using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Runtime.Loader;

namespace Codengine.Runner;

using TaskData = Dictionary<string, object?>;

public static class Loader
{
    /// <summary>Build the module's project (its <paramref name="root"/>), load the
    /// output assembly, and bind every eligible public static method by name.</summary>
    public static Dictionary<string, TaskFunction> LoadModule(IReadOnlyList<string> files, string? root)
    {
        if (string.IsNullOrEmpty(root))
            throw new ArgumentException("A C# module needs a `root` (its .csproj directory).");

        string dll = BuildAssembly(root);
        var assembly = LoadAssembly(dll);

        var functions = new Dictionary<string, TaskFunction>();
        var origin = new Dictionary<string, string>();
        foreach (var type in assembly.GetExportedTypes())
        {
            foreach (var method in type.GetMethods(
                BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly))
            {
                if (method.IsSpecialName || method.Name == "Main" || method.IsGenericMethod) continue;
                string name = method.Name;
                if (functions.ContainsKey(name))
                {
                    throw new InvalidOperationException(
                        $"Duplicate task function '{name}' in module:\n" +
                        $"  {origin[name]}\n  {type.FullName}\n" +
                        "Rename one, or split them into separate modules.");
                }
                functions[name] = Bind(method);
                origin[name] = type.FullName ?? type.Name;
            }
        }
        return functions;
    }

    /// <summary>Wrap a method as a TaskFunction: bind the input map to parameters by
    /// name (the invocation contract), coercing values, dropping extras, and raising a
    /// normalized error for a missing required parameter.</summary>
    private static TaskFunction Bind(MethodInfo method)
    {
        var parameters = method.GetParameters();
        return data =>
        {
            var args = new object?[parameters.Length];
            var missing = new List<string>();
            for (int i = 0; i < parameters.Length; i++)
            {
                var p = parameters[i];
                string paramName = p.Name!;
                if (data.TryGetValue(paramName, out var value))
                {
                    args[i] = Coerce(value, p.ParameterType);
                }
                else if (p.HasDefaultValue)
                {
                    args[i] = p.DefaultValue;
                }
                else
                {
                    missing.Add(paramName);
                }
            }
            if (missing.Count > 0)
            {
                throw new MissingInputError(
                    $"missing required input(s): {string.Join(", ", missing)}");
            }
            return method.Invoke(null, args);
        };
    }

    /// <summary>Coerce a JSON-shaped CLR value to a parameter's type (long->int, etc.).</summary>
    private static object? Coerce(object? value, Type target)
    {
        if (value is null) return null;
        if (target.IsInstanceOfType(value)) return value;
        var underlying = Nullable.GetUnderlyingType(target) ?? target;
        if (underlying.IsInstanceOfType(value)) return value;
        if (value is IConvertible && (underlying.IsPrimitive || underlying == typeof(decimal)))
            return Convert.ChangeType(value, underlying, CultureInfo.InvariantCulture);
        return value; // hand it over as-is; the invoke throws if truly incompatible
    }

    private static string BuildAssembly(string root)
    {
        var build = RunDotnet($"build \"{root}\" -c Debug -v quiet -nologo");
        if (build.ExitCode != 0)
        {
            string detail = (build.StdErr + build.StdOut).Trim();
            throw new InvalidOperationException($"`dotnet build` failed for '{root}':\n{detail}");
        }
        // `--getProperty` only evaluates (it does not build), so it runs after the build.
        var target = RunDotnet($"build \"{root}\" -c Debug --getProperty:TargetPath");
        string dll = target.StdOut.Trim();
        if (string.IsNullOrEmpty(dll) || !File.Exists(dll))
            throw new InvalidOperationException($"Could not resolve the built assembly for '{root}'.");
        return dll;
    }

    private static Assembly LoadAssembly(string dll)
    {
        var context = new AssemblyLoadContext("codengine-user", isCollectible: false);
        var resolver = new AssemblyDependencyResolver(dll);
        context.Resolving += (ctx, name) =>
        {
            string? path = resolver.ResolveAssemblyToPath(name);
            return path is null ? null : ctx.LoadFromAssemblyPath(path);
        };
        return context.LoadFromAssemblyPath(dll);
    }

    private static (int ExitCode, string StdOut, string StdErr) RunDotnet(string arguments)
    {
        var psi = new ProcessStartInfo("dotnet", arguments)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Could not start `dotnet`.");
        string stdout = process.StandardOutput.ReadToEnd();
        string stderr = process.StandardError.ReadToEnd();
        process.WaitForExit();
        return (process.ExitCode, stdout, stderr);
    }
}
