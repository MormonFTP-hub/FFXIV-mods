# Striking Dummy Sim (Black Mage, Samurai, Gunbreaker, Summoner, Astrologian)

A browser game: play a job the way it was in an older patch, at level 90 on a striking dummy. Each job version has that patch's kit and numbers, and they all share the game's timing rules: GCD, caster tax, slidecasting, the 0.5s action queue and animation lock. There's also a parse meter, so you can practise openers and loops the way they played back then.

## Jobs and versions

Press `J` (or the job button, top left) to pick a job, then the patch to play it at. Each job version keeps its own hotbars.

| Job | Version | What makes it that version |
|---|---|---|
| Black Mage | Endwalker 6.5 | Paradox, Sharpcast and Triplecast with 2 charges, Enochian 23% |
| Black Mage | Stormblood 4.2–4.58 | Level 70. 13s Astral Fire and Umbral Ice, one Polyglot for Foul, Convert, 60s Sharpcast, Enochian as a button, Stormblood's 15,480 MP and level-70 spell costs, Seventh Hell gear and the Omega Rod |
| Black Mage | Shadowbringers 5.0–5.58 | Level 80. Enochian as a button (30s, lost when Astral Fire or Umbral Ice drops), Xenoglossy 750, Despair 380, one-charge Sharpcast and Triplecast, 18s procs, Spaekona's gear and the Edenmorn Rod |
| Samurai | Stormblood 4.0–4.58 | Level 70. Weaponskills cost TP (Invigorate refills it), Hissatsu: Kaiten on a 5s recast, Jinpu and Shifu at 10% for 30s, Yukikaze's Slashing Resistance Down, positionals give Kenki rather than potency, a 1.8s Iaijutsu, Guren for 50 Kenki, no Tsubame-gaeshi. Myochin artifact gear with the Omega blade |
| Samurai | Endwalker 6.08 (Kaiten) | Hissatsu: Kaiten, Midare Setsugekka 660, Kaeshi: Setsugekka 990. Patch 6.1 (April 2022) removed Kaiten and reworked the job, so 6.0–6.08 is the whole Kaiten era |
| Summoner | Stormblood 4.0–4.06 | Level 70, Summon Bahamut's debut. Ruin III 150 and still cast in Trance, Ruin IV with a cast in place of Ruin III, Tri-bind with a 3s cast, 6s summons, Devotion 5% on one player, Wyrmwave 160 |
| Summoner | Stormblood 4.1–4.58 | Level 70. Garuda-Egi or Ifrit-Egi attacking on its own, Bio III and Miasma III with Tri-disaster, Aetherflow into Fester and a 16s Dreadwyrm Trance, two Trances for Demi-Bahamut (Wyrmwave on every action, Akh Morn), Further Ruin from pet actions. Channeler's artifact gear with the Omega Grimoire |
| Astrologian | Stormblood 4.05–4.18 | Level 70. The Stormblood card game (Draw, Royal Road, Spread, Minor Arcana, Sleeve Draw; the Balance 10%, the Spear 20s), Malefic III with a 2.5s cast, Earthly Star, Lightspeed with a 25% damage cost. Constellation artifact gear with the Omega Torquetum |
| Astrologian | Stormblood 4.2–4.25 | As 4.05 with the Spear lasting 30s, Sigmascape gear |
| Astrologian | Stormblood 4.3–4.38 | 1.5s Malefic casts, Aspected Helios 2.5s, Lightspeed halves MP with no damage cost (120s) |
| Astrologian | Stormblood 4.4–4.58 | Minor Arcana and Lord / Lady of Crowns on 1s recasts, Alphascape gear |
| Gunbreaker | Shadowbringers 5.1–5.58 | Level 80. Two cartridges (Bloodfest adds 2, 90s), no Double Down or Hypervelocity, Savage Claw and Wicked Talon on their own buttons, skill speed drifts Gnashing Fang and Sonic Break, 15s combos, Bodyguard's gear and the Edenmorn Gunblade |
| Gunbreaker | Endwalker 6.0–6.18 | Bloodfest on a 90s recast against the 60s No Mercy, Continuation at 3 yalms, the 6.11 potencies, 6.0-era gear and Grade 6 tinctures |
| Gunbreaker | Endwalker 6.2–6.58 | Bloodfest on a 120s recast (6.2 raised it from 90s), Double Down for 2 cartridges, Sonic Break as a 60s weaponskill, 6.4 potencies |

