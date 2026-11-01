# Mit Plan

A Dalamud plugin you keep open during a fight. It shows the NA community's mit plan for the fight, one phase at a time, hit by hit, with your own buttons for the job you're on.

## Fights and plans

| Fight | Plan | Phases |
|---|---|---|
| Dancing Mad (Ultimate) | [Ikuya Mit](https://tinyurl.com/ikuyamittydmu) by Ikuya Kirishima, the sheet [NAUR](https://naurffxiv.com/ultimate/kefka) lists. Includes the Omnitank tab's personal tank cooldowns. | 5 |
| Futures Rewritten (Ultimate) | [FRU Mit But Good](http://mit.lesb.in/) by Fae Nightwolf & Valiaa Masume, the one [NAUR](https://naurffxiv.com/ultimate/fru) says NA PF tanks use | 6 (P2 split into Shiva and Light Rampant) |
| M9S–M12S (AAC Heavyweight Savage) | [Silacy Alaseia's mitsheet](https://na.finalfantasyxiv.com/lodestone/character/30004232/blog/5650059/) from week 1 PF, with phases from Exia's DT raid timeline sheet | 3–8 per fight (M12S has the door boss and the final boss) |

Every plan credits its author in the window's footer; click the credit to open the sheet. The savage sheet's healer columns are written for a Scholar shield healer and a pure healer, so a Sage sees which buttons are Scholar's.

## What it does

- **Picks the fight from your duty.** Walk into a fight it has a plan for and the window opens on it (both can be turned off).
- **Picks your column from your job.** Healers in the ultimates get their own job's column; tanks choose MT or OT, melee D1 or D2, and the choice is remembered per fight and job. A job picker lets you look at any other job too.
- **Your buttons, by name and icon.** The sheets' shorthand becomes your job's actions: "Party Mit" is Shake It Off on Warrior and Tactician on Machinist, "40%" is Damnation or Guardian, "Soil" is Sacred Soil, "Kera" is Kerachole. The sheet's own words stay around them ("-10s Recitation", "Reprisal 50% cast"), and the original cell is in the tooltip with any footnote it points at.
- **Other jobs' lines, greyed.** "Party Mit (GNB/DRK)" in a Warrior's column, or Dismantle in a Bard's, show dimmed so you can see they're not yours. A Red Mage or Machinist also sees their Magick Barrier or Dismantle from the sheet's Extras column.
- **Carried-over mits.** Rows the sheet marks with an arrow (still up from the hit before) are drawn dimmed behind an arrow so you don't press them twice.
- **Party view.** Every column of the sheet as written, with your column highlighted.
- **Follows the pull.** When you pull, a clock starts on the plan's times and the boss's casts keep it in line: the hit happening now is highlighted, the next one shows how many seconds away it is, and the window switches to the phase you're in. Ultimates' phases each start their own clock when the boss casts the phase's first hit that has a cast bar.
- **Notes.** Each phase's notes and footnotes, plus the sheet author's notes about the plan.

## Commands

| Command | Does |
|---|---|
| `/mitplan` or `/mits` | Open the window |
| `/mitplan dmu` (or `fru`, `m9s` … `m12s`) | Show that fight |
| `/mitplan config` | Settings |
| `/mitplan reload` | Reload plans, including your own |

## Your own plans

Settings → **Copy built-in plans there** writes every built-in plan into the plans folder (`%AppData%\XIVLauncher\pluginConfigs\MitPlan\plans`). Edit one, then **Reload**: a file with the same `id` replaces the built-in plan, and a new `id` adds a fight. The format, briefly:

```jsonc
{
  "id": "m9s",
  "name": "M9S · Vamp Fatale",
  "short": "M9S",
  "duties": ["AAC Heavyweight M1 (Savage)"],          // Duty Finder names it opens for
  "slots": [
    { "key": "MT", "label": "MT", "role": "tank" },     // role: tank, melee, ranged, caster, extras
    { "key": "Shield", "label": "Shield healer", "jobs": ["SCH", "SGE"] }
  ],
  "phases": [
    { "name": "It's A10 Again", "clock": "fight", "notes": ["¹ Footnote text"], "hits": [
      { "name": "Blast Beat > Rain + Screech", "time": "0:42–1:01", "t": 42, "tEnd": 61,
        "sync": ["Blast Beat", "Sadistic Screech"],       // boss casts, as the game spells them
        "cells": {
          "MT": [ { "items": ["Reprisal"] } ],
          "Shield": [ { "items": ["Soil", "GCD"] }, { "carry": true, "items": ["Seraph"] } ]
        } }
    ] }
  ]
}
```

Phases that share a `clock` count time from the same zero; give each ultimate phase its own. `t` is seconds on that clock. Items use the same shorthand as the sheets, with a job list in brackets to limit one to those jobs (`"Party Mit (GNB/DRK)"`).

## Building

You need the .NET 10 SDK, and XIVLauncher with Dalamud installed (the build references Dalamud from `%AppData%\XIVLauncher\addon\Hooks\dev`).

```
dotnet build MitPlan.slnx -c Debug
```

The output is `MitPlan\bin\Debug\MitPlan.dll`. A `-c Release` build also produces `MitPlan\bin\Release\MitPlan\latest.zip`.

## Loading it in game

1. `/xlsettings` → **Experimental** → under *Dev Plugin Locations* add the full path to `MitPlan\bin\Debug\MitPlan.dll`, click **+**, then **Save and Close**.
2. `/xlplugins` → **Dev Tools** → **Installed Dev Plugins** → enable **Mit Plan**.
3. `/mitplan`.

## Updating the plans

The plans are built from the sheets by a script, so when an author updates their sheet:

```
python tools/build_plans.py --refresh
```

It downloads each sheet as CSV (cached in `work/sheets`), turns every phase into hits and cells, and matches each hit's name to the boss casts in cactbot's timeline for the fight ([OverlayPlugin/cactbot](https://github.com/OverlayPlugin/cactbot), Apache-2.0) so the follow mode has the game's spelling. It reads the timelines the Striking Dummy Sim already cached, or downloads them.

With the Striking Dummy Sim's fight exports (`BlackMageSim/work/fights`) present, it also lines each row up with the cast's time in cactbot's timeline. That tells the plugin which occurrence of a repeated cast a row means (M9S's Dead Wake comes four times, the sheet names one), gives rows the sheet left untimed a time, and follows the drift between the sheet's clock and the fight's. Hits with no cast still show; they light up by the clock alone. Then rebuild the plugin.

To check the follow mode after an update, replay cactbot's timelines through it:

```
dotnet run --project tools/replay            every fight: how many rows light up, and in order
dotnet run --project tools/replay -- dmu     one fight, row by row, with each sync
```

## Project layout

```
MitPlan/
  Plugin.cs              entry point, services, commands, duty detection
  Configuration.cs       settings
  Plans/*.json           the built-in plans (embedded in the DLL)
  Data/
    PlanModels.cs        plan, phase, hit, cell
    PlanLibrary.cs       loads built-in and custom plans
    Jobs.cs              roles, default columns, each job's buttons for the generic terms
    MitText.cs           sheet shorthand → buttons
    GameData.cs          action icons, cast names, current duty (Lumina)
  Tracking/
    FollowClock.cs       a pull's clock on the plan's times, synced to the boss's casts
    FightFollower.cs     starts a clock each pull and feeds it the enemies' cast bars
  Windows/
    MainWindow.cs        the plan window
    ConfigWindow.cs      settings
tools/build_plans.py     sheets → Plans/*.json
tools/replay/            replays cactbot timelines through FollowClock
```
