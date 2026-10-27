# Every job version (2.0 to 7.57)

The plan for the sim: every job, in every version it has had. This is the list of those versions, researched from the official patch notes and the FFXIV wiki's per-action patch histories. Live patch when this was written: **7.57** (2026-10-13). The next expansion, 8.0 "Evercold", is announced for January 2027 and, per the wiki, will give each job a "Reborn" and an "Evolved" mode. It isn't covered here yet.

**What counts as a version.** One per expansion, split mid-expansion only where a patch changed how the job plays: actions added, removed or reworked, gauge or resource changes, recast, charge or duration changes to key cooldowns, or rotation-changing traits. Pure potency tuning doesn't start a new version; where a version spans potency changes, the sim uses that version's last numbers. Versions marked **(minor)** are small enough to merge into the one before if you want fewer. Each range runs from its first patch until the day before the next version starts; dates are NA release dates.

| Role | Jobs | Versions |
|---|---|---|
| Tanks | Paladin 13, Warrior 14, Dark Knight 11, Gunbreaker 7 | 45 |
| Healers | White Mage 16, Scholar 13, Astrologian 21, Sage 5 | 55 |
| Melee | Monk 15, Dragoon 14, Ninja 10, Samurai 8, Reaper 3, Viper 2 | 52 |
| Physical ranged | Bard 10, Machinist 14, Dancer 4 | 28 |
| Casters | Black Mage 13, Summoner 11, Red Mage 7, Pictomancer 2 | 33 |
| Limited | Blue Mage 4 (by level cap). Beastmaster (added 7.56) not covered | 4 |
| **Total** | | **217** |

## Endwalker first

Endwalker (6.0–6.58, Dec 2021 – Jul 2024) has 44 versions across 19 jobs. Built ones are ticked (4 so far).

| Job | Endwalker versions |
|---|---|
| Paladin | 6.0–6.08 · 6.1–6.28 · 6.3–6.38 · 6.4–6.58 (minor) |
| Warrior | 6.0–6.08 · 6.1–6.58 |
| Dark Knight | 6.0–6.08 · 6.1–6.18 · 6.2–6.58 |
| Gunbreaker | **6.0–6.18 ✔** · **6.2–6.58 ✔** |
| White Mage | 6.0–6.08 · 6.1–6.18 · 6.2–6.28 (minor) · 6.3–6.58 |
| Scholar | 6.0–6.08 · 6.1–6.58 (minor) |
| Astrologian | 6.0–6.18 · 6.2–6.58 |
| Sage | 6.0–6.08 · 6.1–6.18 · 6.2–6.28 · 6.3–6.58 |
| Monk | 6.0–6.08 · 6.1–6.28 · 6.3–6.58 (minor) |
| Dragoon | 6.0–6.28 · 6.3–6.58 |
| Ninja | 6.0–6.01 (minor) · 6.05–6.08 · 6.1–6.58 |
| Samurai | **6.0–6.08 (Kaiten) ✔** · 6.1–6.58 |
| Reaper | 6.0–6.58 |
| Bard | 6.0–6.58 |
| Machinist | 6.0–6.18 · 6.2–6.28 · 6.3–6.58 |
| Dancer | 6.0–6.08 · 6.1–6.58 |
| Black Mage | **6.0–6.58 ✔** (built with the 6.4–6.58 numbers) |
| Summoner | 6.0–6.08 · 6.1–6.58 |
| Red Mage | 6.0–6.58 |


## Tanks (45 versions: PLD 13, WAR 14, DRK 11, GNB 7)

Role actions: cross-class skills in 2.x–3.x; a role-action pool in 4.x; the fixed set (Rampart, Low Blow, Provoke, Interject, Reprisal, Arm's Length, Shirk) from 5.0. Reprisal became AoE 10s in 5.1. Tank stance recast 10→3s in 6.1, 2s plus a release button in 6.3.

### Paladin / Gladiator
1. ARR 2.0–2.57 (2013-08-27 → 2015-06-22): TP kit; Fight or Flight 90s; Shield Swipe a GCD after a block; Sentinel 180s; Bulwark; Sword Oath / Shield Oath stance; Cover; Spirits Within; Hallowed Ground.
2. HW 3.0–3.07 (2015-06-23 → 2015-11-09): Sheltron (30s block), Goring Blade, Divine Veil (150s), Clemency (3s cast), Royal Authority off Savage Blade.
3. HW 3.1–3.15 (2015-11-10 → 2016-02-22): Shield Swipe an oGCD (15s, 150).
4. HW 3.2–3.57 (2016-02-23 → 2017-06-19): Divine Veil 120s; Clemency 2s; Oaths don't break combos; Shield Oath penalty 15%. (3.4 Sword Oath 75.)
5. SB 4.0–4.01 (2017-06-20 → 2017-07-16): Oath Gauge; Sheltron 50 gauge / 5s; Fight or Flight 60s 25%; Holy Spirit, Requiescat (+20% magic at 80% MP), Total Eclipse, Intervention, Passage of Arms.
6. SB 4.05–4.58 (2017-07-17 → 2019-07-01): Oath Gauge not halved on swap.
7. ShB 5.0–5.08 (2019-07-02 → 2019-10-28): TP and Oaths removed; Iron Will; Atonement; Requiescat +50% magic, instant casts; Confiteor, Holy Circle, Prominence, Intervene; Sentinel 120s; Divine Veil 90s.
8. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): Sentinel 15s.
9. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Requiescat 5 stacks; Confiteor → Blade of Faith / Truth / Valor; Expiacion; Holy Sheltron.
10. EW 6.1–6.28 (2022-04-12 → 2023-01-09): Blade of Faith needs Blade of Faith Ready (from Requiescat ending); Holy Spirit / Circle / Clemency don't break combos.
11. EW 6.3–6.38 (2023-01-10 → 2023-05-22): Fight or Flight all damage, 20s; Goring Blade a 700-potency 60s GCD; Requiescat 4 stacks + Confiteor Ready; Divine Might; Sheltron 15% reduction; Bulwark back.
12. EW 6.4–6.58 (2023-05-23 → 2024-07-01) (minor): Atonement doesn't break combos.
13. DT 7.0–7.57 (2024-07-02 → present): Goring Blade Ready from Fight or Flight; Atonement → Supplication → Sepulchre; Imperator; Blade of Honor; Guardian.

