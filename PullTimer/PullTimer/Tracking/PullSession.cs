using System;
using System.Collections.Generic;
using System.Linq;
using Dalamud.Game.ClientState.Objects.Types;

namespace PullTimer.Tracking;

/// <summary>
/// Live state for one countdown, from the moment it starts until the party's first hits are collected.
/// Times are <see cref="Clock.Now"/> seconds.
/// </summary>
public sealed class PullSession
{
    public required DateTime StartedLocal { get; init; }
    public required double StartedAt { get; init; }
    public required int CountdownSeconds { get; init; }
    public required string Duty { get; init; }
    public string? StartedBy { get; init; }

    /// <summary>When the countdown hits zero. Re-estimated every frame while the countdown runs.</summary>
    public double ExpectedZero { get; set; }
    public bool CountdownRunning { get; set; } = true;
    public bool ReachedZero { get; set; }
    public double StoppedAt { get; set; }

    /// <summary>When the first hostile party action went off, or combat started, whichever came first.</summary>
    public double? EngagedAt { get; set; }
    public PullSource Source { get; set; }
    /// <summary>When an enemy first took a hit from the party.</summary>
    public double? FirstLandedAt { get; set; }
    public MemberTiming? Puller { get; set; }
    public bool Announced { get; set; }
    public bool OwnAnnounced { get; set; }

    public Dictionary<uint, MemberTiming> Members { get; } = [];
    public List<TimedAction> YourActions { get; } = [];

    public MemberTiming? You => Members.Values.FirstOrDefault(m => m.IsYou);

    /// <summary>
    /// The moment the pull is measured at: when the enemy first got hit, or when combat started for a body pull.
    /// Falls back to when the first action went off if its hit was never seen.
    /// </summary>
    public double? PullTime => Source == PullSource.CombatStart ? EngagedAt : FirstLandedAt ?? EngagedAt;

    public MemberTiming GetOrAdd(IBattleChara chara, bool isYou)
    {
        if (!Members.TryGetValue(chara.EntityId, out var member))
        {
            member = new MemberTiming
            {
                EntityId = chara.EntityId,
                Name = chara.Name.TextValue,
                Job = chara.ClassJob.IsValid ? chara.ClassJob.Value.Abbreviation.ToString() : "?",
                IsYou = isYou,
            };
            Members[chara.EntityId] = member;
        }

        return member;
    }

    public PullRecord ToRecord()
    {
        var pull = PullTime ?? ExpectedZero;
        var puller = Puller;
        return new PullRecord
        {
            Time = StartedLocal.AddSeconds(pull - StartedAt),
            Duty = Duty,
            CountdownSeconds = CountdownSeconds,
            CountdownBy = StartedBy,
            Offset = pull - ExpectedZero,
            Source = Source,
            PullLanded = Source == PullSource.Action && FirstLandedAt != null,
            PullerName = puller?.Name,
            PullerJob = puller?.Job,
            PullerAction = puller?.FirstAction,
            PullerWentOff = puller?.WentOffTime - ExpectedZero,
            PullerCastStart = puller?.CastStart - ExpectedZero,
            PullerIsYou = puller?.IsYou ?? false,
            Party = Members.Values
                .Select(m => new MemberResult
                {
                    Name = m.Name,
                    Job = m.Job,
                    IsYou = m.IsYou,
                    Action = m.FirstAction,
                    Landed = m.LandedTime - ExpectedZero,
                    WentOff = m.WentOffTime - ExpectedZero,
                    CastStart = m.CastStart - ExpectedZero,
                })
                .OrderBy(m => m.Landed ?? m.WentOff ?? double.MaxValue)
                .ToList(),
            YourActions = YourActions
                .Select(a => new ActionResult
                {
                    Name = a.Name,
                    Offset = a.Time - ExpectedZero,
                    Landed = a.LandedTime - ExpectedZero,
                    CastStart = a.CastStart - ExpectedZero,
                    Hostile = a.Hostile,
                })
                .ToList(),
        };
    }
}

public sealed class MemberTiming
{
    public required uint EntityId { get; init; }
    public required string Name { get; init; }
    public required string Job { get; init; }
    public bool IsYou { get; init; }

    /// <summary>Their first action against an enemy.</summary>
    public string? FirstAction { get; set; }
    public double? WentOffTime { get; set; }
    public double? LandedTime { get; set; }
    public double? CastStart { get; set; }

    // The cast bar we last saw this member start, matched against the next action effect.
    internal uint PendingCastId { get; set; }
    internal double PendingCastStart { get; set; }
    internal bool PendingCastConsumed { get; set; }
    internal bool WasCasting { get; set; }
}

public sealed class TimedAction
{
    public required string Name { get; init; }
    /// <summary>When it went off.</summary>
    public required double Time { get; init; }
    public double? CastStart { get; init; }
    public bool Hostile { get; init; }
    public double? LandedTime { get; set; }
}
