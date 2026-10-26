using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Dalamud.Bindings.ImGui;
using Dalamud.Game.ClientState.Objects.SubKinds;
using Dalamud.Interface.Utility.Raii;
using Dalamud.Interface.Windowing;
using VoiceLink.Speech;
using VoiceLink.Sync;

namespace VoiceLink.Windows;

public sealed class ConfigWindow : Window
{
    private static readonly string[] EngineLabels = ["Natural (online)", "Windows (offline)"];
    private static readonly Vector4 Warning = new(1f, 0.8f, 0.3f, 1f);
    private static readonly Vector4 Good = new(0.5f, 0.9f, 0.5f, 1f);

    private readonly Plugin plugin;
    private readonly Configuration config;

    private List<string> windowsVoices = [];
    private List<string> devices = [];
    private string testText = "Hi! Ready when you are.";
    private string broadcastText = "Testing, can you hear me?";
    private string newName = string.Empty;
    private string newWorld = string.Empty;

    public ConfigWindow(Plugin plugin)
        : base("Voice Link###VoiceLinkConfig", ImGuiWindowFlags.NoCollapse)
    {
        this.plugin = plugin;
        config = plugin.Configuration;
        Size = new Vector2(480, 560);
        SizeCondition = ImGuiCond.FirstUseEver;
    }

    public override void OnOpen()
    {
        // Both mean a COM or driver round trip, so only refresh when the window opens.
        windowsVoices = WindowsTts.InstalledVoices();
        devices = AudioOutput.Devices();
    }

    public override void Draw()
    {
        using var tabs = ImRaii.TabBar("tabs");
        if (!tabs)
            return;

        using (var tab = ImRaii.TabItem("Broadcast"))
        {
            if (tab)
                DrawBroadcast();
        }

        using (var tab = ImRaii.TabItem("Chat"))
        {
            if (tab)
                DrawChat();
        }

        using (var tab = ImRaii.TabItem("Voice"))
        {
            if (tab)
                DrawVoice();
        }

        using (var tab = ImRaii.TabItem($"Paired players ({config.Paired.Count})"))
        {
            if (tab)
                DrawPaired();
        }
    }

    private void DrawBroadcast()
    {
        var broadcaster = plugin.Broadcaster;

        ImGui.PushTextWrapPos();
        ImGui.TextUnformatted("Players synced with you (Lightless Sync and similar) hear your messages without installing Voice Link.");
        ImGui.TextDisabled($"Type /vl <message>. Your character does {Emotes.PhotographCommand}, and instead of the camera "
                           + "sound, everyone synced and nearby hears your message.");
        ImGui.PopTextWrapPos();
        ImGui.Spacing();

        Checkbox("Send /vl messages through mod sync", config.Broadcast, v =>
        {
            config.Broadcast = v;
            if (!v)
                broadcaster.PutSoundBack();
        }, "Off: /vl only speaks on your PC, and /photograph sounds normal again.");

        ImGui.Spacing();
        ImGui.TextDisabled("Checks");
        Check(broadcaster.PenumbraAvailable, "Penumbra is running", "Penumbra isn't running");
        var sync = Broadcaster.SyncPlugins();
        Check(sync.Length > 0, $"Sync plugin: {string.Join(", ", sync)}", "No sync plugin (Lightless Sync, Snowcloak...) is loaded");
        var photo = Emotes.Photograph is { } id && Emotes.CanUse(id);
        Check(photo, $"You can use {Emotes.PhotographCommand}",
            $"Can't use {Emotes.PhotographCommand} right now (not unlocked yet, or mounted / in combat)");
        if (broadcaster.PenumbraAvailable && broadcaster.PlayerCollection() is { Individual: false } shared)
        {
            ImGui.PushTextWrapPos();
            ImGui.TextColored(Warning, $"Your character uses the shared \"{shared.Name}\" collection, so other players' "
                                       + $"{Emotes.PhotographCommand} will play your clips on your screen. Assign yourself "
                                       + "a collection in Penumbra to avoid that.");
            ImGui.PopTextWrapPos();
        }

        ImGui.Spacing();
        ImGui.TextDisabled("Timing");
        SliderInt("Wait before the emote", config.SyncDelaySeconds, 2, 15, "%d s", v => config.SyncDelaySeconds = v);
        Tooltip("How long the sync gets to deliver the clip to everyone. Too short and they hear the previous message.");
        Checkbox("Redraw me after each clip", config.RedrawAfterClip, v => config.RedrawAfterClip = v,
            "Only needed for Mare-based sync other than Lightless (e.g. Snowcloak), which only notices changes on a redraw.");

        ImGui.Spacing();
        ImGui.TextDisabled("Send one");
        ImGui.SetNextItemWidth(260);
        var send = ImGui.InputText("##broadcast", ref broadcastText, 300, ImGuiInputTextFlags.EnterReturnsTrue);
        ImGui.SameLine();
        using (ImRaii.Disabled(broadcaster.Busy))
        {
            if ((ImGui.Button("Send") || send) && broadcastText.Trim().Length > 0)
                broadcaster.Send(broadcastText.Trim());
        }

        ImGui.TextUnformatted(broadcaster.Status);
        ImGui.PushTextWrapPos();
        if (broadcaster.Problem is { } problem)
            ImGui.TextColored(Warning, problem);

        ImGui.Spacing();
        ImGui.TextDisabled("Good to know");
        Bullet("The first message after you log in usually isn't heard: the sync learns about the sound the first time "
               + "you play it. Send a short test first.");
        Bullet("Each message takes about 10 seconds to be heard: the wait above, then the camera sound comes about 6 s into "
               + "the emote. Stand still until it plays; moving cancels the emote.");
        Bullet("Your character briefly redraws (flickers) on their screens with each message, as with any synced mod change.");
        Bullet("They need to be nearby, synced with you (directly or through a syncshell), with sound sync on.");
        Bullet("Clips are saved in your Penumbra folder under \"Voice Link clips\" and uploaded to your sync service.");
        ImGui.PopTextWrapPos();
    }

