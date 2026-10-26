using System;
using System.Collections.Generic;
using Dalamud.Configuration;
using Dalamud.Game.Text;
using Newtonsoft.Json;

namespace VoiceLink;

public enum VoiceEngine
{
    /// <summary>Microsoft's neural voices, online.</summary>
    Natural,
    /// <summary>The voices installed in Windows, offline.</summary>
    Windows,
}

[Serializable]
public class PairedPlayer
{
    public string Name { get; set; } = string.Empty;
    /// <summary>Home world; empty matches any.</summary>
    public string World { get; set; } = string.Empty;
    /// <summary>Natural voice id for this player; empty uses the main voice.</summary>
    public string Voice { get; set; } = string.Empty;

    public string Display => World.Length == 0 ? Name : $"{Name} @ {World}";
}

[Serializable]
public class Configuration : IPluginConfiguration
{
    public int Version { get; set; } = 0;

    public bool Enabled { get; set; } = true;

    // Who gets read
    /// <summary>Off reads everyone in the chosen channels, not just paired players.</summary>
    public bool OnlyPaired { get; set; } = true;
    public bool ReadOwnMessages { get; set; } = true;
    public bool SayNames { get; set; } = false;
    public List<PairedPlayer> Paired { get; set; } = [];

    // Replace rather than merge into the defaults on load, or unticked channels would come back.
    [JsonProperty(ObjectCreationHandling = ObjectCreationHandling.Replace)]
    public HashSet<XivChatType> Channels { get; set; } =
    [
        XivChatType.Party, XivChatType.CrossParty, XivChatType.Alliance,
        XivChatType.Say, XivChatType.TellIncoming, XivChatType.TellOutgoing,
    ];

    // Voice
    public VoiceEngine Engine { get; set; } = VoiceEngine.Natural;
    public string Voice { get; set; } = Speech.Voices.Default;
    /// <summary>Installed Windows voice name; empty picks the first female one.</summary>
    public string WindowsVoice { get; set; } = string.Empty;
    /// <summary>Speed change in percent.</summary>
    public int Rate { get; set; } = 0;
    /// <summary>Pitch change in Hz (natural voices only).</summary>
    public int Pitch { get; set; } = 0;
    /// <summary>0 to 100.</summary>
    public int Volume { get; set; } = 80;
    /// <summary>Playback device name; empty is the Windows default.</summary>
    public string OutputDevice { get; set; } = string.Empty;
    /// <summary>Longer messages are cut here so one wall of text can't hold up the queue.</summary>
    public int MaxLength { get; set; } = 300;

    // Broadcasting through mod sync
    /// <summary>When on, /voicelink &lt;text&gt; goes out through Lightless Sync instead of only playing here.</summary>
    public bool Broadcast { get; set; } = false;
    /// <summary>Time for the sync plugin to deliver the clip before the emote plays it.</summary>
    public int SyncDelaySeconds { get; set; } = 5;
    /// <summary>Mare-based sync other than Lightless only re-sends your mods after a redraw.</summary>
    public bool RedrawAfterClip { get; set; } = false;

    public void Save()
    {
        Plugin.PluginInterface.SavePluginConfig(this);
    }
}
