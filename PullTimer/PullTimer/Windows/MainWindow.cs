using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text;
using Dalamud.Bindings.ImGui;
using Dalamud.Interface.Colors;
using Dalamud.Interface.Utility;
using Dalamud.Interface.Utility.Raii;
using Dalamud.Interface.Windowing;
using PullTimer.Tracking;

namespace PullTimer.Windows;

public sealed class MainWindow : Window
{
    private const string AllDuties = "All duties";

    private readonly Plugin plugin;
    private PullRecord? selected;
    private string dutyFilter = AllDuties;

    public MainWindow(Plugin plugin)
        : base("Pull Timer###PullTimerMain")
    {
        SizeConstraints = new WindowSizeConstraints
        {
            MinimumSize = new Vector2(520, 360),
            MaximumSize = new Vector2(float.MaxValue, float.MaxValue),
        };

        this.plugin = plugin;
    }

    private float Window => plugin.Configuration.OnTimeWindow;

    public override void Draw()
    {
        DrawStatus();

        ImGui.SameLine(ImGui.GetContentRegionMax().X - (70 * ImGuiHelpers.GlobalScale));
        if (ImGui.Button("Settings"))
            plugin.ToggleConfigUi();

        ImGui.Separator();

        using var tabs = ImRaii.TabBar("##tabs");
        if (!tabs)
            return;

        using (var tab = ImRaii.TabItem("Last pull"))
        {
            if (tab)
                DrawLastPull();
        }

        using (var tab = ImRaii.TabItem("History"))
        {
            if (tab)
                DrawHistory();
        }

        using (var tab = ImRaii.TabItem("Stats"))
        {
            if (tab)
                DrawStats();
        }
    }

    private void DrawStatus()
    {
        var now = Clock.Now;
        switch (plugin.Tracker.Current)
        {
            case null:
                ImGui.TextDisabled("Idle. Start a countdown (e.g. /countdown 10) and pull.");
                break;
            case { EngagedAt: not null, Announced: false }:
                ImGui.TextColored(ImGuiColors.DalamudViolet, "Pulling, waiting for the hit to land...");
                break;
            case { EngagedAt: not null }:
                ImGui.TextColored(ImGuiColors.DalamudViolet, "Pulled, collecting party first hits...");
                break;
            case { CountdownRunning: true } s:
                ImGui.TextColored(ImGuiColors.DalamudWhite, $"Countdown: {Math.Max(0, s.ExpectedZero - now):0.00}s left");
                ImGui.SameLine();
                ImGui.TextDisabled($"({s.CountdownSeconds}s{(s.StartedBy is { } by ? $" by {by}" : "")})");
                break;
            case { ReachedZero: true } s:
                ImGui.TextColored(ImGuiColors.DalamudYellow, $"Countdown over, waiting for the pull ({Timing.Signed(now - s.ExpectedZero)})");
                break;
            default:
                ImGui.TextDisabled("Countdown stopped.");
                break;
        }
    }

    private void DrawLastPull()
    {
        var session = plugin.Tracker.Current;
        var record = session is { EngagedAt: not null, Announced: true } ? session.ToRecord() : plugin.History.Latest;
        if (record == null)
        {
            ImGui.TextWrapped("No pulls yet. Use a countdown and the result shows up here, in chat, and on the overlay.");
            return;
        }

        DrawRecord(record);
    }

