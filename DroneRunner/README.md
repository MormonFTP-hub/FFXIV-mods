# Drone Runner

A Dalamud plugin that runs **Artifact Search** in Cosmic Exploration (Oizys and Auxesia) for you. Press Start on a crafter or gatherer and it uses a drone module, finds the artifact the drone located, travels there, examines it, logs the record (gold, silver or bronze) and uses the next module, until the modules run out.

**Early version (2026-11-15).** v0.1.0's first in-game runs went in circles: it looked for the red X only in the map's event markers, didn't find it, and swept the nearest spots. v0.1.1 reads every marker list on the map and accepts a marker sitting on one of the zone's known artifact spots (45 on Oizys, 60 on Auxesia, read from the game files), learns the artifact's icon, steps closer before examining, and hands the walk or the click to you (map flag) instead of stopping when it can't do it. v0.1.1 found the red X, but standing on it didn't examine anything (the artifact isn't a targetable object; examining it is an "artifact appraisal", `LogMessage` 11386 → 11383, then the record). v0.1.2 treats reaching the marked spot as arriving, gets off the mount, tries every object on the spot that could be it (targetable or not, reaction event objects included), counts the appraisal message as success, waits for vnavmesh to work out long paths before giving up, and logs everything near the spot. The **Diagnostics** tab has a run log plus every marker and nearby object; its text is what's needed to fix a run that goes wrong.

## Installing it (for friends)

See [HOW TO INSTALL.txt](HOW%20TO%20INSTALL.txt). In short: `/xlsettings` → **Experimental** → **Custom Plugin Repositories**, add

```
https://raw.githubusercontent.com/MormonFTP-hub/FFXIV-mods/main/repo.json
```

(and `https://puni.sh/api/repository/veyn` for vnavmesh), **Save and Close**, then install **Drone Runner** and **vnavmesh** from `/xlplugins`.

## Using it

| Command | Does |
|---|---|
| `/drone` (or `/dronerunner`) | Open the window |
| `/drone start` | Start |
| `/drone stop` | Stop |
| `/drone kaede` | Flag Kaede (drone modules, appraisal) on the map |

Settings: ride Mount Roulette for trips longer than N yalms (40 by default), stop after N artifacts, print each record in chat.

Without vnavmesh it flags each artifact on the map and examines it as soon as you walk up.

It stops on combat, leaving the zone, switching to a combat job, full bags, a Yes/No box that isn't the drone's, or 30 seconds with nothing happening.

## How it works

The game's side of Artifact Search, as read from its data:

- **The module.** Oizys Drone Module (item 50414) and Auxesia Drone Module (50415), bought from Kaede for dronebits. Using one asks "Use [module]?" (`Addon` 17172); the plugin answers Yes only to that.
- **One artifact per drone.** `LogMessage` 11379 "The reconnaissance drone has located an artifact!", and 11380 refuses a second drone until the first one's artifact is collected.
- **The artifact.** An event object, `EObj` 2015138 ("artifact"), at one of the zone's fixed spots: `WKSTreasureInfo` lists them by layout instance id (row 1 Oizys, row 2 Auxesia), and they sit in `planlive.lgb` layers named `WKS_TREASURE_*` with their positions. Its map marker is labelled "Artifact Site" (`Addon` 17173).
- **The records.** Oizys: Bronze / Silver / Gold Ancient Record (50413 / 50412 / 50411). Auxesia: Arboreal Bronze / Civic Silver / Botanic Gold Ancient Record (52095 / 52094 / 52093).

The loop (`Runner.cs`):

1. **Deploy.** `AgentInventoryContext.UseItem(module)`, Yes to the prompt, then wait for log 11379 or the module count to drop. Log 11380 means a drone is already out, so it goes looking for that one's artifact.
2. **Locate.** Best source first: the artifact object in the object table (named "artifact", id 2015138, or any targetable field object on an artifact spot); then the red X, read from every `AgentMap` marker list (event, map, temp, minimap) and matched to an artifact spot under each way the game stores positions (world, ×16, map pixels), taking a marker labelled "Artifact Site", one with the learned icon, or one that's new since the drone went up; then a sweep of the zone's spots, nearest first.
3. **Travel.** vnavmesh IPC (`vnavmesh.SimpleMove.PathfindAndMoveTo`), Mount Roulette for long legs, a new path whenever it stops getting closer.
4. **Examine.** Dismount, step within 2.8 yalms, `TargetSystem.InteractWithObject` (alternating the line-of-sight check), Yes to a prompt naming the artifact or opening right after, click through Talk boxes, and count the record that lands. After four failed tries it asks you to click it and carries on once the record lands.

## Building

Needs the .NET 10 SDK and XIVLauncher with Dalamud.

```
dotnet build DroneRunner.slnx -c Debug
```

To share a new version: bump `<Version>` in `DroneRunner/DroneRunner.csproj`, then `python tools/package_plugin.py DroneRunner`. The backup pushes `repo.json` and uploads the zip to the apps release.
