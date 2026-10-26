using System;
using System.Numerics;
using Dalamud.Bindings.ImGui;
using Dalamud.Interface.Colors;
using Dalamud.Interface.Windowing;
using PullTimer.Tracking;

namespace PullTimer.Windows;

/// <summary>Small always-on-top readout: live countdown to the millisecond, then the pull result.</summary>
public sealed class OverlayWindow : Window
{
    // In "only when active" mode, keep showing the result this long after the pull completes.
    private const double LingerSeconds = 15;

    private const ImGuiWindowFlags LockedFlags = ImGuiWindowFlags.NoMove | ImGuiWindowFlags.NoInputs;

    private readonly Plugin plugin;

    public OverlayWindow(Plugin plugin)
        : base("Pull Timer Overlay###PullTimerOverlay",
            ImGuiWindowFlags.NoTitleBar | ImGuiWindowFlags.NoScrollbar | ImGuiWindowFlags.NoCollapse |
            ImGuiWindowFlags.AlwaysAutoResize | ImGuiWindowFlags.NoFocusOnAppearing | ImGuiWindowFlags.NoNav)
    {
        this.plugin = plugin;
        IsOpen = true;
        RespectCloseHotkey = false;
    }

    public override bool DrawConditions()
    {
        var config = plugin.Configuration;
        if (!config.ShowOverlay)
            return false;
        if (!config.OverlayOnlyWhenActive)
            return true;
        return plugin.Tracker.Current != null || Clock.Now - plugin.Tracker.LastCompletedAt < LingerSeconds;
    }

    public override void PreDraw()
    {
        if (plugin.Configuration.LockOverlay)
            Flags |= LockedFlags;
        else
            Flags &= ~LockedFlags;

        ImGui.SetNextWindowBgAlpha(0.6f);
    }

    public override void Draw()
    {
        var now = Clock.Now;
        var window = plugin.Configuration.OnTimeWindow;
        var session = plugin.Tracker.Current;

        if (session is { CountdownRunning: true, EngagedAt: null })
        {
            BigText(ImGuiColors.DalamudWhite, $"{Math.Max(0, session.ExpectedZero - now):0.00}");
            ImGui.TextDisabled($"{session.CountdownSeconds}s countdown" + (session.StartedBy is { } by ? $" by {by}" : ""));
            return;
        }

        if (session is { EngagedAt: null, ReachedZero: true })
        {
            BigText(ImGuiColors.DalamudYellow, Timing.Signed(now - session.ExpectedZero));
            ImGui.TextDisabled("Countdown over, waiting for the pull");
            return;
        }

        if (session is { EngagedAt: not null, Announced: false })
        {
            BigText(ImGuiColors.DalamudViolet, "Pulling...");
            ImGui.TextDisabled("Waiting for the hit to land");
            return;
        }

        var record = session is { EngagedAt: not null } ? session.ToRecord() : plugin.History.Latest;
        if (record == null)
        {
            ImGui.TextDisabled("Pull Timer: waiting for a countdown");
            return;
        }

        BigText(Timing.Color(record.Offset, window), Timing.Describe(record.Offset, window));
        ImGui.TextUnformatted(Timing.Puller(record));

        if (!record.PullerIsYou && record.You is { } you && Timing.OwnHit(you) is { } hit)
        {
            ImGui.TextUnformatted($"You ({hit.Label}):");
            ImGui.SameLine();
            ImGui.TextColored(Timing.Color(hit.Offset, window), Timing.Signed(hit.Offset));
            ImGui.SameLine();
            ImGui.TextDisabled(you.Action ?? "?");
        }
    }

    private void BigText(Vector4 color, string text)
    {
        using (plugin.BigFont.Push())
            ImGui.TextColored(color, text);
    }
}
