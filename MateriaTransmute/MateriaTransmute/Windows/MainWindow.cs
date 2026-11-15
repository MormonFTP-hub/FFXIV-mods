using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Dalamud.Bindings.ImGui;
using Dalamud.Interface.Colors;
using Dalamud.Interface.Textures;
using Dalamud.Interface.Utility;
using Dalamud.Interface.Utility.Raii;
using Dalamud.Interface.Windowing;

namespace MateriaTransmute.Windows;

public sealed class MainWindow : Window
{
    private static readonly Vector4 Dim = ImGuiColors.DalamudGrey;
    private static readonly Vector4 Good = ImGuiColors.HealerGreen;
    private static readonly Vector4 Warn = ImGuiColors.DalamudOrange;
    private static readonly Vector4 Gold = ImGuiColors.DalamudYellow;
    private static readonly Vector4 GradeUpRow = new(0.95f, 0.75f, 0.15f, 0.18f);

    private readonly Plugin plugin;
    private List<MateriaStack> stacks = [];
    private DateTime lastScan;
    private string filter = "";

    public MainWindow(Plugin plugin)
        : base("Materia Transmuter###MateriaTransmuteMain")
    {
        this.plugin = plugin;
        Size = new Vector2(600, 520);
        SizeCondition = ImGuiCond.FirstUseEver;
        SizeConstraints = new WindowSizeConstraints { MinimumSize = new Vector2(420, 300), MaximumSize = new Vector2(2000, 2000) };
    }

    private Configuration Config => plugin.Configuration;

    public override void Draw()
    {
        if (DateTime.UtcNow - lastScan > TimeSpan.FromMilliseconds(500))
        {
            stacks = GameUi.ScanBags(plugin.Catalog);
            lastScan = DateTime.UtcNow;
        }

        DrawHeader();
        ImGui.Separator();

        using var tabs = ImRaii.TabBar("##tabs");
        if (!tabs)
            return;

        using (var tab = ImRaii.TabItem("Pick junk"))
        {
            if (tab)
                DrawPicker();
        }

        using (var tab = ImRaii.TabItem($"Results ({plugin.Transmuter.Results.Count})###results"))
        {
            if (tab)
                DrawResults();
        }

        using (var tab = ImRaii.TabItem("Settings"))
        {
            if (tab)
                DrawSettings();
        }

        using (var tab = ImRaii.TabItem("How it works"))
        {
            if (tab)
                DrawHelp();
        }
    }

    private void DrawHeader()
    {
        var t = plugin.Transmuter;
        var scale = ImGuiHelpers.GlobalScale;

        if (t.Running)
        {
            using (ImRaii.PushColor(ImGuiCol.Button, new Vector4(0.6f, 0.15f, 0.15f, 1f)))
            {
                if (ImGui.Button("Stop", new Vector2(110 * scale, 0)))
                    t.Stop("Stopped.");
            }

            ImGui.SameLine();
            ImGui.TextColored(Gold, $"Trade {t.TradesThisRun + 1}: {t.Status}");
            return;
        }

        var reason = t.CantStart();
        var trades = Planner.CountTrades(stacks, Config);
        using (ImRaii.Disabled(reason != null))
        {
            using (ImRaii.PushColor(ImGuiCol.Button, new Vector4(0.15f, 0.45f, 0.2f, 1f), reason == null))
            {
                if (ImGui.Button("Start", new Vector2(110 * scale, 0)))
                    t.Start();
            }
        }

        ImGui.SameLine();
        if (reason != null)
            ImGui.TextColored(Warn, reason);
        else
            ImGui.TextColored(Good, $"Ready: {trades} trade{(trades == 1 ? "" : "s")} of junk in your bags.");

        if (t.Status != "Idle" && t.Status != reason)
            ImGui.TextColored(Dim, $"Last run: {t.Status}");

        if (Transmuter.FindMutamix() is not { } npc || Transmuter.Distance(npc) > Transmuter.TalkRange)
        {
            ImGui.TextColored(Dim, "Mutamix Bubblypots is at the Bonfire in Central Thanalan (X 23.7, Y 13.6).");
            ImGui.SameLine();
            if (ImGui.SmallButton("Show on map"))
                Plugin.FlagMutamix();
        }
    }

