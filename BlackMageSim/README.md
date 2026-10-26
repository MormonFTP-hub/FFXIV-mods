# Black Mage Sim (Endwalker)

A browser game: play Endwalker-era (patch 6.5) Black Mage at level 90 on a striking dummy. It has the 6.x kit and numbers and the game's timing rules: GCD, caster tax, slidecasting, the 0.5s action queue and animation lock. There's also a parse meter, so you can practise the opener and the fire/ice loop the way it played before Dawntrail.

## Playing

Open `index.html` in Chrome, Edge or Firefox. Nothing to install. It needs internet only for the fonts and falls back to system fonts without it.

To serve it locally instead (the preview config in `.claude/launch.json` does this as `blm-sim`):

```
python -m http.server 8797 --directory BlackMageSim
```

then go to http://localhost:8797.

| | |
|---|---|
| Hotbar 1 | `1` – `=`: Fire III, Fire IV, Despair, Fire, Blizzard III, Blizzard IV, Blizzard, Thunder III, Xenoglossy, Foul, Umbral Soul, Scathe |
| Hotbar 2 | `Shift` + `1` – `=`: Sharpcast, Triplecast, Swiftcast, Ley Lines, Between the Lines, Amplifier, Manafont, Transpose, Lucid Dreaming, Tincture, Addle, Manaward |
| Hotbar 3 | `Q` `E` `R` `F` `T` `G` `Z` `X` `C` `V` `B` `Y`: Surecast, Sprint, then empty |
| Move | `W` `A` `S` `D` or arrows, `Space` to jump |
| Target | `Tab` or click the dummy, `Esc` to clear |
| Chat | `Enter`, then `/countdown 15` (`/cd`), `/reset`, `/help` |
| Windows | `P` Actions & Traits (drag actions onto the bars), `K` keybind mode, `F1` help |

Hotbars, keybinds and settings save in your browser.

To send it to someone, bundle it into one file and send them `build/BlackMageSim.html`; they double-click it to play:

```
python BlackMageSim/tools/build_single.py
```

## What's in it

- **The 6.5 kit.** Fire, Fire III, Fire IV, Despair, Blizzard, Blizzard III, Blizzard IV, Thunder III, Paradox, Xenoglossy, Foul, Scathe, Umbral Soul, Transpose, Sharpcast (2 charges), Triplecast (2 charges), Manafont, Amplifier, Ley Lines, Between the Lines, Manaward, Swiftcast, Lucid Dreaming, Addle, Surecast, Sprint and a Grade 8 Tincture of Intelligence.
- **Elemental Gauge.** Astral Fire / Umbral Ice I–III with the 15s timer, the Enochian ring (a Polyglot every 30s, max 2, kept when Enochian drops while the timer resets), Umbral Hearts, and the Paradox marker. The marker lights when you leave Astral Fire III for ice, or Umbral Ice III with 3 hearts for fire. Fire and Blizzard turn into Paradox while it's lit.
- **Timing.** Type your spell speed or your GCD in Settings and the other follows (1160 is 2.37, 400 is 2.50). A typed GCD sets the lowest spell speed that reaches it. Fire spells cast in half the time from Umbral Ice III, and ice spells from Astral Fire III.
- **Queueing.** A spell queues in the last 0.5s of the GCD or of a cast. Anything pressed during an animation lock waits for the lock to end, because the game starts a 0.5s client lock on every action. The queue keeps one spell and up to two abilities in the order you pressed them. Triplecast then Fire IV comes out instant, and two abilities pressed together after an instant both go off. Pressed the other way round (Fire IV, then Triplecast at the end of a cast), Fire IV hardcasts, as in the game.
- **Ping, like the vanilla client.** Without NoClippy or XivAlexander, the game holds your animation lock until the server answers. So each instant or ability locks you for 0.6s plus your ping, and each cast adds a 0.1s caster tax plus your ping, with a little jitter per action. At 70 ms that's 0.67s and 0.17s: back-to-back Fire IVs land every 2.82s instead of 2.75s, and a double weave inside Ley Lines clips. Tick the NoClippy / XivAlexander box to take the ping back out. Pressing up to 0.5s early queues the action. Moving or jumping cancels a cast except in its last 0.5s, which is marked on the cast bar. Abilities can't be used mid-cast.
- **MP.** 10,000 MP. Fire spells cost double in Astral Fire unless a heart covers it. Despair takes everything (800 minimum). MP comes back on a 3s server tick: 200 normally, 3200/4700/6200 in Umbral Ice I/II/III, nothing in Astral Fire. Manafont gives 3000. A thin bar above the MP bar fills toward the next tick and shows what it will give, so you can time Fire III off the second Umbral Ice tick.
- **Procs.** Fire and Astral Fire Paradox have a 40% chance to grant Firestarter. Each Thunder III tick has a 10% chance to grant Thundercloud, which makes the next Thunder III instant and free, with the whole DoT added to the hit. Sharpcast guarantees the proc.
- **Damage.** The level 90 damage formula with a rough 6.5 best-in-slot set: Astral Fire III ×1.8, Umbral Ice ×0.9/0.8/0.7 on the other element, Enochian ×1.23, and crit and direct hit rolls. DoT ticks run on their own 3s server tick.
- **Ley Lines.** Drops a circle at your feet. Standing in it gives Circle of Power (15% faster casts and GCD). Between the Lines teleports you back to it.
- **HUD.** Hotbars with the GCD sweep, cooldown numbers, charge counts, MP cost and proc borders. Also a cast bar, party list, target bar with your DoT, buff row, battle log, flytext and an Endwalker-style gauge.
- **Parses.** The meter starts on your first hit, or at the end of a countdown. Pulls end after 10s of not acting, or at a fixed pull length from Settings. Each pull gets a breakdown: DPS, GCD uptime, per-action damage and crit/DH, and a timeline of every cast and weave. DPS is coloured against a scripted bot running the same loop. The colours are a rough guide only, with no raid buffs.

