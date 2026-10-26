using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace PullTimer.Tracking;

public enum PullSource
{
    /// <summary>A party member's action hit an enemy.</summary>
    Action,
    /// <summary>Combat started before any party action was seen (body pull, or someone outside the party).</summary>
    CombatStart,
}

/// <summary>
/// A finished pull, saved to history. All offsets are seconds relative to countdown zero:
/// negative means before zero (early), positive means after zero (late).
/// "Went off" is when an action resolved (cast finished or instant used); "landed" is when the enemy took the hit.
/// </summary>
public sealed class PullRecord
{
    public DateTime Time { get; set; }
    public string Duty { get; set; } = "";
    public int CountdownSeconds { get; set; }
    public string? CountdownBy { get; set; }

    /// <summary>When the enemy first got hit (or combat started, for a body pull).</summary>
    public double Offset { get; set; }
    public PullSource Source { get; set; }
    /// <summary>False when the pulling hit was never seen landing and <see cref="Offset"/> is when it went off.</summary>
    public bool PullLanded { get; set; }
    public string? PullerName { get; set; }
    public string? PullerJob { get; set; }
    public string? PullerAction { get; set; }
    public double? PullerWentOff { get; set; }
    public double? PullerCastStart { get; set; }
    public bool PullerIsYou { get; set; }

    public List<MemberResult> Party { get; set; } = [];
    public List<ActionResult> YourActions { get; set; } = [];

    [JsonIgnore]
    public MemberResult? You => Party.FirstOrDefault(m => m.IsYou);
}

public sealed class MemberResult
{
    public string Name { get; set; } = "";
    public string Job { get; set; } = "";
    public bool IsYou { get; set; }
    /// <summary>First action against an enemy, or null if they never used one within the window.</summary>
    public string? Action { get; set; }
    public double? Landed { get; set; }
    public double? WentOff { get; set; }
    public double? CastStart { get; set; }
}

public sealed class ActionResult
{
    public string Name { get; set; } = "";
    /// <summary>When it went off.</summary>
    public double Offset { get; set; }
    public double? Landed { get; set; }
    public double? CastStart { get; set; }
    public bool Hostile { get; set; }
}