    private static void Check(bool ok, string good, string bad)
    {
        if (ok)
            ImGui.TextColored(Good, good);
        else
            ImGui.TextColored(Warning, bad);
    }

    private static void Bullet(string text)
    {
        ImGui.Bullet();
        ImGui.TextUnformatted(text);
    }

    private void DrawChat()
    {
        Checkbox("Read chat aloud", config.Enabled, v => config.Enabled = v, "Also /voicelink on and /voicelink off.");

        ImGui.Spacing();
        ImGui.TextDisabled("Whose messages");
        if (ImGui.RadioButton("Only paired players", config.OnlyPaired))
            Set(() => config.OnlyPaired = true);
        Tooltip("Add them on the Paired players tab.");
        if (ImGui.RadioButton("Everyone in the channels below", !config.OnlyPaired))
            Set(() => config.OnlyPaired = false);
        Checkbox("My own messages too", config.ReadOwnMessages, v => config.ReadOwnMessages = v,
            "Hear your messages the way your friends do.");
        Checkbox("Say who's talking first", config.SayNames, v => config.SayNames = v,
            "\"Alex says, ...\". Handy when reading more than one person.");

        ImGui.Spacing();
        ImGui.TextDisabled("Channels");
        using (var table = ImRaii.Table("channels", 2))
        {
            if (table)
            {
                foreach (var (label, types) in ChatListener.ChannelGroups)
                {
                    ImGui.TableNextColumn();
                    var on = types.All(config.Channels.Contains);
                    if (ImGui.Checkbox(label, ref on))
                    {
                        foreach (var type in types)
                        {
                            if (on)
                                config.Channels.Add(type);
                            else
                                config.Channels.Remove(type);
                        }

                        config.Save();
                    }
                }
            }
        }

        ImGui.Spacing();
        ImGui.TextDisabled("Long messages");
        SliderInt("Cut off after", config.MaxLength, 50, 1000, "%d characters", v => config.MaxLength = v);
    }

