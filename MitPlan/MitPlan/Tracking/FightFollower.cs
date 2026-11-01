using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dalamud.Game.ClientState.Conditions;
using Dalamud.Game.ClientState.Objects.Types;
using Dalamud.Plugin.Services;
using MitPlan.Data;

namespace MitPlan.Tracking;

/// <summary>
/// Follows a pull of the duty's fight: a clock from the pull, kept in line by the boss's casts.
/// Each sheet row named after a cast has a time on its phase's clock; when the boss starts that cast, the clock
/// is set so the row's time lands when the cast bar ends. Ultimate phases each have their own clock, entered when
/// the boss casts one of a phase's first rows.
/// </summary>
public sealed partial class FightFollower : IDisposable
{
    /// <summary>How far, in seconds, a cast may be from its row's time and still be that row.</summary>
    private const double Window = 25;

    /// <summary>A hit counts as reached this many seconds before its time, so its row lights up as you press.</summary>
    private const double Lead = 2;

    /// <summary>Casts from this many of a phase's first rows can start that phase.</summary>
    private const int PhaseEntryRows = 3;

    private readonly Plugin plugin;
    private readonly Dictionary<ulong, uint> casting = [];
    private bool wasInCombat;
    private string? clock;
    private double anchorT;
    private double anchorReal;

    public FightFollower(Plugin plugin)
    {
        this.plugin = plugin;
        Plugin.Framework.Update += OnUpdate;
    }

    /// <summary>The plan being followed: the duty's, while a pull is going on.</summary>
    public Plan? Plan { get; private set; }

    public bool Running { get; private set; }

    /// <summary>The last hit reached, as an index into <see cref="Data.Plan.Flat"/>; -1 before the first.</summary>
    public int NowIndex { get; private set; } = -1;

    /// <summary>The phase the window should show: the next hit's.</summary>
    public int Phase { get; private set; }

    /// <summary>Seconds until the next hit, when it's on the running clock.</summary>
    public double? NextIn { get; private set; }

    /// <summary>The last cast that set the clock, for the status line.</summary>
    public string? LastSync { get; private set; }

    private static double Now => Environment.TickCount64 / 1000.0;

    private double ClockNow => anchorT + (Now - anchorReal);

    public void Dispose()
    {
        Plugin.Framework.Update -= OnUpdate;
    }

    private void OnUpdate(IFramework framework)
    {
        var inCombat = Plugin.Condition[ConditionFlag.InCombat];
        var plan = plugin.Configuration.FollowFight ? plugin.DutyPlan : null;

        if (plan == null)
        {
            Running = false;
            Plan = null;
        }
        else if (inCombat && !wasInCombat)
        {
            Start(plan);
        }
        else if (!inCombat && wasInCombat)
        {
            Running = false;
        }

        wasInCombat = inCombat;
        if (!Running || Plan == null)
            return;

        ScanCasts();
        Advance();
    }

    private void Start(Plan plan)
    {
        Plan = plan;
        Running = true;
        clock = plan.Flat.FirstOrDefault()?.Clock;
        anchorT = 0;
        anchorReal = Now;
        NowIndex = -1;
        LastSync = null;
        casting.Clear();
    }

    private void ScanCasts()
    {
        foreach (var obj in Plugin.ObjectTable)
        {
            // Sub kind 5 is a combatant: bosses and adds, not pets or chocobos.
            if (obj is not IBattleNpc npc || (byte)npc.BattleNpcKind != 5)
                continue;

            if (!npc.IsCasting || npc.CastActionId == 0)
            {
                casting.Remove(npc.GameObjectId);
                continue;
            }

            if (casting.TryGetValue(npc.GameObjectId, out var last) && last == npc.CastActionId)
                continue;

            casting[npc.GameObjectId] = npc.CastActionId;
            OnCast(GameData.CastName(npc.CastActionId), Math.Max(0, npc.TotalCastTime - npc.CurrentCastTime));
        }
    }

    private void OnCast(string name, double remaining)
    {
        var key = Norm(name);
        if (key.Length == 0 || Plan == null)
            return;

        var now = ClockNow + remaining;
        var current = ClockIndex(clock);
        (Hit Hit, double At, double Score)? best = null;

        foreach (var hit in Plan.Flat)
        {
            foreach (var at in Times(hit, key))
            {
                double score;
                if (hit.Clock == clock)
                {
                    score = Math.Abs(at - now);
                    if (score > Window)
                        continue;
                }
                else
                {
                    var target = ClockIndex(hit.Clock);
                    if (hit.ClockOrder >= PhaseEntryRows || target <= current)
                        continue;
                    score = 100 + target - current;
                }

                if (best == null || score < best.Value.Score)
                    best = (hit, at, score);
            }
        }

        if (best is not { } match)
            return;

        clock = match.Hit.Clock;
        anchorT = match.At;
        anchorReal = Now + remaining;
        LastSync = $"{name} -> {match.Hit.Name}";
    }

    /// <summary>When on its clock a row's hit lands, for each of its casts called <paramref name="key"/>.</summary>
    private static IEnumerable<double> Times(Hit hit, string key)
    {
        foreach (var s in hit.SyncAt)
        {
            if (Norm(s.Name) == key)
                yield return s.At;
        }

        if (hit.T is not { } t)
            yield break;

        for (var i = 0; i < hit.Sync.Count; i++)
        {
            // A row covering several casts ("Rain + Screech", 0:42–1:01): the first starts it, the last ends it.
            if (Norm(hit.Sync[i]) == key)
                yield return i > 0 && i == hit.Sync.Count - 1 ? hit.TEnd ?? t : t;
        }
    }

    private void Advance()
    {
        if (Plan == null)
            return;

        var t = ClockNow;
        var now = -1;
        foreach (var hit in Plan.Flat)
        {
            if (hit.Clock == clock && hit.T is { } ht && ht <= t + Lead)
                now = hit.FlatIndex;
        }

        if (now < 0)
            now = (Plan.Flat.FirstOrDefault(h => h.Clock == clock)?.FlatIndex ?? 0) - 1;

        NowIndex = now;
        var next = now + 1 < Plan.Flat.Count ? Plan.Flat[now + 1] : null;
        Phase = (next ?? Plan.Flat[Math.Max(0, now)]).PhaseIndex;
        NextIn = next is { T: { } nt } && next.Clock == clock ? nt - t : null;
    }

    private int ClockIndex(string? c) => Plan?.Flat.FirstOrDefault(h => h.Clock == c)?.PhaseIndex ?? -1;

    [GeneratedRegex(@"(\s+([0-9]+|[ivx]+))+$")]
    private static partial Regex TrailingNumber();

    [GeneratedRegex("[^a-z]")]
    private static partial Regex NotLetter();

    /// <summary>Cast names compared the way tools/build_plans.py writes them: letters only, no trailing number.</summary>
    public static string Norm(string s) =>
        NotLetter().Replace(TrailingNumber().Replace(s.ToLowerInvariant().Trim(), "").Replace("judgement", "judgment"), "");
}