    private void DrawPicker()
    {
        ImGui.TextWrapped("Tick the materia Mutamix can have. A tick on a stat's name covers every grade of it, including ones you get later. "
                          + "Each trade is five of one grade. He never gives back a stat you put in, and now and then the result is a grade higher.");

        ImGui.SetNextItemWidth(200 * ImGuiHelpers.GlobalScale);
        ImGui.InputTextWithHint("##filter", "Filter stats", ref filter, 64);
        ImGui.SameLine();
        if (ImGui.Button("Untick everything"))
        {
            Config.TrashTypes.Clear();
            Config.TrashItems.Clear();
            Config.Save();
        }

        var owned = stacks.GroupBy(s => s.Materia.ItemId).ToDictionary(g => g.Key, g => g.Sum(s => s.Quantity));
        var types = stacks.Select(s => s.Materia.TypeId).Concat(Config.TrashTypes).Distinct()
            .Where(id => filter.Length == 0 || plugin.Catalog.TypeName(id).Contains(filter, StringComparison.OrdinalIgnoreCase))
            .OrderBy(id => id)
            .ToList();
        var grades = stacks.Select(s => s.Materia.Grade).Distinct().OrderByDescending(g => g).ToList();

        if (types.Count == 0)
        {
            ImGui.Spacing();
            ImGui.TextColored(Dim, stacks.Count == 0 ? "No materia in your bags." : "No stat matches the filter.");
            DrawJunkSummary();
            return;
        }

        var scale = ImGuiHelpers.GlobalScale;
        var footer = ImGui.GetFrameHeightWithSpacing() * 2;
        using (var table = ImRaii.Table("##grid", grades.Count + 1,
                   ImGuiTableFlags.Borders | ImGuiTableFlags.RowBg | ImGuiTableFlags.ScrollX | ImGuiTableFlags.ScrollY | ImGuiTableFlags.SizingFixedFit,
                   new Vector2(0, -footer)))
        {
            if (table)
            {
                ImGui.TableSetupScrollFreeze(1, 1);
                ImGui.TableSetupColumn("Stat (all grades)", ImGuiTableColumnFlags.WidthFixed, 170 * scale);
                foreach (var g in grades)
                    ImGui.TableSetupColumn(MateriaCatalog.Roman(g), ImGuiTableColumnFlags.WidthFixed, 74 * scale);
                ImGui.TableHeadersRow();

                foreach (var typeId in types)
                {
                    ImGui.TableNextRow();
                    ImGui.TableNextColumn();
                    var typeTrash = Config.TrashTypes.Contains(typeId);
                    if (ImGui.Checkbox($"{plugin.Catalog.TypeName(typeId)}##type{typeId}", ref typeTrash))
                    {
                        if (typeTrash)
                            Config.TrashTypes.Add(typeId);
                        else
                            Config.TrashTypes.Remove(typeId);
                        Config.Save();
                    }

                    if (ImGui.IsItemHovered())
                        ImGui.SetTooltip(typeTrash ? "Every grade of this stat is junk." : "Tick to make every grade of this stat junk.");

                    foreach (var grade in grades)
                    {
                        ImGui.TableNextColumn();
                        if (plugin.Catalog.Find(typeId, grade) is not { } item || !owned.TryGetValue(item.ItemId, out var count))
                            continue;
                        DrawCell(item, count, typeTrash);
                    }
                }
            }
        }

        DrawJunkSummary();
    }

    private void DrawCell(MateriaItem item, int count, bool typeTrash)
    {
        var scale = ImGuiHelpers.GlobalScale;
        var on = typeTrash || Config.TrashItems.Contains(item.ItemId);
        using (ImRaii.Disabled(typeTrash))
        {
            if (ImGui.Checkbox($"##item{item.ItemId}", ref on))
            {
                if (on)
                    Config.TrashItems.Add(item.ItemId);
                else
                    Config.TrashItems.Remove(item.ItemId);
                Config.Save();
            }
        }

        var hovered = ImGui.IsItemHovered(ImGuiHoveredFlags.AllowWhenDisabled);
        ImGui.SameLine(0, 2 * scale);
        DrawIcon(item.Icon, ImGui.GetFrameHeight());
        hovered |= ImGui.IsItemHovered();
        ImGui.SameLine(0, 3 * scale);
        ImGui.AlignTextToFramePadding();
        if (on)
            ImGui.TextColored(Warn, $"{count}");
        else
            ImGui.TextUnformatted($"{count}");
        hovered |= ImGui.IsItemHovered();

        if (hovered)
        {
            var spare = on ? Planner.SpareOf(stacks, Config, item.ItemId) : 0;
            ImGui.SetTooltip($"{item.Name}\n{count} in your bags"
                             + (on ? $"\nJunk: {spare} can go{(Config.KeepPerItem > 0 ? $" (keeping {Math.Min(Config.KeepPerItem, count)})" : "")}" : "")
                             + (typeTrash ? "\n(the whole stat is ticked)" : ""));
        }
    }

    private void DrawJunkSummary()
    {
        var junk = stacks.Where(s => Planner.IsTrash(Config, s.Materia)).Sum(s => s.Quantity);
        var trades = Planner.CountTrades(stacks, Config);
        ImGui.TextColored(junk > 0 ? Warn : Dim,
            junk == 0 ? "Nothing ticked yet." : $"{junk} junk materia in your bags, enough for {trades} trade{(trades == 1 ? "" : "s")} right now.");
        if (junk > 0 && trades == 0)
            ImGui.TextColored(Dim, "A trade needs five junk materia of the same grade.");
    }

