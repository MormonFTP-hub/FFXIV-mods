using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Dalamud.Game.ClientState.Conditions;
using Dalamud.Game.ClientState.Objects.Enums;
using Dalamud.Game.ClientState.Objects.Types;
using Dalamud.Plugin.Services;
using FFXIVClientStructs.FFXIV.Client.Game;
using FFXIVClientStructs.FFXIV.Client.Game.Control;
using FFXIVClientStructs.FFXIV.Client.UI;
using FFXIVClientStructs.FFXIV.Client.UI.Agent;
using FFXIVClientStructs.FFXIV.Component.GUI;
using Lumina.Excel.Sheets;
using GameObjectStruct = FFXIVClientStructs.FFXIV.Client.Game.Object.GameObject;

namespace MateriaTransmute;

/// <summary>What one trade gave and got.</summary>
public sealed record TradeResult(DateTime Time, int Grade, string Gave, MateriaItem? Got, int GotCount)
{
    public bool GradeUp => Got != null && Got.Grade > Grade;
}

/// <summary>
/// Runs the trades: talks to Mutamix, picks "Transmute Materia", puts five junk materia in the window, confirms,
/// says yes, waits for the new materia to land in the bags, and goes again until the junk runs out.
/// Every step checks it's looking at Mutamix's own windows; anything else stops it.
/// </summary>
public sealed unsafe class Transmuter : IDisposable
{
    public const uint MutamixId = 1001425;        // ENpcResident / ENpcBase: Mutamix Bubblypots
    public const uint TerritoryId = 141;          // Central Thanalan
    public const uint MapId = 21;
    public const float MapX = 23.7f, MapY = 13.6f;
    private const uint TransmuteTalkRow = 721070; // CustomTalk: his "Transmute Materia" menu entry
    private const uint ConfirmPromptRow = 3912;   // Addon: "Are you certain you wish to transmute these materia?"
    public const float TalkRange = 6.5f;

    private readonly Plugin plugin;
    private readonly string menuText;
    private readonly string promptText;

    public bool Running { get; private set; }
    public string Status { get; private set; } = "Idle";
    public int TradesThisRun { get; private set; }
    public List<TradeResult> Results { get; } = [];

    // The trade going into the window
    private Batch? filling;
    private int pickIndex;
    private int expectedInWindow;
    private DateTime lastAdd;
    private bool confirmClicked;
    private DateTime confirmAt;

    // The trade sent off, waiting for the bags to change
    private Batch? sent;
    private Dictionary<uint, int>? before;
    private DateTime sentAt;

    private DateTime nextStep;
    private DateTime lastProgress;
    private DateTime nextInteract;
    private DateTime lastInteract;
    private int interactTries;

    public Transmuter(Plugin plugin)
    {
        this.plugin = plugin;
        menuText = Plugin.DataManager.GetExcelSheet<CustomTalk>().GetRowOrDefault(TransmuteTalkRow)?.MainOption.ExtractText()
                   is { Length: > 0 } m ? m : "Transmute Materia";
        promptText = Plugin.DataManager.GetExcelSheet<Addon>().GetRowOrDefault(ConfirmPromptRow)?.Text.ExtractText()
                     is { Length: > 0 } p ? p : "Are you certain you wish to transmute these materia?";
        Plugin.Framework.Update += OnUpdate;
    }

    public void Dispose() => Plugin.Framework.Update -= OnUpdate;

    /// <summary>Why a run can't start right now, or null if it can.</summary>
    public string? CantStart()
    {
        var config = plugin.Configuration;
        if (config.TrashTypes.Count == 0 && config.TrashItems.Count == 0)
            return "Tick the materia you want to get rid of first.";
        if (Planner.CountTrades(GameUi.ScanBags(plugin.Catalog), config) == 0)
            return "No grade has five junk materia to spare yet.";
        if (FindMutamix() is not { } npc || Distance(npc) > TalkRange)
            return "Stand next to Mutamix Bubblypots in Central Thanalan.";
        if (GameUi.FreeBagSlots() == 0)
            return "Make room for one more item in your bags.";
        return null;
    }

    public void Start()
    {
        if (Running)
            return;

        if (CantStart() is { } reason)
        {
            Status = reason;
            Plugin.ChatGui.PrintError(reason, "Transmute");
            return;
        }

        Running = true;
        TradesThisRun = 0;
        filling = null;
        sent = null;
        before = null;
        confirmClicked = false;
        interactTries = 0;
        nextStep = nextInteract = DateTime.UtcNow;
        lastProgress = DateTime.UtcNow;
        Status = "Starting";
    }

