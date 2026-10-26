using System;
using Dalamud.Bindings.ImGui;
using Dalamud.Interface.Utility.Raii;
using Dalamud.Interface.Windowing;

namespace PullTimer.Windows;

public sealed class ConfigWindow : Window
{
    private static readonly string[] ChatModeLabels = ["Always", "Only when early or late", "Never"];

    private readonly Configuration config;

    public ConfigWindow(Plugin plugin)
        : base("Pull Timer Settings###PullTimerConfig", ImGuiWindowFlags.AlwaysAutoResize | ImGuiWindowFlags.NoCollapse)
    {
        config = plugin.Configuration;
    }

    public override void Draw()
    {
        ImGui.TextDisabled("Chat (only you see these)");

        var chatMode = (int)config.PullChat;
        ImGui.SetNextItemWidth(220);
        using (var combo = ImRaii.Combo("Announce pulls", ChatModeLabels[chatMode]))
        {
            if (combo)
            {
                for (var i = 0; i < ChatModeLabels.Length; i++)
                {
                    if (ImGui.Selectable(ChatModeLabels[i], i == chatMode))
                    {
                        config.PullChat = (ChatMode)i;
                        config.Save();
                    }
                }
            }
        }

        Checkbox("Also print your own first hit", config.PrintOwnFirstHit, v => config.PrintOwnFirstHit = v);

        ImGui.Spacing();
        ImGui.TextDisabled("Timing");

        SliderFloat("On-time window (± s)", config.OnTimeWindow, 0.05f, 2f, "%.2f s", v => config.OnTimeWindow = v,
            "A pull this close to zero, either way, counts as on time.");
        SliderFloat("Ignore pulls later than", config.MaxLateSeconds, 5f, 60f, "%.0f s after zero", v => config.MaxLateSeconds = v,
            "If nobody pulls within this long after the countdown ends, it's dropped.");
        SliderFloat("Party first-hit window", config.PartyWindowSeconds, 1f, 15f, "%.1f s", v => config.PartyWindowSeconds = v,
            "How long after the pull (or zero, whichever is later) to keep recording each member's first hit.");
        Checkbox("Only track inside duties", config.OnlyInDuties, v => config.OnlyInDuties = v,
            "Off lets you practise on striking dummies.");

        ImGui.Spacing();
        ImGui.TextDisabled("Overlay");

        Checkbox("Show overlay", config.ShowOverlay, v => config.ShowOverlay = v);
        using (ImRaii.Disabled(!config.ShowOverlay))
        {
            Checkbox("Only during countdowns and just after", config.OverlayOnlyWhenActive, v => config.OverlayOnlyWhenActive = v);
            Checkbox("Lock overlay (click-through)", config.LockOverlay, v => config.LockOverlay = v);
        }

        ImGui.Spacing();
        ImGui.TextDisabled("History");

        var maxHistory = config.MaxHistory;
        ImGui.SetNextItemWidth(220);
        if (ImGui.SliderInt("Pulls to keep", ref maxHistory, 20, 2000))
            config.MaxHistory = maxHistory;
        if (ImGui.IsItemDeactivatedAfterEdit())
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

    private void SliderFloat(string label, float value, float min, float max, string format, Action<float> set, string? tooltip = null)
    {
        ImGui.SetNextItemWidth(220);
        if (ImGui.SliderFloat(label, ref value, min, max, format))
            set(value);

        // Save once the drag ends rather than every frame of it.
        if (ImGui.IsItemDeactivatedAfterEdit())
            config.Save();

        Tooltip(tooltip);
    }

    private static void Tooltip(string? text)
    {
        if (text != null && ImGui.IsItemHovered())
            ImGui.SetTooltip(text);
    }
}
