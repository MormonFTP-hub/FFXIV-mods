using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Lumina.Data.Files;
using Lumina.Excel.Sheets;

namespace DroneRunner;

/// <summary>A Cosmic Exploration planet with Artifact Search.</summary>
public sealed record Zone(
    uint TerritoryId,
    uint MapId,
    string Name,
    uint ModuleItemId,
    uint BronzeRecordId,
    uint SilverRecordId,
    uint GoldRecordId,
    Vector2 KaedeMapPos)
{
    public uint[] RecordIds => [BronzeRecordId, SilverRecordId, GoldRecordId];
}

/// <summary>One fixed spot an artifact can turn up at (a WKS_TREASURE layout point).</summary>
public sealed record Site(uint InstanceId, string Layer, Vector3 Position);

public static class Zones
{
    public const uint ArtifactEObj = 2015138;       // EObj / EObjName "artifact"
    public const uint ArtifactSiteLabel = 17173;    // Addon "Artifact Site" (the red X on the map)
    public const uint UsePromptLabel = 17172;       // Addon "Use ?" (the Yes/No before a module goes up)

    // LogMessage rows
    public const uint LocatedLog = 11379;           // The reconnaissance drone has located an artifact!
    public const uint AlreadyDeployedLog = 11380;   // A drone module has already been deployed... retrieve any discovered artifacts
    public const uint WrongPlanetLog = 11381;       // Unable to use drone modules from another planet.
    public const uint OutsideDutyLog = 11382;       // This item cannot be used outside of specified duties.
    public const uint AppraisalStartLog = 11386;    // Starting artifact appraisal... (examining it)
    public const uint AppraisalDoneLog = 11383;     // Artifact appraisal complete! (the record follows)

    public static readonly Zone[] All =
    [
        new(1310, 1139, "Oizys", 50414, 50413, 50412, 50411, new Vector2(17.3f, 24.1f)),
        new(1319, 1246, "Auxesia", 50415, 52095, 52094, 52093, new Vector2(27.8f, 29.0f)),
    ];

    public static Zone? ForTerritory(uint territoryId) => All.FirstOrDefault(z => z.TerritoryId == territoryId);

    private static readonly Dictionary<uint, List<Site>> SiteCache = [];

    /// <summary>Every spot an artifact can appear at in this zone, read from its planlive.lgb (layers named WKS_TREASURE_*).</summary>
    public static IReadOnlyList<Site> Sites(Zone zone)
    {
        if (SiteCache.TryGetValue(zone.TerritoryId, out var cached))
            return cached;

        var sites = new List<Site>();
        try
        {
            var bg = Plugin.DataManager.GetExcelSheet<TerritoryType>().GetRowOrDefault(zone.TerritoryId)?.Bg.ExtractText();
            if (!string.IsNullOrEmpty(bg))
            {
                var dir = bg[..bg.LastIndexOf('/')];
                var lgb = Plugin.DataManager.GetFile<LgbFile>($"bg/{dir}/planlive.lgb");
                foreach (var layer in lgb?.Layers ?? [])
                {
                    if (!layer.Name.StartsWith("WKS_TREASURE", StringComparison.OrdinalIgnoreCase))
                        continue;
                    foreach (var inst in layer.InstanceObjects)
                    {
                        var t = inst.Transform.Translation;
                        sites.Add(new Site(inst.InstanceId, layer.Name, new Vector3(t.X, t.Y, t.Z)));
                    }
                }
            }
        }
        catch (Exception e)
        {
            Plugin.Log.Warning(e, $"Couldn't read the artifact sites for {zone.Name}");
        }

        SiteCache[zone.TerritoryId] = sites;
        return sites;
    }

    /// <summary>World position to the map's X/Y coordinates (the numbers the game shows).</summary>
    public static Vector2 ToMapCoords(Vector3 world, uint mapId)
    {
        var map = Plugin.DataManager.GetExcelSheet<Map>().GetRowOrDefault(mapId);
        var scale = (map?.SizeFactor ?? 100) / 100f;
        float Convert(float v, short offset) => 41f / scale * ((v + offset) * scale + 1024f) / 2048f + 1f;
        return new Vector2(Convert(world.X, map?.OffsetX ?? 0), Convert(world.Z, map?.OffsetY ?? 0));
    }
}
