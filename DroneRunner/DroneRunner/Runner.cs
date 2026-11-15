using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using Dalamud.Game.Chat;
using Dalamud.Game.ClientState.Conditions;
using Dalamud.Game.ClientState.Objects.Enums;
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

/// <summary>Where the artifact is and how we know.</summary>
public sealed record ArtifactFix(Vector3 Position, string Source, IGameObject? Object, MapMark? Marker);

/// <summary>
/// Runs Artifact Search: use a drone module, find the artifact it located, travel there, examine it, repeat.
/// The artifact is found, best first: the object itself if it's in view; the red X on the map, read from whichever of
/// the map's marker lists holds it and matched to the zone's fixed artifact spots; else a sweep of those spots.
/// </summary>
public sealed unsafe class Runner : IDisposable
{
    private const uint MountRoulette = 9;    // GeneralAction
    private const uint Dismount = 23;        // GeneralAction
    private const float ExamineRange = 3.5f; // 2D, to stop walking and start examining
    private const float SiteSeenRange = 25f; // an artifact this close shows up in the object table
    private const float SnapRange = 10f;     // a map marker this close to an artifact spot is on that spot
    private const float ArriveRange = 3f;    // 2D, standing on the marked spot

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

    /// <summary>What happened, newest last, for the Diagnostics tab.</summary>
    public List<string> RunLog { get; } = [];

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
    private HashSet<(string, uint, int, int)>? markerBaseline;
    private DateTime deployNotBefore;
    private DateTime locateGraceUntil;

    // Locating / travelling
    private Site? sweepSite;
    private readonly HashSet<uint> checkedSites = [];
    private readonly List<Vector3> doneSpots = [];
    private int moveTries;
    private int moveFails;
    private DateTime lastMoveAt;
    private int stalls;
    private float bestDistance;
    private DateTime lastCloser;
    private bool mountTried;
    private bool manualLeg;
    private bool flagged;

    // Examining
    private Dictionary<uint, int> recordsBefore = [];
    private ulong examineId;
    private DateTime examineSince;
    private DateTime interactAt;
    private int interactTries;
    private int approachTries;
    private bool sawActivity;
    private bool appraisalDone;
    private DateTime appraisalAt;
    private bool manualExamine;

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

    private static Vector3 Me => Plugin.ObjectTable.LocalPlayer?.Position ?? Vector3.Zero;

    /// <summary>Why a run can't start right now, or null if it can.</summary>
    public string? CantStart()
    {
        if (CurrentZone is not { } z)
            return "Go to Oizys or Auxesia in Cosmic Exploration.";
        if (!OnCrafterOrGatherer())
            return "Switch to a crafter or gatherer: drones only work for them.";
        if (GameUi.ItemCount(z.ModuleItemId) == 0 && FindArtifact() == null)
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
        doneSpots.Clear();
        markerBaseline = null;
        lastProgress = nextStep = DateTime.UtcNow;
        Status = "Starting";
        RunLog.Clear();
        Note($"Start on {zone!.Name}: {GameUi.ItemCount(zone.ModuleItemId)} modules, {Zones.Sites(zone).Count} artifact spots, vnavmesh {(ManualTravel ? "missing" : "ready")}");

        // A drone may already be out with an artifact waiting: fetch that first.
        if (FindArtifact() is { } fix)
            BeginTravel(fix, null);
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
        Note(why);
        Plugin.ChatGui.Print(why, "Drone", 45);
    }

    private void Note(string text)
    {
        RunLog.Add($"{DateTime.Now:HH:mm:ss} {text}");
        if (RunLog.Count > 80)
            RunLog.RemoveAt(0);
        Plugin.Log.Info(text);
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
            case Zones.AppraisalStartLog:
                sawActivity = true;
                break;
            case Zones.AppraisalDoneLog:
                appraisalDone = true;
                appraisalAt = DateTime.UtcNow;
                break;
            case Zones.WrongPlanetLog:
            case Zones.OutsideDutyLog:
                break;
            default:
                return;
        }