## Notes on accuracy

The 6.x numbers come from the patch history on the FFXIV wiki (consolegameswiki): Fire IV 310, Despair 340, Paradox 500, Xenoglossy 880 (6.4), Thunder III 50 + 35 per tick for 30s, Enhanced Enochian III at 23% (6.4), Triplecast and Sharpcast with 2 charges, and Thundercloud lasting 40s.

Some things are reconstructed rather than read off a 6.x source:

- Ice spells cost no MP while in Umbral Ice. Blizzard IV straight after Blizzard III at 0 MP needs this to work the way it did. Fire spells under Umbral Ice I/II, and ice spells under Astral Fire I/II, cost half and a quarter.
- The gear set, the Grade 8 Tincture cap (262 INT) and the spell application delays are close approximations, so hits land within a few percent of what you remember, not to the point.
- AoE spells (Flare, Freeze, High Fire II, High Blizzard II, Thunder IV) are left out since there's one dummy. Aetherial Manipulation is left out because it needs a party member.
- Icons, the dummy and the mage are drawn in code for this page. No game assets are used. The sounds are synthesised.

## Files

| File | What it does |
|---|---|
| `js/data.js` | Actions, potencies, cooldowns, default hotbars and keybinds |
| `js/engine.js` | Combat engine: GCD, casts, queue, gauge, MP/DoT ticks, damage formula |
| `js/scene.js` | Canvas scene: camera, arena, dummy, mage, spell effects |
| `js/ui.js` | HUD: hotbars, gauge, statuses, cast bar, chat, flytext, meter, windows |
| `js/main.js` | Input, keybinds, drag and drop, countdown, parse tracking, frame loop |
| `js/icons.js` | SVG icon art |
| `js/audio.js` | Web Audio sound effects |

## Changelog

- **1.2.1**: Action queue fixed. Triplecast then Fire IV no longer loses the Triplecast, a press during an animation lock queues instead of being dropped, and double weaves queue both abilities.
- **1.2.0**: Ping is added to animation lock and caster tax like the vanilla client, with a NoClippy / XivAlexander toggle. GCD and spell speed boxes update each other. Single-file build script for sharing.
- **1.1.0**: Spell speed is a number you type instead of a GCD dropdown. MP tick timer above the MP bar.
- **1.0.0**: First version.
