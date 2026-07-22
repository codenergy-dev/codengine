// The codengine IR executor, in C#.
//
// Implements codengine-spec/semantics/execution.md and is a faithful port of
// codengine-runner-ts / runtime.py. The runner is "dumb": it trusts the precomputed
// executionPlan and only resolves functions and applies the runtime rules. Named
// binding (the invocation contract) is the loader's job — here a TaskFunction is
// already a delegate that takes the input map.

namespace Codengine.Runner;

using TaskData = Dictionary<string, object?>;

/// <summary>A bound task function: takes the input map, returns a raw result.</summary>
public delegate object? TaskFunction(TaskData data);

/// <summary>Functions bound per module namespace; "" is the default module.</summary>
public sealed class MissingInputError : Exception
{
    public MissingInputError(string message) : base(message) { }
}

public static class Engine
{
    /// <summary>Run a workflow registry from the <paramref name="entry"/> address with
    /// <paramref name="data"/>. Returns the output task's collected output of the
    /// workflow that owns the entry, or null.</summary>
    public static List<TaskData>? Run(
        IReadOnlyList<WorkflowIR> workflows,
        Dictionary<string, Dictionary<string, TaskFunction>> functions,
        string entry,
        TaskData? data = null)
    {
        var runInput = data ?? new TaskData();
        var registry = workflows.ToDictionary(w => w.Workflow);
        var entrypoints = BuildEntrypointIndex(workflows);

        string? target = entrypoints.GetValueOrDefault(entry);
        bool isolated = false;
        if (target is null)
        {
            // Not an entrypoint anywhere: a unit call of that address, wherever declared.
            foreach (var (name, ir) in registry)
            {
                if (ir.Tasks.Any(t => t.Name == entry))
                {
                    target = name;
                    isolated = true;
                    break;
                }
            }
        }
        if (target is null) throw new ArgumentException($"Unknown entry address '{entry}'.");

        var state = ExecuteWorkflow(registry, functions, entrypoints, target, entry, runInput, isolated);
        return state.GetValueOrDefault("output");
    }

    private static Dictionary<string, string> BuildEntrypointIndex(IReadOnlyList<WorkflowIR> workflows)
    {
        var index = new Dictionary<string, string>();
        foreach (var workflow in workflows)
        {
            foreach (var task in workflow.Tasks)
            {
                if (!task.Entrypoint) continue;
                if (index.TryGetValue(task.Name, out var owner))
                {
                    throw new ArgumentException(
                        $"Address '{task.Name}' is an entrypoint in more than one workflow:\n" +
                        $"  {owner}\n  {workflow.Workflow}\n" +
                        "An address may be an entrypoint in at most one workflow.");
                }
                index[task.Name] = workflow.Workflow;
            }
        }
        return index;
    }

    // state: name present -> list (produced) or null (ran, no data).
    // A name absent from `state` means the task never ran (skipped).
    private static Dictionary<string, List<TaskData>?> ExecuteWorkflow(
        Dictionary<string, WorkflowIR> registry,
        Dictionary<string, Dictionary<string, TaskFunction>> functions,
        Dictionary<string, string> entrypoints,
        string workflowName,
        string entryTask,
        TaskData runInput,
        bool isolated)
    {
        if (!registry.TryGetValue(workflowName, out var ir))
            throw new ArgumentException($"Unknown workflow '{workflowName}'.");
        var tasks = ir.Tasks.ToDictionary(t => t.Name);
        if (!tasks.TryGetValue(entryTask, out var entryDef))
            throw new ArgumentException($"Unknown task '{entryTask}' in workflow '{workflowName}'.");

        // An isolated entry is a unit call: only that task, ignoring its fanIn.
        var plan = isolated ? new List<string> { entryTask } : entryDef.ExecutionPlan;

        var state = new Dictionary<string, List<TaskData>?>();
        var injected = new Dictionary<string, List<TaskData>>();

        foreach (var name in plan)
        {
            if (!tasks.TryGetValue(name, out var task)) continue;
            if (state.ContainsKey(name)) continue; // already resolved (e.g. mirrored from a sub-run)

            List<TaskData> inputs;
            if (injected.TryGetValue(name, out var injectedInputs))
            {
                inputs = injectedInputs;
            }
            else if (isolated && name == entryTask)
            {
                inputs = new List<TaskData> { new() };
            }
            else
            {
                // A required fanIn that ran and produced no data (null) blocks this task.
                bool blocked = task.FanIn.Any(f =>
                    !task.FanInNullable.Contains(f) && state.TryGetValue(f, out var s) && s is null);
                if (blocked) continue; // skipped: leave absent

                var present = task.FanIn
                    .Where(f => state.TryGetValue(f, out var s) && s is not null)
                    .Select(f => state[f]!)
                    .ToList();
                if (present.Count == 0)
                {
                    if (task.FanIn.Count == 0) inputs = new List<TaskData> { new() }; // root task
                    else continue; // no producer ran
                }
                else
                {
                    inputs = CartesianMerge(present);
                }
            }

            // The run input replaces the entry task's declared args.
            var args = name == entryTask ? runInput : task.Args;

            // Cross-workflow call: this address is an entrypoint in another workflow, so
            // that workflow's chain runs and its results are mirrored back here.
            string? chainOwner = entrypoints.GetValueOrDefault(name);
            if (chainOwner is not null && chainOwner != workflowName)
            {
                var mirrored = new Dictionary<string, List<TaskData>>();
                foreach (var raw in inputs)
                {
                    var subInput = FormatData(task, Merge(raw, args), "input");
                    var subState = ExecuteWorkflow(
                        registry, functions, entrypoints, chainOwner, name, subInput, false);
                    foreach (var (subName, subOutput) in subState)
                    {
                        if (!tasks.ContainsKey(subName) || subOutput is null) continue;
                        if (!mirrored.TryGetValue(subName, out var acc))
                            mirrored[subName] = acc = new List<TaskData>();
                        acc.AddRange(subOutput);
                    }
                }
                foreach (var (mirroredName, outputs) in mirrored)
                    if (!state.ContainsKey(mirroredName)) state[mirroredName] = outputs;
                if (!state.ContainsKey(name)) state[name] = null;
                continue;
            }

            var fn = ResolveFunction(functions, task);
            var produced = new List<TaskData>();
            bool routed = false;
            foreach (var raw in inputs)
            {
                var formatted = FormatData(task, Merge(raw, args), "input");
                if (Classify(task, fn(formatted), formatted, produced, injected)) routed = true;
            }

            state[name] = routed ? null : (produced.Count > 0 ? produced : null);
        }

        return state;
    }