### Warrior / Marauder
1. ARR 2.0 (2013-08-27 → 2013-12-16): Defiance + Wrath (5 stacks → Inner Beast, Steel Cyclone, Unchained); Inner Beast heals 300% of damage; Unchained 180s.
2. ARR 2.1–2.57 (2013-12-17 → 2015-06-22): Inner Beast heal 100% + 20% reduction; Unchained 120s; Vengeance 30% mitigation; Holmgang pull.
3. HW 3.0–3.57 (2015-06-23 → 2017-06-19): Deliverance + Abandon → Fell Cleave, Decimate; Raw Intuition; Equilibrium.
4. SB 4.0–4.01 (2017-06-20 → 2017-07-16): Beast Gauge; Inner Release (120s, halves costs); Berserk 60s +30%; Storm's Eye +20%; Upheaval, Onslaught, Shake It Off.
5. SB 4.05–4.06 (2017-07-17 → 2017-10-09): gauge kept on stance swap; Inner Release and Unchained free.
6. SB 4.1–4.18 (2017-10-10 → 2018-01-29): Deliverance turns Inner Beast etc. into Fell Cleave etc.; Shake It Off a party barrier.
7. SB 4.2–4.58 (2018-01-30 → 2019-07-01): Inner Release 90s, free gauge actions + guaranteed crit/DH; Berserk upgrades into it; Storm's Eye 10%.
8. ShB 5.0–5.08 (2019-07-02 → 2019-10-28): single stance; Infuriate 2 charges → Nascent Chaos → Chaotic Cyclone / Inner Chaos; Mythril Tempest; Nascent Flash.
9. ShB 5.1–5.21 (2019-10-29 → 2020-08-10): Vengeance 15s; Holmgang 8s; Raw Intuition 6s.
10. ShB 5.3–5.58 (2020-08-11 → 2021-12-06): Storm's Eye stacks to 60s.
11. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Surging Tempest; Inner Release / Berserk 60s, 3 stacks; Primal Rend; Onslaught 3 charges; Orogeny; Bloodwhetting.
12. EW 6.1–6.58 (2022-04-12 → 2024-07-01): Inner Release stacks only on Fell Cleave / Decimate.
13. DT 7.0 (2024-07-02 → 2024-07-15): Primal Wrath, Primal Ruination; Inner Chaos needs 50 gauge; Damnation.
14. DT 7.01–7.57 (2024-07-16 → present): Primal Ruination Ready 20s.

### Dark Knight (from 3.0)
1. HW 3.0–3.25 (2015-06-23 → 2016-04-12): Darkside (+15%, drains MP); Grit; Dark Arts 5s; Blood Weapon; Delirium a combo GCD.
2. HW 3.26–3.57 (2016-04-13 → 2017-06-19): Dark Arts 3s.
3. SB 4.0–4.18 (2017-06-20 → 2018-01-29): Blood Gauge → Bloodspiller, Quietus; Delirium an ability (120s); The Blackest Night (5s); Darkside 20%.
4. SB 4.2–4.25 (2018-01-30 → 2018-05-21): Delirium 80s; The Blackest Night 7s.
5. SB 4.3–4.58 (2018-05-22 → 2019-07-01): Dark Arts empowers Power Slash / Plunge; Dark Passenger 60s.
6. ShB 5.0–5.08 (2019-07-02 → 2019-10-28): Edge / Flood of Shadow grant Darkside; The Blackest Night 25% barrier → Dark Arts; Blood Weapon 60s; Delirium 90s; Living Shadow (24s); Plunge 2 charges.
7. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): Shadow Wall 15s.
8. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Delirium 60s, 3 stacks; Edge / Flood 1s recast; Salt and Darkness, Shadowbringer, Oblation.
9. EW 6.1–6.18 (2022-04-12 → 2022-08-22): Blood Weapon 5 stacks; Living Dead rework.
10. EW 6.2–6.58 (2022-08-23 → 2024-07-01): Living Shadow 20s, no Quietus.
11. DT 7.0–7.57 (2024-07-02 → present): Blood Weapon folded into Delirium → Scarlet Delirium / Comeuppance / Torcleaver; Living Shadow free → Disesteem; Shadowstride.

### Gunbreaker (from 5.0)
1. ShB 5.0–5.08 (2019-07-02 → 2019-10-28): 2 Cartridges max; Gnashing Fang 30s with Savage Claw / Wicked Talon as separate buttons; Bloodfest 90s (+2); Sonic Break 60s; Nebula 10s.
2. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): Nebula 15s.
3. EW 6.0–6.18 (2021-12-07 → 2022-08-22): 3 Cartridges (Bloodfest +3, 90s); Double Down; Hypervelocity; Gnashing Fang combo on one button; Aurora 2 charges. ← built
4. EW 6.2–6.58 (2022-08-23 → 2024-07-01): Bloodfest 120s; Continuation 5y. ← built
5. DT 7.0–7.05 (2024-07-02 → 2024-11-11): Ready to Break (Sonic Break a 2.5s GCD); Ready to Reign → Reign of Beasts / Noble Blood / Lion Heart; Fated Brand; Great Nebula; Trajectory. Bloodfest still 120s.
6. DT 7.1–7.38 (2024-11-12 → 2025-12-15): Double Down costs 1; Superbolide 50% HP.
7. DT 7.4–7.57 (2025-12-16 → present): Bloodfest 60s and cartridge cap 6 for 30s; Gnashing Fang 2 charges; Double Down 2 again.

## Healers (55 versions: WHM 16, SCH 13, AST 21, SGE 5)


