using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;

namespace MitPlan.Data;

/// <summary>The built-in plans plus any JSON plans the user drops in the custom plans folder (same id replaces).</summary>
public sealed class PlanLibrary
{
    private const string ResourcePrefix = "MitPlan.Plans.";

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        WriteIndented = true,
    };

    public PlanLibrary(string customFolder)
    {
        CustomFolder = customFolder;
        Reload();
    }

    public string CustomFolder { get; }
    public IReadOnlyList<Plan> Plans { get; private set; } = [];
    public IReadOnlyList<string> Errors { get; private set; } = [];

    public Plan? Get(string? id) => Plans.FirstOrDefault(p => p.Id == id);

    public Plan? ForDuty(string duty) =>
        Plans.FirstOrDefault(p => p.Duties.Any(d => string.Equals(d, duty, StringComparison.OrdinalIgnoreCase)));

    public void Reload()
    {
        var plans = new List<Plan>();
        var errors = new List<string>();

        var assembly = Assembly.GetExecutingAssembly();
        foreach (var name in assembly.GetManifestResourceNames().Where(n => n.StartsWith(ResourcePrefix)).Order())
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            var plan = JsonSerializer.Deserialize<Plan>(stream, Json);
            if (plan != null)
                plans.Add(plan);
        }

        if (Directory.Exists(CustomFolder))
        {
            foreach (var file in Directory.EnumerateFiles(CustomFolder, "*.json").Order())
            {
                try
                {
                    var plan = JsonSerializer.Deserialize<Plan>(File.ReadAllText(file), Json);
                    if (plan == null || string.IsNullOrWhiteSpace(plan.Id) || plan.Phases.Count == 0)
                    {
                        errors.Add($"{Path.GetFileName(file)}: needs an id and at least one phase.");
                        continue;
                    }

                    plan.Custom = true;
                    plans.RemoveAll(p => p.Id == plan.Id);
                    plans.Add(plan);
                }
                catch (Exception e)
                {
                    errors.Add($"{Path.GetFileName(file)}: {e.Message}");
                }
            }
        }

        foreach (var plan in plans)
            plan.Index();

        Plans = plans;
        Errors = errors;
    }

    /// <summary>Writes the built-in plans into the custom folder as starting points. Never overwrites a file.</summary>
    public int ExportBuiltIns()
    {
        Directory.CreateDirectory(CustomFolder);
        var assembly = Assembly.GetExecutingAssembly();
        var written = 0;
        foreach (var name in assembly.GetManifestResourceNames().Where(n => n.StartsWith(ResourcePrefix)))
        {
            var path = Path.Combine(CustomFolder, name[ResourcePrefix.Length..]);
            if (File.Exists(path))
                continue;

            using var stream = assembly.GetManifestResourceStream(name)!;
            using var file = File.Create(path);
            stream.CopyTo(file);
            written++;
        }

        return written;
    }
}
