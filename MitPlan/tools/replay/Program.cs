// Plays each fight's cactbot timeline (the Striking Dummy Sim's export of its main line) through FollowClock the way
// the plugin sees a pull: every cast bar from the moment it starts. Prints whether each sheet row lights up, and when.
//
//   dotnet run --project tools/replay            every fight, one line each
//   dotnet run --project tools/replay -- dmu     one fight, row by row, with each sync

using System.Text.Json;
using System.Text.RegularExpressions;
using MitPlan.Data;
using MitPlan.Tracking;

var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
var plans = Path.Combine(root, "MitPlan", "Plans");
var fights = Path.Combine(root, "..", "BlackMageSim", "work", "fights");
var simKey = new Dictionary<string, string> { ["dmu"] = "umad" };
var only = args.FirstOrDefault();
var json = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

foreach (var file in Directory.GetFiles(plans, "*.json").Order())
{
    var plan = JsonSerializer.Deserialize<Plan>(File.ReadAllText(file), json)!;
    if (only != null && plan.Id != only)
        continue;

    plan.Index();
    var fight = Path.Combine(fights, $"{simKey.GetValueOrDefault(plan.Id, plan.Id)}.json");
    if (!File.Exists(fight))
    {
        Console.WriteLine($"{plan.Id,-5} no timeline at {fight}");
        continue;
    }

    var casts = JsonDocument.Parse(File.ReadAllText(fight)).RootElement.GetProperty("fight").GetProperty("events")
        .EnumerateArray()
        .Where(e => e.TryGetProperty("cast", out _))
        .Select(e => (End: e.GetProperty("t").GetDouble(), Name: e.GetProperty("name").GetString()!, Cast: e.GetProperty("cast").GetDouble()))
        .OrderBy(e => e.End - e.Cast)
        .ToList();

    var clock = new FollowClock(plan, 0);
    var lit = new Dictionary<int, double>();
    var next = 0;
    string? lastSync = null;
    var end = casts.Max(c => c.End) + 15;
    for (double t = 0; t < end; t += 0.25)
    {
        for (; next < casts.Count && casts[next].End - casts[next].Cast <= t; next++)
        {
            // cactbot writes "A/B" for either-or casts and adds notes in brackets; the game shows one plain name.
            foreach (var name in Regex.Replace(casts[next].Name, @"\s*\(.*?\)|\?$", "").Split('/'))
                clock.OnCast(name.Trim(), casts[next].End - t, t);
        }

        clock.Advance(t);
        if (clock.LastSync != lastSync && only != null)
            Console.WriteLine($"  {Clock(t)}  sync  {lastSync = clock.LastSync}");
        lastSync = clock.LastSync;
        if (clock.NowIndex >= 0)
            lit.TryAdd(clock.NowIndex, t);
    }

    var hits = plan.Flat.Where(h => h.Info == null).ToList();
    var times = hits.Where(h => lit.ContainsKey(h.FlatIndex)).Select(h => lit[h.FlatIndex]).ToList();
    var outOfOrder = times.Zip(times.Skip(1)).Count(p => p.Second < p.First);
    var missed = hits.Where(h => !lit.ContainsKey(h.FlatIndex)).Select(h => h.Name).ToList();
    Console.WriteLine($"{plan.Id,-5} {times.Count}/{hits.Count} rows light up, {outOfOrder} out of order"
                      + (missed.Count > 0 ? $", never: {string.Join(", ", missed)}" : ""));

    if (only != null)
    {
        foreach (var h in plan.Flat)
            Console.WriteLine($"  {plan.Phases[h.PhaseIndex].Name,-24} {h.Time,-12} {h.Name,-36} {(lit.TryGetValue(h.FlatIndex, out var at) ? Clock(at) : "-")}");
    }
}

static string Clock(double s) => $"{(int)s / 60}:{(int)s % 60:00}";
