using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text;
using System.Text.RegularExpressions;
using Dalamud.Bindings.ImGui;
using Dalamud.Interface;
using Dalamud.Interface.Colors;
using Dalamud.Interface.Textures;
using Dalamud.Interface.Utility;
using Dalamud.Interface.Utility.Raii;
using Dalamud.Interface.Windowing;
using Dalamud.Utility;
using MitPlan.Data;

namespace MitPlan.Windows;

public sealed partial class MainWindow : Window
{
    private static readonly Vector4 Dim = ImGuiColors.DalamudGrey3;
    private static readonly Vector4 Muted = ImGuiColors.DalamudGrey;
    private static readonly Vector4 NowRow = new(0.95f, 0.65f, 0.15f, 0.22f);
    private static readonly Vector4 NextRow = new(0.95f, 0.65f, 0.15f, 0.08f);

    private readonly Plugin plugin;
    private int phase;
    private int followedPhase = -1;
    private string? shownPlan;
    private bool selectPhase;

    // Flow layout: items go on one line until the column runs out.
    private float flowRight;
    private bool flowFirst;

    public MainWindow(Plugin plugin)
        : base("Mit Plan###MitPlanMain")
    {
        SizeConstraints = new WindowSizeConstraints
        {
            MinimumSize = new Vector2(380, 220),
            MaximumSize = new Vector2(float.MaxValue, float.MaxValue),
        };
        Size = new Vector2(620, 520);
        SizeCondition = ImGuiCond.FirstUseEver;

        this.plugin = plugin;
    }

    private Configuration Config => plugin.Configuration;

    public override void PreDraw()
    {
        Flags = ImGuiWindowFlags.None;
        if (Config.LockWindow)
            Flags |= ImGuiWindowFlags.NoMove | ImGuiWindowFlags.NoResize;
        BgAlpha = Config.Opacity;
    }

    public override void Draw()
    {
        var plans = plugin.Library.Plans;
        if (plans.Count == 0)
        {
            ImGui.TextWrapped("No plans loaded. Check the custom plans folder in the settings.");
            return;
        }

        var plan = plugin.Library.Get(Config.SelectedPlan) ?? plans[0];
        if (plan.Id != shownPlan)
        {
            shownPlan = plan.Id;
            phase = 0;
            followedPhase = -1;
        }

        var job = plugin.Job;
        var slot = ChosenSlot(plan, job);

        DrawHeader(plan, job, slot);
        FollowPhase(plan);
        DrawPhaseTabs(plan);

        if (phase >= plan.Phases.Count)
            phase = 0;
        var current = plan.Phases[phase];

        using (var child = ImRaii.Child("##hits", new Vector2(0, -FooterHeight()), false))
        {
            if (child)
            {
                if (Config.PartyView)
                    DrawParty(plan, current, slot);
                else
                    DrawMine(plan, current, job, slot);

                DrawTankCooldowns(plan, current, job);
            }
        }

        DrawFooter(plan, current);
    }

    // ------------------------------------------------------------------ header

