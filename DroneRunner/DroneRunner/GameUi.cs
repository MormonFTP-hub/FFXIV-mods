using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Dalamud.Game.ClientState.Objects.Enums;
using Dalamud.Game.ClientState.Objects.Types;
using Dalamud.Memory;
using FFXIVClientStructs.FFXIV.Client.Game;
using FFXIVClientStructs.FFXIV.Client.UI;
using FFXIVClientStructs.FFXIV.Client.UI.Agent;
using FFXIVClientStructs.FFXIV.Component.GUI;

namespace DroneRunner;

/// <summary>A marker on the map (for the diagnostics panel and for spotting the artifact's red X).</summary>
public readonly record struct MapMark(uint IconId, string Tooltip, Vector3 Position);

/// <summary>Reads the bags, the map and nearby objects, and presses the game's own buttons.</summary>
public static unsafe class GameUi
{
    public static int ItemCount(uint itemId)
    {
        var manager = InventoryManager.Instance();
        return manager == null ? 0 : manager->GetInventoryItemCount(itemId);
    }

    public static uint FreeBagSlots()
    {
        var manager = InventoryManager.Instance();
        return manager == null ? 0 : manager->GetEmptySlotsInBag();
    }

    public static void UseItem(uint itemId) => AgentInventoryContext.Instance()->UseItem(itemId);

    public static bool UseGeneralAction(uint id) =>
        ActionManager.Instance()->UseAction(ActionType.GeneralAction, id);

    public static bool CanUseGeneralAction(uint id) =>
        ActionManager.Instance()->GetActionStatus(ActionType.GeneralAction, id) == 0;

    /// <summary>The map's event markers: quest and content icons, the artifact's red X among them.</summary>
    public static List<MapMark> EventMarkers()
    {
        var list = new List<MapMark>();
        var agent = AgentMap.Instance();
        if (agent == null)
            return list;

        foreach (ref var m in agent->EventMarkers)
        {
            var tooltip = m.TooltipString == null ? "" : m.TooltipString->ToString();
            list.Add(new MapMark(m.IconId, tooltip, m.Position));
        }

        return list;
    }

    /// <summary>Put the map flag on a world position and open the map there.</summary>
    public static void FlagOnMap(Zone zone, Vector3 world)
    {
        var agent = AgentMap.Instance();
        if (agent == null)
            return;
        agent->SetFlagMapMarker(zone.TerritoryId, zone.MapId, world.X, world.Z);
        agent->OpenMapByMapId(zone.MapId, zone.TerritoryId);
    }

    public static void Interact(IGameObject obj) =>
        FFXIVClientStructs.FFXIV.Client.Game.Control.TargetSystem.Instance()->InteractWithObject(
            (FFXIVClientStructs.FFXIV.Client.Game.Object.GameObject*)obj.Address, true);

    public static IEnumerable<IGameObject> EventObjects() =>
        Plugin.ObjectTable.Where(o => o.ObjectKind == ObjectKind.EventObj);

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

    /// <summary>Whether <paramref name="shown"/> contains <paramref name="wanted"/>.</summary>
    public static bool Contains(string shown, string wanted)
    {
        var w = Squash(wanted);
        return w.Length > 0 && Squash(shown).Contains(w);
    }

    public static float Distance2D(Vector3 a, Vector3 b) => Vector2.Distance(new Vector2(a.X, a.Z), new Vector2(b.X, b.Z));
}
