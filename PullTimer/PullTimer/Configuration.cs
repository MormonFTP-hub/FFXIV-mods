using System;
using Dalamud.Configuration;

namespace PullTimer;

public enum ChatMode
{
    Always,
    OnlyWhenOff,
    Never,
}

[Serializable]
public class Configuration : IPluginConfiguration
{
    public int Version { get; set; } = 0;

    // Chat
    public ChatMode PullChat { get; set; } = ChatMode.Always;
    public bool PrintOwnFirstHit { get; set; } = true;

    // Timing
    /// <summary>A pull within ± this many seconds of zero counts as on time.</summary>
    public float OnTimeWindow { get; set; } = 0.30f;
    /// <summary>Pulls later than this after the countdown ends are not linked to it.</summary>
    public float MaxLateSeconds { get; set; } = 20f;
    /// <summary>How long after the pull (or zero, whichever is later) to keep collecting party first hits.</summary>
    public float PartyWindowSeconds { get; set; } = 5f;
    public bool OnlyInDuties { get; set; } = false;

    // Overlay
    public bool ShowOverlay { get; set; } = true;
    public bool OverlayOnlyWhenActive { get; set; } = true;
    public bool LockOverlay { get; set; } = false;

    // History
    public int MaxHistory { get; set; } = 300;

    public void Save()
    {
        Plugin.PluginInterface.SavePluginConfig(this);
    }
}
