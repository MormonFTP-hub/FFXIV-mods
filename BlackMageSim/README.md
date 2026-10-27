# Striking Dummy Sim (Black Mage, Samurai, Monk, Dragoon, Ninja, Bard, Machinist, Warrior, Gunbreaker, Summoner, Astrologian, Scholar)

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
| Summoner | Heavensward 3.0–3.57 | Level 60, the DoT Summoner. Bio, Bio II and Miasma with Tri-disaster and Contagion, Fester at 100 per DoT, a 15s Dreadwyrm Trance into Deathflare, Rouse and Spur, Raging Strikes, with Heavensward's formula. Caller's artifact gear with the Alexandrian Metal Grimoire |
| Summoner | Stormblood 4.0–4.06 | Level 70, Summon Bahamut's debut. Ruin III 150 and still cast in Trance, Ruin IV with a cast in place of Ruin III, Tri-bind with a 3s cast, 6s summons, Devotion 5% on one player, Wyrmwave 160 |
| Summoner | Stormblood 4.1–4.58 | Level 70. Garuda-Egi or Ifrit-Egi attacking on its own, Bio III and Miasma III with Tri-disaster, Aetherflow into Fester and a 16s Dreadwyrm Trance, two Trances for Demi-Bahamut (Wyrmwave on every action, Akh Morn), Further Ruin from pet actions. Channeler's artifact gear with the Omega Grimoire |
| Astrologian | Heavensward 3.4–3.57 | Level 60. Cleric Stance swaps your Mind into Intelligence for damage; Malefic II with both Combust and Combust II; the Balance 20%, the Spear −20% ability recast, Draw, Spread, Redraw and Royal Road (no Minor Arcana or Earthly Star); Luminiferous Aether for MP, with Heavensward's formula. Welkin artifact gear with the Alexandrian Metal Meter |
| Astrologian | Stormblood 4.05–4.18 | Level 70. The Stormblood card game (Draw, Royal Road, Spread, Minor Arcana, Sleeve Draw; the Balance 10%, the Spear 20s), Malefic III with a 2.5s cast, Earthly Star, Lightspeed with a 25% damage cost. Constellation artifact gear with the Omega Torquetum |
| Astrologian | Stormblood 4.2–4.25 | As 4.05 with the Spear lasting 30s, Sigmascape gear |
| Astrologian | Stormblood 4.3–4.38 | 1.5s Malefic casts, Aspected Helios 2.5s, Lightspeed halves MP with no damage cost (120s) |
| Astrologian | Stormblood 4.4–4.58 | Minor Arcana and Lord / Lady of Crowns on 1s recasts, Alphascape gear |
| Scholar | Heavensward 3.0–3.57 | Level 60, "Scholar's golden age". Cleric Stance swaps your Mind into Intelligence; Broil, Bio, Bio II, Miasma and Shadow Flare (a cast), Energy Drain on Aetherflow (20% MP), Bane, Dissipation, Selene's Fey Wind; no Faerie Gauge or Chain Stratagem, with Heavensward's formula. Savant's artifact gear with the Alexandrian Metal Codex |
| Scholar | Stormblood 4.05–4.18 | Level 70. Broil II, Bio II and Miasma, Energy Drain with Quickened Aetherflow, Chain Stratagem, Shadow Flare, Selene's Fey Wind; Dissipation sends the faerie away until you resummon it. Orator's artifact gear with the Omega Codex |
| Scholar | Stormblood 4.2–4.25 | The same damage kit; Excogitation also heals on expiry; Sigmascape gear |
| Scholar | Stormblood 4.3–4.58 | The same damage kit; Whispering Dawn instant, Aetherpact 3s; Alphascape gear |
| Monk | Heavensward 3.07–3.57 | Level 60. Greased Lightning III on a 14s timer, Tornado Kick every 40s, Touch of Death, The Forbidden Chakra 320, Blood for Blood and Fracture cross-class, with Heavensward's formula. Tantra artifact gear with the Alexandrian Metal Knuckles |
| Monk | Stormblood 4.2–4.58 | Level 70 on TP. Forms and Greased Lightning III, Tornado Kick, Riddle of Fire, Brotherhood, Perfect Balance every 60s, chakra and The Forbidden Chakra, Fists and Tackles. Seventh Heaven artifact gear with the Omega Knuckles |
| Dragoon | Stormblood 4.1–4.58 | Level 70 on TP. Two five-hit combos with Lance Mastery, Blood of the Dragon, three Eyes for Life of the Dragon and Nastrond, Blood for Blood, Battle Litany, Dragon Sight. Trueblood artifact gear with the Omega Trident |
| Ninja | Heavensward 3.0–3.57 | Level 60. Huton kept up by Armor Crush, Kiss of the Viper, Ten / Chi / Jin off the GCD (another action between them makes Rabbit Medium), Suiton into Trick Attack, Kassatsu Raiton, Duality, Shadow Fang and Mutilate, on TP, with Heavensward's formula. Iga artifact gear with the Alexandrian Metal Daggers |
| Bard | Stormblood 4.06–4.58 | Level 70 on TP. Caustic Bite and Stormbite with Iron Jaws, Straighter Shot into Refulgent Arrow, the three songs and their Repertoire, Barrage, Pitch Perfect. Storyteller's artifact gear with the Omega Bow |
| Machinist | Heavensward 3.4–3.57 | Level 60, before Heat. The Gauss Barrel (+30%, but weaponskills are cast and auto-attacks stop), five rounds from Reload, Hot Shot and Lead Shot, Wildfire over 15s, Rapid Fire, the Rook Autoturret with Hypercharge, Raging Strikes and Hawk's Eye, with Heavensward's formula. Machinist's artifact gear with the Alexandrian Metal Cannon |
| Machinist | Stormblood 4.06–4.58 | Level 70 on TP. Gauss Barrel Heat and Overheat, ammunition, the Heated combo, Wildfire, Rapid Fire, Flamethrower, the Rook Autoturret with Hypercharge and Overdrive. Gunner's artifact gear with Omegafire |
| Warrior | Heavensward 3.0–3.57 | Level 60, the first Heavensward version. Deliverance and Abandon into Fell Cleave, Infuriate, Berserk then Pacification, Maim and Storm's Eye, on TP, with Heavensward's damage formula (no Direct Hit). Ravager's artifact gear with the Alexandrian Metal Axe |
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
- **Elemental Gauge.** Astral Fire / Umbral Ice I–III with the 15s timer, the Enochian ring (a Polyglot every 30s, max 2, kept when Enochian drops while the timer resets), Umbral Hearts, and the Paradox marker. The marker lights when you leave Astral Fire III for ice, or Umbral Ice III with 3 hearts for fire. Fire and Blizzard turn into Paradox while it's lit; in ice, Paradox adds a stack of Umbral Ice (Umbral Ice I becomes II) as well as refreshing the timer.
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