### White Mage / Conjurer
1. ARR 2.0 (2013-08-27 → 2013-12-16): Conjurer kit (Stone, Cure, Aero, Medica, Raise, Stone II, Cure II, Aero II, Medica II, Fluid Aura 30s bind+knockback, Stoneskin, Shroud of Saints 120s, Cure III 2.5s cast 4y, Protect + Proshell, Esuna, Repose); Cleric Stance (INT/MND swap, +10% attack, -20% healing; ARR level uncertain); WHM: Presence of Mind 30 (300s, 10s), Regen 35, Divine Seal 40 (60s, +30% healing 15s), Holy 45 (AoE+stun, 240), Benediction 50 (300s).
2. ARR 2.1–2.28 (2013-12-17 → 2014-07-07): Cure III 2.0s cast, 6y; Cure II 15% chance to halve next Cure III; Medica II regen 50 for 30s; Holy 200.
3. ARR 2.3–2.57 (2014-07-08 → 2015-06-22): Presence of Mind 150s recast, 15s; 2.45 Stoneskin II (party barrier, out of combat; size uncertain 10/18%).
4. HW 3.0–3.57 (2015-06-23 → 2017-06-19): Asylum 52, Stone III 54, Assize 56 (90s, 300 dmg/300 heal, +10% MP), Aero III 58, Tetragrammaton 60 (60s, 700); Proshell trait removed.
5. SB 4.0–4.01 (2017-06-20 → 2017-07-16): Thin Air 62 (120s), Stone IV 64 (250), Divine Benison 66 (30s, 15% max-HP barrier, needs a Lily); Plenary Indulgence 70 v1 (Confession from Cure/Cure II 20%, 15s recast); Lily gauge from Cure/Cure II cutting ability recasts (details uncertain); Assize 60s, Benediction 180s; Stoneskin, Divine Seal, Shroud of Saints removed; Cleric Stance → role action.
6. SB 4.05–4.18 (2017-07-17 → 2018-01-29): Plenary Indulgence rework (Confession 100% from Medica/Medica II/Cure III, 10s, 60s recast); Cure Lily chance 100%.
7. SB 4.2–4.45 (2018-01-30 → 2019-01-07) (minor): Divine Benison no longer needs a Lily; 4.4 Asylum applies immediately.
8. SB 4.5–4.58 (2019-01-08 → 2019-07-01): Assize 45s recast, 400 potency; Plenary Indulgence 30s.
9. ShB 5.0–5.58 (2019-07-02 → 2021-12-06): Lily rework (1 per 30s, max 3, Afflatus Solace/Rapture, Blood Lily → Afflatus Misery 900); Glare 72, Dia 72, Temperance 80; Thin Air to 58; Divine Benison 500 barrier; Holy 140, 2.5s; Lucid 60s; Aero III and Protect removed.
10. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Glare III, Holy III (82), Aquaveil (86), Liturgy of the Bell (90); Thin Air 60s, 2 charges, next action free; Glare 1.5s cast; Divine Benison 2 charges; Fluid Aura removed.
11. EW 6.1–6.18 (2022-04-12 → 2022-08-22): Lily timer 30→20s; Afflatus Misery 900→1240.
12. EW 6.2–6.28 (2022-08-23 → 2023-01-09) (minor): Liturgy of the Bell 15→20s.
13. EW 6.3–6.58 (2023-01-10 → 2024-07-01): Assize 45→40s.
14. DT 7.0–7.05 (2024-07-02 → 2024-11-11): Presence of Mind 120s + Sacred Sight → Glare IV (92, 640); Medica III (96); Temperance → Divine Caress (100); Tetragrammaton 2 charges; Aetherial Shift.
15. DT 7.1–7.38 (2024-11-12 → 2025-12-15): Holy / Holy III 1.5s cast; Divine Caress 30y.
16. DT 7.4–7.57 (2025-12-16 → present): Confession −10% damage taken; start duties with full Lilies and Blood Lily; Glare III 350, Misery 1400.

### Scholar / Arcanist
1. ARR 2.0 (2013-08-27 → 2013-12-16): Aetherflow 60s (+20% MP), Energy Drain, Virus, Bane, Eye for an Eye, Rouse, Shadow Flare, Sustain (HP cost); Adloquium 30, Succor 35, Leeches 40, Sacred Soil 45, Lustrate 50 (20% max HP); Eos and Selene.
2. ARR 2.1–2.57 (2013-12-17 → 2015-06-22): Lustrate 25%, Bane 8y, Virus Antibody, Sustain costs MP.
3. HW 3.0–3.57 (2015-06-23 → 2017-06-19): Indomitability 52, Broil 54, Deployment Tactics 56 (120s), Emergency Tactics 58, Dissipation 60 (180s); Lustrate 600 potency.
4. SB 4.0–4.01 (2017-06-20 → 2017-07-16): Faerie Gauge + Aetherpact/Fey Union; Excogitation 62, Broil II 64, Chain Stratagem 66; Quickened Aetherflow (20% chance −10s); Aetherflow 10% MP; Virus, Sustain, Miasma II removed.
5. SB 4.05–4.18 (2017-07-17 → 2018-01-29): Excogitation 800 / 45s / 45s recast; Emergency Tactics 20s; Quickened Aetherflow 100% −5s; Miasma II back, Sustain back in 4.1.
6. SB 4.2–4.25 (2018-01-30 → 2018-05-21) (minor): Excogitation heals on expiry.
7. SB 4.3–4.58 (2018-05-22 → 2019-07-01): Whispering Dawn instant; Aetherpact 3s.
8. ShB 5.0–5.01 (2019-07-02 → 2019-07-28): Bane, Miasma, Shadow Flare, Rouse, Eye for an Eye, Energy Drain removed; one shared fairy kit; Art of War 46, Biolysis + Broil III 72, Recitation 74 (90s), Fey Blessing 76, Summon Seraph 80.
9. ShB 5.05–5.08 (2019-07-29 → 2019-10-28): Energy Drain back (1 Aetherflow, 150); Succor 2s cast.
10. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): Seraph 22s; Consolation 30s.
11. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Broil IV, Art of War II (82), Protraction (86), Expedient (90); Broil 1.5s; Energy Drain no MP, 1s; Deployment Tactics 90s.
12. EW 6.1–6.58 (2022-04-12 → 2024-07-01) (minor): Expedient sprint 10s; 6.4 Summon Selene removed.
13. DT 7.0–7.57 (2024-07-02 → present): Chain Stratagem 20s + Baneful Impaction (92); Concitation (96); Recitation 60s; Seraphism (100).