    private void DrawHeader(Plan plan, string? job, Slot? slot)
    {
        var scale = ImGuiHelpers.GlobalScale;

        ImGui.SetNextItemWidth(220 * scale);
        using (var combo = ImRaii.Combo("##fight", Title(plan)))
        {
            if (combo)
            {
                foreach (var p in plugin.Library.Plans)
                {
                    var label = Title(p) + (p.Custom ? " (custom)" : "");
                    if (ImGui.Selectable(label, p.Id == plan.Id))
                    {
                        Config.SelectedPlan = p.Id;
                        Config.Save();
                    }
                }
            }
        }

        if (plugin.DutyPlan is { } duty && duty.Id != plan.Id && ImGui.IsItemHovered())
            ImGui.SetTooltip($"You're in {Title(duty)}.");

        ImGui.SameLine();
        if (job != null && Config.ShowIcons && GameData.JobIcon(job) is var jobIcon and > 0)
        {
            Icon(jobIcon, ImGui.GetFrameHeight());
            ImGui.SameLine(0, 4 * scale);
        }

        ImGui.SetNextItemWidth(78 * scale);
        using (var combo = ImRaii.Combo("##job", Config.JobOverride ?? (job != null ? $"{job}" : "Job")))
        {
            if (combo)
            {
                if (ImGui.Selectable("Your job", Config.JobOverride == null))
                {
                    Config.JobOverride = null;
                    Config.Save();
                }

                foreach (var j in Jobs.All)
                {
                    if (ImGui.Selectable(j, Config.JobOverride == j))
                    {
                        Config.JobOverride = j;
                        Config.Save();
                    }
                }
            }
        }

        if (ImGui.IsItemHovered())
            ImGui.SetTooltip(Config.JobOverride == null ? "Follows the job you're on. Pick one to look at another job's mits." : "Showing a job you picked. Choose \"Your job\" to follow yours again.");

        ImGui.SameLine();
        ImGui.SetNextItemWidth(150 * scale);
        using (var combo = ImRaii.Combo("##slot", slot?.Label ?? "Column"))
        {
            if (combo)
            {
                foreach (var s in plan.Slots.Where(s => s.Role != "extras"))
                {
                    var fits = job != null && Jobs.Fits(s, job);
                    using (ImRaii.PushColor(ImGuiCol.Text, Dim, !fits))
                    {
                        if (ImGui.Selectable(s.Label, s.Key == slot?.Key) && job != null)
                        {
                            Config.Slots[$"{plan.Id}:{job}"] = s.Key;
                            Config.Save();
                        }
                    }
                }
            }
        }

        if (ImGui.IsItemHovered())
            ImGui.SetTooltip("The sheet's column you read. Tanks pick MT or OT, melee D1 or D2.");

        // Right side: view toggle and settings.
        var right = ImGui.GetContentRegionMax().X;
        var viewWidth = ImGui.CalcTextSize("Party").X + ImGui.CalcTextSize("Mine").X + ImGui.GetStyle().FramePadding.X * 4 + ImGui.GetStyle().ItemSpacing.X;
        var cogWidth = ImGui.GetFrameHeight();
        var start = right - viewWidth - cogWidth - ImGui.GetStyle().ItemSpacing.X * 2;
        ImGui.SameLine();
        // A narrow window puts the view buttons on their own line rather than over the column picker.
        if (ImGui.GetCursorPosX() > start)
            ImGui.NewLine();
        ImGui.SetCursorPosX(start);
        if (Toggle("Mine", !Config.PartyView))
            SetPartyView(false);
        ImGui.SameLine(0, 2 * scale);
        if (Toggle("Party", Config.PartyView))
            SetPartyView(true);
        if (ImGui.IsItemHovered())
            ImGui.SetTooltip("Every column of the sheet as written.");
        ImGui.SameLine();
        using (ImRaii.PushFont(UiBuilder.IconFont))
        {
            if (ImGui.Button(FontAwesomeIcon.Cog.ToIconString()))
                plugin.ToggleConfigUi();
        }

        DrawStatus(plan, job, slot);
    }

    private void DrawStatus(Plan plan, string? job, Slot? slot)
    {
        var follower = plugin.Follower;
        if (follower.Running && follower.Plan?.Id == plan.Id)
        {
            ImGui.TextColored(ImGuiColors.HealerGreen, "Following the pull");
            if (follower.NextIn is { } next && next > 0)
            {
                ImGui.SameLine();
                ImGui.TextDisabled($"next hit in {next:0}s");
            }

            if (follower.LastSync != null && ImGui.IsItemHovered())
                ImGui.SetTooltip($"Last synced to a boss cast: {follower.LastSync}");
        }
        else if (job == null)
        {
            ImGui.TextDisabled("Pick a job to see its mits.");
        }
        else if (slot != null && slot.Jobs is { Count: > 0 } written && !written.Contains(job))
        {
            ImGui.TextColored(ImGuiColors.DalamudYellow, $"This column is written for {string.Join("/", written)}.");
        }
        else if (slot == null)
        {
            ImGui.TextDisabled($"This sheet has no column for {job}. Pick one above.");
        }
        else if (Config.FollowFight && plugin.DutyPlan?.Id == plan.Id)
        {
            ImGui.TextDisabled("Pull and the window follows the fight.");
        }
        else
        {
            ImGui.TextDisabled($"{job} as {slot.Label}");
        }
    }