    private void DrawRecord(PullRecord record)
    {
        using (plugin.BigFont.Push())
            ImGui.TextColored(Timing.Color(record.Offset, Window), Timing.Describe(record.Offset, Window));

        ImGui.TextWrapped(Timing.Puller(record));
        ImGui.TextDisabled($"{record.Duty} · {record.CountdownSeconds}s countdown"
                           + (record.CountdownBy is { } by ? $" by {by}" : "")
                           + $" · {record.Time:g}");

        if (ImGui.Button("Copy summary"))
            ImGui.SetClipboardText(Timing.Summary(record, Window));
        if (ImGui.IsItemHovered())
            ImGui.SetTooltip("Copies a one-line summary so you can paste it into party chat yourself.");

        ImGui.Spacing();
        ImGui.TextUnformatted("First hit on the enemy");
        HelpMarker("Each person's first action against an enemy, relative to countdown zero.\n"
                   + "Landed: when the enemy took the hit (the server confirmed the effect on it).\n"
                   + "Went off: when the action resolved (cast finished or instant used). The gap is the action's animation delay.\n"
                   + "Times are when your client saw them, so they include latency.");

        using (var table = ImRaii.Table("##party", 6, ImGuiTableFlags.RowBg | ImGuiTableFlags.BordersInnerV | ImGuiTableFlags.SizingStretchProp))
        {
            if (table)
            {
                ImGui.TableSetupColumn("Name", ImGuiTableColumnFlags.WidthStretch, 2f);
                ImGui.TableSetupColumn("Job", ImGuiTableColumnFlags.WidthFixed, 40 * ImGuiHelpers.GlobalScale);
                ImGui.TableSetupColumn("Action", ImGuiTableColumnFlags.WidthStretch, 2f);
                ImGui.TableSetupColumn("Landed", ImGuiTableColumnFlags.WidthFixed, 60 * ImGuiHelpers.GlobalScale);
                ImGui.TableSetupColumn("Went off", ImGuiTableColumnFlags.WidthFixed, 60 * ImGuiHelpers.GlobalScale);
                ImGui.TableSetupColumn("Cast from", ImGuiTableColumnFlags.WidthFixed, 70 * ImGuiHelpers.GlobalScale);
                ImGui.TableHeadersRow();

                foreach (var member in record.Party)
                {
                    ImGui.TableNextRow();
                    ImGui.TableNextColumn();
                    using (ImRaii.PushColor(ImGuiCol.Text, ImGuiColors.DalamudOrange, member.IsYou))
                        ImGui.TextUnformatted(member.IsYou ? $"{member.Name} (you)" : member.Name);
                    ImGui.TableNextColumn();
                    ImGui.TextUnformatted(member.Job);
                    ImGui.TableNextColumn();
                    if (member.Action != null)
                        ImGui.TextUnformatted(member.Action);
                    else
                        ImGui.TextDisabled("no hit");
                    ImGui.TableNextColumn();
                    if (member.Landed is { } landed)
                        ImGui.TextColored(Timing.Color(landed, Window), Timing.Signed(landed));
                    else if (member.WentOff != null)
                        ImGui.TextDisabled("not seen");
                    ImGui.TableNextColumn();
                    if (member.WentOff is { } wentOff)
                        ImGui.TextUnformatted(Timing.Signed(wentOff));
                    ImGui.TableNextColumn();
                    if (member.CastStart is { } cast)
                        ImGui.TextDisabled(Timing.Signed(cast));
                }
            }
        }

        if (record.YourActions.Count == 0)
            return;

        ImGui.Spacing();
        ImGui.TextUnformatted("Your actions");
        HelpMarker("Everything you used from the countdown start until the party window closed, so you can check your pre-pull timings.");

        using var actions = ImRaii.Table("##yours", 4, ImGuiTableFlags.RowBg | ImGuiTableFlags.BordersInnerV | ImGuiTableFlags.SizingStretchProp);
        if (!actions)
            return;

        ImGui.TableSetupColumn("Action", ImGuiTableColumnFlags.WidthStretch, 3f);
        ImGui.TableSetupColumn("Went off", ImGuiTableColumnFlags.WidthFixed, 60 * ImGuiHelpers.GlobalScale);
        ImGui.TableSetupColumn("Landed", ImGuiTableColumnFlags.WidthFixed, 60 * ImGuiHelpers.GlobalScale);
        ImGui.TableSetupColumn("Cast from", ImGuiTableColumnFlags.WidthFixed, 70 * ImGuiHelpers.GlobalScale);
        ImGui.TableHeadersRow();

        foreach (var action in record.YourActions)
        {
            ImGui.TableNextRow();
            ImGui.TableNextColumn();
            ImGui.TextUnformatted(action.Name);
            ImGui.TableNextColumn();
            ImGui.TextUnformatted(Timing.Signed(action.Offset));
            ImGui.TableNextColumn();
            if (action.Landed is { } landed)
                ImGui.TextUnformatted(Timing.Signed(landed));
            else if (action.Hostile)
                ImGui.TextDisabled("not seen");
            ImGui.TableNextColumn();
            if (action.CastStart is { } cast)
                ImGui.TextDisabled(Timing.Signed(cast));
        }
    }

