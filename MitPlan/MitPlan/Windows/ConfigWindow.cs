using System;
using System.Diagnostics;
using System.IO;
using Dalamud.Bindings.ImGui;
using Dalamud.Interface.Colors;
using Dalamud.Interface.Utility.Raii;
using Dalamud.Interface.Windowing;

namespace MitPlan.Windows;

public sealed class ConfigWindow : Window
{
    private readonly Plugin plugin;
    private string? exportMessage;

    public ConfigWindow(Plugin plugin)
        : base("Mit Plan Settings###MitPlanConfig", ImGuiWindowFlags.AlwaysAutoResize | ImGuiWindowFlags.NoCollapse)
    {
        this.plugin = plugin;
    }

    private Configuration Config => plugin.Configuration;

    public override void Draw()
    {
        ImGui.TextDisabled("Opening");
        Checkbox("Open when you enter a fight with a plan", Config.OpenInDuty, v => Config.OpenInDuty = v);
        Checkbox("Show the fight you're in", Config.PickFightFromDuty, v => Config.PickFightFromDuty = v,
            "Off keeps whatever fight you picked last.");

        ImGui.Spacing();
        ImGui.TextDisabled("Following the fight");
        Checkbox("Follow the pull", Config.FollowFight, v => Config.FollowFight = v,
            "Starts a clock when you pull and keeps it in line with the boss's casts,\nhighlighting the hit happening now and the one coming up.");
        using (ImRaii.Disabled(!Config.FollowFight))
            Checkbox("Switch to the phase you're in", Config.FollowSwitchesPhase, v => Config.FollowSwitchesPhase = v);

        ImGui.Spacing();
        ImGui.TextDisabled("What to show");
        Checkbox("Action icons", Config.ShowIcons, v => Config.ShowIcons = v);
        Checkbox("Carried-over mits", Config.ShowCarryOver, v => Config.ShowCarryOver = v,
            "Lines marked with an arrow are mits still up from an earlier hit.");
        Checkbox("Other jobs' lines in your column (greyed)", Config.ShowOtherJobs, v => Config.ShowOtherJobs = v,
            "e.g. \"Party Mit (GNB/DRK)\" when you're on Warrior.");
        Checkbox("Hide hits with nothing for you", Config.HideEmptyHits, v => Config.HideEmptyHits = v);

        ImGui.Spacing();
        ImGui.TextDisabled("Window");
        Checkbox("Lock position and size", Config.LockWindow, v => Config.LockWindow = v);
        var opacity = Config.Opacity;
        ImGui.SetNextItemWidth(220);
        if (ImGui.SliderFloat("Background opacity", ref opacity, 0.1f, 1f, "%.2f"))
            Config.Opacity = opacity;
        if (ImGui.IsItemDeactivatedAfterEdit())
            Config.Save();

        ImGui.Spacing();
        ImGui.TextDisabled("Your own plans");
        ImGui.TextUnformatted("Plan .json files in the plans folder add fights, or replace a built-in one with the same id.");
        if (ImGui.Button("Open plans folder"))
        {
            Directory.CreateDirectory(plugin.Library.CustomFolder);
            Process.Start(new ProcessStartInfo(plugin.Library.CustomFolder) { UseShellExecute = true });
        }

        ImGui.SameLine();
        if (ImGui.Button("Copy built-in plans there"))
        {
            var n = plugin.Library.ExportBuiltIns();
            exportMessage = n > 0 ? $"Copied {n} plans. Edit them, then Reload." : "They're already there.";
        }

        if (ImGui.IsItemHovered())
            ImGui.SetTooltip("Starting points for your static's own mits. A copy replaces the built-in plan with the same id.");

        ImGui.SameLine();
        if (ImGui.Button("Reload"))
            plugin.ReloadPlans();

        if (exportMessage != null)
            ImGui.TextDisabled(exportMessage);

        ImGui.TextDisabled($"{plugin.Library.Plans.Count} plans loaded.");
        foreach (var error in plugin.Library.Errors)
            ImGui.TextColored(ImGuiColors.DalamudRed, error);
    }

    private void Checkbox(string label, bool value, Action<bool> set, string? tooltip = null)
    {
        if (ImGui.Checkbox(label, ref value))
        {
            set(value);
            Config.Save();
        }

        if (tooltip != null && ImGui.IsItemHovered())
            ImGui.SetTooltip(tooltip);
    }
}