    private void SetPartyView(bool party)
    {
        Config.PartyView = party;
        Config.Save();
    }

    private static bool Toggle(string label, bool on)
    {
        using var color = ImRaii.PushColor(ImGuiCol.Button, ImGui.GetColorU32(ImGuiCol.ButtonActive), on);
        return ImGui.Button(label);
    }

    private Slot? ChosenSlot(Plan plan, string? job)
    {
        if (job == null)
            return null;

        if (Config.Slots.TryGetValue($"{plan.Id}:{job}", out var key) && plan.Slots.FirstOrDefault(s => s.Key == key) is { } picked)
            return picked;

        return Jobs.DefaultSlot(plan, job);
    }

    private static string Title(Plan plan) =>
        plan.Name.StartsWith(plan.Short, StringComparison.OrdinalIgnoreCase) ? plan.Name : $"{plan.Short} · {plan.Name}";

    // ------------------------------------------------------------------ phases

    private void FollowPhase(Plan plan)
    {
        var follower = plugin.Follower;
        if (!Config.FollowSwitchesPhase || !follower.Running || follower.Plan?.Id != plan.Id)
        {
            followedPhase = -1;
            return;
        }

        if (follower.Phase != followedPhase)
        {
            followedPhase = follower.Phase;
            phase = follower.Phase;
            selectPhase = true;
        }
    }

    private void DrawPhaseTabs(Plan plan)
    {
        // One tab bar per fight, so switching fights doesn't keep the last fight's tab.
        using var bar = ImRaii.TabBar($"##phases-{plan.Id}", ImGuiTabBarFlags.FittingPolicyScroll);
        if (!bar)
            return;

        for (var i = 0; i < plan.Phases.Count; i++)
        {
            var flags = selectPhase && i == phase ? ImGuiTabItemFlags.SetSelected : ImGuiTabItemFlags.None;
            if (ImGui.BeginTabItem($"{Display(plan.Phases[i].Name)}###phase{i}", flags))
            {
                if (!selectPhase)
                    phase = i;
                ImGui.EndTabItem();
            }
        }

        selectPhase = false;
    }

    // ------------------------------------------------------------------ your mits

    private void DrawMine(Plan plan, Phase current, string? job, Slot? slot)
    {
        var scale = ImGuiHelpers.GlobalScale;
        using var table = ImRaii.Table("##mine", 3, ImGuiTableFlags.RowBg | ImGuiTableFlags.BordersInnerH | ImGuiTableFlags.SizingStretchProp | ImGuiTableFlags.PadOuterX);
        if (!table)
            return;

        ImGui.TableSetupColumn("Time", ImGuiTableColumnFlags.WidthFixed, 74 * scale);
        ImGui.TableSetupColumn("Hit", ImGuiTableColumnFlags.WidthStretch, 1f);
        ImGui.TableSetupColumn(job != null && slot != null ? $"{job} · {slot.Label}" : "Your mits", ImGuiTableColumnFlags.WidthStretch, 1.9f);
        ImGui.TableHeadersRow();

        var extras = plan.Slots.Where(s => s.Role == "extras").ToList();
        var notes = current.Notes.Concat(plan.Notes).ToList();
        var shown = 0;

        foreach (var hit in current.Hits)
        {
            var lines = slot != null && hit.Cells.TryGetValue(slot.Key, out var mine) ? mine : [];

            // Extras columns (Magick Barrier, Dismantle) for the job that owns the button.
            var extraItems = new List<MitItem>();
            if (job != null)
            {
                foreach (var e in extras)
                {
                    if (!hit.Cells.TryGetValue(e.Key, out var cell))
                        continue;
                    foreach (var line in cell)
                        extraItems.AddRange(line.Items.Select(i => MitText.Resolve(i, job, e))
                                                .Where(i => i.Buttons.Any(b => b.ForYou && b.Actions.Any(a => Jobs.Owner.GetValueOrDefault(a) == job))));
                }
            }

            var empty = lines.Count == 0 && extraItems.Count == 0 && hit.Note == null && hit.Info == null;
            if (empty && Config.HideEmptyHits && !IsFollowed(plan, hit))
                continue;

            shown++;
            ImGui.TableNextRow();
            RowHighlight(plan, hit);

            ImGui.TableNextColumn();
            DrawTime(hit);

            ImGui.TableNextColumn();
            DrawHitName(plan, hit);

            ImGui.TableNextColumn();
            if (hit.Info != null)
            {
                foreach (var line in hit.Info)
                {
                    using (ImRaii.PushColor(ImGuiCol.Text, Muted))
                        ImGui.TextWrapped(Display(line));
                }
            }

            var drew = false;
            foreach (var line in lines)
            {
                if (line.Carry && !Config.ShowCarryOver)
                    continue;

                var items = line.Items.Select(i => MitText.Resolve(i, job, slot)).ToList();
                if (!Config.ShowOtherJobs && items.All(i => !i.AnyForYou))
                    continue;

                DrawLine(items, line.Carry, notes);
                drew = true;
            }

            if (extraItems.Count > 0)
            {
                DrawLine(extraItems, false, notes);
                drew = true;
            }

            if (hit.Note != null)
            {
                using (ImRaii.PushColor(ImGuiCol.Text, ImGuiColors.DalamudOrange))
                    ImGui.TextWrapped(Display(hit.Note));
                drew = true;
            }

            if (!drew && hit.Info == null)
                ImGui.TextDisabled("-");
        }

        if (shown == 0)
        {
            ImGui.TableNextRow();
            ImGui.TableNextColumn();
            ImGui.TableNextColumn();
            ImGui.TextDisabled("Nothing for you this phase.");
        }
    }