### Astrologian (from 3.0)
1. HW 3.0–3.01 (2015-06-23 → 2015-07-20): Draw, sects, Royal Road, Spread, Shuffle, Time Dilation, Celestial Opposition (150s), Lightspeed (15s, potency penalty), Synastry (120s); cards Balance/Bole/Arrow/Spear/Ewer/Spire.
2. HW 3.05 (2015-07-21 → 2015-08-24): Lightspeed 10s −25% MP; Ewer/Spire refresh; Shuffle 60s.
3. HW 3.07–3.15 (2015-08-25 → 2016-02-22): Synastry 90s; Celestial Opposition 120s; Balance/Bole/Arrow 30s.
4. HW 3.2–3.26 (2016-02-23 → 2016-06-06): Shuffle → Redraw (no repeat); Luminiferous Aether 24s.
5. HW 3.3–3.38 (2016-06-07 → 2016-09-26): Spread 30s; Nocturnal Aspected Helios barrier 120%.
6. HW 3.4–3.57 (2016-09-27 → 2017-06-19): cards held 30s; Redraw 30s; Balance/Bole 20%; Celestial Opposition +10s.
7. SB 4.0–4.01 (2017-06-20 → 2017-07-16): Undraw, Earthly Star 62, Malefic III 64, Minor Arcana 66 (Lord/Lady of Crowns), Hyper Lightspeed, Sleeve Draw 70.
8. SB 4.05–4.18 (2017-07-17 → 2018-01-29): Balance 10%; Spear +10% crit; Undraw 3s; Hyper Lightspeed on Essential Dignity.
9. SB 4.2–4.25 (2018-01-30 → 2018-05-21) (minor): Spear 30s.
10. SB 4.3–4.38 (2018-05-22 → 2018-09-17): Malefic 1.5s casts; Lightspeed −50% MP, 120s; Aspected Helios 2.5s.
11. SB 4.4–4.58 (2018-09-18 → 2019-07-01) (minor): Minor Arcana / Lord / Lady 1s recast.
12. ShB 5.0–5.01 (2019-07-02 → 2019-07-28): seal system, Divination (180s, 2/4/6%), Balance 6%/3%; Royal Road, Spread, Time Dilation removed; Horoscope, Neutral Sect, Malefic IV, Combust III, Gravity.
13. ShB 5.05–5.08 (2019-07-29 → 2019-10-28): Divination 120s 4/5/6%; Lightspeed 90s; Celestial Opposition 60s; Gravity 1.5s.
14. ShB 5.1–5.25 (2019-10-29 → 2020-08-10): Collective Unconscious 60s ring; Minor Arcana converts on draw.
15. ShB 5.3–5.58 (2020-08-11 → 2021-12-06): Draw/Sleeve Draw restore 8% MP; Sleeve Draw single draw; Horoscope heals on expiry.
16. EW 6.0–6.18 (2021-12-07 → 2022-08-22): sects removed; Draw 2 charges; Astrosigns + Astrodyne; Divination flat 6%; Sleeve Draw removed; Crown Play; Exaltation (86), Macrocosmos (90).
17. EW 6.2–6.58 (2022-08-23 → 2024-07-01): Crown Play removed; Redraw never repeats your sign.
18. DT 7.0 (2024-07-02 → 2024-07-15): Astral/Umbral Draw, Play I/II/III, Oracle (92), Essential Dignity 3 charges, Helios Conjunction, Sun Sign; Lightspeed 1 charge 90s.
19. DT 7.01 (2024-07-16 → 2024-07-29): Lightspeed 2 charges 60s; draws 55s.
20. DT 7.05–7.38 (2024-07-30 → 2025-12-15) (minor): Plays no longer share a recast; 7.2 Oracle falloff 50%.
21. DT 7.4–7.57 (2025-12-16 → present) (borderline): Collective Unconscious mitigation 10s.

### Sage (from 6.0)
1. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Addersgall (20s, max 3), Addersting, Kardia, Phlegma 2 charges 45s, Soteria 90s +50%, Zoe, Holos, Panhaima, Krasis, Pneuma.
2. EW 6.1–6.18 (2022-04-12 → 2022-08-22): Soteria 4 stacks +70%; Addersting starts full.
3. EW 6.2–6.28 (2022-08-23 → 2023-01-09): Holos adds a barrier.
4. EW 6.3–6.58 (2023-01-10 → 2024-07-01): Phlegma 40s; Addersting from your own Eukrasian Prognosis too.
5. DT 7.0–7.57 (2024-07-02 → present): Eukrasian Dyskrasia, Psyche (92), Eukrasian Prognosis II (96), Philosophia (100).

## Melee DPS (52 versions: MNK 15, DRG 14, NIN 10, SAM 8, RPR 3, VPR 2)

