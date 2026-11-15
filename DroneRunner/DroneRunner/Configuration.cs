using System;
using Dalamud.Configuration;

namespace DroneRunner;

[Serializable]
public class Configuration : IPluginConfiguration
{
    public int Version { get; set; } = 0;

    /// <summary>Ride Mount Roulette for trips longer than <see cref="MountDistance"/>.</summary>
    public bool UseMount { get; set; } = true;
    public int MountDistance { get; set; } = 40;

    /// <summary>Stop after this many artifacts in one run (0 = until the modules run out).</summary>
    public int MaxArtifacts { get; set; } = 0;

    /// <summary>Print each record found in chat (local only).</summary>
    public bool EchoResults { get; set; } = true;

    // Lifetime tally
    public int TotalArtifacts { get; set; } = 0;
    public int TotalGold { get; set; } = 0;
    public int TotalSilver { get; set; } = 0;
    public int TotalBronze { get; set; } = 0;

    public void Save() => Plugin.PluginInterface.SavePluginConfig(this);
}