    private void DrawLine(List<MitItem> items, bool carry, List<string> notes)
    {
        FlowBegin();
        if (carry)
        {
            using (ImRaii.PushFont(UiBuilder.IconFont))
            {
                var arrow = FontAwesomeIcon.LongArrowAltRight.ToIconString();
                FlowNext(ImGui.CalcTextSize(arrow).X);
                ImGui.TextColored(Dim, arrow);
            }

            if (ImGui.IsItemHovered())
                ImGui.SetTooltip("Carried over: already up from an earlier hit, don't press it again.");
        }

        foreach (var item in items)
            DrawItem(item, carry, notes);
    }

    private void DrawItem(MitItem item, bool carry, List<string> notes)
    {
        var scale = ImGuiHelpers.GlobalScale;
        var iconSize = ImGui.GetTextLineHeight() + (2 * scale);
        var gap = 3 * scale;
        var showIcons = Config.ShowIcons;

        // Measure first so the item moves to the next line whole.
        var width = 0f;
        foreach (var part in item.Parts)
        {
            if (part.Button is { } b)
            {
                if (showIcons)
                    width += b.Actions.Count(a => GameData.Icon(a) != 0) * (iconSize + gap);
                width += ImGui.CalcTextSize(ButtonText(b)).X + gap;
            }
            else
            {
                width += ImGui.CalcTextSize(Display(part.Text!)).X + gap;
            }
        }

        if (item.Refs.Count > 0)
            width += ImGui.CalcTextSize(RefText(item)).X + gap;

        FlowNext(width);
        var forYou = item.AnyForYou;

        using (ImRaii.Group())
        {
            var first = true;
            foreach (var part in item.Parts)
            {
                if (part.Button is not { } b)
                {
                    if (!first)
                        ImGui.SameLine(0, gap);
                    ImGui.TextColored(!forYou ? Dim : Muted, Display(part.Text!));
                    first = false;
                    continue;
                }

                var color = !forYou || !b.ForYou ? Dim : carry ? Muted : ImGuiColors.DalamudWhite;
                if (showIcons)
                {
                    foreach (var a in b.Actions)
                    {
                        var icon = GameData.Icon(a);
                        if (icon == 0)
                            continue;
                        if (!first)
                            ImGui.SameLine(0, gap);
                        Icon(icon, iconSize, !forYou || !b.ForYou || carry);
                        first = false;
                    }
                }

                if (!first)
                    ImGui.SameLine(0, gap);
                ImGui.TextColored(color, ButtonText(b));
                first = false;
            }

            if (!forYou && item.OnlyFor != null)
            {
                if (!first)
                    ImGui.SameLine(0, gap);
                ImGui.TextColored(Dim, $"({item.OnlyFor})");
                first = false;
            }

            if (item.Refs.Count > 0)
            {
                if (!first)
                    ImGui.SameLine(0, gap);
                ImGui.TextColored(ImGuiColors.DalamudYellow, RefText(item));
            }
        }

        if (ImGui.IsItemHovered())
        {
            var tip = new StringBuilder($"Sheet: {Display(item.Raw)}");
            if (!item.ForYou && item.OnlyFor != null)
                tip.Append($"\nOnly for {item.OnlyFor}.");
            foreach (var b in item.Buttons.Where(b => !b.ForYou && b.OnlyFor != null))
                tip.Append($"\n{b.Label} is a {b.OnlyFor} button.");
            foreach (var r in item.Refs.Distinct())
            {
                if (MitText.Footnote(notes, r) is { } note)
                    tip.Append("\n\n").Append(Display(note));
            }

            ImGui.SetTooltip(tip.ToString());
        }
    }

