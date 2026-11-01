using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace MitPlan.Data;

/// <summary>One fight's mit plan, as written by tools/build_plans.py (or by hand in the custom plans folder).</summary>
public sealed class Plan
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Short { get; set; } = "";

    /// <summary>Duty names (ContentFinderCondition, English) the plan opens for.</summary>
    public List<string> Duties { get; set; } = [];

    public PlanSource? Source { get; set; }
    public List<string> About { get; set; } = [];
    public List<string> Notes { get; set; } = [];
    public List<Slot> Slots { get; set; } = [];
    public List<Phase> Phases { get; set; } = [];
    public List<TankTable> TankCooldowns { get; set; } = [];

    /// <summary>True for plans from the custom plans folder.</summary>
    [JsonIgnore]
    public bool Custom { get; set; }

    /// <summary>Every hit in fight order, filled in when the plan is loaded.</summary>
    [JsonIgnore]
    public List<Hit> Flat { get; } = [];

    public void Index()
    {
        Flat.Clear();
        var perClock = new Dictionary<string, int>();
        for (var p = 0; p < Phases.Count; p++)
        {
            var phase = Phases[p];
            var clock = string.IsNullOrEmpty(phase.Clock) ? $"p{p}" : phase.Clock;
            foreach (var hit in phase.Hits)
            {
                hit.PhaseIndex = p;
                hit.Clock = clock;
                hit.FlatIndex = Flat.Count;
                // Position within its clock: casts from the first few rows can start a new clock (a new phase).
                hit.ClockOrder = perClock.GetValueOrDefault(clock);
                perClock[clock] = hit.ClockOrder + 1;
                Flat.Add(hit);
            }
        }
    }
}

public sealed class PlanSource
{
    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
    public string Version { get; set; } = "";
    public string Url { get; set; } = "";
    public string Via { get; set; } = "";
}

/// <summary>A column of the sheet: a role position (MT, D1) or a job (Scholar).</summary>
public sealed class Slot
{
    public string Key { get; set; } = "";
    public string Label { get; set; } = "";

    /// <summary>tank, melee, ranged, caster or extras, when the column is for a position rather than a job.</summary>
    public string? Role { get; set; }

    /// <summary>Jobs the column is written for.</summary>
    public List<string>? Jobs { get; set; }
}

public sealed class Phase
{
    public string Name { get; set; } = "";

    /// <summary>Phases sharing a clock count time from the same zero (a savage fight); each ultimate phase has its own.</summary>
    public string Clock { get; set; } = "";

    public List<Hit> Hits { get; set; } = [];
    public List<string> Notes { get; set; } = [];
}

public sealed class Hit
{
    public string Name { get; set; } = "";

    /// <summary>The time as the sheet writes it ("0:42–1:01", "3:41").</summary>
    public string? Time { get; set; }

    /// <summary>Time from the pull, when <see cref="Time"/> is a phase time.</summary>
    public string? FightTime { get; set; }

    /// <summary>Seconds on the phase's clock, for following the fight.</summary>
    public int? T { get; set; }

    /// <summary>Seconds on the clock of the row's last hit, when the row covers a stretch.</summary>
    public int? TEnd { get; set; }

    /// <summary>Mits per slot key. Each line is used together; a carry line is still up from an earlier hit.</summary>
    public Dictionary<string, List<CellLine>> Cells { get; set; } = [];

    /// <summary>Boss casts this row is named after (game spelling).</summary>
    public List<string> Sync { get; set; } = [];

    /// <summary>Extra casts that put the clock at a set time when they finish.</summary>
    public List<SyncAt> SyncAt { get; set; } = [];

    /// <summary>A note for the whole party ("every remaining mitigation at once").</summary>
    public string? Note { get; set; }

    /// <summary>Set for rows that are instructions rather than a hit to mitigate.</summary>
    public List<string>? Info { get; set; }

    [JsonIgnore] public int PhaseIndex { get; set; }
    [JsonIgnore] public int FlatIndex { get; set; }
    [JsonIgnore] public string Clock { get; set; } = "";
    [JsonIgnore] public int ClockOrder { get; set; }
}

public sealed class CellLine
{
    public bool Carry { get; set; }
    public List<string> Items { get; set; } = [];
}

public sealed class SyncAt
{
    public string Name { get; set; } = "";
    public int At { get; set; }
}

/// <summary>A personal tank cooldown table (Ikuya's Omnitank tab), shown to tanks under the phase it belongs to.</summary>
public sealed class TankTable
{
    public string Phase { get; set; } = "";
    public List<string> Columns { get; set; } = [];
    public List<TankRow> Rows { get; set; } = [];
    public List<string> Notes { get; set; } = [];
}

public sealed class TankRow
{
    public string Name { get; set; } = "";
    public string Time { get; set; } = "";
    public List<CellLine> A { get; set; } = [];
    public List<CellLine> B { get; set; } = [];
}