### Monk / Pugilist
1. ARR 2.0 (2013-08-27 → 2013-12-16): 3 Greased Lightning stacks (7/14/21%, 12s); True Strike rear crit; Shoulder Tackle 90s; Twin Snakes 12s; Demolish DoT only.
2. ARR 2.1–2.57 (2013-12-17 → 2015-06-22): Shoulder Tackle 30s; True Strike flat 190; Demolish initial hit; Twin Snakes 15s; GL 9/18/27%; Internal Release 10%.
3. HW 3.0–3.05 (2015-06-23 → 2015-08-24): Form Shift, Meditation / The Forbidden Chakra, Elixir Field, Purification, Tornado Kick (60s, needs GL III).
4. HW 3.07–3.57 (2015-08-25 → 2017-06-19): Tornado Kick 40s; GL 14s, 10/20/30%.
5. SB 4.0–4.18 (2017-06-20 → 2018-01-29): Riddle of Earth, Wind Tackle / Riddle of Wind, Riddle of Fire (+30% but +15% weaponskill recast), Brotherhood; GL 16s; Perfect Balance 180s; Mantra 120s.
6. SB 4.2–4.58 (2018-01-30 → 2019-07-01): Perfect Balance 60s; Mantra 90s; Riddle of Wind grants GL; Brotherhood affects self (party in 4.3).
7. ShB 5.0–5.01 (2019-07-02 → 2019-07-28): Enlightenment, Anatman, Six-sided Star; 4th GL stack under Fists of Wind; Perfect Balance 120s; Shoulder Tackle 2 charges; Tornado Kick needs max GL.
8. ShB 5.05–5.25 (2019-07-29 → 2020-08-10): forms 15s; Riddle of Fire 25%, no recast penalty; Form Shift refreshes GL in Coeurl form.
9. ShB 5.3–5.35 (2020-08-11 → 2020-12-07): Perfect Balance 90s; Form Shift GL refresh in any form.
10. ShB 5.4–5.58 (2020-12-08 → 2021-12-06): GL becomes a passive speed trait; Perfect Balance 6 stacks/15s; Formless Fist; Tornado Kick 45s; Riddle of Earth 3 charges; potency pass.
11. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Masterful Blitz with Beast Chakra / Nadi; Perfect Balance 3 stacks, 2 charges; Riddle of Fire 60s 15%; Riddle of Wind back (auto delay −50%); Brotherhood 120s; Thunderclap; Disciplined Fist.
12. EW 6.1–6.28 (2022-04-12 → 2023-01-09): Perfect Balance can't be used while holding Beast Chakra.
13. EW 6.3–6.58 (2023-01-10 → 2024-07-01) (minor, defensive): Riddle of Earth 120s, 20% reduction + Earth's Reply.
14. DT 7.0 (2024-07-02 → 2024-07-15): Fury stacks replace Disciplined Fist and the Demolish DoT; Anatman removed; Fire's Reply, Wind's Reply; Brotherhood 20s.
15. DT 7.01–7.57 (2024-07-16 → present): Raptor's Fury max 1, Coeurl's Fury max 2; Dragon Kick grants Opo-opo's Fury only in Opo-opo form; potency pass.

### Dragoon
1. ARR 2.0 (2013-08-27 → 2013-12-16): Power Surge 90s, Spineshatter Dive 90s, Dragonfire Dive 180s, Jump 40s.
2. ARR 2.1–2.38 (2013-12-17 → 2014-10-27): Power Surge 60s; shorter jump locks; Heavy Thrust 15%.
3. ARR 2.4–2.41 (2014-10-28 → 2014-12-07): Spineshatter Dive 60s; Dragonfire Dive 120s.
4. ARR 2.45–2.57 (2014-12-08 → 2015-06-22): Jump 30s; Impulse Drive / Heavy Thrust need no positional.
5. HW 3.0–3.57 (2015-06-23 → 2017-06-19): Battle Litany, Blood of the Dragon (+30% Jump/Spineshatter, 15s, 60s), Fang and Claw, Wheeling Thrust, Geirskogul.
6. SB 4.0–4.01 (2017-06-20 → 2017-07-16): Dragon Gauge with 4 Eyes → Life of the Dragon; Mirage Dive, Nastrond, Dragon Sight, Sonic Thrust; Blood of the Dragon 15s.
7. SB 4.05–4.06 (2017-07-17 → 2017-10-09): Blood of the Dragon 20s (+10s from Sonic Thrust, max 30s); Elusive Jump 30s; Dragon Sight 12y.
8. SB 4.1–4.58 (2017-10-10 → 2019-07-01): 3 Eyes max; Geirskogul 30s; Blood can't be used during Life.
9. ShB 5.0 (2019-07-02 → 2019-07-14): Heavy Thrust removed, Disembowel grants Power Surge; Geirskogul needs 2 eyes; Blood 30s; Stardiver.
10. ShB 5.01–5.58 (2019-07-15 → 2021-12-06): Power Surge 30s; 5.1 Blood recast 25s.
11. EW 6.0–6.28 (2021-12-07 → 2023-01-09): Blood of the Dragon becomes a trait; Life of the Dragon fixed 20s; Wyrmwind Thrust; Spineshatter Dive 2 charges.
12. EW 6.3–6.58 (2023-01-10 → 2024-07-01): Life Surge 40s.
13. DT 7.0–7.05 (2024-07-02 → 2024-11-11): Eyes removed; Geirskogul 60s → Life of the Dragon +15% and Nastrond Ready ×3; Dragon Sight removed; Winged Glide; Starcross; Drakesbane.
14. DT 7.1–7.57 (2024-11-12 → present): Nastrond Ready ×1 (Nastrond 600); Enhanced Piercing Talon; Mirage Dive 380.