    private static string ButtonText(MitButton b) => b.ForYou || b.OnlyFor == null ? b.Label : $"{b.Label} ({b.OnlyFor})";

    private static string RefText(MitItem item) => string.Join("", item.Refs.Select(r => r.StartsWith('*') ? $"[{r}]" : Display(r)));

    private void FlowBegin()
    {
        flowRight = ImGui.GetCursorScreenPos().X + ImGui.GetContentRegionAvail().X;
        flowFirst = true;
    }

    private void FlowNext(float width)
    {
        if (!flowFirst)
        {
            ImGui.SameLine(0, 10 * ImGuiHelpers.GlobalScale);
            if (ImGui.GetCursorScreenPos().X + width > flowRight)
                ImGui.NewLine();
        }

        flowFirst = false;
    }

    private void DrawTime(Hit hit)
    {
        if (hit.Time is { Length: > 0 } time)
            ImGui.TextDisabled(Display(time));
        if (hit.FightTime != null && ImGui.IsItemHovered())
            ImGui.SetTooltip($"{Display(hit.FightTime)} from the pull");
    }

    private void DrawHitName(Plan plan, Hit hit)
    {
        var follower = plugin.Follower;
        var followed = follower.Running && follower.Plan?.Id == plan.Id;
        var color = hit.Info != null ? ImGuiColors.DalamudYellow : ImGuiColors.DalamudWhite;
        ImGui.TextColored(color, Display(hit.Name));

        if (!followed)
            return;

        if (hit.FlatIndex == follower.NowIndex)
            ImGui.TextColored(ImGuiColors.DalamudOrange, "now");
        else if (hit.FlatIndex == follower.NowIndex + 1)
            ImGui.TextColored(ImGuiColors.DalamudOrange, follower.NextIn is { } n && n > 0 ? $"next · {n:0}s" : "next");
    }

    private void RowHighlight(Plan plan, Hit hit)
    {
        var follower = plugin.Follower;
        if (!follower.Running || follower.Plan?.Id != plan.Id)
            return;

        if (hit.FlatIndex == follower.NowIndex)
            ImGui.TableSetBgColor(ImGuiTableBgTarget.RowBg1, ImGui.GetColorU32(NowRow));
        else if (hit.FlatIndex == follower.NowIndex + 1)
            ImGui.TableSetBgColor(ImGuiTableBgTarget.RowBg1, ImGui.GetColorU32(NextRow));
    }

    private bool IsFollowed(Plan plan, Hit hit)
    {
        var follower = plugin.Follower;
        return follower.Running && follower.Plan?.Id == plan.Id && (hit.FlatIndex == follower.NowIndex || hit.FlatIndex == follower.NowIndex + 1);
    }

    // ------------------------------------------------------------------ party view