    private void DrawHistory()
    {
        var records = plugin.History.Records;
        if (records.Count == 0)
        {
            ImGui.TextDisabled("No pulls recorded yet.");
            return;
        }

        if (selected != null && !records.Contains(selected))
            selected = null;

        var footer = ImGui.GetFrameHeightWithSpacing();
        var height = selected != null ? ImGui.GetContentRegionAvail().Y * 0.4f : -footer;

        using (var table = ImRaii.Table("##history", 6,
                   ImGuiTableFlags.RowBg | ImGuiTableFlags.BordersInnerV | ImGuiTableFlags.ScrollY | ImGuiTableFlags.SizingStretchProp,
                   new Vector2(0, height)))
        {
            if (table)
            {
                ImGui.TableSetupScrollFreeze(0, 1);
                ImGui.TableSetupColumn("When", ImGuiTableColumnFlags.WidthFixed, 95 * ImGuiHelpers.GlobalScale);
                ImGui.TableSetupColumn("Duty", ImGuiTableColumnFlags.WidthStretch, 3f);
                ImGui.TableSetupColumn("CD", ImGuiTableColumnFlags.WidthFixed, 30 * ImGuiHelpers.GlobalScale);
                ImGui.TableSetupColumn("Pull", ImGuiTableColumnFlags.WidthFixed, 60 * ImGuiHelpers.GlobalScale);
                ImGui.TableSetupColumn("Puller", ImGuiTableColumnFlags.WidthStretch, 2f);
                ImGui.TableSetupColumn("You", ImGuiTableColumnFlags.WidthFixed, 60 * ImGuiHelpers.GlobalScale);
                ImGui.TableHeadersRow();

                for (var i = records.Count - 1; i >= 0; i--)
                {
                    var record = records[i];
                    ImGui.TableNextRow();
                    ImGui.TableNextColumn();
                    if (ImGui.Selectable($"{record.Time:MM-dd HH:mm}##{i}", selected == record, ImGuiSelectableFlags.SpanAllColumns))
                        selected = selected == record ? null : record;
                    ImGui.TableNextColumn();
                    ImGui.TextUnformatted(record.Duty);
                    ImGui.TableNextColumn();
                    ImGui.TextUnformatted($"{record.CountdownSeconds}s");
                    ImGui.TableNextColumn();
                    ImGui.TextColored(Timing.Color(record.Offset, Window), Timing.Signed(record.Offset));
                    ImGui.TableNextColumn();
                    if (record.PullerIsYou)
                        ImGui.TextColored(ImGuiColors.DalamudOrange, "You");
                    else if (record.PullerName != null)
                        ImGui.TextUnformatted($"{record.PullerName} ({record.PullerJob})");
                    else
                        ImGui.TextDisabled("unknown");
                    ImGui.TableNextColumn();
                    if (record.You?.Landed is { } own)
                        ImGui.TextColored(Timing.Color(own, Window), Timing.Signed(own));
                }
            }
        }

        if (ImGui.Button("Copy as CSV"))
            ImGui.SetClipboardText(ToCsv(records));

        ImGui.SameLine();
        var ctrl = ImGui.GetIO().KeyCtrl;
        using (ImRaii.Disabled(!ctrl))
        {
            if (ImGui.Button("Clear history"))
            {
                plugin.History.Clear();
                selected = null;
            }
        }

        if (ImGui.IsItemHovered(ImGuiHoveredFlags.AllowWhenDisabled))
            ImGui.SetTooltip("Hold Ctrl to clear.");

        if (selected == null)
            return;

        ImGui.Separator();
        using var child = ImRaii.Child("##selected", Vector2.Zero);
        if (child)
            DrawRecord(selected);
    }