### Ninja / Rogue (from 2.4)
1. ARR 2.4–2.57 (2014-10-28 → 2015-06-22): Mudras and Ninjutsu (Fuma, Katon, Raiton, Hyoton, Huton +15% speed 70s, Doton, Suiton); Kassatsu.
2. HW 3.0–3.57 (2015-06-23 → 2017-06-19): Smoke Screen, Armor Crush, Shadewalker, Duality, Dream Within a Dream.
3. SB 4.0–4.58 (2017-06-20 → 2019-07-01): Ninki gauge; Ten Chi Jin; Enhanced Mug; Bhavacakra, Hellfrog.
4. ShB 5.0–5.08 (2019-07-02 → 2019-10-28): Bunshin; Kassatsu 2 charges +30%; Ten Chi Jin 150%; Mug 110s; Shadow Fang in the combo.
5. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): Mudras 2 charges / 20s; Kassatsu one free Ninjutsu; Ten Chi Jin rework; Bunshin 5 stacks 90s; Trick Attack 5% any direction; Shadow Fang oGCD.
6. EW 6.0–6.01 (2021-12-07 → 2022-01-02) (minor): Shadow Fang removed; Huraijin; Phantom Kamaitachi; Forked/Fleeting Raiju (15s).
7. EW 6.05–6.08 (2022-01-03 → 2022-04-11): Raiju Ready 30s; Fleeting Raiju 3y; Bunshin → Phantom Kamaitachi button.
8. EW 6.1–6.58 (2022-04-12 → 2024-07-01): Mug +5% damage taken; Trick Attack +10% from you; Doton 18s.
9. DT 7.0–7.05 (2024-07-02 → 2024-11-11): Huton speed becomes a trait; Kazematoi; Dokumori; Kunai's Bane; Tenri Jindo.
10. DT 7.1–7.57 (2024-11-12 → present) (minor): Ten Chi Jin allows movement; Dokumori a cone.

### Samurai (from 4.0)
1. SB 4.0–4.58 (2017-06-20 → 2019-07-01): Sen, Kenki, Iaijutsu; Hissatsu: Kaiten; Meikyo 10s / 80s.
2. ShB 5.0–5.01 (2019-07-02 → 2019-07-28): Tsubame-gaeshi (with a cast), Ikishoten; Meditation up to 5 for Shoha; Meikyo 15s / 60s.
3. ShB 5.05–5.08 (2019-07-29 → 2019-10-28): Kaeshi instant; Meikyo 55s; Meditate 45s; 5.08 Kaiten 1s recast.
4. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): Meditation max 3 from Iaijutsu/Kaeshi; Shoha 400 / 15s; Meditate triggers GCD; Hagakure 10 per Sen.
5. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Ikishoten 120s + Ogi Namikiri; Tsubame 2 charges; Meikyo 2 charges, grants Fugetsu/Fuka; Kaiten. ← built
6. EW 6.1–6.58 (2022-04-12 → 2024-07-01): Kaiten removed; Midare, Kaeshi and Namikiri always crit; potency rework.
7. DT 7.0–7.01 (2024-07-02 → 2024-07-29): Tsubame-gaeshi a GCD needing Tsubame-gaeshi Ready (from Meikyo); Tendo; Zanshin.
8. DT 7.05–7.57 (2024-07-30 → present): Iaijutsu (not Higanbana) grants Tsubame-gaeshi Ready; Tengentsu.

### Reaper (from 6.0)
1. EW 6.0–6.58 (2021-12-07 → 2024-07-01): launch kit (Gluttony → 2 Soul Reaver, Enshroud, Arcane Circle).
2. DT 7.0–7.25 (2024-07-02 → 2025-08-04): Executioner from Gluttony; Oblatio; Perfectio.
3. DT 7.3–7.57 (2025-08-05 → present) (minor): Enshroud 5s recast.

### Viper (from 7.0)
1. DT 7.0–7.01 (2024-07-02 → 2024-07-29): Noxious Gnash debuff; venoms 40s; Serpent's Ire 120s.
2. DT 7.05–7.57 (2024-07-30 → present): Noxious Gnash removed; Reaving Fangs, Vicewinder, Vicepit; Honed Steel / Honed Reavers; venoms 60s; potency pass.

## Physical ranged (28 versions: BRD 10, MCH 14, DNC 4)

### Bard / Archer
1. ARR 2.0–2.57 (2013-08-27 → 2015-06-22): Straight Shot +10% crit, Heavier Shot, River of Blood (DoT ticks reset Bloodletter), Raging Strikes 20%/180s, Barrage, Misery's End, Hawk's Eye, Quelling Strikes, Blunt Arrow, Flaming Arrow, Wide Volley; songs are MP-draining toggles that lower your own damage; Battle Voice 300s. (2.1 changed Hawk's Eye and Blood for Blood; 2.0 Hawk's Eye uncertain.)
2. HW 3.0 (2015-06-23 → 2015-07-06): Wanderer's Minuet is a 3s-cast stance (+20%, no autos, weaponskills get cast times); Empyreal Arrow, Sidewinder, Iron Jaws only under it.
3. HW 3.01–3.26 (2015-07-07 → 2016-06-06): Wanderer's Minuet an instant toggle, +30%; Empyreal Arrow 220; Sidewinder 100/175/250. (3.2: Warden's Paean oGCD.)
4. HW 3.3–3.57 (2016-06-07 → 2017-06-19): song casts 1.5s, singing penalty 10%; Battle Voice 180s; DoT and Blunt Arrow buffs.
5. SB 4.0–4.05 (2017-06-20 → 2017-08-06): Repertoire; songs instant 80s recast 30s (Mage's Ballad resets Bloodletter on DoT crits, Army's Paeon speed stacks, Wanderer's Minuet Pitch Perfect); Refulgent Arrow, Caustic Bite, Stormbite, Troubadour, Nature's Minne; Raging Strikes 80s 10%; Battle Voice +15% DH; many ARR actions removed.
6. SB 4.06–4.58 (2017-08-07 → 2019-07-01): Straight Shot 30s; Barrage 80s.
7. ShB 5.0–5.08 (2019-07-02 → 2019-10-28): Soul Voice + Apex Arrow; Straight Shot Ready procs; Repertoire 40% per DoT tick; Burst Shot, Shadowbite; Empyreal Arrow an ability; Battle Voice 20%; Misery's End, Foe Requiem removed.
8. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): songs give party buffs (1% dmg / 3% DH / 2% crit); Apex Arrow 120–600 full gauge; Troubadour 120s.
9. EW 6.0–6.58 (2021-12-07 → 2024-07-01): songs abilities 120s/45s, Repertoire 80%; Bloodletter charges (3 at 84) and Mage's Ballad 7.5s cut; Coda + Radiant Finale; Blast Arrow; Raging Strikes 120s 15%; Shadowbite proc; Ladonsbite; Sidewinder 300. (6.1: Battle Voice needs no song.)
10. DT 7.0–7.57 (2024-07-02 → present): songs deal no damage; Hawk's Eye proc; Heartbreak Shot; Barrage rework + Resonant Arrow; Radiant Encore; buffs 20s; Wide Volley back.