    private void DrawParty(Plan plan, Phase current, Slot? mine)
    {
        var scale = ImGuiHelpers.GlobalScale;
        var slots = plan.Slots.Where(s => current.Hits.Any(h => h.Cells.ContainsKey(s.Key))).ToList();
        using var table = ImRaii.Table("##party", 2 + slots.Count,
            ImGuiTableFlags.RowBg | ImGuiTableFlags.BordersInner | ImGuiTableFlags.ScrollX | ImGuiTableFlags.ScrollY | ImGuiTableFlags.SizingFixedFit);
        if (!table)
            return;

        ImGui.TableSetupScrollFreeze(2, 1);
        ImGui.TableSetupColumn("Time", ImGuiTableColumnFlags.WidthFixed, 70 * scale);
        ImGui.TableSetupColumn("Hit", ImGuiTableColumnFlags.WidthFixed, 150 * scale);
        foreach (var s in slots)
            ImGui.TableSetupColumn(s.Label, ImGuiTableColumnFlags.WidthFixed, 140 * scale);

        ImGui.TableNextRow(ImGuiTableRowFlags.Headers);
        ImGui.TableNextColumn();
        ImGui.TableHeader("Time");
        ImGui.TableNextColumn();
        ImGui.TableHeader("Hit");
        foreach (var s in slots)
        {
            ImGui.TableNextColumn();
            using (ImRaii.PushColor(ImGuiCol.Text, ImGuiColors.DalamudOrange, s.Key == mine?.Key))
                ImGui.TableHeader(s.Label);
        }

        foreach (var hit in current.Hits)
        {
            ImGui.TableNextRow();
            RowHighlight(plan, hit);

            ImGui.TableNextColumn();
            DrawTime(hit);

            ImGui.TableNextColumn();
            ImGui.PushTextWrapPos(ImGui.GetCursorPosX() + ImGui.GetColumnWidth());
            DrawHitName(plan, hit);
            if (hit.Note != null)
                ImGui.TextColored(ImGuiColors.DalamudOrange, Display(hit.Note));
            if (hit.Info != null)
            {
                foreach (var line in hit.Info)
                    ImGui.TextColored(Muted, Display(line));
            }

            ImGui.PopTextWrapPos();

            foreach (var s in slots)
            {
                ImGui.TableNextColumn();
                if (!hit.Cells.TryGetValue(s.Key, out var cell))
                    continue;

                ImGui.PushTextWrapPos(ImGui.GetCursorPosX() + ImGui.GetColumnWidth());
                foreach (var line in cell)
                {
                    var text = Display((line.Carry ? "-> " : "") + string.Join(" + ", line.Items));
                    ImGui.TextColored(line.Carry ? Dim : ImGuiColors.DalamudWhite, text);
                }

                ImGui.PopTextWrapPos();
            }
        }
    }

    // ------------------------------------------------------------------ tank cooldowns

    private void DrawTankCooldowns(Plan plan, Phase current, string? job)
    {
        if (plan.TankCooldowns.Count == 0 || (!Config.PartyView && Jobs.RoleOf(job) != Role.Tank))
            return;

        var number = PhaseNumber(current.Name);
        var table = plan.TankCooldowns.FirstOrDefault(t => PhaseNumber(t.Phase) == number);
        if (table == null || table.Rows.Count == 0)
            return;

        ImGui.Spacing();
        if (!ImGui.CollapsingHeader("Personal tank cooldowns (Omnitank)", ImGuiTreeNodeFlags.DefaultOpen))
            return;

        var scale = ImGuiHelpers.GlobalScale;
        var tank = new Slot { Key = "tank", Label = "Tank", Role = "tank" };
        var a = table.Columns.ElementAtOrDefault(0) ?? "MT";
        var b = table.Columns.ElementAtOrDefault(1) ?? "OT";

        using var t = ImRaii.Table("##tankcds", 4, ImGuiTableFlags.RowBg | ImGuiTableFlags.BordersInnerH | ImGuiTableFlags.SizingStretchProp);
        if (!t)
            return;

        ImGui.TableSetupColumn("Time", ImGuiTableColumnFlags.WidthFixed, 50 * scale);
        ImGui.TableSetupColumn("Hit", ImGuiTableColumnFlags.WidthStretch, 1f);
        ImGui.TableSetupColumn(Display(a), ImGuiTableColumnFlags.WidthStretch, 1.3f);
        ImGui.TableSetupColumn(Display(b), ImGuiTableColumnFlags.WidthStretch, 1.3f);
        ImGui.TableHeadersRow();

        var tankJob = Jobs.RoleOf(job) == Role.Tank ? job : null;
        foreach (var row in table.Rows)
        {
            ImGui.TableNextRow();
            ImGui.TableNextColumn();
            ImGui.TextDisabled(Display(row.Time));
            ImGui.TableNextColumn();
            ImGui.TextUnformatted(Display(row.Name));
            foreach (var cell in new[] { row.A, row.B })
            {
                ImGui.TableNextColumn();
                foreach (var line in cell)
                    DrawLine(line.Items.Select(i => MitText.Resolve(i, tankJob, tank)).ToList(), line.Carry, table.Notes);
            }
        }

        if (table.Notes.Count > 0)
        {
            ImGui.TableNextRow();
            ImGui.TableNextColumn();
            ImGui.TableNextColumn();
            using (ImRaii.PushColor(ImGuiCol.Text, Muted))
            {
                foreach (var note in table.Notes)
                    ImGui.TextWrapped(Display(note));
            }
        }
    }