### Astrologian (Heavensward 3.4–3.57)

- **The kit.** Malefic, Malefic II, Combust, Combust II, Gravity, Draw, Redraw, Royal Road, Spread, Time Dilation, Celestial Opposition, Luminiferous Aether, Disable, Lightspeed, the Sects, the heals for the hotbar, the Conjurer and Thaumaturge cross-class skills Astrologians slotted (Cleric Stance, Swiftcast, Surecast, Aero, Protect, Stoneskin) and a Supramax-Potion of Mind.
- **Cleric Stance.** A toggle: it swaps your Mind into Intelligence (+10% attack magic, −20% healing). Healer gear had no Intelligence, so without it your spells hit with about 228.
- **Cards and MP.** Built on the Stormblood class: Draw turns into the card, Spread keeps one, Royal Road enhances the next. The Balance is +20% (3.4), the Spear −20% to ability recasts. MP regen is 2% of the pool a tick; Luminiferous Aether and the Ewer add to it, and a long fight runs dry.

### Astrologian (Stormblood 4.05–4.58, four versions)

- **The kit.** Malefic III, Combust II, Gravity, Earthly Star and Stellar Detonation, Draw, Redraw, Undraw, Royal Road and Empty Road, Spread and Undraw Spread, Minor Arcana with Lord and Lady of Crowns, Sleeve Draw, Time Dilation, Celestial Opposition, Lightspeed, the Sects, the heals for the hotbar, the healer role actions of the time (Cleric Stance, Swiftcast, Lucid Dreaming, Largesse, Surecast) and a Grade 3 Infusion of Mind.
- **Cards.** Draw turns into the card you drew; press it to play it on yourself. The Balance (+10% damage), the Spear (+10% crit), the Arrow (10% haste) and the Ewer (MP) do something on a dummy; the Bole and the Spire are for Royal Road (Enhanced ×1.5, Extended ×2 duration, Expanded AoE at half) or Minor Arcana. Draw's recast starts once the card is used, as in 4.x. A gauge shows your hand, the Spread, the stored Royal Road and the Arcana card.
- **Earthly Star.** Placed at the dummy: detonate it after 10s (Giant Dominance) for 200, or earlier for 150; it goes off by itself at 20s.