    private void DrawResults()
    {
        var t = plugin.Transmuter;
        var gradeUps = t.Results.Count(r => r.GradeUp);
        ImGui.TextUnformatted($"This session: {t.Results.Count} trade{(t.Results.Count == 1 ? "" : "s")}, {gradeUps} grade-up{(gradeUps == 1 ? "" : "s")}.");
        ImGui.SameLine();
        ImGui.TextColored(Dim, $"All time: {Config.TotalTrades} trades, {Config.TotalGradeUps} grade-ups"
                               + (Config.TotalTrades > 0 ? $" ({100.0 * Config.TotalGradeUps / Config.TotalTrades:0.#}%)" : "") + ".");

        if (t.Results.Count == 0)
        {
            ImGui.Spacing();
            ImGui.TextColored(Dim, "Every trade shows up here: what went in and what came back.");
            return;
        }

        if (ImGui.SmallButton("Clear list"))
            t.Results.Clear();

        var scale = ImGuiHelpers.GlobalScale;
        using var table = ImRaii.Table("##results", 3, ImGuiTableFlags.Borders | ImGuiTableFlags.RowBg | ImGuiTableFlags.ScrollY);
        if (!table)
            return;

        ImGui.TableSetupScrollFreeze(0, 1);
        ImGui.TableSetupColumn("Time", ImGuiTableColumnFlags.WidthFixed, 64 * scale);
        ImGui.TableSetupColumn("Gave", ImGuiTableColumnFlags.WidthStretch, 1.2f);
        ImGui.TableSetupColumn("Got", ImGuiTableColumnFlags.WidthStretch, 1f);
        ImGui.TableHeadersRow();

        foreach (var r in t.Results.ToList())
        {
            ImGui.TableNextRow();
            if (r.GradeUp)
                ImGui.TableSetBgColor(ImGuiTableBgTarget.RowBg1, ImGui.GetColorU32(GradeUpRow));

            ImGui.TableNextColumn();
            ImGui.TextColored(Dim, r.Time.ToString("HH:mm:ss"));
            ImGui.TableNextColumn();
            ImGui.TextWrapped(r.Gave);
            ImGui.TableNextColumn();
            if (r.Got == null)
            {
                ImGui.TextColored(Dim, "(not seen)");
                continue;
            }

            DrawIcon(r.Got.Icon, ImGui.GetTextLineHeight() * 1.3f);
            ImGui.SameLine();
            var name = (r.GotCount > 1 ? $"{r.GotCount}× " : "") + r.Got.Name;
            if (r.GradeUp)
                ImGui.TextColored(Gold, $"{name}  ★ grade up");
            else
                ImGui.TextUnformatted(name);
        }
    }

    private void DrawSettings()
    {
        var scale = ImGuiHelpers.GlobalScale;

        var keep = Config.KeepPerItem;
        ImGui.SetNextItemWidth(110 * scale);
        if (ImGui.InputInt("Keep at least this many of each junk materia", ref keep))
        {
            Config.KeepPerItem = Math.Clamp(keep, 0, 999);
            Config.Save();
        }

        var max = Config.MaxTrades;
        ImGui.SetNextItemWidth(110 * scale);
        if (ImGui.InputInt("Stop after this many trades (0 = until the junk runs out)", ref max))
        {
            Config.MaxTrades = Math.Clamp(max, 0, 9999);
            Config.Save();
        }

        var mix = Config.MixTypes;
        if (ImGui.Checkbox("Mix different junk stats in one trade", ref mix))
        {
            Config.MixTypes = mix;
            Config.Save();
        }

        ImGui.TextColored(Dim, "Mutamix never gives back a stat that went in, so mixing junk stats rules more of them out.\n"
                               + "Off: each trade is five of the very same materia. The grade is never mixed either way.");

        var echo = Config.EchoResults;
        if (ImGui.Checkbox("Print each result in chat (only you see it)", ref echo))
        {
            Config.EchoResults = echo;
            Config.Save();
        }
    }

    private static void DrawHelp()
    {
        ImGui.TextWrapped(
            "1. Get to Mutamix Bubblypots at the Bonfire in Central Thanalan (X 23.7, Y 13.6). The \"Show on map\" button flags him.\n"
            + "   He trades once you've done the level 19 quest \"Marvelously Mutable Materia\".\n"
            + "2. On \"Pick junk\", tick what you don't want: a stat's name for every grade of it (Piety, say), or single boxes for one grade.\n"
            + "3. Stand next to him and press Start (or type /transmute start).\n\n"
            + "It talks to him, picks \"Transmute Materia\", puts five junk materia of one grade in the window, confirms, and goes again "
            + "until fewer than five of any grade are left. Lower grades go first, so a lucky grade-up can join the next batch of its grade. "
            + "If what comes back is junk too, it goes back in.\n\n"
            + "It only ever puts in materia you ticked, never mixes grades, and stops by itself if you get into combat, change zones, "
            + "a window it doesn't know shows up, or nothing happens for 20 seconds. Press Stop or type /transmute stop at any time.\n\n"
            + "Commands: /transmute (window), /transmute start, /transmute stop, /transmute map. /mutamix works too.");
    }

    private static void DrawIcon(uint icon, float size)
    {
        var wrap = Plugin.TextureProvider.GetFromGameIcon(new GameIconLookup(icon)).GetWrapOrEmpty();
        ImGui.Image(wrap.Handle, new Vector2(size));
    }
}