### Machinist (from 3.0)
1. HW 3.0 (2015-06-23 → 2015-07-06): Gauss Barrel toggle spell (+20%, no autos, weaponskill casts); Reload ammo; Quick Reload; Hypercharge (turret); Wildfire 25%; Rapid Fire; turrets.
2. HW 3.01–3.05 (2015-07-07 → 2015-08-24): Gauss Barrel instant +30%.
3. HW 3.07–3.15 (2015-08-25 → 2016-02-22): Quick Reload 30s (15s with trait), 30 TP.
4. HW 3.2–3.38 (2016-02-23 → 2016-09-26): Hypercharge 20s; turret vulnerability 10%.
5. HW 3.4–3.57 (2016-09-27 → 2017-06-19): Reload ammo no longer expires.
6. SB 4.0–4.01 (2017-06-20 → 2017-07-16): Heat Gauge and Overheat, heated shots, Cooldown, Flamethrower, Barrel Stabilizer 120s, Overdrive; Reload 30s 3 rounds; Wildfire 60s 10s.
7. SB 4.05 (2017-07-17 → 2017-08-06): Barrel Stabilizer 60s; Quick Reload no heat drop; heat per shot 5; Overloads doubled.
8. SB 4.06–4.58 (2017-08-07 → 2019-07-01): Overheat +20%; Gauss Barrel 2s; Hot Shot 60s.
9. ShB 5.0–5.01 (2019-07-02 → 2019-07-28): full rework — Hypercharge (50 Heat, Heat Blast), Battery and Queen, Gauss Round / Ricochet charges, Wildfire 120s, Reassemble, Drill, Air Anchor, Tactician.
10. ShB 5.05–5.58 (2019-07-29 → 2021-12-06): Reassemble 55s; 5.1 Tactician 120s, Flamethrower skill speed.
11. EW 6.0–6.18 (2021-12-07 → 2022-08-22): Chain Saw, Scattergun, Reassemble 2 charges, Queen's Gambit; Overheated 8s; Drill/Air Anchor 550. (6.1 Wildfire buff.)
12. EW 6.2–6.28 (2022-08-23 → 2023-01-09): Queen/Rook fixed duration, Battery scales potency; guaranteed crit/DH now use crit/DH buffs.
13. EW 6.3–6.58 (2023-01-10 → 2024-07-01): Hypercharge 5 Overheated stacks, 10s; Wildfire max 6; Dismantle back.
14. DT 7.0–7.57 (2024-07-02 → present): Barrel Stabilizer → Hypercharged + Full Metal Field; Drill 2 charges; Excavator; Double Check / Checkmate; Blazing Shot.

### Dancer (from 5.0)
1. ShB 5.0–5.58 (2019-07-02 → 2021-12-06): Standard Step, Technical Step, Flourish, Devilment, Shield Samba, Esprit + Saber Dance, Fourfold Feathers, Improvisation. (5.01 cut Finishes; 5.1 GCD buffs.)
2. EW 6.0–6.08 (2021-12-07 → 2022-04-11): Flourishing Symmetry/Flow, Threefold/Fourfold Fan Dance, Fan Dance IV, Tillana, Starfall Dance; Esprit from your own GCDs; Improvisation rework.
3. EW 6.1–6.58 (2022-04-12 → 2024-07-01): Silken procs separate from Flourishing, so Flourish no longer overwrites them; steps are weaponskills.
4. DT 7.0–7.57 (2024-07-02 → present): Last Dance, Finishing Move, Dance of the Dawn; Tillana 2.5s recast + 50 Esprit.

## Caster DPS (39 versions: BLM 13, SMN 11, RDM 7, PCT 2, BLU 4)


### Black Mage / Thaumaturge
1. ARR 2.0–2.57 (2013-08-27 → 2015-06-22): Astral Fire / Umbral Ice up to 3 with a 10s timer, no gauge; Thundercloud 5% per tick; Convert (180s, MP for HP); Thunder II/III single-target DoTs. (2.1 / 2.3 potency tweaks.)
2. HW 3.0–3.01 (2015-06-23 → 2015-07-20): Enochian an ability (60s, ~30s, +5%), needed for Fire IV / Blizzard IV; Ley Lines (90s), Sharpcast (60s), Blizzard IV, Fire IV (280, 3s).
3. HW 3.05–3.15 (2015-07-21 → 2016-02-22): recasting Enochian refreshes it; Thundercloud 10%.
4. HW 3.2–3.57 (2016-02-23 → 2017-06-19): AF/UI timer 12s.
5. SB 4.0–4.01 (2017-06-20 → 2017-07-16): job gauge; Enochian has no duration; Polyglot (1) and Foul; Blizzard IV hearts; Thunder IV; Triplecast 90s; Sharpcast 15s; AF/UI 13s.
6. SB 4.05–4.1x (2017-07-17 → 2018-01-29): Triplecast 60s; Fire IV / Blizzard IV 2.8s; Foul no MP.
7. SB 4.2–4.58 (2018-01-30 → 2019-07-01): Transpose 8s; procs 18s; Aetherial Manipulation 10s; Fire IV 280 (300 in 4.4).
8. ShB 5.0–5.58 (2019-07-02 → 2021-12-06): Manafont replaces Convert; Despair, Umbral Soul, Xenoglossy; 2 Polyglot; Enochian 15%; AF/UI 15s; Transpose 5s; Sharpcast 30s; Freeze rework.
9. EW 6.0–6.58 (2021-12-07 → 2024-07-01): Enochian a trait; Amplifier; Paradox; Sharpcast and Triplecast 2 charges; Manafont 120s; Ley Lines 120s; Thundercloud 40s. Potency tiers 6.08 / 6.28 / 6.4 (Xenoglossy 880, Enochian 23% from 6.4). ← built (6.4–6.58 numbers)
10. DT 7.0–7.01 (2024-07-02 → 2024-07-29): Sharpcast removed; Thunderhead; High Thunder; Retrace; Astral Soul + Flare Star; 3 Polyglot; Manafont 100s rework; Umbral Ice MP refunds; instant Paradox.
11. DT 7.05 (2024-07-30 → 2024-11-11): Paradox from Ice is free and grants Umbral Ice; Umbral Soul halts the timer.
12. DT 7.1–7.1x (2024-11-12 → 2025-03-24): Ley Lines 2 charges; Flare 3s; instant Despair at 100.
13. DT 7.2–7.57 (2025-03-25 → present): Astral Fire / Umbral Ice no longer expire; Ley Lines 20s; 2s casts.

