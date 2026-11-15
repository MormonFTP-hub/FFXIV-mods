using System;
using System.Collections.Generic;
using System.Linq;
using Dalamud.Memory;
using FFXIVClientStructs.FFXIV.Client.Game;
using FFXIVClientStructs.FFXIV.Client.UI;
using FFXIVClientStructs.FFXIV.Component.GUI;

namespace MateriaTransmute;

/// <summary>Reads the bags and presses the game's own buttons, the same way a mouse click would.</summary>
public static unsafe class GameUi
{
    private static readonly InventoryType[] Bags =
        [InventoryType.Inventory1, InventoryType.Inventory2, InventoryType.Inventory3, InventoryType.Inventory4];

    /// <summary>Every materia stack in your four bag pages.</summary>
    public static List<MateriaStack> ScanBags(MateriaCatalog catalog)
    {
        var list = new List<MateriaStack>();
        var manager = InventoryManager.Instance();
        if (manager == null)
            return list;

        foreach (var bag in Bags)
        {
            var container = manager->GetInventoryContainer(bag);
            if (container == null)
                continue;

            for (var i = 0; i < container->Size; i++)
            {
                var slot = container->GetInventorySlot(i);
                if (slot == null || slot->ItemId == 0 || slot->Quantity <= 0)
                    continue;
                if (catalog.TryGet(slot->ItemId, out var materia))
                    list.Add(new MateriaStack(bag, (short)i, materia, slot->Quantity));
            }
        }

        return list;
    }

    public static Dictionary<uint, int> Counts(IEnumerable<MateriaStack> stacks) =>
        stacks.GroupBy(s => s.Materia.ItemId).ToDictionary(g => g.Key, g => g.Sum(s => s.Quantity));

    public static uint FreeBagSlots()
    {
        var manager = InventoryManager.Instance();
        return manager == null ? 0 : manager->GetEmptySlotsInBag();
    }

    public static InventoryItem* Slot(InventoryType container, short slot)
    {
        var manager = InventoryManager.Instance();
        return manager == null ? null : manager->GetInventorySlot(container, slot);
    }

    /// <summary>An addon that is open, drawn and finished loading.</summary>
    public static bool TryGetAddon(string name, out AtkUnitBase* addon)
    {
        addon = (AtkUnitBase*)Plugin.GameGui.GetAddonByName(name).Address;
        return addon != null && addon->IsVisible && addon->UldManager.LoadedState == AtkLoadState.Loaded;
    }

    /// <summary>Press a button: hand the addon the click event the button registered for itself.</summary>
    public static bool ClickButton(AtkUnitBase* addon, AtkComponentButton* button)
    {
        if (addon == null || button == null || !button->IsEnabled)
            return false;

        var node = button->AtkComponentBase.OwnerNode;
        if (node == null)
            return false;

        AtkEvent* found = null;
        for (var evt = node->AtkResNode.AtkEventManager.Event; evt != null; evt = evt->NextEvent)
        {
            if (evt->State.EventType == AtkEventType.ButtonClick)
            {
                found = evt;
                break;
            }

            found = found == null ? evt : found;
        }

        if (found == null)
            return false;

        var data = new AtkEventData();
        addon->ReceiveEvent(found->State.EventType, (int)found->Param, found, &data);
        return true;
    }

    /// <summary>Click a Talk box to move the conversation on.</summary>
    public static void ClickTalk(AtkUnitBase* addon)
    {
        var evt = new AtkEvent
        {
            Listener = (AtkEventListener*)addon,
            Target = &AtkStage.Instance()->AtkEventTarget,
        };
        var data = new AtkEventData();
        addon->ReceiveEvent(AtkEventType.MouseClick, 0, &evt, &data);
    }

    /// <summary>The entries of a SelectString or SelectIconString menu.</summary>
    public static List<string> MenuEntries(PopupMenu* menu)
    {
        var list = new List<string>();
        if (menu == null || menu->EntryNames == null)
            return list;

        for (var i = 0; i < menu->EntryCount; i++)
        {
            var ptr = (nint)menu->EntryNames[i].Value;
            list.Add(ptr == 0 ? "" : MemoryHelper.ReadSeStringNullTerminated(ptr).TextValue);
        }

        return list;
    }

    public static string YesnoText(AddonSelectYesno* addon)
    {
        if (addon == null || addon->PromptText == null)
            return "";
        var ptr = (nint)addon->PromptText->NodeText.StringPtr.Value;
        return ptr == 0 ? "" : MemoryHelper.ReadSeStringNullTerminated(ptr).TextValue;
    }

    /// <summary>Text compared without spaces, line breaks or case, since the game wraps prompts to fit the box.</summary>
    public static string Squash(string text) =>
        new string(text.Where(c => !char.IsWhiteSpace(c) && !char.IsControl(c)).ToArray()).ToLowerInvariant();

    /// <summary>Whether <paramref name="shown"/> is (or contains) <paramref name="wanted"/>.</summary>
    public static bool Matches(string shown, string wanted)
    {
        var w = Squash(wanted);
        return w.Length > 0 && Squash(shown).Contains(w);
    }
}