    public void Stop(string why)
    {
        if (!Running)
            return;

        Running = false;
        filling = null;
        sent = null;
        before = null;
        confirmClicked = false;
        Status = why;
        Plugin.ChatGui.Print(why, "Transmute", 45);
    }

    public static IGameObject? FindMutamix() =>
        Plugin.ObjectTable.FirstOrDefault(o => o.ObjectKind == ObjectKind.EventNpc && o.BaseId == MutamixId);

    public static float Distance(IGameObject obj) =>
        Plugin.ObjectTable.LocalPlayer is { } me ? Vector3.Distance(me.Position, obj.Position) : float.MaxValue;

    private void OnUpdate(IFramework framework)
    {
        if (!Running)
            return;

        try
        {
            Step();
        }
        catch (Exception e)
        {
            Plugin.Log.Error(e, "Transmute step failed");
            Stop($"Stopped: something went wrong ({e.Message}).");
        }
    }

    private void Progress(string status)
    {
        Status = status;
        lastProgress = DateTime.UtcNow;
    }

    private void Step()
    {
        var now = DateTime.UtcNow;

        // The result is checked every frame so it's logged the moment the bags change.
        if (sent != null && CheckResult(now))
            return;

        if (now < nextStep)
            return;
        nextStep = now.AddMilliseconds(250);

        if (Plugin.Condition[ConditionFlag.InCombat] || Plugin.Condition[ConditionFlag.BoundByDuty])
        {
            Stop("Stopped: you're in combat or in a duty.");
            return;
        }

        if (Plugin.Condition[ConditionFlag.OccupiedInCutSceneEvent] || Plugin.Condition[ConditionFlag.WatchingCutscene]
            || Plugin.Condition[ConditionFlag.WatchingCutscene78])
        {
            lastProgress = now;
            Status = "Mutamix is working his magic";
            return;
        }

        if (now - lastProgress > TimeSpan.FromSeconds(20))
        {
            Stop($"Stopped: nothing happened for 20 seconds (last step: {Status}).");
            return;
        }

        // The "are you certain" prompt after Confirm
        if (GameUi.TryGetAddon("SelectYesno", out var yesnoBase))
        {
            var yesno = (AddonSelectYesno*)yesnoBase;
            if (filling != null && confirmClicked && GameUi.Matches(GameUi.YesnoText(yesno), promptText))
            {
                before = GameUi.Counts(GameUi.ScanBags(plugin.Catalog));
                if (!GameUi.ClickButton(yesnoBase, yesno->YesButton))
                {
                    Status = "Waiting for the Yes button";
                    return;
                }

                sent = filling;
                sentAt = now;
                filling = null;
                confirmClicked = false;
                Progress($"Transmuting {sent.Describe()}");
                nextStep = now.AddMilliseconds(600);
                return;
            }

            Status = "A Yes/No box that isn't the transmute one is open; answer it to carry on";
            return;
        }

        // Trade sent: touch nothing until the bags change, only move his chatter along.
        if (sent != null)
        {
            if (GameUi.TryGetAddon("Talk", out var chatter) && TalkingToMutamix(now))
            {
                GameUi.ClickTalk(chatter);
                nextStep = now.AddMilliseconds(400);
            }

            Status = "Waiting for the result";
            if (now - sentAt > TimeSpan.FromSeconds(15))
                Stop("Stopped: no new materia showed up within 15 seconds of the trade. Check your bags, then press Start again.");
            return;
        }

        if (GameUi.TryGetAddon("TradeMultiple", out var trade))
        {
            FillWindow((AddonTradeMultiple*)trade, now);
            return;
        }

        if (GameUi.TryGetAddon("SelectString", out var select))
        {
            PickMenu(select, &((AddonSelectString*)select)->PopupMenu.PopupMenu, now);
            return;
        }

        if (GameUi.TryGetAddon("SelectIconString", out var iconSelect))
        {
            PickMenu(iconSelect, &((AddonSelectIconString*)iconSelect)->PopupMenu.PopupMenu, now);
            return;
        }

        if (GameUi.TryGetAddon("Talk", out var talk))
        {
            if (!TalkingToMutamix(now))
            {
                Status = "Someone else is talking to you; finish that to carry on";
                return;
            }

            GameUi.ClickTalk(talk);
            Progress("Talking to Mutamix");
            nextStep = now.AddMilliseconds(400);
            return;
        }

        if (Busy())
        {
            Status = "Waiting for the game";
            return;
        }

        StartNextTrade(now);
    }