More jobs and expansions go in as `js/jobs/<job>_<version>.js`, one file per version (see Files). The full list of versions to build, every job from 2.0 to 7.57 (217 of them, with Endwalker's 44 first), is in [docs/job-versions.md](docs/job-versions.md). Each version there carries a 1–5 rating for how players remember it (5 most missed, 4 well liked, 3 mixed, 2 unpopular, 1 panned). The job window shows these: each playable version's rating and the reason for it, a strip of the job's whole history coloured by rating, and the jobs still to come. After editing the list, run `python BlackMageSim/tools/build_versions.py` to regenerate `js/versions.js`.

## Playing

Open `index.html` in Chrome, Edge or Firefox. Nothing to install. It needs internet only for the fonts and falls back to system fonts without it.

To serve it locally instead (the preview config in `.claude/launch.json` does this as `blm-sim`):

```
python -m http.server 8797 --directory BlackMageSim
```

then go to http://localhost:8797.

| | |
|---|---|
| Hotbar 1 | `1` – `=`. Black Mage: Fire III, Fire IV, Despair, Fire, Blizzard III, Blizzard IV, Blizzard, Thunder III, Xenoglossy, Foul, Umbral Soul, Scathe. Samurai: Hakaze, Jinpu, Gekko, Shifu, Kasha, Yukikaze, Iaijutsu, Tsubame-gaeshi, Ogi Namikiri, Enpi, Hagakure, Meditate |
| Hotbar 2 | `Shift` + `1` – `=`. Black Mage: Sharpcast, Triplecast, Swiftcast, Ley Lines, Between the Lines, Amplifier, Manafont, Transpose, Lucid Dreaming, Tincture, Addle, Manaward. Samurai: Kaiten, Shinten, Senei, Shoha, Meikyo Shisui, Ikishoten, Gyoten, Yaten, True North, Tincture, Feint, Third Eye |
| Gunbreaker bars | Keen Edge, Brutal Shell, Solid Barrel, Gnashing Fang (turns into Savage Claw and Wicked Talon), Continuation, Burst Strike, Sonic Break, Double Down, Lightning Shot, Rough Divide, Royal Guard, Provoke; then No Mercy, Bloodfest, Blasting Zone, Bow Shock, Tincture and the defensive cooldowns |
| Hotbar 3 | `Q` `E` `R` `F` `T` `G` `Z` `X` `C` `V` `B` `Y`: role actions and Sprint (Samurai also has Guren here) |
| Move | `W` `A` `S` `D` or arrows, `Space` to jump |
| Camera | Hold the right mouse button and drag to turn the camera and your character. While it's held, `A` `D` strafe and `S` backpedals at walking pace. Left drag turns just the camera, both buttons run forward, the wheel zooms. The camera stays where you put it; Settings can make it follow the dummy |
| Target | `Tab` or click the dummy, `Esc` to clear |
| Chat | `Enter`, then `/countdown 15` (`/cd`), `/reset`, `/help` |
| Windows | `J` job and version, `P` Actions & Traits (drag actions onto the bars), `K` keybind mode, `F1` help (with the job's opener) |

Hotbars, keybinds and settings save in your browser.

### Game icons and models

The game's own icons, models and animations come from your FFXIV install. Run these once (they use PMP Viewer's game reader, so the same Python with numpy and Pillow):

```
python -P -E BlackMageSim/tools/extract_icons.py
```

```
python -P -E BlackMageSim/tools/export_models.py
```

- **Icons** (`work/game-icons.js`): read from the Action, Status and Item sheets for each job, with each `_hr1` icon decoded. Dawntrail points the rows of actions it removed at the generic removed-action icon, so their Endwalker icons are pinned by number: Sharpcast (002657), Hissatsu: Kaiten (003168), Kaeshi: Higanbana (003181) and Rough Divide (003418).
- **Models** (`work/game-models.js`, about 6.7 MB; the binary part is gzipped and the page inflates it as it loads). One Hyur Midlander man per job, resolved and baked by PMP Viewer and skinned to the game's skeleton:
  - **Black Mage:** the Endwalker artifact gear (Archmage's, set 778) and a Moonward Rod.
  - **Samurai:** the Endwalker artifact gear (Sakonji, set 785), a katana in the right hand and its scabbard at the left hip.
  - **Gunbreaker:** the Endwalker artifact gear (Bastion's, set 787) and the Diadochos Gunblade from 6.4, in the gunblade stance (`bt_2gb_emp`).
  - **Dummies:** the Thavnairian, Glade, Oasis and Crystarium housing striking dummies. Pick one in Settings.
  - **Animations:** the game's own: each job's battle stance and run (`bt_rod_emp`, `bt_2kt_emp`), plus, for every action, the cast start, loop and release or ability motion its ActionTimeline names. Fire IV plays `cbbm_mgc_blk_1` → `_2lp` → `_3b`. Iaijutsu plays `cbbm_mgc_sam_1` → `_2lp` → `_3` for Midare, `_3c` for Higanbana and `_3g` for Tenka Goken. Textures shared between the characters are stored once.

`work/` is git-ignored, so Square Enix's files never go into the repo. Without these files the sim uses its own drawn icons and figures. The models are drawn with three.js r128 from cdnjs, so they need an internet connection, like the fonts. Settings has a switch to turn them off.

To send it to someone, bundle it into one file and send them `build/BlackMageSim.html`; they double-click it to play:

```
python BlackMageSim/tools/build_single.py
```

## What's in it

### Black Mage (Endwalker 6.5)

- **The 6.5 kit.** Fire, Fire III, Fire IV, Despair, Blizzard, Blizzard III, Blizzard IV, Thunder III, Paradox, Xenoglossy, Foul, Scathe, Umbral Soul, Transpose, Sharpcast (2 charges), Triplecast (2 charges), Manafont, Amplifier, Ley Lines, Between the Lines, Manaward, Swiftcast, Lucid Dreaming, Addle, Surecast, Sprint and a Grade 8 Tincture of Intelligence.
- **Elemental Gauge.** Astral Fire / Umbral Ice I–III with the 15s timer, the Enochian ring (a Polyglot every 30s, max 2, kept when Enochian drops while the timer resets), Umbral Hearts, and the Paradox marker. The marker lights when you leave Astral Fire III for ice, or Umbral Ice III with 3 hearts for fire. Fire and Blizzard turn into Paradox while it's lit.
- **Timing.** Type your spell speed or your GCD in Settings and the other follows (1160 is 2.37, 400 is 2.50). A typed GCD sets the lowest spell speed that reaches it. Fire spells cast in half the time from Umbral Ice III, and ice spells from Astral Fire III.
- **Queueing.** A spell queues in the last 0.5s of the GCD or of a cast. Anything pressed during an animation lock waits for the lock to end, because the game starts a 0.5s client lock on every action. The queue keeps one spell and up to two abilities in the order you pressed them. Triplecast then Fire IV comes out instant, and two abilities pressed together after an instant both go off. Pressed the other way round (Fire IV, then Triplecast at the end of a cast), Fire IV hardcasts, as in the game.
- **Ping, like the vanilla client.** Without NoClippy or XivAlexander, the game holds your animation lock until the server answers. So each instant or ability locks you for 0.6s plus your ping, and each cast adds a 0.1s caster tax plus your ping, with a little jitter per action. At 70 ms that's 0.67s and 0.17s: back-to-back Fire IVs land every 2.82s instead of 2.75s, and a double weave inside Ley Lines clips. Tick the NoClippy / XivAlexander box to take the ping back out. Pressing up to 0.5s early queues the action. Moving or jumping cancels a cast except in its last 0.5s, which is marked on the cast bar. Abilities can't be used mid-cast.
- **MP.** 10,000 MP. Fire spells cost double in Astral Fire unless a heart covers it. Despair takes everything (800 minimum). MP comes back on a 3s server tick: 200 normally, 3200/4700/6200 in Umbral Ice I/II/III, nothing in Astral Fire. Manafont gives 3000. A thin bar above the MP bar fills toward the next tick and shows what it will give, so you can time Fire III off the second Umbral Ice tick.
- **Procs.** Fire and Astral Fire Paradox have a 40% chance to grant Firestarter. Each Thunder III tick has a 10% chance to grant Thundercloud, which makes the next Thunder III instant and free, with the whole DoT added to the hit. Sharpcast guarantees the proc.
- **Damage.** The level 90 damage formula with a rough 6.5 best-in-slot set: Astral Fire III ×1.8, Umbral Ice ×0.9/0.8/0.7 on the other element, Enochian ×1.23, and crit and direct hit rolls. DoT ticks run on their own 3s server tick.
- **Ley Lines.** Drops a circle at your feet. Standing in it gives Circle of Power (15% faster casts and GCD). Between the Lines teleports you back to it.

### Samurai (Endwalker 6.08, with Kaiten)

- **The 6.0x kit.** Hakaze, Jinpu, Shifu, Gekko, Kasha, Yukikaze, Enpi, Iaijutsu (Higanbana, Tenka Goken, Midare Setsugekka), Tsubame-gaeshi (2 charges) and its three Kaeshi, Ogi Namikiri and Kaeshi: Namikiri, Hissatsu: Kaiten, Shinten, Gyoten, Yaten, Senei, Guren, Shoha, Ikishoten, Meikyo Shisui (2 charges), Hagakure, Meditate, Third Eye, the melee role actions, Sprint and a Grade 6 Tincture of Strength.
- **Combos and positionals.** Weaponskill combos with a 30s window. Gekko is a rear positional and Kasha a flank one (+50 potency). The ring around the dummy shows the quarters and lights the one you're in. True North covers both. Meikyo Shisui lets three weaponskills skip their combo step and still grant Sen, Kenki, and Fugetsu (Gekko) or Fuka (Kasha).
- **Kaiten.** 20 Kenki for +50% on your next weaponskill, Higanbana's DoT included. It doesn't reach the Kaeshi or Kaeshi: Namikiri.
- **Kenki, Sen and Meditation.** A gauge with the Kenki blade (max 100), the three Sen and three Meditation pips. Iaijutsu and Ogi Namikiri add Meditation; three let you use Shoha.
- **Timing.** Type your skill speed or your GCD with Fuka (the 2.14 tier is 579). Fuka takes 13% off weaponskills, Iaijutsu casts and auto-attacks. Auto-attacks start when you engage and keep going while you're in reach.

### Gunbreaker (Endwalker 6.0–6.18 and 6.2–6.58)

- **The 6.x kit.** Keen Edge, Brutal Shell, Solid Barrel, Lightning Shot, Burst Strike, Gnashing Fang → Savage Claw → Wicked Talon on one button, Continuation (Jugular Rip, Abdomen Tear, Eye Gouge, Hypervelocity), Sonic Break, Double Down, No Mercy, Bloodfest, Blasting Zone, Bow Shock, Rough Divide (2 charges), Royal Guard, Camouflage, Nebula, Aurora (2 charges), Superbolide, Heart of Light, Heart of Corundum, the tank role actions, Sprint and a Grade 8 Tincture of Strength.
- **Two versions.** 6.0–6.18 has Bloodfest on 90s, so it only lines up with No Mercy every 3 minutes, and Continuation reaches 3 yalms; 6.2–6.58 has the 120s Bloodfest and 5-yalm Continuation. Each has its own potencies and gear (6.0 item level 600 against 6.5 item level 665).
- **Powder Gauge.** Three cartridges. Solid Barrel adds one at the end of its combo, Bloodfest adds three. Gnashing Fang and Burst Strike cost one, Double Down two. Cartridge weaponskills don't break the Keen Edge combo.
- **No Mercy.** +20% damage for 20s every 60s. DoTs from Sonic Break and Bow Shock keep the bonus they were applied with.
- **Tank damage.** Tanks use the lower attack power modifier (156 at level 90 against 195) and Tenacity adds to their damage.

### Samurai (Stormblood 4.0–4.58)

- **The 4.5x kit.** Hakaze, Jinpu, Shifu, Gekko, Kasha, Yukikaze, Enpi, Fuga, Mangetsu, Oka, Iaijutsu (Higanbana 240 + 35, Tenka Goken 360, Midare 720 with a 1.8s cast), Hissatsu: Kaiten, Shinten, Kyuten, Gyoten, Yaten, Guren, Hagakure (20 Kenki a Sen), Meikyo Shisui (3 steps, 10s, 80s), Ikishoten (50 Kenki, 60s), Meditate, Third Eye, the usual melee role actions of the time (True North, Invigorate, Feint, Bloodbath, Second Wind, Arm's Length, Leg Sweep), Sprint and a Grade 3 Infusion of Strength.
- **TP.** Shown where MP would be: 1,000, back 60 every 3s. Hakaze, Jinpu and Shifu cost 60, the finishers 50, the AoE weaponskills 140. Invigorate gives 400.
- **Buffs and debuff.** Jinpu (+10% damage) and Shifu (10% haste) last 30s; Yukikaze's combo puts Slashing Resistance Down (+10%) on the dummy for 30s. Gekko from the rear and Kasha from a flank give 5 more Kenki, not potency. Combos have a 15s window.

### Summoner (Stormblood 4.1–4.58)

- **The 4.58 kit.** Ruin III (instant in Trance), Ruin II, Ruin IV, Bio III, Miasma III, Tri-disaster (both DoTs and Ruination, +20 on your Ruins), Aetherflow, Fester, Energy Drain, Painflare, Bane, Dreadwyrm Trance, Deathflare, Summon Bahamut, Enkindle Bahamut, Rouse, Enkindle, Aetherpact, Contagion, Shadow Flare, Tri-bind, Physick, Summon and Summon III, the caster role actions of the time (Swiftcast, Lucid Dreaming, Addle, Surecast) and a Grade 3 Infusion of Intelligence.
- **Pets.** The egi fights on its own from your first attack: Garuda-Egi casts Wind Blade every 3s and Aerial Slash every 30s; Ifrit-Egi stands at the dummy with Burning Strike, Crimson Cyclone and Flaming Crush. Each pet action has a 15% chance of Further Ruin, which makes Ruin II into Ruin IV and takes 10s off Enkindle. Demi-Bahamut replaces the egi for 20s and casts Wyrmwave each time you use an action on the dummy; anything it throws that lands after it leaves does nothing. The pets are drawn as glowing figures, not the game's models.
- **Gauge.** Three Aetherflow slots that turn into Aethertrail Attunement as you spend them, two Dreadwyrm Aether, and a bar for Trance or Demi-Bahamut.

### Astrologian (Stormblood 4.05–4.58, four versions)

- **The kit.** Malefic III, Combust II, Gravity, Earthly Star and Stellar Detonation, Draw, Redraw, Undraw, Royal Road and Empty Road, Spread and Undraw Spread, Minor Arcana with Lord and Lady of Crowns, Sleeve Draw, Time Dilation, Celestial Opposition, Lightspeed, the Sects, the heals for the hotbar, the healer role actions of the time (Cleric Stance, Swiftcast, Lucid Dreaming, Largesse, Surecast) and a Grade 3 Infusion of Mind.
- **Cards.** Draw turns into the card you drew; press it to play it on yourself. The Balance (+10% damage), the Spear (+10% crit), the Arrow (10% haste) and the Ewer (MP) do something on a dummy; the Bole and the Spire are for Royal Road (Enhanced ×1.5, Extended ×2 duration, Expanded AoE at half) or Minor Arcana. Draw's recast starts once the card is used, as in 4.x. A gauge shows your hand, the Spread, the stored Royal Road and the Arcana card.
- **Earthly Star.** Placed at the dummy: detonate it after 10s (Giant Dominance) for 200, or earlier for 150; it goes off by itself at 20s.

### Every job

- **AoE.** Settings → Dummies puts 1, 3 or 5 striking dummies out. AoE actions hit every one with their falloff (Flare 40% less after the first, Stormblood's Mangetsu stepping down per target), and an AoE DoT (Thunder IV, Bow Shock) ticks on each. Point-blank ones (Blizzard II before 6.0, Demon Slice, Fuko, Mangetsu, Oka, Kyuten) need no target but whiff if the dummy isn't within 5 yalms. The meter adds up every dummy. Black Mage has High Fire II, High Blizzard II, Freeze, Flare and Thunder IV in 6.5 (Fire II and Blizzard II before), Samurai Fuko or Fuga, Mangetsu, Oka and Kyuten, Gunbreaker Demon Slice, Demon Slaughter and Fated Circle.
- **HUD.** Hotbars with the GCD sweep, cooldown numbers, charge counts, MP cost and proc borders. Also a cast bar, party list, target bar with your DoT, buff row, battle log, flytext and the job's Endwalker-style gauge.
- **Parses.** The meter starts on your first hit, or at the end of a countdown. Pulls end after 10s of not acting, or at a fixed pull length from Settings. Each pull gets a breakdown: DPS, GCD uptime, per-action damage and crit/DH, and a timeline of every cast and weave. DPS is coloured against a scripted bot playing that job version. The colours are a rough guide only, with no raid buffs. The Samurai bot does about 8,200 DPS in its 6.0 gear and 6,950 in Stormblood (with TP and Kaiten); the Stormblood Summoner bot about 5,300 with Garuda-Egi in 4.1–4.58 and 5,500 in 4.0–4.06; the Stormblood Astrologian bot about 1,750, 2,250, 2,600 and 3,250 across its four versions (before 4.3 it runs short of MP); the Gunbreaker bot about 5,300 in 6.0–6.18 (6.0 gear) and 8,400 in 6.2–6.58 (6.5 gear).

## Notes on accuracy

The 6.x numbers come from the patch history on the FFXIV wiki (consolegameswiki): Fire IV 310, Despair 340, Paradox 500, Xenoglossy 880 (6.4), Thunder III 50 + 35 per tick for 30s, Enhanced Enochian III at 23% (6.4), Triplecast and Sharpcast with 2 charges, and Thundercloud lasting 40s.

Some things are reconstructed rather than read off a 6.x source:

- Ice spells cost no MP while in Umbral Ice. Blizzard IV straight after Blizzard III at 0 MP needs this to work the way it did. Fire spells under Umbral Ice I/II, and ice spells under Astral Fire I/II, cost half and a quarter.
- The gear set, the Grade 8 Tincture cap (262 INT) and the spell application delays are close approximations, so hits land within a few percent of what you remember, not to the point.
- Samurai's 6.0x numbers (Hakaze 180; Jinpu, Shifu and Yukikaze 280; Gekko and Kasha 320/370; Midare 660; Kaeshi: Setsugekka 990; Ogi Namikiri 900; Kaeshi: Namikiri 1350; Shinten 270; Senei 800; Shoha 580; Higanbana 200 + 30 per tick) are worked back from what the 6.1 patch notes changed. Its gear is a rough 6.0 best-in-slot set (Strength 2563, weapon damage 120, skill speed 579). The Grade 6 tincture caps at 189 Strength.
- Gunbreaker's numbers are the 6.4–6.58 values from the wiki's patch histories (Keen Edge 200, Brutal Shell 160/300 from 6.4; Solid Barrel 140/360 and Blasting Zone 720 from 6.2; Gnashing Fang 380, Savage Claw 440, Wicked Talon 540 and the Continuation follow-ups from 6.11). Its gear is a rough item level 665 set at the 2.50 GCD (Strength 3330, weapon damage 132, Tenacity 751). The opener in its help follows the version's rules but isn't copied from a published guide.
- The extra dummies stand in a pack behind the first; every AoE reaches all of them, whatever its shape. Aetherial Manipulation is left out because it needs a party member.
- Astrologian's numbers are the game data at 4.11, 4.2, 4.25, 4.38 and 4.58 (there's none before 4.11, so 4.05–4.18 uses 4.11's). Cards are drawn at random, 1 in 6 each, and Minor Arcana is Lord or Lady at even odds; the Ewer counts as 600 MP a tick; gear for each tier (item level 340, 370 and 400) is approximate. Cards only go on yourself, since there's no party.
- Summoner's numbers are the 4.58 game data (Action and ActionTransient at the 4.58 datamining commit), checked against the wiki's pre-5.0 revisions and xivanalysis's Stormblood module. How pets scaled in Stormblood isn't documented: here they use your stats and the +30% Maim and Mend trait, and Dreadwyrm Trance doesn't reach them. Ifrit-Egi's separate auto-attack is left out; Further Ruin's 30s and Energy Drain's 5% MP are guesses.
- Samurai's 4.5x numbers come from the wiki's pre-5.0 revisions and patch histories (4.3 and 4.4 raised the combo potencies). The TP costs, the 15s combo window and the 110-potency auto-attacks are the era's values as remembered, not read off a 4.x source. The weapon (93 damage, 2.64 delay) is from the game data; the rest of the gear is approximate.
- Icons, models and animations come from your own game install when you've run the two tools, and are drawn in code otherwise. Spell effects and sounds are made for this page, not the game's VFX and audio. Two of the exporter's choices: it shows the coat's sleeves (PMP Viewer's pre-Dawntrail visibility tables hide them under these gloves, which left the arms empty), and it draws the housing dummies fully opaque (background textures keep other data in alpha). FINAL FANTASY XIV © SQUARE ENIX. This is a fan-made, non-commercial practice tool, not affiliated with Square Enix.

## Files

| File | What it does |
|---|---|
| `js/data.js` | Shared numbers, role actions, the job registry, default keybinds and settings |
| `js/versions.js` | Every job's version history with ratings, generated from `docs/job-versions.md` |
| `js/engine.js` | Combat engine shared by every job: GCD, casts, queue, cooldowns and charges, combos, positionals, auto-attacks, MP/DoT ticks, damage formula |
| `js/jobs/blm_ew.js` | Black Mage, Endwalker 6.5: actions, gauge, rules, help text |
| `js/jobs/sam_ew.js` | Samurai, Endwalker 6.08: actions, gauge, rules, help text |
| `js/jobs/sam_sb.js` | Samurai, Stormblood 4.0–4.58: the 4.5x kit with TP, built on the 6.08 class |
| `js/jobs/smn_sb.js` | Summoner, Stormblood 4.1–4.58: the kit, the egis and Demi-Bahamut, the Aetherflow gauge, help text |
| `js/jobs/smn_sb40.js` | Summoner, Stormblood 4.0–4.06, built on the 4.1–4.58 class |
| `js/jobs/ast_sb.js` | Astrologian, Stormblood: four versions from one class, the card game, Earthly Star, the card gauge |
| `js/jobs/gnb_ew.js` | Gunbreaker, Endwalker 6.2–6.58: actions, Powder Gauge, rules, help text |
| `js/scene.js` | Canvas scene: camera, arena, dummy, drawn figures, spell and weaponskill effects |
| `js/ui.js` | HUD: hotbars, gauge, statuses, cast bar, chat, flytext, meter, windows |
| `js/main.js` | Input, keybinds, drag and drop, countdown, parse tracking, frame loop |
| `js/icons.js` | Game icons when extracted, SVG icon art otherwise |
| `js/models.js` | Draws the game's models with three.js and plays their animations |
| `tools/extract_icons.py` | Pulls the game's icons from your install into `work/game-icons.js` |
| `tools/export_models.py` | Pulls each job's character, weapons and animations, and the dummies, into `work/game-models.js` |
| `tools/build_versions.py` | Turns `docs/job-versions.md` into `js/versions.js` |
| `tools/build_single.py` | Bundles everything into one HTML file for sharing |
| `js/audio.js` | Web Audio sound effects |

## Changelog

- **2.3.0**: Astrologian, Stormblood, in four versions (4.05–4.18, 4.2–4.25, 4.3–4.38, 4.4–4.58), with the card game. Healers cast like casters in the engine; a crit-rate buff and abilities whose recast starts later are new engine pieces.
- **2.2.0**: Summoner, Stormblood 4.1–4.58 and 4.0–4.06: the engine now has pets (an egi's own attacks, Demi-Bahamut, pet buffs and procs). Icons of actions that Dawntrail struck through are recovered from the grey copies. Black Mage SB's Omega Rod is 93 weapon damage, as in the game data (it was 108), so its numbers and reference DPS dropped about 11%.
- **2.1.0**: Samurai, Stormblood 4.0–4.58, with TP. AoE for every job: a Dummies setting (1, 3 or 5) and each version's AoE kit. Lucid Dreaming now ticks on its own, with the other status effects, so it visibly gives MP in Umbral Ice (it still does nothing in Astral Fire). Weaponskills with their own recast (Gnashing Fang, Sonic Break, Double Down, Tsubame-gaeshi) now show it on the hotbar instead of looking ready after the GCD. New default hotbar actions fill empty slots in saved hotbars.
- **2.0.0**: Black Mage, Stormblood 4.2–4.58, the first level 70 version. The engine now has Stormblood's level 70 formula and lets a version set its own max MP, MP regen and Astral Fire timer. Seventh Hell artifact gear with the Omega Rod. Gear stats, the MP pool and the tincture cap are approximate.
- **1.9.0**: Gunbreaker, Shadowbringers 5.1–5.58, with The Balance's 5.58 "4th GCD No Mercy" opener. Job versions can now set their own combo window, and a GCD's own recast can scale with skill speed (5.x Gnashing Fang and Sonic Break).
- **1.8.0**: Black Mage, Shadowbringers 5.0–5.58, the first version below level 90. The engine now takes a level per job version, including level 80 as it was before Endwalker's stat squish (divisor 3300, gear with 5,000+ Intelligence), and a version can wear its own era's gear model. Numbers from the archived 5.58 job guide and The Balance's 5.58 guides; its opener is The Balance's for the 2.33 tier. Build order from here: every version, highest rating first.
- **1.7.0**: Version ratings in the job window. Each playable version shows how players remember it (1–5, with the reason), each job has a history strip of every version it has had, coloured by rating, and the jobs not built yet are listed with theirs. The ratings live in `docs/job-versions.md`.
- **1.6.1**: Gunbreaker's other Endwalker version, 6.0–6.18, with Bloodfest on its original 90s recast, Continuation at 3 yalms, the 6.11 potencies, 6.0-era gear and Grade 6 tinctures. Pick it under Gunbreaker in the job window (`J`).
- **1.6.0**: Gunbreaker, Endwalker 6.2–6.58, the version with Bloodfest on its 120s recast. Comes with the Powder Gauge, the Gnashing Fang and Continuation chains, its game icons, model and animations, gunblade effects and sounds, and an opener in the help. The engine now does tank damage (the 156 attack modifier and Tenacity) and has the tank role actions. The model data is gzipped, so three jobs still fit in a share file under 10 MB.
- **1.5.1**: Mouse camera like the game's standard controls. Right drag turns the camera and your character (A/D strafe, S backpedals at 2.4 yalms a second), left drag turns only the camera, both buttons run forward, and the wheel zooms. The camera no longer swings round to the dummy on its own (a Settings switch brings that back), and Settings has a mouse camera speed.
- **1.5.0**: Jobs and versions. Pick a job and the patch to play it at (`J`); each version keeps its own hotbars. Samurai joins as Endwalker 6.08, the last patch with Hissatsu: Kaiten. It comes with its gauge, combos and positionals, auto-attacks, Iaijutsu and Tsubame-gaeshi, game icons, model and animations, sword effects and sounds, and its opener in the help. The engine is now shared, with each job version in its own file.
- **1.4.0**: The game's own models and animations: the Black Mage in Archmage's gear with a Moonward Rod, a choice of four striking dummies, and every action's real cast and ability motion. Exported from your install by `tools/export_models.py`. The camera sits closer and you start 10 yalms from the dummy.
- **1.3.0**: The game's own icons for actions, statuses (Triplecast with its stack art), the Tincture and the job, extracted from your install by `tools/extract_icons.py`.
- **1.2.1**: Action queue fixed. Triplecast then Fire IV no longer loses the Triplecast, a press during an animation lock queues instead of being dropped, and double weaves queue both abilities.
- **1.2.0**: Ping is added to animation lock and caster tax like the vanilla client, with a NoClippy / XivAlexander toggle. GCD and spell speed boxes update each other. Single-file build script for sharing.
- **1.1.0**: Spell speed is a number you type instead of a GCD dropdown. MP tick timer above the MP bar.
- **1.0.0**: First version.
