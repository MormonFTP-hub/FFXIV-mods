using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Dalamud.Game.Chat;
using Dalamud.Game.ClientState.Conditions;
using Dalamud.Game.ClientState.Objects.Types;
using Dalamud.Plugin.Services;
using FFXIVClientStructs.FFXIV.Client.UI;
using Lumina.Excel.Sheets;

namespace DroneRunner;

public enum Phase
{
    Idle,
    Deploying,
    Locating,
    Travelling,
    Examining,
}

/// <summary>One artifact examined and what it gave.</summary>
public sealed record Find(DateTime Time, string Zone, uint RecordId, string RecordName, int Tier);

/// <summary>
/// Runs Artifact Search: use a drone module, find the artifact it located (the artifact itself if it's in view, else the
/// red X on the map, else the zone's known artifact spots nearest first), travel there, examine it, repeat.
/// </summary>
public sealed unsafe class Runner : IDisposable
{
    private const uint MountRoulette = 9;   // GeneralAction
    private const uint Dismount = 23;       // GeneralAction
    private const float ExamineRange = 3.5f;
    private const float SiteSeenRange = 40f; // an artifact this close would be in the object table

    private readonly Plugin plugin;
    private readonly Navmesh nav = new();
    private readonly string artifactName;
    private readonly string siteLabel;

    public bool Running { get; private set; }
    public Phase Phase { get; private set; } = Phase.Idle;
    public string Status { get; private set; } = "Idle";
    public List<Find> Finds { get; } = [];
    public int FoundThisRun { get; private set; }
    public bool ManualTravel { get; private set; }

    // Diagnostics
    public Vector3? Target { get; private set; }
    public string TargetSource { get; private set; } = "";
    public uint LastLogId { get; private set; }
    public DateTime LastLogTime { get; private set; }

    private Zone? zone;
    private DateTime nextStep;
    private DateTime lastProgress;

    // Deploying
    private bool deployIssued;
    private DateTime deployAt;
    private int modulesBefore;
    private int deployTries;
    private bool locatedSignal;
    private bool alreadyDeployedSignal;

    // Locating / travelling
    private bool targetIsArtifact;
    private Site? sweepSite;
    private readonly HashSet<uint> checkedSites = [];
    private readonly List<Vector3> collectedSpots = [];
    private int moveTries;
    private float bestDistance;
    private DateTime lastCloser;
    private bool mountTried;
    private bool flagged;

    // Examining
    private Dictionary<uint, int> recordsBefore = [];
    private DateTime examineSince;
    private DateTime interactAt;
    private int interactTries;

    public Runner(Plugin plugin)
    {
        this.plugin = plugin;
        artifactName = Plugin.DataManager.GetExcelSheet<EObjName>().GetRowOrDefault(Zones.ArtifactEObj)?.Singular.ExtractText()
                       is { Length: > 0 } a ? a : "artifact";
        siteLabel = Plugin.DataManager.GetExcelSheet<Addon>().GetRowOrDefault(Zones.ArtifactSiteLabel)?.Text.ExtractText()
                    is { Length: > 0 } s ? s : "Artifact Site";
        Plugin.Framework.Update += OnUpdate;
        Plugin.ChatGui.LogMessage += OnLogMessage;
    }

    public void Dispose()
    {
        Plugin.Framework.Update -= OnUpdate;
        Plugin.ChatGui.LogMessage -= OnLogMessage;
        if (Running)
            nav.Stop();
    }

    public static Zone? CurrentZone => Zones.ForTerritory(Plugin.ClientState.TerritoryType);

    public static string ItemName(uint itemId) =>
        Plugin.DataManager.GetExcelSheet<Item>().GetRowOrDefault(itemId)?.Name.ExtractText() ?? $"item {itemId}";

    public static bool OnCrafterOrGatherer()
    {
        var player = Plugin.ObjectTable.LocalPlayer;
        if (player == null || !player.ClassJob.IsValid)
            return false;
        var category = player.ClassJob.Value.ClassJobCategory.RowId;
        return category is 32 or 33; // Disciple of the Land / Hand
    }

    /// <summary>Why a run can't start right now, or null if it can.</summary>
    public string? CantStart()
    {
        if (CurrentZone is not { } z)
            return "Go to Oizys or Auxesia in Cosmic Exploration.";
        if (!OnCrafterOrGatherer())
            return "Switch to a crafter or gatherer: drones only work for them.";
        if (GameUi.ItemCount(z.ModuleItemId) == 0 && FindArtifact(out _, out _, out _) == null)
            return $"You have no {ItemName(z.ModuleItemId)}. Kaede sells them for dronebits.";
        if (GameUi.FreeBagSlots() == 0)
            return "Your bags are full: free one slot for the records.";
        return null;
    }