### Scholar (Heavensward 3.0–3.57)

- **The kit.** Broil, Ruin, Ruin II, Bio, Bio II, Miasma, Miasma II, Shadow Flare, Energy Drain, Bane, Aetherflow, Dissipation, Rouse, Eye for an Eye, Virus, the heals and faerie actions for the hotbar, the Conjurer and Thaumaturge cross-class skills (Cleric Stance, Swiftcast, Surecast, Aero, Protect, Stoneskin) and a Supramax-Potion of Mind.
- **Built on the Stormblood class.** Cleric Stance is the Heavensward toggle (Mind into Intelligence, +10%). Aetherflow restores 20% of your MP every 60s with three Energy Drains; there's no Quickened Aetherflow or Faerie Gauge. After Dissipation you summon the faerie back yourself (a 6s cast). The faerie doesn't attack; Selene keeps Fey Wind (3%) on you.

### Scholar (Stormblood 4.05–4.58, three versions)

- **The kit.** Broil II, Bio II, Miasma, Miasma II, Ruin II, Energy Drain, Bane, Shadow Flare, Chain Stratagem (+15% crit on the dummy), Aetherflow (Quickened: 5s off its recast per Aetherflow action), Dissipation, the heals and faerie orders for the hotbar, the healer role actions of the time and a Grade 3 Infusion of Mind. Scholar's damage didn't change across Stormblood; the three versions differ in the healing kit and gear.
- **Faerie.** Selene keeps Fey Wind (3% haste) on you in combat; Eos is there for her heals. The faerie deals no damage. Dissipation dismisses it, and you resummon it yourself, as in Stormblood. A gauge shows Aetherflow, the Faerie Gauge (Energy Drain +10, Fey Union drains it) and your faerie.

### Monk (Stormblood 4.2–4.58)

- **The kit.** Bootshine, True Strike, Snap Punch, Dragon Kick, Twin Snakes, Demolish, Arm of the Destroyer, One Ilm Punch, Rockbreaker, Form Shift, Meditation and The Forbidden Chakra, Tornado Kick, Steel Peak, Howling Fist, Elixir Field, Shoulder / Fire / Wind / Earth Tackle and the Riddle of Wind attack, Internal Release, Perfect Balance, Riddle of Fire, Brotherhood, Riddle of Earth, the three Fists, Mantra, Purification, the melee role actions of the time and a Grade 3 Infusion of Strength.
- **Forms and Greased Lightning.** Opo-opo → Raptor → Coeurl, each 10s; Perfect Balance lifts the requirement. Snap Punch, Demolish, Rockbreaker and the Riddle of Wind attack add a Greased Lightning stack (16s, up to three: +10% damage and 5% speed each); Tornado Kick spends three. Bootshine in opo-opo from the rear is a critical hit. A gauge shows the form, the stacks and five chakra (Meditation, 50% on a critical weaponskill, 30% per weaponskill under Brotherhood).