    private void DrawStats()
    {
        var all = plugin.History.Records;
        if (all.Count == 0)
        {
            ImGui.TextDisabled("No pulls recorded yet.");
            return;
        }

        var duties = all.AsEnumerable().Reverse().Select(r => r.Duty).Distinct().ToList();
        if (dutyFilter != AllDuties && !duties.Contains(dutyFilter))
            dutyFilter = AllDuties;

        ImGui.SetNextItemWidth(260 * ImGuiHelpers.GlobalScale);
        using (var combo = ImRaii.Combo("##duty", dutyFilter))
        {
            if (combo)
            {
                if (ImGui.Selectable(AllDuties, dutyFilter == AllDuties))
                    dutyFilter = AllDuties;
                foreach (var duty in duties)
                {
                    if (ImGui.Selectable(duty, dutyFilter == duty))
                        dutyFilter = duty;
                }
            }
        }

        var records = dutyFilter == AllDuties ? all : all.Where(r => r.Duty == dutyFilter).ToList();
        if (records.Count == 0)
            return;

        var early = records.Count(r => Timing.Classify(r.Offset, Window) == PullTiming.Early);
        var late = records.Count(r => Timing.Classify(r.Offset, Window) == PullTiming.Late);
        var onTime = records.Count - early - late;

        ImGui.Spacing();
        ImGui.TextUnformatted($"{records.Count} pulls:");
        ImGui.SameLine();
        ImGui.TextColored(Timing.Color(PullTiming.Early), $"{early} early");
        ImGui.SameLine();
        ImGui.TextColored(Timing.Color(PullTiming.OnTime), $"{onTime} on time");
        ImGui.SameLine();
        ImGui.TextColored(Timing.Color(PullTiming.Late), $"{late} late");

        var offsets = records.Select(r => r.Offset).ToList();
        ImGui.TextUnformatted($"Pull timing: average {Timing.Signed(offsets.Average())}, median {Timing.Signed(Median(offsets))}");

        var own = records.Select(r => r.You?.Landed).OfType<double>().ToList();
        ImGui.Spacing();
        ImGui.TextUnformatted("Your first hit (when it landed)");
        if (own.Count == 0)
        {
            ImGui.TextDisabled("No hits recorded for you yet.");
        }
        else
        {
            var mean = own.Average();
            var spread = Math.Sqrt(own.Average(v => (v - mean) * (v - mean)));
            ImGui.TextUnformatted($"Average {Timing.Signed(mean)} · median {Timing.Signed(Median(own))} · typically off by {own.Average(Math.Abs):0.00}s");
            ImGui.TextUnformatted($"Closest {Timing.Signed(own.MinBy(Math.Abs))} · furthest {Timing.Signed(own.MaxBy(Math.Abs))} · consistency ±{spread:0.00}s over {own.Count} pulls");
        }

        var earlyPullers = records
            .Where(r => r.PullerName != null && Timing.Classify(r.Offset, Window) == PullTiming.Early)
            .GroupBy(r => r.PullerIsYou ? "You" : $"{r.PullerName} ({r.PullerJob})")
            .Select(g => (Name: g.Key, Count: g.Count(), Average: g.Average(r => r.Offset)))
            .OrderByDescending(g => g.Count)
            .ThenBy(g => g.Average)
            .Take(10)
            .ToList();

        if (earlyPullers.Count == 0)
            return;

        ImGui.Spacing();
        ImGui.TextUnformatted("Most early pulls");
        using var table = ImRaii.Table("##earlypullers", 3, ImGuiTableFlags.RowBg | ImGuiTableFlags.BordersInnerV | ImGuiTableFlags.SizingStretchProp);
        if (!table)
            return;

        ImGui.TableSetupColumn("Who", ImGuiTableColumnFlags.WidthStretch, 3f);
        ImGui.TableSetupColumn("Early pulls", ImGuiTableColumnFlags.WidthFixed, 80 * ImGuiHelpers.GlobalScale);
        ImGui.TableSetupColumn("Avg", ImGuiTableColumnFlags.WidthFixed, 60 * ImGuiHelpers.GlobalScale);
        ImGui.TableHeadersRow();
        foreach (var (name, count, average) in earlyPullers)
        {
            ImGui.TableNextRow();
            ImGui.TableNextColumn();
            ImGui.TextUnformatted(name);
            ImGui.TableNextColumn();
            ImGui.TextUnformatted(count.ToString());
            ImGui.TableNextColumn();
            ImGui.TextColored(Timing.Color(PullTiming.Early), Timing.Signed(average));
        }
    }

    private static double Median(List<double> values)
    {
        var sorted = values.Order().ToList();
        var mid = sorted.Count / 2;
        return sorted.Count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    private static string ToCsv(IEnumerable<PullRecord> records)
    {
        static string Q(string? s) => s == null ? "" : $"\"{s.Replace("\"", "\"\"")}\"";
        static string N(double? v) => v?.ToString("0.000", System.Globalization.CultureInfo.InvariantCulture) ?? "";

        var sb = new StringBuilder("time,duty,countdown_s,pull_offset_s,pull_landed,puller,puller_job,puller_action,puller_went_off_s,"
                                   + "your_action,your_landed_s,your_went_off_s\n");
        foreach (var r in records)
        {
            var you = r.You;
            sb.Append($"{r.Time:yyyy-MM-dd HH:mm:ss},{Q(r.Duty)},{r.CountdownSeconds},{N(r.Offset)},{(r.PullLanded ? 1 : 0)},")
              .Append($"{Q(r.PullerIsYou ? "You" : r.PullerName)},{Q(r.PullerJob)},{Q(r.PullerAction)},{N(r.PullerWentOff)},")
              .Append($"{Q(you?.Action)},{N(you?.Landed)},{N(you?.WentOff)}\n");
        }

        return sb.ToString();
    }

    private static void HelpMarker(string text)
    {
        ImGui.SameLine();
        ImGui.TextDisabled("(?)");
        if (ImGui.IsItemHovered())
            ImGui.SetTooltip(text);
    }
}