        LastLogId = message.LogMessageId;
        LastLogTime = DateTime.Now;
        if (!Running)
            return;
        Note($"Game said: log message {message.LogMessageId}");
        if (message.LogMessageId is Zones.WrongPlanetLog or Zones.OutsideDutyLog)
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
            if (Phase == Phase.Examining)
                sawActivity = true;
            lastProgress = now;
            return;
        }

        var waitingOnYou = ManualTravel || manualLeg || manualExamine;
        if (!waitingOnYou && now - lastProgress > TimeSpan.FromSeconds(30))
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
                StepLocate();
                break;
            case Phase.Travelling:
                StepTravel(now);
                break;
            case Phase.Examining:
                StepExamine(now);
                break;
        }
    }

    /// <summary>The "Use [module]?" box when deploying; when examining, a box naming the artifact or any box that
    /// opens right after we touched it. Anything else is left alone and the run waits.</summary>
    private bool HandlePrompts(DateTime now)
    {
        if (GameUi.TryGetAddon("SelectYesno", out var yesnoBase))
        {
            var yesno = (AddonSelectYesno*)yesnoBase;
            var text = GameUi.YesnoText(yesno);
            var ours = (Phase == Phase.Deploying && GameUi.Contains(text, ItemName(zone!.ModuleItemId)))
                       || (Phase == Phase.Examining && (GameUi.Contains(text, artifactName) || now - interactAt < TimeSpan.FromSeconds(8)));
            if (ours && GameUi.ClickButton(yesnoBase, yesno->YesButton))
            {
                Note($"Yes to \"{text}\"");
                if (Phase == Phase.Examining)
                    sawActivity = true;
                Progress(Phase == Phase.Deploying ? "Deploying the drone" : "Examining the artifact");
                nextStep = now.AddMilliseconds(500);
            }
            else
            {
                Status = "A Yes/No box is open that isn't the drone's; answer it to carry on";
            }

            return true;
        }

        if (Phase == Phase.Examining && GameUi.TryGetAddon("Talk", out var talk))
        {
            GameUi.ClickTalk(talk);
            sawActivity = true;
            nextStep = now.AddMilliseconds(400);
            return true;
        }

        if (Phase == Phase.Examining && !manualExamine
            && (GameUi.TryGetAddon("SelectString", out _) || GameUi.TryGetAddon("SelectIconString", out _)))
        {
            manualExamine = true;
            Note("A menu came up at the artifact: leaving it to you");
            Plugin.ChatGui.Print("A menu came up at the artifact. Pick what you want; the run carries on once the record lands.", "Drone", 45);
            return true;
        }

        return false;
    }

    // ---------------------------------------------------------------- deploy

    private void BeginDeploy(bool pause = false)
    {
        Phase = Phase.Deploying;
        deployIssued = false;
        deployTries = 0;
        // Right after an appraisal the game refuses items for a moment ("can't perform this action"): wait first.
        deployNotBefore = pause ? DateTime.UtcNow.AddSeconds(Math.Max(0, plugin.Configuration.PauseAfterArtifact)) : DateTime.MinValue;
        Target = null;
        TargetSource = "";
        manualLeg = false;
        manualExamine = false;
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

            if (now < deployNotBefore)
            {
                Status = $"Next drone in {(deployNotBefore - now).TotalSeconds:0} s";
                lastProgress = now;
                return;
            }

            if (Plugin.Condition[ConditionFlag.Mounted])
            {
                GameUi.UseGeneralAction(Dismount);
                Status = "Getting off the mount to use the module";
                nextStep = now.AddMilliseconds(800);
                return;
            }

            // Remember what's on the map before the first try, so the drone's marker stands out as new. Not on a
            // retry: a module that went up late would already be on the map, and its marker wouldn't look new.
            if (deployTries == 0)
                markerBaseline = GameUi.AllMarkers().Select(m => m.Key).ToHashSet();
            modulesBefore = GameUi.ItemCount(z.ModuleItemId);
            locatedSignal = false;
            alreadyDeployedSignal = false;
            GameUi.UseItem(z.ModuleItemId);
            deployIssued = true;
            deployTries++;
            deployAt = now;
            Note($"Used {ItemName(z.ModuleItemId)} (try {deployTries}, {modulesBefore} left before)");
            Progress($"Using {ItemName(z.ModuleItemId)}");
            nextStep = now.AddMilliseconds(600);
            return;
        }

        if (alreadyDeployedSignal)
        {
            alreadyDeployedSignal = false;
            if (FindArtifact() is { } waiting)
                BeginTravel(waiting, null);
            else
                BeginLocate("A drone is already out: looking for its artifact", TimeSpan.FromSeconds(6));
            return;
        }

        var launched = locatedSignal || GameUi.ItemCount(z.ModuleItemId) < modulesBefore;
        if (launched)
        {
            if (FindArtifact() is { } fix)
            {
                BeginTravel(fix, null);
                return;
            }

            Status = "Drone is scanning";
            if (now - deployAt > TimeSpan.FromSeconds(12))
            {
                Note("Drone went up but no marker or artifact found; sweeping the spots");
                BeginLocate("Checking the artifact spots");
            }

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

    // ---------------------------------------------------------------- locate

    private void BeginLocate(string status, TimeSpan? grace = null)
    {
        Phase = Phase.Locating;
        sweepSite = null;
        locateGraceUntil = DateTime.UtcNow + (grace ?? TimeSpan.Zero);
        Progress(status);
    }

    /// <summary>No artifact in view and no red X: go round the zone's artifact spots, nearest first, until it shows up.</summary>
    private void StepLocate()
    {
        if (FindArtifact() is { } fix)
        {
            BeginTravel(fix, null);
            return;
        }

        // Give a late map marker a few seconds before walking the spots.
        if (DateTime.UtcNow < locateGraceUntil)
        {
            Status = "Waiting for the drone's marker";
            return;
        }

        var me = Me;
        var sites = Zones.Sites(zone!);
        foreach (var s in sites.Where(s => Vector3.Distance(me, s.Position) < SiteSeenRange))
            checkedSites.Add(s.InstanceId);

        var next = sites.Where(s => !checkedSites.Contains(s.InstanceId))
            .OrderBy(s => GameUi.Distance2D(me, s.Position))
            .FirstOrDefault();
        if (next == null)
        {
            Stop(sites.Count == 0
                ? "Stopped: no artifact in sight or on the map, and this zone's artifact spots couldn't be read."
                : "Stopped: checked every artifact spot and found nothing. If the map shows a red X, copy the Diagnostics tab and send it over.");
            return;
        }

        BeginTravel(new ArtifactFix(next.Position, $"checking spot {checkedSites.Count + 1}/{sites.Count}", null, null), next);
    }

    // ---------------------------------------------------------------- travel

    private void BeginTravel(ArtifactFix fix, Site? site)
    {
        Phase = Phase.Travelling;
        Target = fix.Position;
        TargetSource = fix.Source;
        sweepSite = site;
        moveTries = 0;
        moveFails = 0;
        lastMoveAt = DateTime.MinValue;
        stalls = 0;
        bestDistance = float.MaxValue;
        lastCloser = DateTime.UtcNow;
        mountTried = false;
        manualLeg = false;
        flagged = false;
        var c = Zones.ToMapCoords(fix.Position, zone!.MapId);
        Note($"Heading to X {c.X:0.0} Y {c.Y:0.0} ({fix.Source}), {GameUi.Distance2D(Me, fix.Position):0}y away");
        Progress($"Heading to the artifact ({fix.Source})");
    }

    private void StepTravel(DateTime now)
    {
        var me = Me;

        // Sharpen the destination: the artifact itself beats the map marker, which beats a guessed spot.
        if (FindArtifact() is { } fix && Vector3.Distance(fix.Position, Target!.Value) > 1f
            && (fix.Object != null || sweepSite != null))
        {
            Note($"Better fix: {fix.Source}");
            Target = fix.Position;
            TargetSource = fix.Source;
            sweepSite = null;
            if (!ManualTravel && !manualLeg)
                nav.Stop();
            moveTries = 0;
            moveFails = 0;
            lastMoveAt = DateTime.MinValue;
            stalls = 0;
            flagged = false;
            manualLeg = false;
        }

        var dest = Target!.Value;
        var dist = GameUi.Distance2D(me, dest);
        var obj = NearestArtifactObject();
        var objDist = obj == null ? float.MaxValue : GameUi.Distance2D(me, obj.Position);

        // Arrived: at the artifact, or standing on the marked spot (the artifact may not show as a normal object).
        if ((obj != null && objDist <= ExamineRange) || (sweepSite == null && dist <= ArriveRange))
        {
            nav.Stop();
            BeginExamine(obj != null && objDist <= ExamineRange ? obj : null);
            return;
        }

        if (sweepSite != null && dist <= 8f)
        {
            nav.Stop();
            checkedSites.Add(sweepSite.InstanceId);
            BeginLocate("Nothing at this spot; trying the next");
            return;
        }

        if (ManualTravel || manualLeg)
        {
            if (!flagged)
            {
                GameUi.FlagOnMap(zone!, dest);
                var c = Zones.ToMapCoords(dest, zone!.MapId);
                Plugin.ChatGui.Print($"Artifact flagged on your map (X {c.X:0.0}, Y {c.Y:0.0}). Get there and it's examined for you.", "Drone", 45);
                flagged = true;
            }

            Status = $"Your turn: get to the flag ({dist:0} yalms). It examines the artifact when you're there.";
            lastProgress = now;
            return;
        }

        if (dist < bestDistance - 1f)
        {
            bestDistance = dist;
            lastCloser = now;
            Progress($"Travelling: {dist:0} yalms to go ({TargetSource})");
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

        if (now - lastCloser > TimeSpan.FromSeconds(12))
        {
            stalls++;
            Note($"Not getting closer ({dist:0}y left), stall {stalls}");
            nav.Stop();
            lastCloser = now;
            bestDistance = float.MaxValue;
        }

        if (stalls >= 3 || moveFails >= 3)
        {
            nav.Stop();
            if (sweepSite != null)
            {
                Note("Can't reach this spot; skipping it");
                checkedSites.Add(sweepSite.InstanceId);
                BeginLocate("Couldn't reach that spot; trying the next");
                return;
            }

            // The real artifact, out of vnavmesh's reach (a floating island, say): hand the walk to you.
            Note($"Can't find a way there ({stalls} stalls, {moveFails} refused paths); handing the walk over");
            manualLeg = true;
            Plugin.ChatGui.Print("vnavmesh can't find a way to this artifact. Get there yourself and it takes over again.", "Drone", 45);
            return;
        }

        // Ask for a path when vnavmesh is idle, and give it time to work one out before asking again.
        if (!nav.Busy && now - lastMoveAt > TimeSpan.FromSeconds(3))
        {
            var accepted = nav.MoveTo(dest);
            lastMoveAt = now;
            moveTries++;
            if (!accepted)
            {
                moveFails++;
                Note($"vnavmesh refused the path ({moveFails})");
            }
        }
    }

    // ---------------------------------------------------------------- examine

    private void BeginExamine(IGameObject? obj)
    {
        Phase = Phase.Examining;
        recordsBefore = zone!.RecordIds.ToDictionary(id => id, GameUi.ItemCount);
        examineId = obj?.GameObjectId ?? 0;
        examineSince = DateTime.UtcNow;
        interactTries = 0;
        approachTries = 0;
        interactAt = DateTime.MinValue;
        sawActivity = false;
        appraisalDone = false;
        manualExamine = false;
        var spot = Target ?? Me;
        Note(obj == null
            ? $"On the spot ({GameUi.Distance2D(Me, spot):0.0}y); no artifact object recognised yet"
            : $"At the artifact: {obj.Name} ({obj.ObjectKind}, id {obj.BaseId}), {Vector3.Distance(Me, obj.Position):0.0}y");
        foreach (var line in NearbyObjects(spot, 12f).Take(15))
            Note("  near: " + line);
        Progress("At the artifact");
    }

    private void StepExamine(DateTime now)
    {
        // Did a record land?
        foreach (var id in zone!.RecordIds)
        {
            if (GameUi.ItemCount(id) > recordsBefore.GetValueOrDefault(id))
            {
                RecordFind(id);
                return;
            }
        }

        // The game said the appraisal finished but no record showed up in the bags: count it and carry on.
        if (appraisalDone && now - appraisalAt > TimeSpan.FromSeconds(3))
        {
            RecordFind(0);
            return;
        }

        if (Plugin.Condition[ConditionFlag.Mounted])
        {
            GameUi.UseGeneralAction(Dismount);
            Status = "Getting off the mount";
            nextStep = now.AddMilliseconds(800);
            return;
        }

        if (Plugin.Condition[ConditionFlag.OccupiedInEvent] || Plugin.Condition[ConditionFlag.OccupiedInQuestEvent]
            || Plugin.Condition[ConditionFlag.Occupied39] || Plugin.Condition[ConditionFlag.Occupied33]
            || Plugin.Condition[ConditionFlag.Occupied])
        {
            sawActivity = true;
            Progress("Examining the artifact");
            return;
        }

        if (manualExamine)
        {
            Status = "Your turn: examine the artifact. The run carries on once the record lands.";
            lastProgress = now;
            return;
        }

        if (sawActivity && now - interactAt < TimeSpan.FromSeconds(8))
        {
            Status = "Appraising the artifact";
            return;
        }

        if (now - interactAt < TimeSpan.FromSeconds(3.5))
            return;

        var spot = Target ?? Me;
        var candidates = SpotCandidates(spot);
        if (examineId != 0 && Plugin.ObjectTable.FirstOrDefault(o => o.GameObjectId == examineId) is { } first)
            candidates = candidates.Prepend(first).DistinctBy(o => o.GameObjectId).ToList();

        if (candidates.Count == 0 || interactTries >= 6)
        {
            manualExamine = true;
            Note(candidates.Count == 0 ? "Nothing to interact with on the spot; leaving it to you" : "Six tries didn't start an appraisal; leaving it to you");
            Plugin.ChatGui.Print("Couldn't examine the artifact automatically. Examine it yourself and the run carries on. "
                                 + "(Then copy the Diagnostics tab and send it over, so this can be fixed.)", "Drone", 45);
            return;
        }

        var obj = candidates[interactTries % candidates.Count];

        // Close the last few yalms: interaction range is shorter than where the path ends.
        var reach = Vector3.Distance(Me, obj.Position);
        if (reach > 2.8f && approachTries < 2 && !ManualTravel && nav.IsReady)
        {
            approachTries++;
            nav.MoveTo(obj.Position);
            Note($"Stepping closer to {obj.Name} ({reach:0.0}y)");
            interactAt = now;
            return;
        }

        nav.Stop();
        Plugin.TargetManager.Target = obj;
        var los = interactTries / Math.Max(candidates.Count, 1) % 2 == 0;
        var result = GameUi.Interact(obj, los);
        interactTries++;
        interactAt = now;
        Note($"Interact try {interactTries}: {obj.ObjectKind} {obj.BaseId} \"{obj.Name}\" targetable {obj.IsTargetable}, {reach:0.0}y, line of sight check {los} → {result}");
        Progress("Examining the artifact");
    }

    private void RecordFind(uint recordId)
    {
        var z = zone!;
        var tier = recordId == 0 ? 0 : recordId == z.GoldRecordId ? 3 : recordId == z.SilverRecordId ? 2 : 1;
        var find = new Find(DateTime.Now, z.Name, recordId, recordId == 0 ? "a record (not seen in the bags)" : ItemName(recordId), tier);
        Finds.Insert(0, find);
        FoundThisRun++;
        doneSpots.Add(Target ?? Me);
        Note($"Got {find.RecordName}");

        var c = plugin.Configuration;
        c.TotalArtifacts++;
        switch (tier)
        {
            case 3: c.TotalGold++; break;
            case 2: c.TotalSilver++; break;
            case 1: c.TotalBronze++; break;
        }

        c.Save();

        if (c.EchoResults)
            Plugin.ChatGui.Print($"Artifact {FoundThisRun}: {find.RecordName}{(tier == 3 ? "  ★" : "")}", "Drone", (ushort)(tier == 3 ? 500 : tier == 2 ? 37 : 45));

        BeginDeploy(pause: true);
    }

    // ---------------------------------------------------------------- finding the artifact

    private bool IsDone(Vector3 p) => doneSpots.Any(d => GameUi.Distance2D(d, p) < 5f);

    private static bool CouldBeArtifact(IGameObject o) =>
        o.ObjectKind is not (ObjectKind.Pc or ObjectKind.BattleNpc or ObjectKind.Mount or ObjectKind.Companion
            or ObjectKind.Retainer or ObjectKind.Ornament or ObjectKind.HousingEventObject or ObjectKind.Cutscene or ObjectKind.CardStand);

    /// <summary>Everything on the marked spot that could be the artifact, best guess first: its id or name, then field
    /// objects, then anything else; targetable before not; nearest the spot first. Untargetable ones count here, since
    /// the artifact itself is an invisible object.</summary>
    public List<IGameObject> SpotCandidates(Vector3 spot)
    {
        int Rank(IGameObject o) =>
            o.BaseId == Zones.ArtifactEObj ? 0
            : GameUi.Contains(o.Name.TextValue, artifactName) ? 1
            : o.ObjectKind == ObjectKind.EventObj ? 2
            : o.ObjectKind is ObjectKind.ReactionEventObject or ObjectKind.Treasure or ObjectKind.GatheringPoint ? 3
            : 4;
        return Plugin.ObjectTable
            .Where(o => CouldBeArtifact(o) && o.GameObjectId != Plugin.ObjectTable.LocalPlayer?.GameObjectId)
            .Where(o => GameUi.Distance2D(o.Position, spot) <= (Rank(o) <= 1 ? 8f : 5f))
            .OrderBy(Rank)
            .ThenBy(o => o.IsTargetable ? 0 : 1)
            .ThenBy(o => GameUi.Distance2D(o.Position, spot))
            .Take(6)
            .ToList();
    }

    /// <summary>Every object near a point, for the run log and Diagnostics.</summary>
    public static IEnumerable<string> NearbyObjects(Vector3 point, float radius) =>
        Plugin.ObjectTable
            .Where(o => o.ObjectKind != ObjectKind.Pc && Vector3.Distance(o.Position, point) <= radius)
            .OrderBy(o => Vector3.Distance(o.Position, point))
            .Select(o => $"{o.ObjectKind} {o.BaseId} \"{o.Name}\" {(o.IsTargetable ? "targetable" : "not targetable")}, {Vector3.Distance(o.Position, point):0.0}y from the spot");

    /// <summary>An artifact you can examine, in the object table: named "artifact", or the artifact's id, or any
    /// targetable field object standing on one of the zone's artifact spots.</summary>
    public IGameObject? NearestArtifactObject()
    {
        var z = zone ?? CurrentZone;
        var spots = z == null ? [] : Zones.Sites(z);
        var me = Me;
        return GameUi.FieldObjects()
            .Where(o => o.IsTargetable && !IsDone(o.Position))
            .Where(o => o.BaseId == Zones.ArtifactEObj
                        || GameUi.Contains(o.Name.TextValue, artifactName)
                        || spots.Any(s => GameUi.Distance2D(s.Position, o.Position) < 3f))
            .OrderBy(o => Vector3.Distance(me, o.Position))
            .FirstOrDefault();
    }

    /// <summary>The artifact spot a map marker sits on, trying each way the game stores marker positions.</summary>
    public (Site Site, float Distance)? SpotFor(MapMark m)
    {
        var z = zone ?? CurrentZone;
        if (z == null)
            return null;
        var spots = Zones.Sites(z);
        if (spots.Count == 0)
            return null;

        Vector2[] guesses = m.HasHeight
            ? [m.Raw]
            : [m.Raw / 16f, m.Raw, m.Raw - new Vector2(1024f)];
        (Site Site, float Distance)? best = null;
        foreach (var g in guesses)
        {
            foreach (var s in spots)
            {
                var d = Vector2.Distance(g, new Vector2(s.Position.X, s.Position.Z));
                if (best == null || d < best.Value.Distance)
                    best = (s, d);
            }
        }

        return best;
    }

    /// <summary>The artifact's red X: a marker labelled "Artifact Site", or with the icon learned earlier, or new since
    /// the drone went up, sitting on an artifact spot. Returns the spot it marks.</summary>
    public ArtifactFix? ArtifactMarker()
    {
        var config = plugin.Configuration;
        ArtifactFix? fallback = null;
        foreach (var m in GameUi.AllMarkers())
        {
            if (SpotFor(m) is not { } spot || spot.Distance > SnapRange || IsDone(spot.Site.Position))
                continue;

            // Minimap markers come and go as you move, so only a label or the learned icon counts for them.
            var steady = !m.Source.StartsWith("minimap", StringComparison.Ordinal);
            var labelled = GameUi.Contains(m.Text, siteLabel);
            var knownIcon = config.ArtifactIconId != 0 && m.IconId == config.ArtifactIconId;
            var isNew = steady && markerBaseline != null && !markerBaseline.Contains(m.Key) && spot.Distance < 6f;
            if (labelled || knownIcon || isNew)
            {
                if (!knownIcon && m.IconId != 0 && (labelled || config.ArtifactIconId == 0))
                {
                    config.ArtifactIconId = m.IconId;
                    config.ArtifactMarkerSource = m.Source;
                    config.Save();
                    Note($"Learned the artifact's map icon: {m.IconId} ({m.Source} marker{(labelled ? ", labelled" : "")})");
                }

                return new ArtifactFix(spot.Site.Position, $"map marker ({m.Source})", null, m);
            }

            // Before any drone this run there's no baseline: a marker right on a spot is a fair guess.
            if (steady && markerBaseline == null && spot.Distance < 3f)
                fallback ??= new ArtifactFix(spot.Site.Position, $"map marker on a spot ({m.Source}, icon {m.IconId})", null, m);
        }

        return fallback;
    }

    /// <summary>Where the artifact is, best source first.</summary>
    public ArtifactFix? FindArtifact()
    {
        if (NearestArtifactObject() is { } obj)
            return new ArtifactFix(obj.Position, "artifact in sight", obj, null);
        return ArtifactMarker();
    }
}