### Dragoon (Stormblood 4.1–4.58)

- **The kit.** True Thrust, Vorpal Thrust, Full Thrust, Impulse Drive, Disembowel, Chaos Thrust, Fang and Claw, Wheeling Thrust, Heavy Thrust, Piercing Talon, Doom Spike, Sonic Thrust, Jump, Spineshatter Dive, Dragonfire Dive, Mirage Dive, Geirskogul, Nastrond, Blood of the Dragon, Life Surge, Blood for Blood, Battle Litany, Dragon Sight, Elusive Jump, the melee role actions of the time and a Grade 3 Infusion of Strength.
- **Dragon Gauge.** Blood of the Dragon (20s, extended 10s at a time to 30s by Fang and Claw, Wheeling Thrust and Sonic Thrust) opens Fang and Claw / Wheeling Thrust after Full Thrust / Chaos Thrust; the second of the pair gets Lance Mastery's +100. Jump and Spineshatter Dive grant Mirage Dive, each an Eye; with three, Geirskogul enters Life of the Dragon and becomes Nastrond.

### Bard (Stormblood 4.06–4.58)

- **The kit.** Heavy Shot, Straight Shot, Caustic Bite, Stormbite, Iron Jaws, Refulgent Arrow, Quick Nock, Empyreal Arrow, Bloodletter, Rain of Death, Sidewinder, Pitch Perfect, Raging Strikes, Barrage, the three songs, Battle Voice, Troubadour, Nature's Minne, the Warden's Paean, Repelling Shot, the ranged role actions of the time and a Grade 3 Infusion of Dexterity.
- **Songs.** Each lasts 30s on an 80s recast. A critical DoT tick or an Empyreal Arrow triggers the song's Repertoire: Bloodletter back in Mage's Ballad, 4% speed per stack (up to four) in Army's Paeon, Pitch Perfect stacks in the Minuet. A gauge shows the song, its time and the stacks.

### Machinist (Stormblood 4.06–4.58)

- **The kit.** Split, Slug and Clean Shot and their Heated versions, Hot Shot, Cooldown, Spread Shot, Reload, Quick Reload, Reassemble, Gauss Round, Ricochet, Wildfire, Rapid Fire, Hypercharge, Gauss Barrel, Barrel Stabilizer, Flamethrower, Rook Autoturret and Rook Overdrive, the ranged role actions of the time and a Grade 3 Infusion of Dexterity.
- **Heat and ammunition.** With the barrel on, weaponskills build Heat; the combo turns Heated at 50; at 100 you're Overheated (+20% for 10s), then the barrel comes off for 10s. Ammunition adds 30 potency and makes the combo procs certain. Wildfire stores a quarter of your damage for 10s and deals it at the end. The turret is drawn as a small tripod.

### Ninja (Heavensward 3.0–3.57)

- **The kit.** Spinning Edge, Gust Slash, Aeolian Edge, Armor Crush, Dancing Edge, Shadow Fang, Mutilate, Death Blossom, Throwing Dagger, Trick Attack, Sneak Attack, Mug, Jugulate, Dream Within a Dream, Assassinate, Duality, Kassatsu, Ten, Chi, Jin and Ninjutsu (Fuma Shuriken, Katon, Raiton, Hyoton, Huton, Doton, Suiton, Rabbit Medium), Kiss of the Wasp and Kiss of the Viper, Hide, Shukuchi, Goad, Shade Shift, Shadewalker, Smoke Screen, the Pugilist and Lancer cross-class skills (Internal Release, Blood for Blood, Invigorate, Second Wind, Featherfoot, Mantra, Keen Flurry, Feint) and a Draconian Potion of Dexterity.
- **Mudras.** Ten, Chi and Jin are off the GCD and share Ninjutsu's 20s recast. The Ninjutsu button turns into what the signs make; using anything else in between, repeating a sign or making a fourth makes Rabbit Medium, and signs left 5s run out (the recast starts anyway). No job gauge existed in Heavensward; a small panel shows Huton's timer and the signs made so far.
- **Huton and Duality.** Huton is +15% weaponskill and auto-attack speed for 70s; Armor Crush's combo adds 30s up to 70. Duality makes the next single-target weaponskill strike twice, neither able to crit.

