using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using MitPlan.Data;

namespace MitPlan.Tracking;

/// <summary>
/// A pull's clock on a plan's times, kept in line by the boss's casts. Sheet rows named after a cast, and every cast
/// cactbot has in each phase (tools/build_plans.py), have a time on their phase's clock; when the boss starts one,
/// the clock is set so that time lands when the cast bar ends. Ultimate phases each have their own clock. A cast only
/// used in one phase moves the clock into that phase, so the phase is found from the boss's casts alone, even when
/// the plugin starts mid-fight. Times are in seconds, from any zero.
/// </summary>
public sealed partial class FollowClock
{
    /// <summary>How far, in seconds, a cast may be from its row's time and still be that row.</summary>
    private const double Window = 25;

    /// <summary>The same for casts with an exact time from cactbot's timeline (tools/build_plans.py).</summary>
    private const double ExactWindow = 10;

    /// <summary>A hit counts as reached this many seconds before its time, so its row lights up as you press.</summary>
    private const double Lead = 2;

    private readonly HashSet<(int Index, double At, string Name)> used = [];
    private readonly double startedAt;
    private string? clock;
    private double anchorT;
    private double anchorReal;

    public FollowClock(Plan plan, double now)
    {
        Plan = plan;
        clock = plan.Phases.FirstOrDefault()?.Clock;
        anchorReal = now;
        startedAt = now;
    }

    public Plan Plan { get; }

    /// <summary>The last hit reached, as an index into <see cref="Data.Plan.Flat"/>; -1 before the first.</summary>
    public int NowIndex { get; private set; } = -1;

    /// <summary>The phase you're in.</summary>
    public int Phase { get; private set; }

    /// <summary>Seconds until the next hit, when it's on the running clock.</summary>
    public double? NextIn { get; private set; }

    /// <summary>Seconds into the fight since the clock started (the pull, or loading mid-fight).</summary>
    public double Elapsed { get; private set; }

    /// <summary>True once a boss cast has set the clock this pull.</summary>
    public bool Synced { get; private set; }

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
        (string Clock, double At, (int, double, string) Key, string Label, double Score)? best = null;

        void Consider(string c, double at, (int, double, string) id, string label, bool exact, bool entry, bool anchor, double bias)
        {
            if (used.Contains(id))
                return;

            double score;
            var target = ClockIndex(c);
            if (c == clock && Math.Abs(at - lands) <= (exact ? ExactWindow : Window))
                score = Math.Abs(at - lands);
            else if (anchor)
                score = target >= current ? 60 : 150;      // a once-a-fight cast is right wherever the clock was
            else if (entry && target > current)
                score = 100 + target - current;            // a later phase's own cast: you're in that phase now
            else
                return;

            score += bias;
            if (best == null || score < best.Value.Score)
                best = (c, at, id, label, score);
        }

        foreach (var hit in Plan.Flat)
        {
            foreach (var (at, exact) in Times(hit, key))
                Consider(hit.Clock, at, (hit.FlatIndex, at, ""), hit.Name, exact, hit.Entry, false, 0);
        }

        for (var p = 0; p < Plan.Phases.Count; p++)
        {
            var phase = Plan.Phases[p];
            foreach (var s in phase.Syncs)
            {
                if (Norm(s.Name) == key)
                    Consider(phase.Clock, s.At, (-1 - p, s.At, s.Name), phase.Name, true, s.Entry, s.Anchor, 0.5);
            }
        }

        if (best is not { } match)
            return;

        used.Add(match.Key);
        clock = match.Clock;
        anchorT = match.At;
        anchorReal = now + remaining;
        Synced = true;
        LastSync = $"{name} -> {match.Label}";
    }

    public void Advance(double now)
    {
        Elapsed = now - startedAt;
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
        var next = Plan.Flat.Skip(reached + 1).FirstOrDefault(h => h.Info == null);
        NextIn = next is { When: { } nt } && next.Clock == clock ? nt - t : null;

        // The phase: the last one on this clock that has started.
        var phase = -1;
        for (var p = 0; p < Plan.Phases.Count; p++)
        {
            if (Plan.Phases[p].Clock != clock)
                continue;
            if (phase < 0 || Plan.Phases[p].Start is { } start && start <= t + Lead)
                phase = p;
        }

        Phase = Math.Max(0, phase);
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

    private int ClockIndex(string? c) => Plan.Phases.FindIndex(p => p.Clock == c);

    [GeneratedRegex(@"(\s+([0-9]+|[ivx]+))+$")]
    private static partial Regex TrailingNumber();

    [GeneratedRegex("[^a-z]")]
    private static partial Regex NotLetter();

    /// <summary>Cast names compared the way tools/build_plans.py writes them: letters only, no trailing number.</summary>
    public static string Norm(string s) =>
        NotLetter().Replace(TrailingNumber().Replace(s.ToLowerInvariant().Trim(), "").Replace("judgement", "judgment"), "");
}
