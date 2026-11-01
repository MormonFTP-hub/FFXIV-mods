using System;
using System.Collections.Generic;
using Dalamud.Game.ClientState.Conditions;
using Dalamud.Game.ClientState.Objects.Types;
using Dalamud.Plugin.Services;
using MitPlan.Data;

namespace MitPlan.Tracking;

/// <summary>Runs a <see cref="FollowClock"/> for each pull of the duty's fight, feeding it the enemies' casts.</summary>
public sealed class FightFollower : IDisposable
{
    private readonly Plugin plugin;
    private readonly Dictionary<ulong, uint> casting = [];
    private bool wasInCombat;
    private FollowClock? pull;

    public FightFollower(Plugin plugin)
    {
        this.plugin = plugin;
        Plugin.Framework.Update += OnUpdate;
    }

    /// <summary>The plan being followed: the duty's, from the pull until combat ends.</summary>
    public Plan? Plan => Running ? pull?.Plan : null;

    public bool Running { get; private set; }

    /// <summary>The last hit reached, as an index into <see cref="Data.Plan.Flat"/>; -1 before the first.</summary>
    public int NowIndex => pull?.NowIndex ?? -1;

    /// <summary>The phase the window should show: the next hit's.</summary>
    public int Phase => pull?.Phase ?? 0;

    /// <summary>Seconds until the next hit, when it's on the running clock.</summary>
    public double? NextIn => pull?.NextIn;

    /// <summary>The last cast that set the clock, for the status line.</summary>
    public string? LastSync => pull?.LastSync;

    private static double Now => Environment.TickCount64 / 1000.0;

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
            pull = null;
        }
        else if (inCombat && !wasInCombat)
        {
            pull = new FollowClock(plan, Now);
            casting.Clear();
            Running = true;
        }
        else if (!inCombat && wasInCombat)
        {
            Running = false;
        }

        wasInCombat = inCombat;
        if (!Running || pull == null)
            return;

        ScanCasts(pull);
        pull.Advance(Now);
    }

    private void ScanCasts(FollowClock clock)
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
            clock.OnCast(GameData.CastName(npc.CastActionId), Math.Max(0, npc.TotalCastTime - npc.CurrentCastTime), Now);
        }
    }
}