    private void DrawVoice()
    {
        var engine = (int)config.Engine;
        ImGui.SetNextItemWidth(260);
        using (var combo = ImRaii.Combo("Engine", EngineLabels[engine]))
        {
            if (combo)
            {
                for (var i = 0; i < EngineLabels.Length; i++)
                {
                    if (ImGui.Selectable(EngineLabels[i], i == engine))
                        Set(() => config.Engine = (VoiceEngine)i);
                }
            }
        }

        if (config.Engine == VoiceEngine.Natural)
        {
            if (VoiceCombo("Voice", config.Voice, null, out var picked))
                Set(() => config.Voice = picked!);
            SliderInt("Pitch", config.Pitch, -50, 50, "%+d Hz", v => config.Pitch = v);
            ImGui.PushTextWrapPos();
            ImGui.TextDisabled("Natural voices send the text being read to Microsoft's speech service (the one behind Edge's Read Aloud). "
                               + "If it can't be reached, the Windows voice fills in.");
            ImGui.PopTextWrapPos();
        }
        else
        {
            var current = config.WindowsVoice.Length == 0 ? "Automatic (first female voice)" : config.WindowsVoice;
            ImGui.SetNextItemWidth(260);
            using var combo = ImRaii.Combo("Voice##windows", current);
            if (combo)
            {
                if (ImGui.Selectable("Automatic (first female voice)", config.WindowsVoice.Length == 0))
                    Set(() => config.WindowsVoice = string.Empty);
                foreach (var name in windowsVoices)
                {
                    if (ImGui.Selectable(name, name == config.WindowsVoice))
                        Set(() => config.WindowsVoice = name);
                }
            }
        }

        SliderInt("Speed", config.Rate, -50, 100, "%+d%%", v => config.Rate = v);
        SliderInt("Volume", config.Volume, 0, 100, "%d%%", v => config.Volume = v);

        ImGui.SetNextItemWidth(260);
        using (var combo = ImRaii.Combo("Output", config.OutputDevice.Length == 0 ? "Windows default" : config.OutputDevice))
        {
            if (combo)
            {
                if (ImGui.Selectable("Windows default", config.OutputDevice.Length == 0))
                    Set(() => config.OutputDevice = string.Empty);
                foreach (var device in devices)
                {
                    if (ImGui.Selectable(device, device == config.OutputDevice))
                        Set(() => config.OutputDevice = device);
                }
            }
        }

        Tooltip("Pick a virtual audio cable (like VB-Audio's \"CABLE Input\") to send the voice into Discord as your mic.");

        ImGui.Spacing();
        ImGui.TextDisabled("Try it (only you hear this)");
        ImGui.SetNextItemWidth(260);
        var speak = ImGui.InputText("##test", ref testText, 300, ImGuiInputTextFlags.EnterReturnsTrue);
        ImGui.SameLine();
        if ((ImGui.Button("Speak") || speak) && testText.Trim().Length > 0)
            plugin.Speaker.Say(testText.Trim());
        ImGui.SameLine();
        if (ImGui.Button("Stop"))
            plugin.Speaker.Stop();

        if (plugin.Speaker.LastProblem is { } problem)
        {
            ImGui.Spacing();
            ImGui.PushTextWrapPos();
            ImGui.TextColored(Warning, problem);
            ImGui.PopTextWrapPos();
        }
    }

