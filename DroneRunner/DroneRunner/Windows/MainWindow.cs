using System;
using System.Linq;
using System.Numerics;
using System.Text;
using Dalamud.Bindings.ImGui;
using Dalamud.Interface.Colors;
using Dalamud.Interface.Textures;
using Dalamud.Interface.Utility;
using Dalamud.Interface.Utility.Raii;
using Dalamud.Interface.Windowing;
using Lumina.Excel.Sheets;

namespace DroneRunner.Windows;

public sealed class MainWindow : Window
{
    private static readonly Vector4 Dim = ImGuiColors.DalamudGrey;
    private static readonly Vector4 Good = ImGuiColors.HealerGreen;
    private static readonly Vector4 Warn = ImGuiColors.DalamudOrange;
    private static readonly Vector4 Gold = ImGuiColors.DalamudYellow;
    private static readonly Vector4 Silver = new(0.8f, 0.85f, 0.95f, 1f);
    private static readonly Vector4 Bronze = new(0.85f, 0.6f, 0.4f, 1f);

    private readonly Plugin plugin;

    public MainWindow(Plugin plugin)
        : base("Drone Runner###DroneRunnerMain")
    {
        this.plugin = plugin;
        Size = new Vector2(520, 460);
        SizeCondition = ImGuiCond.FirstUseEver;
        SizeConstraints = new WindowSizeConstraints { MinimumSize = new Vector2(400, 260), MaximumSize = new Vector2(2000, 2000) };
    }

    private Configuration Config => plugin.Configuration;
    private Runner Run => plugin.Runner;

