using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using MitPlan.Data;

namespace MitPlan.Tracking;

/// <summary>
/// A pull's clock on a plan's times. Each sheet row named after a boss cast has a time on its phase's clock; when
/// the boss starts that cast, the clock is set so the row's time lands when the cast bar ends. Ultimate phases each
/// have their own clock, entered when the boss casts the phase's first cast row. Times are in seconds, from any zero.
/// </summary>
public sealed partial class FollowClock
{
    /// <summary>How far, in seconds, a cast may be from its row's time and still be that row.</summary>
    private const double Window = 25;

    /// <summary>The same for casts with an exact time from cactbot's timeline (tools/build_plans.py).</summary>
    private const double ExactWindow = 10;

    /// <summary>A hit counts as reached this many seconds before its time, so its row lights up as you press.</summary>
    private const double Lead = 2;

    private readonly HashSet<(int Hit, double At)> used = [];
    private string? clock;
    private double anchorT;
    private double anchorReal;

    public FollowClock(Plan plan, double now)
    {
        Plan = plan;
        clock = plan.Flat.FirstOrDefault()?.Clock;
        anchorReal = now;
    }

    public Plan Plan { get; }

    /// <summary>The last hit reached, as an index into <see cref="Data.Plan.Flat"/>; -1 before the first.</summary>
    public int NowIndex { get; private set; } = -1;

    /// <summary>The phase the window should show: the next hit's.</summary>
    public int Phase { get; private set; }

    /// <summary>Seconds until the next hit, when it's on the running clock.</summary>
    public double? NextIn { get; private set; }

    /// <summary>The last cast that set the clock, for the status line.</summary>
    public string? LastSync { get; private set; }

    private double ClockAt(double now) => anchorT + (now - anchorReal);

    /// <summary>The boss started casting <paramref name="name"/>, finishing in <paramref name="remaining"/> seconds.</summary>
    public void OnCast(string name, double remaining, double now)
    {
        var key = Norm(name);
        if (key.Length == 0)
            return;

        var lands = ClockAt(now) + remaining;
        var current = ClockIndex(clock);
        (Hit Hit, double At, double Score)? best = null;

        foreach (var hit in Plan.Flat)
        {
            foreach (var (at, exact) in Times(hit, key))
            {
                // Each sync point is used once: a boss repeating the cast (Insane Air x4) would pull the clock back.
                if (used.Contains((hit.FlatIndex, at)))
                    continue;

                double score;
                if (hit.Clock == clock)
                {
                    score = Math.Abs(at - lands);
                    if (score > (exact ? ExactWindow : Window))
                        continue;
                }
                else
                {
                    // Only a later clock's first cast row starts it (P5's Akh Morn is also cast in P4).
                    var target = ClockIndex(hit.Clock);
                    if (!hit.Entry || target <= current)
                        continue;
                    score = 100 + target - current;
                }

                if (best == null || score < best.Value.Score)
                    best = (hit, at, score);
            }
        }

        if (best is not { } match)
            return;

        used.Add((match.Hit.FlatIndex, match.At));
        clock = match.Hit.Clock;
        anchorT = match.At;
        anchorReal = now + remaining;
        LastSync = $"{name} -> {match.Hit.Name}";
    }

    public void Advance(double now)
    {
        var t = ClockAt(now);
        var reached = -1;
        foreach (var hit in Plan.Flat)
        {
            // Instruction rows (how to play Forsaken, the enrage time) aren't hits to light up.
            if (hit.Info == null && hit.Clock == clock && hit.When is { } ht && ht <= t + Lead)
                reached = hit.FlatIndex;
        }

        if (reached < 0)
            reached = (Plan.Flat.FirstOrDefault(h => h.Clock == clock)?.FlatIndex ?? 0) - 1;

        NowIndex = reached;
        var next = reached + 1 < Plan.Flat.Count ? Plan.Flat[reached + 1] : null;
        Phase = (next ?? Plan.Flat[Math.Max(0, reached)]).PhaseIndex;
        NextIn = next is { When: { } nt } && next.Clock == clock ? nt - t : null;
    }

    /// <summary>When on its clock a row's hit lands, for each of its casts called <paramref name="key"/>.</summary>
    private static IEnumerable<(double At, bool Exact)> Times(Hit hit, string key)
    {
        foreach (var s in hit.SyncAt)
        {
            if (Norm(s.Name) == key)
                yield return (s.At, true);
        }

        if (hit.T is not { } t)
            yield break;

        for (var i = 0; i < hit.Sync.Count; i++)
        {
            // A row covering several casts ("Rain + Screech", 0:42–1:01): the first starts it, the last ends it.
            if (Norm(hit.Sync[i]) == key)
                yield return (i > 0 && i == hit.Sync.Count - 1 ? hit.TEnd ?? t : t, false);
        }
    }

    private int ClockIndex(string? c) => Plan.Flat.FirstOrDefault(h => h.Clock == c)?.PhaseIndex ?? -1;

    [GeneratedRegex(@"(\s+([0-9]+|[ivx]+))+$")]
    private static partial Regex TrailingNumber();

    [GeneratedRegex("[^a-z]")]
    private static partial Regex NotLetter();

    /// <summary>Cast names compared the way tools/build_plans.py writes them: letters only, no trailing number.</summary>
    public static string Norm(string s) =>
        NotLetter().Replace(TrailingNumber().Replace(s.ToLowerInvariant().Trim(), "").Replace("judgement", "judgment"), "");
}
