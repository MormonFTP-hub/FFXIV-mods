// Plays each fight's cactbot timeline (the Striking Dummy Sim's export of its main line) through FollowClock the way
// the plugin sees a pull: every cast bar from the moment it starts. Prints whether each sheet row lights up, and when,
// then starts following at every 30 s of the fight with no idea where it is (loading the plugin mid-pull, or a
// checkpoint) and reports how long it takes to name the right phase.
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
const double Step = 0.25;

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
    var end = casts.Max(c => c.End) + 15;

    // The whole pull from the start: which rows light up, and the phase at every step (the truth for the joins).
    var lit = new Dictionary<int, double>();
    var truth = new List<int>();
    Play(plan, casts, 0, end, (clock, t) =>
    {
        if (clock.NowIndex >= 0)
            lit.TryAdd(clock.NowIndex, t);
        truth.Add(clock.Phase);
    }, only != null);

    var hits = plan.Flat.Where(h => h.Info == null).ToList();
    var times = hits.Where(h => lit.ContainsKey(h.FlatIndex)).Select(h => lit[h.FlatIndex]).ToList();
    var outOfOrder = times.Zip(times.Skip(1)).Count(p => p.Second < p.First);
    var missed = hits.Where(h => !lit.ContainsKey(h.FlatIndex)).Select(h => h.Name).ToList();

    // Joining mid-fight: how long until the phase is right and stays right.
    var delays = new List<double>();
    var failed = new List<string>();
    for (double join = 30; join < end - 40; join += 30)
    {
        double? found = null;
        Play(plan, casts, join, end, (clock, t) =>
        {
            var right = clock.Phase == truth[Math.Min(truth.Count - 1, (int)(t / Step))];
            if (right && found == null)
                found = t - join;
            else if (!right)
                found = null;
        }, false);
        if (found is { } d)
            delays.Add(d);
        else
            failed.Add(Clock(join));
    }

    delays.Sort();
    Console.WriteLine($"{plan.Id,-5} {times.Count}/{hits.Count} rows light up, {outOfOrder} out of order"
                      + (missed.Count > 0 ? $", never: {string.Join(", ", missed)}" : "")
                      + $" | joined mid-fight {delays.Count + failed.Count}x: phase right after {(delays.Count > 0 ? delays[delays.Count / 2] : 0):0}s median, {(delays.Count > 0 ? delays[^1] : 0):0}s worst"
                      + (failed.Count > 0 ? $", wrong at the end when joined at {string.Join(", ", failed)}" : ""));

    if (only != null)
    {
        foreach (var h in plan.Flat)
            Console.WriteLine($"  {plan.Phases[h.PhaseIndex].Name,-24} {h.Time,-12} {h.Name,-36} {(lit.TryGetValue(h.FlatIndex, out var at) ? Clock(at) : "-")}");
    }
}

// Feeds the casts that start at or after `from` to a new clock, calling `step` every Step seconds.
static void Play(Plan plan, List<(double End, string Name, double Cast)> casts, double from, double end, Action<FollowClock, double> step, bool log)
{
    var clock = new FollowClock(plan, from);
    var next = casts.FindIndex(c => c.End - c.Cast >= from);
    if (next < 0)
        next = casts.Count;
    string? lastSync = null;
    for (var t = from; t < end; t += Step)
    {
        for (; next < casts.Count && casts[next].End - casts[next].Cast <= t; next++)
        {
            // cactbot writes "A/B" for either-or casts and adds notes in brackets; the game shows one plain name.
            foreach (var name in Regex.Replace(casts[next].Name, @"\s*\(.*?\)|\?$", "").Split('/'))
                clock.OnCast(Regex.Replace(name.Trim(), @"\s+x\d+$", ""), casts[next].End - t, t);
        }

        clock.Advance(t);
        if (log && clock.LastSync != lastSync)
            Console.WriteLine($"  {Clock(t)}  sync  {lastSync = clock.LastSync}");
        lastSync = clock.LastSync;
        step(clock, t);
    }
}

static string Clock(double s) => $"{(int)s / 60}:{(int)s % 60:00}";
