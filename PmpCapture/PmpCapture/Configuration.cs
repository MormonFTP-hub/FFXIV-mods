using System;
using Dalamud.Configuration;

namespace PmpCapture;

[Serializable]
public class Configuration : IPluginConfiguration
{
    public int Version { get; set; } = 0;

    /// <summary>Where captures go: one folder per capture. The PMP Viewer reads this folder.</summary>
    public string OutputDirectory { get; set; } = @"E:\FFXIV-mods\PmpViewer\work\ingame";
}