    [GeneratedRegex(@"\d+")]
    private static partial Regex Digits();

    private static string? PhaseNumber(string name) => Digits().Match(name) is { Success: true } m ? m.Value : null;

    // ------------------------------------------------------------------ footer

    private float FooterHeight() => ImGui.GetFrameHeightWithSpacing() + ImGui.GetStyle().ItemSpacing.Y;

    private void DrawFooter(Plan plan, Phase current)
    {
        ImGui.Separator();
        var notes = current.Notes.Concat(plan.Notes).ToList();

        using (ImRaii.Disabled(notes.Count == 0 && plan.About.Count == 0))
        {
            if (ImGui.Button($"Notes ({notes.Count})"))
                ImGui.OpenPopup("##notes");
        }

        using (var popup = ImRaii.Popup("##notes"))
        {
            if (popup)
            {
                ImGui.PushTextWrapPos(520 * ImGuiHelpers.GlobalScale);
                foreach (var line in plan.About)
                    ImGui.TextColored(Muted, Display(line));
                if (plan.About.Count > 0 && notes.Count > 0)
                    ImGui.Separator();
                foreach (var line in notes)
                    ImGui.TextUnformatted(Display(line));
                ImGui.PopTextWrapPos();
            }
        }

        if (plan.Source is { } source)
        {
            ImGui.SameLine();
            var credit = $"{source.Title} by {source.Author}" + (source.Version.Length > 0 ? $" ({source.Version})" : "");
            ImGui.AlignTextToFramePadding();
            ImGui.TextDisabled(Display(credit));
            if (ImGui.IsItemHovered())
                ImGui.SetTooltip(Display((source.Via.Length > 0 ? source.Via + "\n" : "") + source.Url + "\nClick to open the sheet."));
            if (ImGui.IsItemClicked() && source.Url.Length > 0)
                Util.OpenLink(source.Url);
        }
    }

    // ------------------------------------------------------------------ helpers

    private static void Icon(uint icon, float size, bool dim = false)
    {
        var wrap = Plugin.TextureProvider.GetFromGameIcon(new GameIconLookup(icon)).GetWrapOrEmpty();
        ImGui.Image(wrap.Handle, new Vector2(size), Vector2.Zero, Vector2.One, dim ? new Vector4(1, 1, 1, 0.35f) : Vector4.One);
    }

    [GeneratedRegex("[¹²³⁴⁵⁶⁷⁸⁹⁰]+")]
    private static partial Regex Superscript();

    /// <summary>
    /// Swaps characters the game's fonts may not have for plain ones: a superscript footnote mark becomes [n], so
    /// "Reprisal ⁵" reads "Reprisal [5]" rather than "Reprisal 5".
    /// </summary>
    public static string Display(string s)
    {
        s = Superscript().Replace(s, m => "[" + string.Concat(m.Value.Select(c => (char)('0' + "⁰¹²³⁴⁵⁶⁷⁸⁹".IndexOf(c)))) + "]");
        var sb = new StringBuilder(s.Length);
        foreach (var c in s)
        {
            sb.Append(c switch
            {
                '➔' or '→' => "->",
                '✔' => "yes",
                '–' => "-",
                '’' => "'",
                _ => c.ToString(),
            });
        }

        return sb.ToString();
    }
}