    public void Start()
    {
        if (Running)
            return;
        if (CantStart() is { } reason)
        {
            Status = reason;
            Plugin.ChatGui.PrintError(reason, "Drone");
            return;
        }

        zone = CurrentZone;
        Running = true;
        FoundThisRun = 0;
        ManualTravel = !Navmesh.Installed;
        checkedSites.Clear();
        collectedSpots.Clear();
        lastProgress = nextStep = DateTime.UtcNow;
        Status = "Starting";

        // A drone may already be out with an artifact waiting: fetch that first.
        if (FindArtifact(out var pos, out var source, out var isObject) is not null)
            BeginTravel(pos, source, isObject, null);
        else
            BeginDeploy();

        if (ManualTravel)
            Plugin.ChatGui.Print("vnavmesh isn't installed, so you do the walking: each artifact gets a map flag, and it's examined when you get there.", "Drone", 45);
    }

    public void Stop(string why)
    {
        if (!Running)
            return;
        Running = false;
        Phase = Phase.Idle;
        Target = null;
        nav.Stop();
        Status = why;
        Plugin.ChatGui.Print(why, "Drone", 45);
    }

    private void Progress(string status)
    {
        Status = status;
        lastProgress = DateTime.UtcNow;
    }

    private void OnLogMessage(ILogMessage message)
    {
        switch (message.LogMessageId)
        {
            case Zones.LocatedLog:
                locatedSignal = true;
                break;
            case Zones.AlreadyDeployedLog:
                alreadyDeployedSignal = true;
                break;
            case Zones.WrongPlanetLog:
            case Zones.OutsideDutyLog:
                break;
            default:
                return;
        }

        LastLogId = message.LogMessageId;
        LastLogTime = DateTime.Now;
        if (Running && message.LogMessageId is Zones.WrongPlanetLog or Zones.OutsideDutyLog)
            Stop("Stopped: the game won't let a drone module go up here.");
    }

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
            Plugin.Log.Error(e, "Drone step failed");
            Stop($"Stopped: something went wrong ({e.Message}).");
        }
    }

    // ---------------------------------------------------------------- the loop

    private void Step()
    {
        var now = DateTime.UtcNow;
        if (now < nextStep)
            return;
        nextStep = now.AddMilliseconds(200);

        if (zone == null || Plugin.ClientState.TerritoryType != zone.TerritoryId)
        {
            Stop("Stopped: you left the zone.");
            return;
        }

        if (Plugin.Condition[ConditionFlag.InCombat])
        {
            Stop("Stopped: you're in combat.");
            return;
        }

        if (!OnCrafterOrGatherer())
        {
            Stop("Stopped: you're not on a crafter or gatherer any more.");
            return;
        }

        if (Plugin.Condition[ConditionFlag.Casting] || Plugin.Condition[ConditionFlag.OccupiedInCutSceneEvent]
            || Plugin.Condition[ConditionFlag.BetweenAreas] || Plugin.Condition[ConditionFlag.Jumping])
        {
            lastProgress = now;
            return;
        }

        if (!ManualTravel && now - lastProgress > TimeSpan.FromSeconds(30))
        {
            Stop($"Stopped: nothing happened for 30 seconds (last step: {Status}).");
            return;
        }

        if (HandlePrompts(now))
            return;

        switch (Phase)
        {
            case Phase.Deploying:
                StepDeploy(now);
                break;
            case Phase.Locating:
                StepLocate(now);
                break;
            case Phase.Travelling:
                StepTravel(now);
                break;
            case Phase.Examining:
                StepExamine(now);
                break;
        }
    }

    /// <summary>The "Use [module]?" box when deploying, and any box about the artifact when examining. Anything
    /// else is left alone and the run waits (the 30-second stop catches it).</summary>
    private bool HandlePrompts(DateTime now)
    {
        if (GameUi.TryGetAddon("SelectYesno", out var yesnoBase))
        {
            var yesno = (AddonSelectYesno*)yesnoBase;
            var text = GameUi.YesnoText(yesno);
            var ours = (Phase == Phase.Deploying && GameUi.Contains(text, ItemName(zone!.ModuleItemId)))
                       || (Phase == Phase.Examining && GameUi.Contains(text, artifactName));
            if (ours && GameUi.ClickButton(yesnoBase, yesno->YesButton))
            {
                Progress(Phase == Phase.Deploying ? "Deploying the drone" : "Examining the artifact");
                nextStep = now.AddMilliseconds(500);
            }
            else
            {
                Status = "A Yes/No box is open that isn't the drone's; answer it to carry on";
                Plugin.Log.Debug($"Left a Yes/No alone in {Phase}: \"{text}\"");
            }

            return true;
        }

        if (Phase == Phase.Examining && GameUi.TryGetAddon("Talk", out var talk))
        {
            GameUi.ClickTalk(talk);
            nextStep = now.AddMilliseconds(400);
            return true;
        }

        return false;
    }

    private void BeginDeploy()
    {
        Phase = Phase.Deploying;
        deployIssued = false;
        deployTries = 0;
        Target = null;
        TargetSource = "";
        Progress("Getting a drone module ready");
    }

    private void StepDeploy(DateTime now)
    {
        var z = zone!;
        if (!deployIssued)
        {
            if (plugin.Configuration.MaxArtifacts > 0 && FoundThisRun >= plugin.Configuration.MaxArtifacts)
            {
                Stop($"Done: {FoundThisRun} artifact(s), as many as you asked for.");
                return;
            }

            if (GameUi.ItemCount(z.ModuleItemId) == 0)
            {
                Stop(FoundThisRun == 0
                    ? $"Stopped: you have no {ItemName(z.ModuleItemId)}."
                    : $"Done: {FoundThisRun} artifact(s), and you're out of drone modules. Kaede appraises the records.");
                return;
            }

            if (GameUi.FreeBagSlots() == 0)
            {
                Stop("Stopped: your bags are full. Free a slot for the next record.");
                return;
            }

            if (Plugin.Condition[ConditionFlag.Mounted])
            {
                GameUi.UseGeneralAction(Dismount);
                Status = "Getting off the mount to use the module";
                nextStep = now.AddMilliseconds(800);
                return;
            }

            modulesBefore = GameUi.ItemCount(z.ModuleItemId);
            locatedSignal = false;
            alreadyDeployedSignal = false;
            GameUi.UseItem(z.ModuleItemId);
            deployIssued = true;
            deployTries++;
            deployAt = now;
            Progress($"Using {ItemName(z.ModuleItemId)}");
            nextStep = now.AddMilliseconds(600);
            return;
        }

        if (alreadyDeployedSignal)
        {
            Plugin.Log.Info("A drone was already out: looking for its artifact");
            BeginLocate("A drone is already out: finding its artifact");
            return;
        }

        var launched = locatedSignal || GameUi.ItemCount(z.ModuleItemId) < modulesBefore;
        if (launched)
        {
            if (FindArtifact(out var pos, out var source, out var isObject) is not null)
            {
                BeginTravel(pos, source, isObject, null);
                return;
            }

            Status = "Drone is scanning";
            if (now - deployAt > TimeSpan.FromSeconds(8))
                BeginLocate("Drone found something; checking the artifact spots");
            return;
        }

        if (now - deployAt > TimeSpan.FromSeconds(6))
        {
            if (deployTries >= 3)
            {
                Stop($"Stopped: {ItemName(z.ModuleItemId)} wouldn't go up. Try using one yourself to see why.");
                return;
            }

            deployIssued = false; // try again
        }
    }

    private void BeginLocate(string status)
    {
        Phase = Phase.Locating;
        sweepSite = null;
        Progress(status);
    }

    /// <summary>No artifact in view and no red X: go round the zone's artifact spots, nearest first, until it shows up.</summary>
    private void StepLocate(DateTime now)
    {
        if (FindArtifact(out var pos, out var source, out var isObject) is not null)
        {
            BeginTravel(pos, source, isObject, null);
            return;
        }

        var me = Plugin.ObjectTable.LocalPlayer!.Position;
        var sites = Zones.Sites(zone!);
        foreach (var s in sites.Where(s => GameUi.Distance2D(me, s.Position) < SiteSeenRange))
            checkedSites.Add(s.InstanceId);

        var next = sites.Where(s => !checkedSites.Contains(s.InstanceId))
            .OrderBy(s => GameUi.Distance2D(me, s.Position))
            .FirstOrDefault();
        if (next == null)
        {
            Stop(sites.Count == 0
                ? "Stopped: no artifact in sight or on the map, and this zone's artifact spots couldn't be read."
                : "Stopped: checked every artifact spot and found nothing. Look at the map for a red X.");
            return;
        }

        BeginTravel(next.Position, $"checking artifact spot {checkedSites.Count + 1}/{sites.Count}", false, next);
    }

    private void BeginTravel(Vector3 destination, string source, bool isArtifact, Site? site)
    {
        Phase = Phase.Travelling;
        Target = destination;
        TargetSource = source;
        targetIsArtifact = isArtifact;
        sweepSite = site;
        moveTries = 0;
        bestDistance = float.MaxValue;
        lastCloser = DateTime.UtcNow;
        mountTried = false;
        flagged = false;
        Progress($"Heading to the artifact ({source})");
    }

    private void StepTravel(DateTime now)
    {
        var me = Plugin.ObjectTable.LocalPlayer!.Position;

        // Sharpen the destination: the artifact itself beats the map marker, which beats a guessed spot.
        if (FindArtifact(out var pos, out var source, out var isObject) is not null
            && (isObject || !targetIsArtifact) && Vector3.Distance(pos, Target!.Value) > 1f)
        {
            Target = pos;
            TargetSource = source;
            targetIsArtifact = isObject || source == "map marker";
            sweepSite = null;
            if (!ManualTravel)
                nav.Stop();
            flagged = false;
        }

        var dest = Target!.Value;
        var dist = GameUi.Distance2D(me, dest);
        var nearObject = NearestArtifactObject();
        var objectDist = nearObject == null ? float.MaxValue : GameUi.Distance2D(me, nearObject.Position);

        if (objectDist <= ExamineRange || (sweepSite != null && dist <= 8f))
        {
            nav.Stop();
            if (objectDist <= ExamineRange)
            {
                BeginExamine();
                return;
            }

            checkedSites.Add(sweepSite!.InstanceId);
            BeginLocate("Nothing at this spot; trying the next");
            return;
        }

        if (ManualTravel)
        {
            if (!flagged)
            {
                GameUi.FlagOnMap(zone!, dest);
                var c = Zones.ToMapCoords(dest, zone!.MapId);
                Plugin.ChatGui.Print($"Artifact flagged on your map (X {c.X:0.0}, Y {c.Y:0.0}). Walk there and it's examined for you.", "Drone", 45);
                flagged = true;
            }

            Status = $"Walk to the flag: {dist:0} yalms";
            lastProgress = now;
            return;
        }

        if (dist < bestDistance - 1f)
        {
            bestDistance = dist;
            lastCloser = now;
            Progress($"Travelling to the artifact: {dist:0} yalms ({TargetSource})");
        }

        // Ride for long trips, once per leg.
        if (plugin.Configuration.UseMount && !mountTried && dist > plugin.Configuration.MountDistance
            && !Plugin.Condition[ConditionFlag.Mounted])
        {
            mountTried = true;
            if (GameUi.CanUseGeneralAction(MountRoulette))
            {
                nav.Stop();
                GameUi.UseGeneralAction(MountRoulette);
                Status = "Calling a mount";
                nextStep = now.AddMilliseconds(1800);
                return;
            }
        }

        if (!nav.IsReady)
        {
            Status = "Waiting for vnavmesh to finish loading this zone";
            lastProgress = now;
            return;
        }

        if (now - lastCloser > TimeSpan.FromSeconds(10))
        {
            // Stuck: drop the path and ask for a new one.
            nav.Stop();
            lastCloser = now;
            bestDistance = float.MaxValue;
        }

        if (!nav.Busy)
        {
            // Path finished but not close enough: the artifact may sit where the mesh doesn't reach. Try from here.
            if (moveTries > 0 && nearObject != null && objectDist <= 7f)
            {
                BeginExamine();
                return;
            }

            if (moveTries >= 5)
            {
                Stop("Stopped: vnavmesh couldn't find a way to the artifact. Walk over yourself and press Start again.");
                return;
            }

            nav.MoveTo(dest);
            moveTries++;
            nextStep = now.AddMilliseconds(500);
        }
    }

    private void BeginExamine()
    {
        Phase = Phase.Examining;
        recordsBefore = zone!.RecordIds.ToDictionary(id => id, GameUi.ItemCount);
        examineSince = DateTime.UtcNow;
        interactTries = 0;
        interactAt = DateTime.MinValue;
        Progress("At the artifact");
    }

    private void StepExamine(DateTime now)
    {
        // Did a record land?
        foreach (var id in zone!.RecordIds)
        {
            var gained = GameUi.ItemCount(id) - recordsBefore.GetValueOrDefault(id);
            if (gained > 0)
            {
                RecordFind(id);
                return;
            }
        }

        if (Plugin.Condition[ConditionFlag.Mounted])
        {
            GameUi.UseGeneralAction(Dismount);
            Status = "Getting off the mount";
            nextStep = now.AddMilliseconds(800);
            return;
        }

        if (Plugin.Condition[ConditionFlag.OccupiedInEvent] || Plugin.Condition[ConditionFlag.OccupiedInQuestEvent]
            || Plugin.Condition[ConditionFlag.Occupied39] || Plugin.Condition[ConditionFlag.Occupied33])
        {
            Progress("Examining the artifact");
            return;
        }

        var obj = NearestArtifactObject();
        if (obj == null)
        {
            // Gone without a record showing up (yet): give the bags a moment, then move on.
            if (now - examineSince > TimeSpan.FromSeconds(6))
            {
                collectedSpots.Add(Target ?? Plugin.ObjectTable.LocalPlayer!.Position);
                Plugin.Log.Info("Artifact gone but no record counted; moving on");
                BeginDeploy();
            }

            return;
        }

        if (now - interactAt < TimeSpan.FromSeconds(3))
            return;

        if (interactTries >= 3)
        {
            Stop("Stopped: examining the artifact didn't work three times. Try it yourself to see why.");
            return;
        }

        Plugin.TargetManager.Target = obj;
        GameUi.Interact(obj);
        interactTries++;
        interactAt = now;
        Progress("Examining the artifact");
    }

    private void RecordFind(uint recordId)
    {
        var z = zone!;
        var tier = recordId == z.GoldRecordId ? 3 : recordId == z.SilverRecordId ? 2 : 1;
        var find = new Find(DateTime.Now, z.Name, recordId, ItemName(recordId), tier);
        Finds.Insert(0, find);
        FoundThisRun++;
        collectedSpots.Add(Target ?? Plugin.ObjectTable.LocalPlayer!.Position);

        var c = plugin.Configuration;
        c.TotalArtifacts++;
        switch (tier)
        {
            case 3: c.TotalGold++; break;
            case 2: c.TotalSilver++; break;
            default: c.TotalBronze++; break;
        }

        c.Save();

        if (c.EchoResults)
            Plugin.ChatGui.Print($"Artifact {FoundThisRun}: {find.RecordName}{(tier == 3 ? "  ★" : "")}", "Drone", (ushort)(tier == 3 ? 500 : tier == 2 ? 37 : 45));

        BeginDeploy();
    }

    // ---------------------------------------------------------------- finding the artifact

    /// <summary>An artifact you can examine, in the object table.</summary>
    public IGameObject? NearestArtifactObject()
    {
        var me = Plugin.ObjectTable.LocalPlayer?.Position ?? Vector3.Zero;
        return GameUi.EventObjects()
            .Where(o => o.IsTargetable && (o.BaseId == Zones.ArtifactEObj || GameUi.Contains(o.Name.TextValue, artifactName)))
            .OrderBy(o => Vector3.Distance(me, o.Position))
            .FirstOrDefault();
    }

    /// <summary>The "Artifact Site" marker on the map, unless it's where we already dug.</summary>
    public MapMark? ArtifactMarker() =>
        GameUi.EventMarkers()
            .Where(m => GameUi.Contains(m.Tooltip, siteLabel))
            .Where(m => !collectedSpots.Any(c => GameUi.Distance2D(c, m.Position) < 10f))
            .Select(m => (MapMark?)m)
            .FirstOrDefault();

    /// <summary>Where the artifact is, best source first.</summary>
    public object? FindArtifact(out Vector3 position, out string source, out bool isObject)
    {
        if (NearestArtifactObject() is { } obj)
        {
            position = obj.Position;
            source = "artifact in sight";
            isObject = true;
            return obj;
        }

        if (ArtifactMarker() is { } mark)
        {
            position = mark.Position;
            // The marker has no height on some maps: borrow the nearest known spot's if it's close.
            if (zone != null || CurrentZone != null)
            {
                var site = Zones.Sites(zone ?? CurrentZone!).OrderBy(s => GameUi.Distance2D(s.Position, mark.Position)).FirstOrDefault();
                if (site != null && GameUi.Distance2D(site.Position, mark.Position) < 15f)
                    position = site.Position;
            }

            source = "map marker";
            isObject = false;
            return mark;
        }

        position = default;
        source = "";
        isObject = false;
        return null;
    }
}