### Machinist (Heavensward 3.4–3.57)

- **The kit.** Split, Slug and Clean Shot, Hot Shot, Lead Shot, Spread Shot, Grenado Shot, Reload, Quick Reload, Reassemble, Heartbreak, Blank, Head Graze, Suppressive Fire, Leg Graze, Foot Graze, Wildfire, Rapid Fire, Gauss Barrel, Gauss Round, Ricochet, the Rook and Bishop Autoturrets, Turret Retrieval, Hypercharge, Dismantle, Rend Mind, the Archer and Lancer cross-class skills (Raging Strikes, Hawk's Eye, Quelling Strikes, Blood for Blood, Invigorate, Keen Flurry, Feint) and a Draconian Potion of Dexterity.
- **The Gauss Barrel.** +30% damage, but auto-attacks stop and every weaponskill needs a cast (1.5s here). Split Shot makes the next Slug Shot instant and Slug Shot the next Clean Shot; Rapid Fire makes three weaponskills instant at a 1.5s recast.
- **Ammunition.** Reload loads five rounds and Quick Reload one (plus 30 TP); each round is +20 potency and makes Split's and Slug's bonuses certain. From 3.4 they stay loaded until used. A small panel shows the rounds, the turret and what Wildfire has stored.

### Warrior (Heavensward 3.0–3.57)

- **The kit.** Heavy Swing, Skull Sunder, Butcher's Block, Maim, Storm's Path, Storm's Eye, Overpower, Tomahawk, Fracture, Fell Cleave, Decimate, Inner Beast, Steel Cyclone, Brutal Swing, Berserk, Deliverance, Defiance, Infuriate, Unchained, Equilibrium, Raw Intuition, Vengeance, Holmgang, Thrill of Battle, Foresight, Bloodbath, the Gladiator and Pugilist cross-class skills Warriors used (Internal Release, Provoke, Awareness, Convalescence, Flash, Second Wind) and an X-Potion of Strength.
- **Stances.** Deliverance (+5%) builds Abandon (+2% crit a stack, 30s); five make you Uncontrollable for Fell Cleave. Defiance (−25%) builds Wrath for Inner Beast and Unchained. Switching keeps the stacks. A gauge shows them.
- **Heavensward's formula.** Level 60 uses the community-fitted 3.x formula (damage proportional to Strength, (weapon damage / 25 + 1) and (1 + Determination / 7290); crit 1.45× and up), with no Direct Hit, which arrived in 4.0.

### Every job

- **AoE.** Settings → Dummies puts 1, 3 or 5 striking dummies out. AoE actions hit every one with their falloff (Flare 40% less after the first, Stormblood's Mangetsu stepping down per target), and an AoE DoT (Thunder IV, Bow Shock) ticks on each. Point-blank ones (Blizzard II before 6.0, Demon Slice, Fuko, Mangetsu, Oka, Kyuten) need no target but whiff if the dummy isn't within 5 yalms. The meter adds up every dummy. Black Mage has High Fire II, High Blizzard II, Freeze, Flare and Thunder IV in 6.5 (Fire II and Blizzard II before), Samurai Fuko or Fuga, Mangetsu, Oka and Kyuten, Gunbreaker Demon Slice, Demon Slaughter and Fated Circle.
- **HUD.** Hotbars with the GCD sweep, cooldown numbers, charge counts, MP cost and proc borders. Also a cast bar, party list, target bar with your DoT, buff row, battle log, flytext and the job's Endwalker-style gauge.
- **Parses.** The meter starts on your first hit, or at the end of a countdown. Pulls end after 10s of not acting, or at a fixed pull length from Settings. Each pull gets a breakdown: DPS, GCD uptime, per-action damage and crit/DH, and a timeline of every cast and weave. DPS is coloured against a scripted bot playing that job version. The colours are a rough guide only, with no raid buffs. The Samurai bot does about 8,200 DPS in its 6.0 gear and 7,850 in Stormblood (with TP and Kaiten); the Stormblood Summoner bot about 7,600 with Garuda-Egi in 4.1–4.58 and 7,900 in 4.0–4.06; the Stormblood Astrologian bot about 2,650, 3,300, 3,800 and 4,650 across its four versions (before 4.3 it runs short of MP); the Stormblood Scholar bot about 2,650, 3,300 and 4,150; the Stormblood Monk bot about 7,800, Dragoon about 7,350, Bard about 7,050, Machinist about 8,500; the Heavensward Warrior bot about 2,000, Monk about 2,500, Ninja about 2,580, Machinist about 2,450, Summoner about 2,280, Astrologian about 1,600 and Scholar about 1,520 (Heavensward's numbers are smaller; the Monk runs short of TP, the Summoner and Astrologian of MP); the Gunbreaker bot about 5,300 in 6.0–6.18 (6.0 gear) and 8,400 in 6.2–6.58 (6.5 gear).

## Notes on accuracy

The 6.x numbers come from the patch history on the FFXIV wiki (consolegameswiki): Fire IV 310, Despair 340, Paradox 500, Xenoglossy 880 (6.4), Thunder III 50 + 35 per tick for 30s, Enhanced Enochian III at 23% (6.4), Triplecast and Sharpcast with 2 charges, and Thundercloud lasting 40s.

Some things are reconstructed rather than read off a 6.x source:

- Ice spells cost no MP while in Umbral Ice. Blizzard IV straight after Blizzard III at 0 MP needs this to work the way it did. Fire spells under Umbral Ice I/II, and ice spells under Astral Fire I/II, cost half and a quarter.
- The gear set, the Grade 8 Tincture cap (262 INT) and the spell application delays are close approximations, so hits land within a few percent of what you remember, not to the point.
- Samurai's 6.0x numbers (Hakaze 180; Jinpu, Shifu and Yukikaze 280; Gekko and Kasha 320/370; Midare 660; Kaeshi: Setsugekka 990; Ogi Namikiri 900; Kaeshi: Namikiri 1350; Shinten 270; Senei 800; Shoha 580; Higanbana 200 + 30 per tick) are worked back from what the 6.1 patch notes changed. Its gear is a rough 6.0 best-in-slot set (Strength 2563, weapon damage 120, skill speed 579). The Grade 6 tincture caps at 189 Strength.
- Gunbreaker's numbers are the 6.4–6.58 values from the wiki's patch histories (Keen Edge 200, Brutal Shell 160/300 from 6.4; Solid Barrel 140/360 and Blasting Zone 720 from 6.2; Gnashing Fang 380, Savage Claw 440, Wicked Talon 540 and the Continuation follow-ups from 6.11). Its gear is a rough item level 665 set at the 2.50 GCD (Strength 3330, weapon damage 132, Tenacity 751). The opener in its help follows the version's rules but isn't copied from a published guide.
- The extra dummies stand in a pack behind the first; every AoE reaches all of them, whatever its shape. Aetherial Manipulation is left out because it needs a party member.
- Astrologian's numbers are the game data at 4.11, 4.2, 4.25, 4.38 and 4.58 (there's none before 4.11, so 4.05–4.18 uses 4.11's). Cards are drawn at random, 1 in 6 each, and Minor Arcana is Lord or Lady at even odds; the Ewer counts as 600 MP a tick; gear for each tier (item level 340, 370 and 400) is approximate. Cards only go on yourself, since there's no party.
- There's no game data for Heavensward (the datamining starts at 4.11). Warrior's numbers are the 3.5x tooltips copied on Gamer Escape and the FFXIV wiki before 4.0; the damage formula is the community fit (Dervy's, 2015–16); the gear (item level ~270, the Alexandrian Metal Axe at 85 weapon damage, from Heavensward-era item pages since today's data is the 4.0 rescale) and the X-Potion's cap are approximate.
- Heavensward Scholar's numbers are the 3.5x tooltips, the wiki's 2017 Scholar and Arcanist pages and Gamer Escape's pre-4.0 revisions. Not documented: the MP pool (about 13,900 here, from Scholar's 119% MP modifier) and how much MP Energy Drain gave (5% of the pool here).
- Heavensward Astrologian's numbers are the 3.4–3.5 tooltips and job page from the wiki and Gamer Escape before 4.0, and the Lodestone notes for 3.05–3.57. Not documented: the exact MP pool (about 14,500 here, from Astrologian's 124% MP modifier and the gear's Piety), whether the Mind potion had to be drunk before Cleric Stance, and the heals' exact MP. Time Dilation couldn't target yourself (Mimi's 3.15 guide), so it does nothing on a dummy.
- Ninja's and Heavensward Machinist's numbers are the 3.5x tooltips and job pages the FFXIV wiki and Gamer Escape had before 4.0, after the 3.x patch changes (Ninja's 3.1–3.3 TP and potency changes; Machinist's 3.01, 3.07, 3.2 and 3.4). Not documented anywhere found: mudra and Ninjutsu animation locks (0.5s and 0.8s here), whether Kiss of the Viper raised Ninjutsu (here it doesn't), how long the Gauss Barrel cast was (1.5s), whether Wildfire counted DoT ticks (here it doesn't), how the turret scaled (your stats and the +20% trait, none of your buffs) and Blood for Blood's percentage (10%). Gear is approximate (item level ~270, Dexterity about 1,630 for Ninja and 1,560 for Machinist from Heavensward-era item pages).
- Bard's and Machinist's numbers are the 4.58 game data (Bard's didn't change after 4.06; Machinist's ammunition, Hot Shot, Gauss Round and Ricochet rose in 4.5). Repertoire is taken to proc on every critical DoT tick (Stormblood had no roll), Battle Voice to include you, Machinist's ammunition shots to add no Heat, and the turret to use your stats without your buffs.
- Monk's and Dragoon's numbers are the 4.58 game data (their Stormblood PvE kits didn't change after 4.5 and 4.1). For Monk, Greased Lightning's haste and Riddle of Fire's slowdown are taken as adding up. For Dragoon, how long Life of the Dragon lasted and what Blood returned with aren't in the data: here Life is Blood's remainder + 10s and Blood comes back for 20s. Animation locks for the jumps are estimates.
- Summoner's numbers are the 4.58 game data (Action and ActionTransient at the 4.58 datamining commit), checked against the wiki's pre-5.0 revisions and xivanalysis's Stormblood module. How pets scaled in Stormblood isn't documented: here they use your stats and the +30% Maim and Mend trait, and Dreadwyrm Trance doesn't reach them. Ifrit-Egi's separate auto-attack is left out; Further Ruin's 30s and Energy Drain's 5% MP are guesses.
- Samurai's 4.5x numbers come from the wiki's pre-5.0 revisions and patch histories (4.3 and 4.4 raised the combo potencies). The TP costs, the 15s combo window and the 110-potency auto-attacks are the era's values as remembered, not read off a 4.x source. The weapon (109 damage, 2.64 delay) is from the 4.58 item data; the rest of the gear is approximate.
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
| `js/jobs/smn_hw.js` | Summoner, Heavensward 3.0–3.57: three DoTs, Contagion, Trance without Bahamut |
| `js/jobs/ast_sb.js` | Astrologian, Stormblood: four versions from one class, the card game, Earthly Star, the card gauge |
| `js/jobs/ast_hw.js` | Astrologian, Heavensward 3.4–3.57, built on the Stormblood class: Cleric Stance, Heavensward's cards and MP |
| `js/jobs/sch_hw.js` | Scholar, Heavensward 3.0–3.57, built on the Stormblood class: Cleric Stance, three DoTs, 20% Aetherflow |
| `js/jobs/sch_sb.js` | Scholar, Stormblood: three versions from one class, the faerie, the Aetherflow and Faerie gauge |
| `js/jobs/mnk_sb.js` | Monk, Stormblood 4.2–4.58: forms, Greased Lightning, chakra, the gauge |
| `js/jobs/mnk_hw.js` | Monk, Heavensward 3.07–3.57, built on the Stormblood class |
| `js/jobs/drg_sb.js` | Dragoon, Stormblood 4.1–4.58: the combos, Lance Mastery, the Dragon Gauge |
| `js/jobs/brd_sb.js` | Bard, Stormblood 4.06–4.58: songs and Repertoire, the Song Gauge |
| `js/jobs/mch_sb.js` | Machinist, Stormblood 4.06–4.58: Heat, ammunition, Wildfire, the turret |
| `js/jobs/nin_hw.js` | Ninja, Heavensward 3.0–3.57: mudras and Ninjutsu, Huton, Duality, the Huton panel |
| `js/jobs/mch_hw.js` | Machinist, Heavensward 3.4–3.57: the Gauss Barrel's casts, five-round ammunition, the turret |
| `js/jobs/war_hw.js` | Warrior, Heavensward 3.0–3.57: stances, Wrath and Abandon, the gauge |
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

- **2.11.0**: Astrologian, Heavensward 3.4–3.57, and Scholar, Heavensward 3.0–3.57: every version rated 5/5 is now in.
- **2.10.1**: Black Mage: Paradox in Umbral Ice now adds a stack of Umbral Ice, as the Blizzard it replaces does.
- **2.10.0**: Ninja, Heavensward 3.0–3.57, and Machinist, Heavensward 3.4–3.57. The engine can switch auto-attacks off (the Gauss Barrel).
- **2.9.0**: Summoner, Heavensward 3.0–3.57.
- **2.8.0**: Monk, Heavensward 3.07–3.57. Warrior HW's gear now uses Heavensward-era values (Strength 1,450, weapon damage 85); today's item data shows the 4.0 rescale.
- **2.7.0**: Warrior, Heavensward 3.0–3.57, the first level 60 version, with Heavensward's damage formula in the engine.
- **2.6.0**: Bard and Machinist, Stormblood 4.06–4.58, which completes Stormblood's most-missed versions. Stormblood weapons now use their 4.58 values: 109 weapon damage, and 147 magic damage on casters' and healers' weapons (134 / 140 / 146 at item level 340 / 370 / 400). The 93 used before came from today's client, after Endwalker's stat squish, so every Stormblood version hits harder now (about 13% for physical jobs, 43% for casters and healers), and the reference DPS moved with it.
- **2.5.0**: Monk, Stormblood 4.2–4.58, and Dragoon, Stormblood 4.1–4.58, both on TP. The 3D models load in chunks for the shared link, so it isn't held back by the 16 MB file limit.
- **2.4.0**: Scholar, Stormblood, in three versions (4.05–4.18, 4.2–4.25, 4.3–4.58), with the faerie (Selene's Fey Wind, Dissipation and resummoning).
- **2.3.0**: Astrologian, Stormblood, in four versions (4.05–4.18, 4.2–4.25, 4.3–4.38, 4.4–4.58), with the card game. Healers cast like casters in the engine; a crit-rate buff and abilities whose recast starts later are new engine pieces.
- **2.2.0**: Summoner, Stormblood 4.1–4.58 and 4.0–4.06: the engine now has pets (an egi's own attacks, Demi-Bahamut, pet buffs and procs). Icons of actions that Dawntrail struck through are recovered from the grey copies. Black Mage SB's weapon damage was changed here to 93; that turned out to be today's post-Endwalker value (see 2.6.0).
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
