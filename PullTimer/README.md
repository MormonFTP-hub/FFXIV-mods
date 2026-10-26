# Pull Timer

A Dalamud plugin that tells you how early or late a pull was compared to the countdown, and who did it.

```
[PullTimer] Pull 0.42s early by Some Tank (PLD · Holy Spirit, cast from -1.88s, went off -0.98s) [15s countdown]
[PullTimer] Your first hit landed +0.06s · Fire III, cast from -3.71s, went off -0.70s
```

## Features

- **Pull offset.** How far from countdown zero the pull landed, classed as early, on time or late (the on-time window is configurable).
- **Who pulled and with what.** The first party member (or party pet) whose action hit an enemy. If combat starts with no party action seen, it's flagged as a body pull or someone outside your party.
- **Party first hits.** When each member's first action on the enemy went off, plus when their cast bar started.
- **Your actions.** Everything you pressed from the countdown start through the opener, with timings, for checking pre-pull potions, Standard Step and so on.
- **Overlay.** A live countdown to the hundredth of a second, then the result.
- **History and stats.** Average and median pull timing, your consistency, a "most early pulls" table, a filter by duty, and CSV export.
- **Copy summary.** Puts a one-line summary on the clipboard for you to paste into party chat. The plugin never sends chat messages itself; everything it prints is local echo.

## Commands

| Command | Does |
|---|---|
| `/pulltimer` | Open the main window |
| `/pulltimer config` | Settings |
| `/pulltimer overlay` | Toggle the overlay |
| `/pulltimer last` | Print the last pull to chat again |

## Building

You need the .NET 10 SDK, and XIVLauncher with Dalamud installed (the build references Dalamud from `%AppData%\XIVLauncher\addon\Hooks\dev`).

```
dotnet build PullTimer.slnx -c Debug
```

The output is `PullTimer\bin\Debug\PullTimer.dll`. A `-c Release` build also produces `PullTimer\bin\Release\PullTimer\latest.zip` for distribution.

## Loading it in game

1. `/xlsettings` → **Experimental** → under *Dev Plugin Locations* add the full path to `PullTimer\bin\Debug\PullTimer.dll`, click **+**, then **Save and Close**.
2. `/xlplugins` → **Dev Tools** → **Installed Dev Plugins** → enable **Pull Timer**.
3. After rebuilding, disable and re-enable it there (or turn on auto-reload for it) to pick up the new DLL.

To test, stand at a striking dummy, `/countdown 5`, and hit it near zero. Turn off *Only track inside duties* (the default) so dummies count.

## How it works

- **Countdown.** Each frame the plugin reads the game's countdown agent (`AgentCountDownSettingDialog`: `Active`, `TimeRemaining`), giving the exact moment zero will hit.
- **Pull.** It hooks `ActionEffectHandler.Receive`, the handler for action-effect packets, to see each action from you, a party member, or a party pet that targets an enemy. It then watches that enemy's incoming effects for the hit to land. The first hit to land is the pull, and whoever landed it is the puller. If you drop into combat before any such action, that moment counts as the pull instead, and an action arriving within 0.75 s still names the puller.
- **Cast starts.** Read by polling each party member's cast bar while a countdown is being tracked.

Plugin data lives in `%AppData%\XIVLauncher\pluginConfigs\PullTimer\history.json`.

### Accuracy

All times are when *your client* saw things happen. Other players' actions reach you after a round trip through the server, so their timings carry some latency, and so does the countdown start itself. In practice this is tens of milliseconds, which is fine for judging whether a pull was early. Don't read it as frame-perfect truth.
Two times are tracked for each action:
- **Went off:** the action resolved (cast finished or instant used).
- **Landed:** the enemy actually took the hit.

The pull, and everyone's first-hit times, use **landed**. Landing is detected from each enemy's incoming-effect list: the frame its entry for that action is confirmed by the server, or consumed. The gap between the two times is the action's animation delay. If a landing is never seen (a miss, or the target died), the plugin falls back to the went-off time and marks it "hit not seen".

## Project layout

```
PullTimer/
  Plugin.cs              entry point, services, commands, windows
  Configuration.cs       settings
  ChatReporter.cs        chat output
  Timing.cs              early / on time / late classification and wording
  Tracking/
    PullTracker.cs       countdown + action-effect hook + state machine
    PullSession.cs       live state for one countdown
    PullRecord.cs        saved results
    PullHistory.cs       history.json persistence
    GameNames.cs         action / item / duty names from game data
  Windows/
    MainWindow.cs        last pull, history, stats
    OverlayWindow.cs     live countdown and result
    ConfigWindow.cs      settings UI
```