    private static bool Busy() =>
        Plugin.Condition[ConditionFlag.OccupiedInEvent] || Plugin.Condition[ConditionFlag.OccupiedInQuestEvent]
        || Plugin.Condition[ConditionFlag.Occupied] || Plugin.Condition[ConditionFlag.Occupied30]
        || Plugin.Condition[ConditionFlag.Occupied33] || Plugin.Condition[ConditionFlag.Occupied38]
        || Plugin.Condition[ConditionFlag.Occupied39] || Plugin.Condition[ConditionFlag.BetweenAreas]
        || Plugin.Condition[ConditionFlag.BetweenAreas51] || Plugin.Condition[ConditionFlag.Casting];

    /// <summary>The window on screen belongs to Mutamix: he's the target, or we spoke to him moments ago.</summary>
    private bool TalkingToMutamix(DateTime now) =>
        Plugin.TargetManager.Target?.BaseId == MutamixId || now - lastInteract < TimeSpan.FromSeconds(90);

    private void StartNextTrade(DateTime now)
    {
        var config = plugin.Configuration;
        if (config.MaxTrades > 0 && TradesThisRun >= config.MaxTrades)
        {
            Stop($"Done: made the {TradesThisRun} trade(s) you asked for.");
            return;
        }

        if (Planner.Next(GameUi.ScanBags(plugin.Catalog), config) == null)
        {
            Stop(TradesThisRun == 0
                ? "Nothing to trade: no grade has five junk materia to spare."
                : $"Done: {TradesThisRun} trade(s), and the junk has run out.");
            return;
        }

        if (GameUi.FreeBagSlots() == 0)
        {
            Stop("Stopped: make room for one more item in your bags.");
            return;
        }

        if (FindMutamix() is not { } npc || Distance(npc) > TalkRange)
        {
            Stop("Stopped: stand next to Mutamix Bubblypots and press Start again.");
            return;
        }

        if (now < nextInteract)
            return;

        if (interactTries >= 3)
        {
            Stop("Stopped: Mutamix isn't answering. Walk right up to him and press Start again.");
            return;
        }

        Plugin.TargetManager.Target = npc;
        TargetSystem.Instance()->InteractWithObject((GameObjectStruct*)npc.Address, true);
        interactTries++;
        lastInteract = now;
        nextInteract = now.AddSeconds(2.5);
        Progress("Talking to Mutamix");
    }

    private void PickMenu(AtkUnitBase* addon, PopupMenu* menu, DateTime now)
    {
        if (!TalkingToMutamix(now))
        {
            Status = "A menu from someone else is open; close it to carry on";
            return;
        }

        interactTries = 0;
        var entries = GameUi.MenuEntries(menu);
        var index = entries.FindIndex(e => GameUi.Matches(e, menuText));
        if (index < 0)
        {
            Plugin.Log.Info($"Menu without \"{menuText}\": {string.Join(" | ", entries)}");
            Stop($"Stopped: Mutamix's menu has no \"{menuText}\". It unlocks with the quest \"Marvelously Mutable Materia\".");
            return;
        }

        addon->FireCallbackInt(index);
        Progress($"Picked \"{entries[index]}\"");
        nextStep = now.AddMilliseconds(500);
    }

    private void FillWindow(AddonTradeMultiple* addon, DateTime now)
    {
        interactTries = 0;
        var agent = AgentTradeMultiple.Instance();
        if (agent == null)
        {
            Status = "Waiting for the transmute window";
            return;
        }

        var inWindow = InWindow(agent);

        if (filling == null)
        {
            if (inWindow > 0)
            {
                Stop("Stopped: the transmute window already has materia in it. Take them out and press Start again.");
                return;
            }

            filling = Planner.Next(GameUi.ScanBags(plugin.Catalog), plugin.Configuration);
            if (filling == null)
            {
                Stop("Done: nothing left to trade.");
                return;
            }

            pickIndex = 0;
            expectedInWindow = 0;
            confirmClicked = false;
            Progress($"Filling the window: {filling.Describe()}");
            nextStep = now.AddMilliseconds(300);
            return;
        }

        if (inWindow != expectedInWindow)
        {
            if (pickIndex == 0 || now - lastAdd > TimeSpan.FromSeconds(2))
            {
                Stop(pickIndex == 0
                    ? "Stopped: something else went into the transmute window. Nothing was traded."
                    : $"Stopped: the game didn't take {filling.Picks[pickIndex - 1].Stack.Materia.Name}. Nothing was traded.");
            }

            return;
        }

        if (pickIndex < filling.Picks.Count)
        {
            var (stack, take) = filling.Picks[pickIndex];
            var item = GameUi.Slot(stack.Container, stack.Slot);
            if (item == null || item->ItemId != stack.Materia.ItemId || item->Quantity < take)
            {
                Stop("Stopped: your bags changed while the window was filling. Press Start again.");
                return;
            }

            agent->AddItemQuantity(item, (uint)take);
            pickIndex++;
            expectedInWindow += take;
            lastAdd = now;
            Progress($"Added {take}× {stack.Materia.Name}");
            nextStep = now.AddMilliseconds(300);
            return;
        }

        if (confirmClicked)
        {
            // The Yes/No should be up by now; if it never came, press Confirm again.
            if (now - confirmAt > TimeSpan.FromSeconds(3))
                confirmClicked = false;
            return;
        }

        if (!WindowHolds(agent, filling))
        {
            Stop("Stopped: the window holds something other than the junk picked for it. Nothing was traded.");
            return;
        }

        if (addon->ConfirmButton == null || !addon->ConfirmButton->IsEnabled)
        {
            Status = "Waiting for the Confirm button";
            return;
        }

        if (GameUi.ClickButton(&addon->AtkUnitBase, addon->ConfirmButton))
        {
            confirmClicked = true;
            confirmAt = now;
            Progress("Confirming");
            nextStep = now.AddMilliseconds(400);
        }
    }