    private void DrawPaired()
    {
        ImGui.PushTextWrapPos();
        ImGui.TextDisabled("Their messages are read to you. For them to hear yours, they install Voice Link too and add you.");
        ImGui.PopTextWrapPos();
        ImGui.Spacing();

        if (ImGui.Button("Add my target"))
        {
            if (Plugin.TargetManager.Target is IPlayerCharacter target)
                AddPaired(target.Name.TextValue, target.HomeWorld.IsValid ? target.HomeWorld.Value.Name.ToString() : string.Empty);
        }

        Tooltip("Target a player first.");
        ImGui.SameLine();
        if (ImGui.Button("Add my party"))
        {
            var own = Plugin.PlayerState.IsLoaded ? Plugin.PlayerState.CharacterName : null;
            foreach (var member in Plugin.PartyList)
            {
                var name = member.Name.TextValue;
                if (name != own)
                    AddPaired(name, member.World.IsValid ? member.World.Value.Name.ToString() : string.Empty);
            }
        }

        ImGui.SetNextItemWidth(170);
        ImGui.InputTextWithHint("##name", "First Last", ref newName, 32);
        ImGui.SameLine();
        ImGui.SetNextItemWidth(110);
        ImGui.InputTextWithHint("##world", "World (optional)", ref newWorld, 32);
        ImGui.SameLine();
        using (ImRaii.Disabled(newName.Trim().Length == 0))
        {
            if (ImGui.Button("Add"))
            {
                AddPaired(newName.Trim(), newWorld.Trim());
                newName = string.Empty;
                newWorld = string.Empty;
            }
        }

        ImGui.Spacing();
        if (config.Paired.Count == 0)
        {
            ImGui.TextDisabled("Nobody yet.");
            return;
        }

        using var table = ImRaii.Table("paired", 3, ImGuiTableFlags.RowBg | ImGuiTableFlags.BordersInnerH);
        if (!table)
            return;

        ImGui.TableSetupColumn("Player", ImGuiTableColumnFlags.WidthStretch);
        ImGui.TableSetupColumn("Voice", ImGuiTableColumnFlags.WidthFixed, 190);
        ImGui.TableSetupColumn(string.Empty, ImGuiTableColumnFlags.WidthFixed, 60);
        ImGui.TableHeadersRow();

        PairedPlayer? remove = null;
        for (var i = 0; i < config.Paired.Count; i++)
        {
            var player = config.Paired[i];
            using var id = ImRaii.PushId(i);
            ImGui.TableNextRow();
            ImGui.TableNextColumn();
            ImGui.AlignTextToFramePadding();
            ImGui.TextUnformatted(player.Display);

            ImGui.TableNextColumn();
            ImGui.SetNextItemWidth(-1);
            if (VoiceCombo("##voice", player.Voice, "Main voice", out var picked))
                Set(() => player.Voice = picked ?? string.Empty);
            if (config.Engine == VoiceEngine.Windows)
                Tooltip("Per-player voices apply to the natural voices only.");

            ImGui.TableNextColumn();
            if (ImGui.Button("Remove"))
                remove = player;
        }

        if (remove != null)
            Set(() => config.Paired.Remove(remove));
    }

    private void AddPaired(string name, string world)
    {
        if (name.Length == 0)
            return;
        if (config.Paired.Any(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)
                                   && string.Equals(p.World, world, StringComparison.OrdinalIgnoreCase)))
            return;

        config.Paired.Add(new PairedPlayer { Name = name, World = world });
        config.Save();
    }

    /// <param name="defaultLabel">When set, offers that entry for "no voice of its own", picked as null.</param>
    private static bool VoiceCombo(string label, string current, string? defaultLabel, out string? picked)
    {
        picked = null;
        var preview = defaultLabel != null && current.Length == 0 ? defaultLabel : Voices.Label(current);
        if (!label.StartsWith("##", StringComparison.Ordinal))
            ImGui.SetNextItemWidth(260);
        using var combo = ImRaii.Combo(label, preview);
        if (!combo)
            return false;

        var changed = false;
        if (defaultLabel != null && ImGui.Selectable(defaultLabel, current.Length == 0))
            changed = true;
        foreach (var (id, name) in Voices.Natural)
        {
            if (ImGui.Selectable(name, id == current))
            {
                picked = id;
                changed = true;
            }
        }

        return changed;
    }

    private void Set(Action change)
    {
        change();
        config.Save();
    }

    private void Checkbox(string label, bool value, Action<bool> set, string? tooltip = null)
    {
        if (ImGui.Checkbox(label, ref value))
        {
            set(value);
            config.Save();
        }

        Tooltip(tooltip);
    }

    private void SliderInt(string label, int value, int min, int max, string format, Action<int> set)
    {
        ImGui.SetNextItemWidth(260);
        if (ImGui.SliderInt(label, ref value, min, max, format))
            set(value);

        // Save once the drag ends rather than every frame of it.
        if (ImGui.IsItemDeactivatedAfterEdit())
            config.Save();
    }

    private static void Tooltip(string? text)
    {
        if (text != null && ImGui.IsItemHovered())
            ImGui.SetTooltip(text);
    }
}
