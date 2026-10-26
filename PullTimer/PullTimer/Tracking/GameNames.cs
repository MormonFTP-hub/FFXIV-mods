using System.Collections.Generic;
using Lumina.Excel.Sheets;
using LuminaAction = Lumina.Excel.Sheets.Action;

namespace PullTimer.Tracking;

/// <summary>Lumina lookups for display names, cached because they are hit from the packet hook.</summary>
internal static class GameNames
{
    private const byte ActionTypeAction = 1;
    private const byte ActionTypeItem = 2;

    private static readonly Dictionary<(byte Type, uint Id), string> ActionCache = [];

    public static bool IsAutoAttack(byte type, uint id) => type == ActionTypeAction && id is 7 or 8;

    public static string Action(byte type, uint id)
    {
        if (ActionCache.TryGetValue((type, id), out var cached))
            return cached;

        var name = type switch
        {
            ActionTypeAction => Plugin.DataManager.GetExcelSheet<LuminaAction>().TryGetRow(id, out var action)
                ? action.Name.ToString()
                : null,
            ActionTypeItem => ItemName(id),
            _ => null,
        };

        if (string.IsNullOrWhiteSpace(name))
            name = $"Action #{id}";

        ActionCache[(type, id)] = name;
        return name;
    }

    public static string CurrentDuty()
    {
        var territoryId = Plugin.ClientState.TerritoryType;
        if (!Plugin.DataManager.GetExcelSheet<TerritoryType>().TryGetRow(territoryId, out var territory))
            return "Unknown area";

        if (territory.ContentFinderCondition.RowId != 0 && territory.ContentFinderCondition.IsValid)
        {
            var duty = territory.ContentFinderCondition.Value.Name.ToString();
            if (!string.IsNullOrWhiteSpace(duty))
                return char.ToUpperInvariant(duty[0]) + duty[1..];
        }

        return territory.PlaceName.IsValid ? territory.PlaceName.Value.Name.ToString() : "Unknown area";
    }

    private static string? ItemName(uint id)
    {
        // HQ items come through with +1,000,000.
        var hq = id >= 1_000_000;
        var baseId = id % 500_000;
        if (!Plugin.DataManager.GetExcelSheet<Item>().TryGetRow(baseId, out var item))
            return null;

        var name = item.Name.ToString();
        return hq ? $"{name} (HQ)" : name;
    }
}
