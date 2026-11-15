# Materia Transmuter

A Dalamud plugin that gives your junk materia to **Mutamix Bubblypots** (the Bonfire, Central Thanalan, X 23.7 Y 13.6) five at a time. Each trade returns one materia of a different stat, and now and then it's a grade higher.

You tick what's junk (all Piety, say), stand next to him and press Start. It talks to him, picks **Transmute Materia**, puts five junk materia of one grade in the window, confirms, answers the "are you certain" prompt, logs what came back, and goes again until fewer than five of any grade are left.

Tested in game on 2026-11-15 (v0.1.0): 16 trades of Spell Speed XI ran end to end, three of them grade-ups. v0.1.1 mixes every junk stat into each trade and checks for a free bag slot before every trade, not just the first.

## Installing it (for friends)

See [HOW TO INSTALL.txt](HOW%20TO%20INSTALL.txt). The short version: in game, `/xlsettings` → **Experimental** → **Custom Plugin Repositories**, add

```
https://raw.githubusercontent.com/MormonFTP-hub/FFXIV-mods/main/repo.json
```

then **Save and Close**, `/xlplugins`, search **Materia Transmuter**, Install. The zip is on the [apps release](https://github.com/MormonFTP-hub/FFXIV-mods/releases/tag/apps) too and works as a dev plugin.

## Using it

| Command | Does |
|---|---|
| `/transmute` (or `/mutamix`) | Open the window |
| `/transmute start` | Start trading |
| `/transmute test` | Test run: fill the window and confirm, then stop at the final prompt (click No and nothing is traded) |
| `/transmute stop` | Stop |
| `/transmute map` | Flag Mutamix on the map |

- **Pick junk.** One row per stat in your bags, one column per grade. Ticking a stat's name covers every grade of it, now and later. Single boxes tick one grade.
- **Settings.** Keep at least N of each junk materia. Stop after N trades. Mix junk stats in every trade (on by default): Mutamix never returns a stat that went in, so each trade gets one of every junk stat of its grade (up to five) and the rest from the biggest pile. With 127 Spell Speed XI and 12 Piety XI that's 1 Piety + 4 Spell Speed, and neither can come back. Grades are never mixed, since a mixed trade can come back at the lower grade.
- **Results.** Every trade's input and output, with grade-ups highlighted, plus an all-time tally.

Lower grades go first so a grade-up can join the next batch of its grade. A result that is itself junk goes back in.

### What it won't do

It only ever puts in materia you ticked. It stops by itself on combat, a duty, a zone change, a full bag, a menu or Yes/No box that isn't Mutamix's, a window that holds anything other than what it put in, or 20 seconds with nothing happening.

## How it works

- **Talking to him.** `TargetSystem.InteractWithObject` on the event NPC with base id 1001425 (Mutamix Bubblypots), within 6.5 yalms.
- **His menu.** `SelectString` / `SelectIconString`, entry matched against `CustomTalk` row 721070's main option ("Transmute Materia"), read from the client's sheets so it works in any language. Picked with `FireCallbackInt(index)`.
- **The window.** `TradeMultiple` (`AgentTradeMultiple`). Junk goes in with `AgentTradeMultiple.AddItemQuantity(item, n)`, which commits a stack amount to the next free slot without the quantity prompt. The slots are read back (`AgentTradeMultiple.Slots`) and checked against the plan before **Confirm** is clicked through the button's own registered event.
- **The prompt.** `SelectYesno` whose text matches `Addon` row 3912 ("Are you certain you wish to transmute these materia?"); Yes is clicked the same way.
- **The result.** Bag counts are snapshotted before Yes; the trade counts as done once the five are gone, and whatever materia went up is the result.
- **Trade picking** is `Planner.cs`, pure and tested by `tools/plannertest` (`dotnet run --project tools/plannertest`).

## Building

You need the .NET 10 SDK and XIVLauncher with Dalamud (the build references `%AppData%\XIVLauncher\addon\Hooks\dev`).

```
dotnet build MateriaTransmute.slnx -c Debug
```

The output is `MateriaTransmute\bin\Debug\MateriaTransmute.dll`, which is in this PC's dev plugin locations.

To share a new version: bump `<Version>` in `MateriaTransmute.csproj`, then

```
python tools/package_plugin.py MateriaTransmute
```

(`MateriaTransmute/tools/package.py` does the same.) It builds Release, writes `dist/MateriaTransmute.zip` (plugin + HOW TO INSTALL.txt) and updates `repo.json` at the repo root. The backup (`tools/backup.py`) pushes `repo.json` and uploads the zip to the apps release, and friends get the update through Dalamud.
