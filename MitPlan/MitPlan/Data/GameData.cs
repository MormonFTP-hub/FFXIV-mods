using System;
using System.Collections.Generic;
using Lumina.Excel.Sheets;
using LuminaAction = Lumina.Excel.Sheets.Action;

namespace MitPlan.Data;

/// <summary>Lumina lookups: action icons by name, cast names by id, the current duty's name.</summary>
internal static class GameData
{
    private static Dictionary<string, uint>? icons;
    private static readonly Dictionary<uint, string> CastNames = [];

    /// <summary>The icon of a player action, by its English name; 0 when there's no such action.</summary>
    public static uint Icon(string action)
    {
        if (icons == null)
        {
            icons = new Dictionary<string, uint>(StringComparer.OrdinalIgnoreCase);
            var fallback = new Dictionary<string, uint>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in Plugin.DataManager.GetExcelSheet<LuminaAction>())
            {
                var name = row.Name.ToString();
                if (string.IsNullOrEmpty(name) || row.Icon == 0)
                    continue;

                if (row.IsPlayerAction && !row.IsPvP)
                    icons.TryAdd(name, row.Icon);
                else if (!row.IsPvP)
                    fallback.TryAdd(name, row.Icon);
            }

            foreach (var (name, icon) in fallback)
                icons.TryAdd(name, icon);
        }

        return icons.GetValueOrDefault(action);
    }

    private static Dictionary<string, uint>? jobIds;

    /// <summary>The framed job icon for a job abbreviation; 0 if unknown.</summary>
    public static uint JobIcon(string job)
    {
        if (jobIds == null)
        {
            jobIds = new Dictionary<string, uint>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in Plugin.DataManager.GetExcelSheet<ClassJob>())
                jobIds.TryAdd(row.Abbreviation.ToString(), row.RowId);
        }

        return jobIds.TryGetValue(job, out var id) ? 62100 + id : 0;
    }

    public static string CastName(uint actionId)
    {
        if (CastNames.TryGetValue(actionId, out var cached))
            return cached;

        var name = Plugin.DataManager.GetExcelSheet<LuminaAction>().TryGetRow(actionId, out var row) ? row.Name.ToString() : "";
        CastNames[actionId] = name;
        return name;
    }

    /// <summary>The duty you're in (its Duty Finder name), or "" outside duties.</summary>
    public static string CurrentDuty()
    {
        if (!Plugin.DataManager.GetExcelSheet<TerritoryType>().TryGetRow(Plugin.ClientState.TerritoryType, out var territory))
            return "";

        return territory.ContentFinderCondition.RowId != 0 && territory.ContentFinderCondition.IsValid
            ? territory.ContentFinderCondition.Value.Name.ToString()
            : "";
    }
}