    public override void Draw()
    {
        DrawHeader();
        ImGui.Separator();

        using var tabs = ImRaii.TabBar("##tabs");
        if (!tabs)
            return;

        using (var tab = ImRaii.TabItem($"Finds ({Run.Finds.Count})###finds"))
        {
            if (tab)
                DrawFinds();
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

        using (var tab = ImRaii.TabItem("Diagnostics"))
        {
            if (tab)
                DrawDiagnostics();
        }
    }

    private void DrawHeader()
    {
        var scale = ImGuiHelpers.GlobalScale;
        if (Run.Running)
        {
            using (ImRaii.PushColor(ImGuiCol.Button, new Vector4(0.6f, 0.15f, 0.15f, 1f)))
            {
                if (ImGui.Button("Stop", new Vector2(110 * scale, 0)))
                    Run.Stop("Stopped.");
            }

            ImGui.SameLine();
            ImGui.TextColored(Gold, $"Artifact {Run.FoundThisRun + 1}: {Run.Status}");
        }
        else
        {
            var reason = Run.CantStart();
            using (ImRaii.Disabled(reason != null))
            {
                using (ImRaii.PushColor(ImGuiCol.Button, new Vector4(0.15f, 0.45f, 0.2f, 1f), reason == null))
                {
                    if (ImGui.Button("Start", new Vector2(110 * scale, 0)))
                        Run.Start();
                }
            }

            ImGui.SameLine();
            if (reason != null)
                ImGui.TextColored(Warn, reason);
            else
                ImGui.TextColored(Good, "Ready.");

            if (Run.Status != "Idle" && Run.Status != reason)
                ImGui.TextColored(Dim, $"Last run: {Run.Status}");
        }

        var zone = Runner.CurrentZone;
        if (zone == null)
        {
            ImGui.TextColored(Dim, "Artifact Search runs on Oizys and Auxesia (Cosmic Exploration), on a crafter or gatherer.");
            return;
        }

        var modules = GameUi.ItemCount(zone.ModuleItemId);
        DrawIcon(ItemIcon(zone.ModuleItemId));
        ImGui.SameLine();
        ImGui.TextUnformatted($"{modules} {Runner.ItemName(zone.ModuleItemId)}{(modules == 1 ? "" : "s")}");
        ImGui.SameLine();
        ImGui.TextColored(Dim, "·");
        ImGui.SameLine();
        DrawRecordCount(zone.GoldRecordId, Gold);
        ImGui.SameLine();
        DrawRecordCount(zone.SilverRecordId, Silver);
        ImGui.SameLine();
        DrawRecordCount(zone.BronzeRecordId, Bronze);
        ImGui.SameLine();
        if (ImGui.SmallButton("Kaede"))
            Plugin.FlagKaede();
        if (ImGui.IsItemHovered())
            ImGui.SetTooltip("Flag Kaede on the map: she sells drone modules for dronebits and appraises the records.");

        if (!Navmesh.Installed)
            ImGui.TextColored(Warn, "vnavmesh isn't installed: you walk to each flag and it examines the artifact for you.");
    }

    private static void DrawRecordCount(uint itemId, Vector4 color)
    {
        DrawIcon(ItemIcon(itemId));
        if (ImGui.IsItemHovered())
            ImGui.SetTooltip(Runner.ItemName(itemId));
        ImGui.SameLine(0, 2 * ImGuiHelpers.GlobalScale);
        ImGui.TextColored(color, GameUi.ItemCount(itemId).ToString());
    }

    private void DrawFinds()
    {
        ImGui.TextUnformatted($"This session: {Run.Finds.Count} artifact{(Run.Finds.Count == 1 ? "" : "s")}.");
        ImGui.SameLine();
        ImGui.TextColored(Dim, $"All time: {Config.TotalArtifacts} ({Config.TotalGold} gold, {Config.TotalSilver} silver, {Config.TotalBronze} bronze).");

        if (Run.Finds.Count == 0)
        {
            ImGui.Spacing();
            ImGui.TextColored(Dim, "Every artifact shows up here with the record it gave.");
            return;
        }

        if (ImGui.SmallButton("Clear list"))
            Run.Finds.Clear();

        var scale = ImGuiHelpers.GlobalScale;
        using var table = ImRaii.Table("##finds", 3, ImGuiTableFlags.Borders | ImGuiTableFlags.RowBg | ImGuiTableFlags.ScrollY);
        if (!table)
            return;

        ImGui.TableSetupScrollFreeze(0, 1);
        ImGui.TableSetupColumn("Time", ImGuiTableColumnFlags.WidthFixed, 64 * scale);
        ImGui.TableSetupColumn("Zone", ImGuiTableColumnFlags.WidthFixed, 70 * scale);
        ImGui.TableSetupColumn("Record", ImGuiTableColumnFlags.WidthStretch);
        ImGui.TableHeadersRow();

        foreach (var f in Run.Finds.ToList())
        {
            ImGui.TableNextRow();
            ImGui.TableNextColumn();
            ImGui.TextColored(Dim, f.Time.ToString("HH:mm:ss"));
            ImGui.TableNextColumn();
            ImGui.TextUnformatted(f.Zone);
            ImGui.TableNextColumn();
            DrawIcon(ItemIcon(f.RecordId));
            ImGui.SameLine();
            ImGui.TextColored(f.Tier == 3 ? Gold : f.Tier == 2 ? Silver : Bronze, f.RecordName + (f.Tier == 3 ? "  ★" : ""));
        }
    }

    private void DrawSettings()
    {
        var scale = ImGuiHelpers.GlobalScale;

        var mount = Config.UseMount;
        if (ImGui.Checkbox("Ride a mount (Mount Roulette) for trips longer than", ref mount))
        {
            Config.UseMount = mount;
            Config.Save();
        }

        ImGui.SameLine();
        var dist = Config.MountDistance;
        ImGui.SetNextItemWidth(90 * scale);
        if (ImGui.InputInt("yalms##mountdist", ref dist))
        {
            Config.MountDistance = Math.Clamp(dist, 10, 500);
            Config.Save();
        }

        var max = Config.MaxArtifacts;
        ImGui.SetNextItemWidth(110 * scale);
        if (ImGui.InputInt("Stop after this many artifacts (0 = until the modules run out)", ref max))
        {
            Config.MaxArtifacts = Math.Clamp(max, 0, 9999);
            Config.Save();
        }

        var pause = Config.PauseAfterArtifact;
        ImGui.SetNextItemWidth(110 * scale);
        if (ImGui.InputInt("Seconds to wait after each artifact before the next drone", ref pause))
        {
            Config.PauseAfterArtifact = Math.Clamp(pause, 0, 60);
            Config.Save();
        }

        var echo = Config.EchoResults;
        if (ImGui.Checkbox("Print each record in chat (only you see it)", ref echo))
        {
            Config.EchoResults = echo;
            Config.Save();
        }
    }

    private static void DrawHelp()
    {
        ImGui.TextWrapped(
            "1. Buy drone modules from Kaede for dronebits (the Kaede button flags her). Dronebits come from class A and provisional missions.\n"
            + "2. On Oizys or Auxesia, on a crafter or gatherer, press Start (or type /drone start).\n\n"
            + "It uses a module, waits for the drone to find its artifact, and heads there: straight to the artifact if it's in view, "
            + "else to the red X on the map, else round the zone's artifact spots nearest first until it shows up. It walks with vnavmesh, "
            + "on a mount for long trips, examines the artifact, logs the record and uses the next module, until the modules run out.\n\n"
            + "Without vnavmesh it puts a flag on the map for each artifact; walk there and it examines it for you.\n\n"
            + "It stops if you get into combat, leave the zone, change to a combat job, your bags fill up, a Yes/No box it doesn't know "
            + "shows up, or nothing happens for 30 seconds. Take the records to Kaede to appraise them.\n\n"
            + "Commands: /drone (window), /drone start, /drone stop, /drone kaede. /dronerunner works too.");
    }

    private void DrawDiagnostics()
    {
        ImGui.TextColored(Dim, "What the plugin can see. If a run goes wrong, copy this and send it over.");
        if (ImGui.SmallButton("Copy to clipboard"))
            ImGui.SetClipboardText(DiagnosticsText());
        if (Config.ArtifactIconId != 0)
        {
            ImGui.SameLine();
            if (ImGui.SmallButton("Forget the learned map icon"))
            {
                Config.ArtifactIconId = 0;
                Config.ArtifactMarkerSource = "";
                Config.Save();
            }

            if (ImGui.IsItemHovered())
                ImGui.SetTooltip("If it keeps heading to the wrong place, it may have learned the wrong icon for the red X.");
        }
        ImGui.Separator();
        using var child = ImRaii.Child("##diag");
        ImGui.TextUnformatted(DiagnosticsText());
    }

    private string DiagnosticsText()
    {
        var sb = new StringBuilder();
        var zone = Runner.CurrentZone;
        var me = Plugin.ObjectTable.LocalPlayer?.Position ?? Vector3.Zero;
        sb.AppendLine($"Drone Runner {typeof(Plugin).Assembly.GetName().Version} · territory {Plugin.ClientState.TerritoryType} ({zone?.Name ?? "not an Artifact Search zone"})");
        sb.AppendLine($"Phase {Run.Phase} · running {Run.Running} · status: {Run.Status}");
        sb.AppendLine($"Me {Fmt(me)} · crafter/gatherer {Runner.OnCrafterOrGatherer()} · vnavmesh {(Navmesh.Installed ? "installed" : "missing")}");
        if (Run.Target is { } t)
            sb.AppendLine($"Target {Fmt(t)} ({Run.TargetSource}), {GameUi.Distance2D(me, t):0.0}y");
        if (Run.LastLogId != 0)
            sb.AppendLine($"Last drone log message: {Run.LastLogId} at {Run.LastLogTime:HH:mm:ss}");

        var obj = Run.NearestArtifactObject();
        sb.AppendLine(obj == null ? "Artifact object: none in view" : $"Artifact object: {obj.Name} ({obj.ObjectKind}) id {obj.BaseId} at {Fmt(obj.Position)}, {Vector3.Distance(me, obj.Position):0.0}y");
        var mark = Run.ArtifactMarker();
        sb.AppendLine(mark == null ? "Artifact map marker: none" : $"Artifact map marker: {mark.Source} at {Fmt(mark.Position)}");
        sb.AppendLine($"Learned artifact icon: {(Config.ArtifactIconId == 0 ? "not yet" : $"{Config.ArtifactIconId} ({Config.ArtifactMarkerSource})")}");

        if (zone != null)
        {
            var sites = Zones.Sites(zone);
            var nearest = sites.OrderBy(s => GameUi.Distance2D(me, s.Position)).FirstOrDefault();
            sb.AppendLine($"Artifact spots known: {sites.Count}" + (nearest == null ? "" : $" · nearest {nearest.InstanceId} at {Fmt(nearest.Position)}, {GameUi.Distance2D(me, nearest.Position):0}y"));
        }

        sb.AppendLine();
        sb.AppendLine("Run log:");
        foreach (var line in Run.RunLog.TakeLast(40))
            sb.AppendLine("  " + line);

        sb.AppendLine();
        sb.AppendLine("Map markers (source, icon, text, raw, nearest artifact spot):");
        foreach (var m in GameUi.AllMarkers().Take(120))
        {
            var spot = Run.SpotFor(m);
            sb.AppendLine($"  {m.Source} icon {m.IconId} \"{m.Text}\" raw ({m.Raw.X:0.#}, {m.Raw.Y:0.#})"
                          + (spot == null ? "" : $" spot {spot.Value.Distance:0.0}y"));
        }

        var at = Run.Target ?? me;
        sb.AppendLine($"Could be the artifact, at {(Run.Target == null ? "your feet" : "the target")}:");
        foreach (var o in Run.SpotCandidates(at))
            sb.AppendLine($"  {o.ObjectKind} {o.BaseId} \"{o.Name}\" {(o.IsTargetable ? "targetable" : "not targetable")}, {GameUi.Distance2D(o.Position, at):0.0}y from it");

        sb.AppendLine("Everything within 30y of you (not players):");
        foreach (var line in Runner.NearbyObjects(me, 30f).Take(40))
            sb.AppendLine("  " + line.Replace("from the spot", "away"));

        return sb.ToString();
    }

    private static string Fmt(Vector3 v) => $"({v.X:0.0}, {v.Y:0.0}, {v.Z:0.0})";

    private static uint ItemIcon(uint itemId) =>
        Plugin.DataManager.GetExcelSheet<Item>().GetRowOrDefault(itemId)?.Icon ?? 0;

    private static void DrawIcon(uint icon)
    {
        var size = ImGui.GetTextLineHeight() * 1.25f;
        if (icon == 0)
        {
            ImGui.Dummy(new Vector2(size));
            return;
        }

        var wrap = Plugin.TextureProvider.GetFromGameIcon(new GameIconLookup(icon)).GetWrapOrEmpty();
        ImGui.Image(wrap.Handle, new Vector2(size));
    }
}
