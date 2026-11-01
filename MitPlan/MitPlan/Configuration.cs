using System;
using System.Collections.Generic;
using Dalamud.Configuration;

namespace MitPlan;

[Serializable]
public class Configuration : IPluginConfiguration
{
    public int Version { get; set; } = 0;

    /// <summary>The fight shown, by plan id.</summary>
    public string? SelectedPlan { get; set; }

    /// <summary>A job to show instead of the one you're on (null follows your job).</summary>
    public string? JobOverride { get; set; }

    /// <summary>The column picked for each fight and job ("dmu:WAR" → "OT").</summary>
    public Dictionary<string, string> Slots { get; set; } = [];

    // Opening
    public bool OpenInDuty { get; set; } = true;
    public bool PickFightFromDuty { get; set; } = true;

    // Following the fight
    public bool FollowFight { get; set; } = true;
    public bool FollowSwitchesPhase { get; set; } = true;

    // What to show
    public bool PartyView { get; set; } = false;
    public bool HideEmptyHits { get; set; } = false;
    public bool ShowCarryOver { get; set; } = true;
    public bool ShowOtherJobs { get; set; } = true;
    public bool ShowIcons { get; set; } = true;

    // Window
    public bool LockWindow { get; set; } = false;
    public float Opacity { get; set; } = 0.9f;

    public void Save()
    {
        Plugin.PluginInterface.SavePluginConfig(this);
    }
}