    private static int InWindow(AgentTradeMultiple* agent)
    {
        var total = 0;
        foreach (ref var slot in agent->Slots)
        {
            if (slot.Container != InventoryType.Invalid && slot.Quantity > 0)
                total += slot.Quantity;
        }

        return total;
    }

    /// <summary>Every slot in the window holds one of the planned materia, in the planned amounts.</summary>
    private static bool WindowHolds(AgentTradeMultiple* agent, Batch batch)
    {
        var want = batch.Picks.GroupBy(p => p.Stack.Materia.ItemId).ToDictionary(g => g.Key, g => g.Sum(p => p.Take));
        var have = new Dictionary<uint, int>();
        foreach (ref var slot in agent->Slots)
        {
            if (slot.Container == InventoryType.Invalid || slot.Quantity <= 0)
                continue;

            var id = slot.ItemId;
            if (id == 0 && GameUi.Slot(slot.Container, slot.Slot) is var item && item != null)
                id = item->ItemId;
            have[id] = have.GetValueOrDefault(id) + slot.Quantity;
        }

        return have.Count == want.Count && want.All(w => have.GetValueOrDefault(w.Key) == w.Value);
    }

    /// <summary>True once the trade has landed: the five are gone and the new materia is in the bags.</summary>
    private bool CheckResult(DateTime now)
    {
        if (sent == null || before == null)
            return false;

        var after = GameUi.Counts(GameUi.ScanBags(plugin.Catalog));
        var gaveIds = sent.Picks.Select(p => p.Stack.Materia.ItemId).ToHashSet();
        var used = gaveIds.Sum(id => before.GetValueOrDefault(id) - after.GetValueOrDefault(id));
        if (used < Planner.PerTrade)
            return false;

        var gained = after.Where(kv => !gaveIds.Contains(kv.Key) && kv.Value > before.GetValueOrDefault(kv.Key)).ToList();
        if (gained.Count == 0 && now - sentAt < TimeSpan.FromSeconds(4))
            return false; // the new one can land a moment after the five leave

        MateriaItem? got = null;
        var gotCount = 0;
        if (gained.Count > 0)
        {
            var best = gained.OrderByDescending(kv => kv.Value - before.GetValueOrDefault(kv.Key)).First();
            plugin.Catalog.TryGet(best.Key, out var m);
            got = m;
            gotCount = best.Value - before.GetValueOrDefault(best.Key);
        }

        var result = new TradeResult(DateTime.Now, sent.Grade, sent.Describe(), got, gotCount);
        Results.Insert(0, result);
        TradesThisRun++;
        plugin.Configuration.TotalTrades++;
        if (result.GradeUp)
            plugin.Configuration.TotalGradeUps++;
        plugin.Configuration.Save();

        if (plugin.Configuration.EchoResults)
        {
            var gotText = got == null ? "(couldn't see what came back)" : $"{(gotCount > 1 ? $"{gotCount}× " : "")}{got.Name}";
            Plugin.ChatGui.Print($"{result.Gave} → {gotText}{(result.GradeUp ? "  ★ Grade up!" : "")}", "Transmute", (ushort)(result.GradeUp ? 500 : 45));
        }

        sent = null;
        before = null;
        Progress(got == null ? "Trade done" : $"Got {got.Name}");
        nextStep = now.AddMilliseconds(500);
        return true;
    }
}