    /// <summary>Handle one function result. Pushes data outputs, or routes (injecting
    /// the transferred input into the selected target). Returns true if it routed.
    /// Classification is by type, never truthiness: {}, 0 and "" are meaningful. In C#
    /// a bool is not an int, so the integer branch cleanly excludes booleans.</summary>
    private static bool Classify(
        TaskIR task,
        object? result,
        TaskData taskInput,
        List<TaskData> outputs,
        Dictionary<string, List<TaskData>> injected)
    {
        if (result is null || (result is bool bfalse && !bfalse)) return false;

        if (result is bool) // true
        {
            outputs.Add(FormatData(task, taskInput, "output"));
            return false;
        }

        if (result is string label)
        {
            var route = task.Routes.FirstOrDefault(r => r.Label == label);
            if (route is not null) Inject(injected, route.Target, taskInput); // no match -> halt
            return true;
        }

        if (result is long or int)
        {
            long n = Convert.ToInt64(result);
            var fanOut = task.FanOut;
            if (fanOut.Count > 0)
            {
                var target = fanOut[EuclideanIndex(n, fanOut.Count)];
                Inject(injected, target, taskInput);
            }
            return true;
        }

        if (result is System.Collections.IDictionary)
        {
            outputs.Add(FormatData(task, AsData(result), "output"));
            return false;
        }

        if (result is System.Collections.IEnumerable items)
        {
            foreach (var item in items)
            {
                if (item is not System.Collections.IDictionary)
                    throw new InvalidOperationException($"Task '{task.Name}' returned a non-object array item.");
                outputs.Add(FormatData(task, AsData(item), "output"));
            }
            return false;
        }

        throw new InvalidOperationException(
            $"Task '{task.Name}' returned an unsupported value of type {result.GetType().Name}.");
    }

    /// <summary>Apply the `^key` (input) / `key$` (output) rename directives from args.</summary>
    private static TaskData FormatData(TaskIR task, TaskData data, string kind)
    {
        var directives = task.Args.Keys.Where(k => k.StartsWith('^') || k.EndsWith('$')).ToList();
        if (directives.Count == 0) return data;

        var result = new TaskData(data);
        foreach (var directive in directives)
        {
            bool isInput = directive.StartsWith('^');
            string source = isInput ? directive[1..] : directive[..^1];
            string directiveKind = isInput ? "input" : "output";
            if (directiveKind == kind && data.ContainsKey(source))
            {
                var targetKey = (string)task.Args[directive]!;
                result[targetKey] = data[source];
                result.Remove(source);
            }
            result.Remove(directive);
        }
        return result;
    }

    private static List<TaskData> CartesianMerge(List<List<TaskData>> outputs)
    {
        var merged = new List<TaskData> { new() };
        foreach (var group in outputs)
        {
            var next = new List<TaskData>(merged.Count * group.Count);
            foreach (var acc in merged)
                foreach (var part in group)
                    next.Add(Merge(acc, part));
            merged = next;
        }
        return merged;
    }

    private static void Inject(Dictionary<string, List<TaskData>> injected, string target, TaskData data)
    {
        if (!injected.TryGetValue(target, out var list)) injected[target] = list = new List<TaskData>();
        list.Add(data);
    }

    private static TaskFunction ResolveFunction(
        Dictionary<string, Dictionary<string, TaskFunction>> functions, TaskIR task)
    {
        string module = task.Module ?? "";
        if (functions.TryGetValue(module, out var moduleFns) &&
            moduleFns.TryGetValue(task.Function, out var fn))
            return fn;
        string labelText = module == "" ? "the default module" : $"module '{module}'";
        throw new ArgumentException(
            $"No function '{task.Function}' bound in {labelText} (task '{task.Name}').");
    }

    private static int EuclideanIndex(long n, int length) =>
        (int)(((n % length) + length) % length);

    private static TaskData Merge(TaskData a, TaskData b)
    {
        var result = new TaskData(a);
        foreach (var (key, value) in b) result[key] = value;
        return result;
    }

    /// <summary>Copy any dictionary result into the canonical TaskData shape.</summary>
    private static TaskData AsData(object value)
    {
        if (value is TaskData data) return data;
        var result = new TaskData();
        foreach (System.Collections.DictionaryEntry entry in (System.Collections.IDictionary)value)
            result[entry.Key.ToString()!] = entry.Value;
        return result;
    }
}