### Summoner / Arcanist
1. ARR 2.0–2.05 (2013-08-27 → 2013-12-16): Aetherflow, Energy Drain, Fester; Bio, Bio II, Miasma, Miasma II, Shadow Flare; Bane; Contagion; Spur, Rouse, Enkindle; 6s summon casts.
2. ARR 2.1–2.57 (2013-12-17 → 2015-06-22): Bane 8y, no overwrite of longer DoTs; Sustain costs MP.
3. HW 3.0–3.57 (2015-06-23 → 2017-06-19): Painflare, Ruin III, Tri-disaster, Dreadwyrm Trance (3 Aethertrail), Deathflare.
4. SB 4.0–4.06 (2017-06-20 → 2017-10-09): Summon Bahamut; Trance 20s; Fester 5s; Ruin IV procs; Aetherpact / Devotion; Spur removed.
5. SB 4.1–4.58 (2017-10-10 → 2019-07-01): summons 3s; instant Ruin III in Trance; Further Ruin; Devotion party-wide.
6. ShB 5.0–5.08 (2019-07-02 → 2019-10-28): Egi Assault I/II; Firebird Trance alternating with Dreadwyrm; Trance 60s; Rouse, Contagion, Shadow Flare removed.
7. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): Ruination removed; Tri-disaster 300; Bane applies DoTs; Trances 55s; Egi Assault a spell; pets deal magic damage.
8. EW 6.0–6.08 (2021-12-07 → 2022-04-11): full rework — demi phase + Ifrit/Titan/Garuda attunement; Searing Light via Carbuncle; DoTs removed.
9. EW 6.1–6.58 (2022-04-12 → 2024-07-01): Ruby GCDs 3.0s recast; Searing Light cast by you.
10. DT 7.0–7.05 (2024-07-02 → 2024-11-11): Searing Flash; Solar Bahamut; Lux Solaris; Necrotize.
11. DT 7.1–7.57 (2024-11-12 → present): Crimson Strike needs Crimson Strike Ready.

### Red Mage (from 4.0)
1. SB 4.0–4.58 (2017-06-20 → 2019-07-01): Dualcast, Black/White Mana; Impact needs a proc; Acceleration 35s; Embolden decaying 10%; Manafication doubles mana; melee costs 30/25/30.
2. ShB 5.0–5.08 (2019-07-02 → 2019-10-28): Engagement, Enchanted Reprise, Verthunder II / Veraero II, Scorch; Impact AoE; Manafication 110s +5%.
3. ShB 5.1–5.58 (2019-10-29 → 2021-12-06): Acceleration 3 casts, 20s, 55s.
4. EW 6.0–6.58 (2021-12-07 → 2024-07-01): Mana Stacks; Verthunder III / Veraero III, Magick Barrier, Resolution; cheaper melee; Acceleration, Corps-a-corps, Displacement 2 charges; Manafication +50|50 and 6 stacks; Embolden flat 5%.
5. DT 7.0–7.01 (2024-07-02 → 2024-07-29): Manafication → Magicked Swordplay + Prefulgence; Vice of Thorns; Grand Impact; Jolt III; Moulinet Deux/Trois.
6. DT 7.05–7.3x (2024-07-30 → 2025-12-15): Magicked Swordplay 30s.
7. DT 7.4–7.57 (2025-12-16 → present): Manafication grants Prefulgence directly, no stacks; Embolden self 10%.

### Pictomancer (from 7.0)
1. DT 7.0–7.05 (2024-07-02 → 2024-11-11): launch kit; motifs painted by hand before the pull.
2. DT 7.1–7.57 (2024-11-12 → present): motifs pre-painted on entry and reset. (7.2 big potency rework, 7.3 partial revert.)

### Blue Mage (limited; by level cap)
1. Cap 50, 4.5–5.11 (2019-01-08 → 2019-12-08): spells 1–49; Moon Flute, Bristle.
2. Cap 60, 5.15–5.41 (2019-12-09 → 2021-01-31): spells 50–80; Aetheric Mimicry.
3. Cap 70, 5.45–6.41 (2021-02-01 → 2023-07-16): spells 81–104.
4. Cap 80, 6.45–7.57 (2023-07-17 → present): spells 105–124.

## Sources

- Official patch notes, all 135 from 2.1 to 7.57: https://na.finalfantasyxiv.com/lodestone/special/patchnote_log/ (the x.0 notes don't list job changes; they point to the job guides).
- Expansion launch kits and per-action changes: the "History" sections of the action and trait pages on https://ffxiv.consolegameswiki.com/wiki/ (checked against old page revisions where the history had gaps), and its Patches page for dates.
- The Balance (https://www.thebalanceffxiv.com) job-change pages, as a cross-check for Endwalker and Dawntrail.

Researched by five parallel passes, one per role. Most figures were read from the patch notes or wiki histories, but not every number was re-checked by hand, and some early ARR values conflict between wiki revisions. Each job's module checks its own numbers again when it's built.
