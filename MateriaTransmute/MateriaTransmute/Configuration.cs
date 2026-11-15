using System;
using System.Collections.Generic;
using Dalamud.Configuration;

namespace MateriaTransmute;

[Serializable]
public class Configuration : IPluginConfiguration
{
    public int Version { get; set; } = 0;

    /// <summary>Stats marked as junk, by Materia sheet row: every grade of them counts, even ones you get later.</summary>
    public HashSet<uint> TrashTypes { get; set; } = [];

    /// <summary>Single materia items marked as junk (one stat at one grade).</summary>
    public HashSet<uint> TrashItems { get; set; } = [];

    /// <summary>How many of each junk materia to hold back.</summary>
    public int KeepPerItem { get; set; } = 0;

    /// <summary>Stop after this many trades in one run (0 = until the junk runs out).</summary>
    public int MaxTrades { get; set; } = 0;

    /// <summary>Let one trade mix different stats of the same grade. Mutamix never gives back a stat you put in,
    /// so mixing junk stats rules more of them out of the result.</summary>
    public bool MixTypes { get; set; } = true;

    /// <summary>Print each trade's result in chat (local only, nobody else sees it).</summary>
    public bool EchoResults { get; set; } = true;

    public void Save() => Plugin.PluginInterface.SavePluginConfig(this);
}
