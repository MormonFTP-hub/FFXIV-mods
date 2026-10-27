"""Pull the game's own icons for every action and status the sim uses, from your FFXIV install.

Reads the Action, Status, Item and ClassJob sheets with PMP Viewer's game reader (Lumina helper), decodes the
_hr1 icon textures, and writes:
  BlackMageSim/work/game-icons.js   BLM.GAME_ICONS = { id: data URL } (loaded by index.html, inlined by the build)
  BlackMageSim/work/icons/*.png     the same icons, for a look
work/ is git-ignored, so Square Enix's art stays out of the repo. Without the file the sim uses its drawn icons.

Run with the Python that runs PMP Viewer (numpy + Pillow):  python -P -E BlackMageSim/tools/extract_icons.py
"""
import base64
import io
import json
import os
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "PmpViewer" / "server"))
import game  # noqa: E402  (PmpViewer/server/game.py)

OUT = ROOT / "work"

# Per job: sim action id -> (Action row, expected English name), statuses (row id or name), icon overrides for
# actions Dawntrail removed (their rows now point at the generic removed-action icon, 000786), the tincture and
# the ClassJob row for the job crest. Ids are the PvE rows; names are checked so a wrong id shows up.
ACTIONS = {
    "fire": (141, "Fire"), "blizzard": (142, "Blizzard"), "transpose": (149, "Transpose"),
    "fire3": (152, "Fire III"), "thunder3": (153, "Thunder III"), "blizzard3": (154, "Blizzard III"),
    "scathe": (156, "Scathe"), "manaward": (157, "Manaward"), "manafont": (158, "Manafont"),
    "leyLines": (3573, "Ley Lines"), "sharpcast": (3574, "Sharpcast"), "blizzard4": (3576, "Blizzard IV"),
    "fire4": (3577, "Fire IV"), "betweenTheLines": (7419, "Between the Lines"), "triplecast": (7421, "Triplecast"),
    "foul": (7422, "Foul"), "despair": (16505, "Despair"), "umbralSoul": (16506, "Umbral Soul"),
    "xenoglossy": (16507, "Xenoglossy"), "amplifier": (25796, "Amplifier"), "paradox": (25797, "Paradox"),
    "surecast": (7559, "Surecast"), "addle": (7560, "Addle"), "swiftcast": (7561, "Swiftcast"),
    "lucidDreaming": (7562, "Lucid Dreaming"), "sprint": (3, "Sprint"),
    # Shadowbringers: Enochian was a button until 6.0 made it a trait.
    "enochian": (3575, "Enochian"),
    # Stormblood: Convert (row 158 became Manafont in 5.0; the old action survives at 9637).
    "convert": (9637, "Convert"),
    # AoE: High Fire II / High Blizzard II from 6.0; Fire II and the old point-blank Blizzard II (row 146) before it.
    "fire2": (147, "Fire II"), "blizzard2": (146, "Blizzard II"), "highFire2": (25794, "High Fire II"),
    "highBlizzard2": (25795, "High Blizzard II"), "freeze": (159, "Freeze"), "flare": (162, "Flare"),
    "thunder4": (7420, "Thunder IV"),
}
BLM_STATUSES = {
    "firestarter": "Firestarter", "thundercloud": "Thundercloud", "sharpcast": "Sharpcast",
    "triplecast": "Triplecast", "swiftcast": "Swiftcast", "leyLines": "Ley Lines",
    "circleOfPower": "Circle of Power", "lucidDreaming": "Lucid Dreaming", "manaward": "Manaward",
    "surecast": "Surecast", "sprint": "Sprint", "medicated": "Medicated", "thunder3": "Thunder III",
    "addle": "Addle", "enochian": "Enochian", "thunder4": "Thunder IV",
}
SAM_ACTIONS = {
    "hakaze": (7477, "Hakaze"), "jinpu": (7478, "Jinpu"), "shifu": (7479, "Shifu"), "yukikaze": (7480, "Yukikaze"),
    "gekko": (7481, "Gekko"), "kasha": (7482, "Kasha"), "enpi": (7486, "Enpi"), "iaijutsu": (7867, "Iaijutsu"),
    "midareSetsugekka": (7487, "Midare Setsugekka"), "tenkaGoken": (7488, "Tenka Goken"), "higanbana": (7489, "Higanbana"),
    "shinten": (7490, "Hissatsu: Shinten"), "kyuten": (7491, "Hissatsu: Kyuten"), "gyoten": (7492, "Hissatsu: Gyoten"),
    "yaten": (7493, "Hissatsu: Yaten"), "kaiten": (7494, "Hissatsu: Kaiten"), "hagakure": (7495, "Hagakure"),
    "guren": (7496, "Hissatsu: Guren"), "meditate": (7497, "Meditate"), "thirdEye": (7498, "Third Eye"),
    "meikyoShisui": (7499, "Meikyo Shisui"), "senei": (16481, "Hissatsu: Senei"), "ikishoten": (16482, "Ikishoten"),
    "tsubameGaeshi": (16483, "Tsubame-gaeshi"), "kaeshiHiganbana": (16484, "Kaeshi: Higanbana"),
    "kaeshiGoken": (16485, "Kaeshi: Goken"), "kaeshiSetsugekka": (16486, "Kaeshi: Setsugekka"), "shoha": (16487, "Shoha"),
    "ogiNamikiri": (25781, "Ogi Namikiri"), "kaeshiNamikiri": (25782, "Kaeshi: Namikiri"),
    "trueNorth": (7546, "True North"), "feint": (7549, "Feint"), "bloodbath": (7542, "Bloodbath"),
    "secondWind": (7541, "Second Wind"), "armsLength": (7548, "Arm's Length"), "legSweep": (7863, "Leg Sweep"),
    "fuga": (7483, "Fuga"), "fuko": (25780, "Fuko"), "mangetsu": (7484, "Mangetsu"), "oka": (7485, "Oka"),
    "invigorate": (7544, "Invigorate"),
    "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
# Dawntrail renamed some of these, so they go by row (1298 Fugetsu, 1299 Fuka).
SAM_STATUSES = {
    "fugetsu": 1298, "fuka": 1299, "kaiten": 1229, "meikyoShisui": 1233, "enhancedEnpi": 1236, "higanbana": 1228,
    "ogiNamikiriReady": 2959, "thirdEye": 1232, "meditate": 1231, "trueNorth": 1250, "bloodbath": 84, "feint": 1195,
    "armsLength": 1209, "sprint": "Sprint", "medicated": "Medicated", "slashingResDown": "Slashing Resistance Down",
}

GNB_ACTIONS = {
    "keenEdge": (16137, "Keen Edge"), "noMercy": (16138, "No Mercy"), "brutalShell": (16139, "Brutal Shell"),
    "camouflage": (16140, "Camouflage"), "royalGuard": (16142, "Royal Guard"), "lightningShot": (16143, "Lightning Shot"),
    "solidBarrel": (16145, "Solid Barrel"), "gnashingFang": (16146, "Gnashing Fang"), "savageClaw": (16147, "Savage Claw"),
    "nebula": (16148, "Nebula"), "wickedTalon": (16150, "Wicked Talon"), "aurora": (16151, "Aurora"),
    "superbolide": (16152, "Superbolide"), "sonicBreak": (16153, "Sonic Break"), "roughDivide": (16154, "Rough Divide"),
    "continuation": (16155, "Continuation"), "jugularRip": (16156, "Jugular Rip"), "abdomenTear": (16157, "Abdomen Tear"),
    "eyeGouge": (16158, "Eye Gouge"), "bowShock": (16159, "Bow Shock"), "heartOfLight": (16160, "Heart of Light"),
    "burstStrike": (16162, "Burst Strike"), "bloodfest": (16164, "Bloodfest"), "blastingZone": (16165, "Blasting Zone"),
    "heartOfCorundum": (25758, "Heart of Corundum"), "hypervelocity": (25759, "Hypervelocity"),
    "doubleDown": (25760, "Double Down"), "heartOfStone": (16161, "Heart of Stone"),
    "rampart": (7531, "Rampart"), "lowBlow": (7540, "Low Blow"), "provoke": (7533, "Provoke"),
    "interject": (7538, "Interject"), "reprisal": (7535, "Reprisal"), "shirk": (7537, "Shirk"),
    "armsLength": (7548, "Arm's Length"), "sprint": (3, "Sprint"), "auto": (7, "attack"),
    "demonSlice": (16141, "Demon Slice"), "demonSlaughter": (16149, "Demon Slaughter"), "fatedCircle": (16163, "Fated Circle"),
}
GNB_STATUSES = {
    "noMercy": "No Mercy", "brutalShell": "Brutal Shell", "royalGuard": "Royal Guard", "camouflage": "Camouflage",
    "nebula": "Nebula", "aurora": "Aurora", "superbolide": "Superbolide", "sonicBreak": "Sonic Break",
    "bowShock": "Bow Shock", "readyToRip": "Ready to Rip", "readyToTear": "Ready to Tear",
    "readyToGouge": "Ready to Gouge", "readyToBlast": "Ready to Blast", "heartOfCorundum": "Heart of Corundum",
    "heartOfLight": "Heart of Light", "heartOfStone": "Heart of Stone", "rampart": "Rampart", "reprisal": "Reprisal", "armsLength": "Arm's Length",
    "sprint": "Sprint", "medicated": "Medicated",
}

# Summoner (Stormblood 4.x): the summoner's own actions, then the pets' (Garuda-Egi, Ifrit-Egi, Demi-Bahamut).
SMN_ACTIONS = {
    "ruin": (163, "Ruin"), "ruin2": (172, "Ruin II"), "ruin3": (3579, "Ruin III"), "ruin4": (7426, "Ruin IV"),
    "bio3": (7424, "Bio III"), "miasma3": (7425, "Miasma III"), "triDisaster": (3580, "Tri-disaster"),
    "aetherflow": (166, "Aetherflow"), "energyDrain": (167, "Energy Drain"), "fester": (181, "Fester"),
    "painflare": (3578, "Painflare"), "bane": (174, "Bane"), "dreadwyrmTrance": (3581, "Dreadwyrm Trance"),
    "deathflare": (3582, "Deathflare"), "summonBahamut": (7427, "Summon Bahamut"),
    "enkindleBahamut": (7429, "Enkindle Bahamut"), "rouse": (176, "Rouse"), "enkindle": (184, "Enkindle"),
    "aetherpact": (7423, "Aetherpact"), "shadowFlare": (179, "Shadow Flare"), "triBind": (182, "Tri-bind"),
    "physick": (190, "Physick"),
    "windBlade": (792, "Wind Blade"), "shockwave": (793, "Shockwave"), "aerialSlash": (794, "Aerial Slash"),
    "contagion": (795, "Contagion"), "aerialBlast": (796, "Aerial Blast"), "crimsonCyclone": (797, "Crimson Cyclone"),
    "burningStrike": (798, "Burning Strike"), "radiantShield": (799, "Radiant Shield"), "flamingCrush": (800, "Flaming Crush"),
    "inferno": (801, "Inferno"), "wyrmwave": (7428, "Wyrmwave"), "akhMorn": (7449, "Akh Morn"),
    "swiftcast": (7561, "Swiftcast"), "lucidDreaming": (7562, "Lucid Dreaming"), "addle": (7560, "Addle"),
    "surecast": (7559, "Surecast"), "sprint": (3, "Sprint"),
    # Heavensward: the three DoTs, Spur and the Archer cross-class Raging Strikes.
    "bio": (17864, "Bio"), "bio2": (17865, "Bio II"), "miasma": (168, "Miasma"), "spur": (183, "Spur"),
    "ragingStrikes": (101, "Raging Strikes"),
}
SMN_STATUSES = {
    "bio3": "Bio III", "miasma3": "Miasma III", "dreadwyrmTrance": "Dreadwyrm Trance", "furtherRuin": "Further Ruin",
    "rouse": "Rouse", "devotion": "Devotion", "shadowFlare": "Shadow Flare", "swiftcast": "Swiftcast",
    "lucidDreaming": "Lucid Dreaming", "addle": "Addle", "surecast": "Surecast", "sprint": "Sprint", "medicated": "Medicated",
    "bio": "Bio", "bio2": "Bio II", "miasma": "Miasma", "spur": "Spur", "ragingStrikes": "Raging Strikes",
}

# Astrologian (Stormblood 4.x): the cards are their own actions ("the Balance" ...), played from Draw.
AST_ACTIONS = {
    "malefic3": (7442, "Malefic III"), "combust2": (3608, "Combust II"), "gravity": (3615, "Gravity"),
    "earthlyStar": (7439, "Earthly Star"), "stellarDetonation": (8324, "Stellar Detonation"),
    "stellarBurst": (7440, "Stellar Burst"), "stellarExplosion": (7441, "Stellar Explosion"),
    "lordOfCrowns": (7444, "Lord of Crowns"), "ladyOfCrowns": (7445, "Lady of Crowns"), "minorArcana": (7443, "Minor Arcana"),
    "draw": (3590, "Draw"), "redraw": (3593, "Redraw"), "undraw": (9629, "Undraw"), "royalRoad": (3591, "Royal Road"),
    "emptyRoad": (4645, "Empty Road"), "spread": (3592, "Spread"), "undrawSpread": (4646, "Undraw Spread"),
    "sleeveDraw": (7448, "Sleeve Draw"), "balance": (4401, "the Balance"), "arrow": (4402, "the Arrow"),
    "spear": (4403, "the Spear"), "bole": (4404, "the Bole"), "ewer": (4405, "the Ewer"), "spire": (4406, "the Spire"),
    "lightspeed": (3606, "Lightspeed"), "diurnalSect": (3604, "Diurnal Sect"), "nocturnalSect": (3605, "Nocturnal Sect"),
    "benefic": (3594, "Benefic"), "benefic2": (3610, "Benefic II"), "aspectedBenefic": (3595, "Aspected Benefic"),
    "helios": (3600, "Helios"), "aspectedHelios": (3601, "Aspected Helios"), "essentialDignity": (3614, "Essential Dignity"),
    "synastry": (3612, "Synastry"), "collectiveUnconscious": (3613, "Collective Unconscious"),
    "celestialOpposition": (16553, "Celestial Opposition"), "timeDilation": (3611, "Time Dilation"),
    "clericStance": (7567, "Cleric Stance"), "largesse": (7570, "Largesse"), "swiftcast": (7561, "Swiftcast"),
    "lucidDreaming": (7562, "Lucid Dreaming"), "surecast": (7559, "Surecast"), "sprint": (3, "Sprint"),
    # Heavensward only: the 3.x spells removed in 4.0, and the Conjurer cross-class skills.
    "malefic": (3596, "Malefic"), "malefic2": (3598, "Malefic II"), "combust": (3599, "Combust"),
    "luminiferousAether": (3607, "Luminiferous Aether"), "disable": (3609, "Disable"), "aero": (121, "Aero"),
    "protect": (123, "Protect"), "stoneskin": (129, "Stoneskin"),
}
AST_STATUSES = {
    "theBalance": 829, "theBole": 830, "theArrow": 831, "theSpear": 832, "theEwer": 833, "theSpire": 834,
    "enhancedRoyalRoad": 816, "expandedRoyalRoad": 817, "extendedRoyalRoad": 818, "lightspeed": 841, "combust2": 843,
    "earthlyDominance": 1224, "giantDominance": 1248, "diurnalSect": 839, "nocturnalSect": 840, "clericStance": 145,
    "largesse": 1207, "lucidDreaming": "Lucid Dreaming", "swiftcast": "Swiftcast", "surecast": "Surecast",
    "combust": "Combust", "aero": "Aero", "luminiferousAether": "Luminiferous Aether",
    "sprint": "Sprint", "medicated": "Medicated",
}

# Scholar (Stormblood 4.x): the summoner-line damage spells, the faerie's actions and the Aetherflow heals.
SCH_ACTIONS = {
    "broil2": (7435, "Broil II"), "bio2": (17865, "Bio II"), "miasma": (168, "Miasma"), "miasma2": (177, "Miasma II"),
    "ruin2": (172, "Ruin II"), "shadowFlare": (179, "Shadow Flare"), "energyDrain": (16508, "Energy Drain"), "bane": (174, "Bane"),
    "chainStratagem": (7436, "Chain Stratagem"), "aetherflow": (166, "Aetherflow"), "dissipation": (3587, "Dissipation"),
    "physick": (190, "Physick"), "adloquium": (185, "Adloquium"), "succor": (186, "Succor"), "lustrate": (189, "Lustrate"),
    "indomitability": (3583, "Indomitability"), "excogitation": (7434, "Excogitation"), "sacredSoil": (188, "Sacred Soil"),
    "deploymentTactics": (3585, "Deployment Tactics"), "emergencyTactics": (3586, "Emergency Tactics"),
    "aetherpact": (7437, "Aetherpact"), "summon": (165, "Summon"), "summon2": (170, "Summon II"),
    "whisperingDawn": (803, "Whispering Dawn"), "feyCovenant": (804, "Fey Covenant"), "feyIllumination": (805, "Fey Illumination"),
    "silentDusk": (807, "Silent Dusk"), "feyCaress": (810, "Fey Caress"), "feyWind": (811, "Fey Wind"), "embrace": (802, "Embrace"),
    "clericStance": (7567, "Cleric Stance"), "largesse": (7570, "Largesse"), "swiftcast": (7561, "Swiftcast"),
    "lucidDreaming": (7562, "Lucid Dreaming"), "surecast": (7559, "Surecast"), "sprint": (3, "Sprint"),
    # Heavensward only: the 3.x Arcanist and Scholar actions removed or replaced later, and the Conjurer cross-class skills.
    "broil": (3584, "Broil"), "ruin": (163, "Ruin"), "bio": (17864, "Bio"), "rouse": (176, "Rouse"),
    "eyeForAnEye": (175, "Eye for an Eye"), "virus": (169, "Virus"), "leeches": (187, "Leeches"), "aero": (121, "Aero"),
    "protect": (123, "Protect"), "stoneskin": (129, "Stoneskin"),
}
SCH_STATUSES = {
    "bio2": 189, "miasma": 180, "miasma2": "Miasma II", "chainStratagem": 1221, "feyWind": 799, "dissipation": "Dissipation",
    "clericStance": 145, "largesse": 1207, "shadowFlare": "Shadow Flare", "feyUnion": "Fey Union",
    "emergencyTactics": "Emergency Tactics", "excogitation": "Excogitation", "lucidDreaming": "Lucid Dreaming",
    "swiftcast": "Swiftcast", "surecast": "Surecast", "sprint": "Sprint", "medicated": "Medicated",
    "bio": "Bio", "aero": "Aero", "rouse": "Rouse",
}

# Dragoon (Stormblood 4.x). Row 85 is now Lance Charge; in Stormblood it was Blood for Blood.
DRG_ACTIONS = {
    "trueThrust": (75, "True Thrust"), "vorpalThrust": (78, "Vorpal Thrust"), "fullThrust": (84, "Full Thrust"),
    "impulseDrive": (81, "Impulse Drive"), "disembowel": (87, "Disembowel"), "chaosThrust": (88, "Chaos Thrust"),
    "heavyThrust": (79, "Heavy Thrust"), "piercingTalon": (90, "Piercing Talon"), "doomSpike": (86, "Doom Spike"),
    "sonicThrust": (7397, "Sonic Thrust"), "fangAndClaw": (3554, "Fang and Claw"), "wheelingThrust": (3556, "Wheeling Thrust"),
    "jump": (92, "Jump"), "spineshatterDive": (95, "Spineshatter Dive"), "dragonfireDive": (96, "Dragonfire Dive"),
    "mirageDive": (7399, "Mirage Dive"), "geirskogul": (3555, "Geirskogul"), "nastrond": (7400, "Nastrond"),
    "bloodOfTheDragon": (3553, "Blood of the Dragon"), "lifeSurge": (83, "Life Surge"), "bloodForBlood": (85, "Lance Charge"),
    "battleLitany": (3557, "Battle Litany"), "dragonSight": (7398, "Dragon Sight"), "elusiveJump": (94, "Elusive Jump"),
    "trueNorth": (7546, "True North"), "feint": (7549, "Feint"), "bloodbath": (7542, "Bloodbath"),
    "secondWind": (7541, "Second Wind"), "armsLength": (7548, "Arm's Length"), "legSweep": (7863, "Leg Sweep"),
    "invigorate": (7544, "Invigorate"), "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
DRG_STATUSES = {
    "heavyThrust": 115, "lifeSurge": 116, "chaosThrust": 118, "piercingResDown": 820, "bloodOfTheDragon": 736,
    "battleLitany": 786, "sharperFangAndClaw": 802, "enhancedWheelingThrust": 803, "rightEye": 1183, "diveReady": 1243,
    "bloodForBlood": "Blood for Blood", "lifeOfTheDragon": "Life of the Dragon",
    "trueNorth": 1250, "bloodbath": 84, "feint": 1195, "armsLength": 1209, "sprint": "Sprint", "medicated": "Medicated",
}
# Monk (Stormblood 4.2–4.58).
MNK_ACTIONS = {
    "bootshine": (53, "Bootshine"), "trueStrike": (54, "True Strike"), "snapPunch": (56, "Snap Punch"),
    "dragonKick": (74, "Dragon Kick"), "twinSnakes": (61, "Twin Snakes"), "demolish": (66, "Demolish"),
    "armOfTheDestroyer": (62, "Arm of the Destroyer"), "oneIlmPunch": (72, "One Ilm Punch"), "rockbreaker": (70, "Rockbreaker"),
    "formShift": (4262, "Form Shift"), "meditation": (3546, "Meditation"), "forbiddenChakra": (3547, "the Forbidden Chakra"),
    "tornadoKick": (3543, "Tornado Kick"), "steelPeak": (64, "Steel Peak"), "howlingFist": (67, "Howling Fist"),
    "elixirField": (3545, "Elixir Field"), "shoulderTackle": (71, "Shoulder Tackle"), "fireTackle": (7866, "Fire Tackle"),
    "windTackle": (7865, "Wind Tackle"), "earthTackle": (7864, "Earth Tackle"), "riddleOfWind": (7868, "Riddle of Wind"),
    "internalRelease": (59, "Internal Release"), "perfectBalance": (69, "Perfect Balance"), "riddleOfFire": (7395, "Riddle of Fire"),
    "brotherhood": (7396, "Brotherhood"), "riddleOfEarth": (7394, "Riddle of Earth"), "fistsOfFire": (63, "Fists of Fire"),
    "fistsOfWind": (73, "Fists of Wind"), "fistsOfEarth": (60, "Fists of Earth"), "mantra": (65, "Mantra"),
    "purification": (3544, "Purification"),
    # Heavensward only: Touch of Death, and the Lancer and Marauder cross-class skills (row 85 is Blood for Blood then).
    "touchOfDeath": (68, "Touch of Death"), "fracture": (33, "Fracture"), "bloodForBlood": (85, "Lance Charge"),
    "featherfoot": (55, "Featherfoot"),
    "trueNorth": (7546, "True North"), "feint": (7549, "Feint"), "bloodbath": (7542, "Bloodbath"),
    "secondWind": (7541, "Second Wind"), "armsLength": (7548, "Arm's Length"), "legSweep": (7863, "Leg Sweep"),
    "invigorate": (7544, "Invigorate"), "sprint": (3, "Sprint"), "auto": (7, "attack"),
    # Endwalker.
    "sixSidedStar": (16476, "Six-sided Star"), "shadowOfTheDestroyer": (25767, "Shadow of the Destroyer"),
    "fourPointFury": (16473, "Four-point Fury"), "enlightenment": (16474, "Enlightenment"), "masterfulBlitz": (25764, "Masterful Blitz"),
    "celestialRevolution": (25765, "Celestial Revolution"), "risingPhoenix": (25768, "Rising Phoenix"), "phantomRush": (25769, "Phantom Rush"),
    "thunderclap": (25762, "Thunderclap"), "anatman": (16475, "Anatman"),
}
MNK_STATUSES = {
    "gl1": 111, "gl2": 112, "gl3": 113, "opoOpo": 107, "raptor": 108, "coeurl": 109, "perfectBalance": 110,
    "twinSnakes": 101, "bluntResDown": 98, "demolish": 246, "riddleOfWind": 1244, "internalRelease": "Internal Release",
    "riddleOfFire": "Riddle of Fire", "brotherhood": "Brotherhood", "fistsOfFire": "Fists of Fire",
    "fistsOfWind": "Fists of Wind", "fistsOfEarth": "Fists of Earth", "riddleOfEarth": "Riddle of Earth", "mantra": "Mantra",
    "trueNorth": 1250, "bloodbath": 84, "feint": 1195, "armsLength": 1209, "sprint": "Sprint", "medicated": "Medicated",
    "formlessFist": "Formless Fist", "disciplinedFist": "Disciplined Fist", "leadenFist": "Leaden Fist",
}

# Bard (Stormblood 4.06–4.58).
BRD_ACTIONS = {
    "heavyShot": (97, "Heavy Shot"), "straightShot": (98, "Straight Shot"), "causticBite": (7406, "Caustic Bite"),
    "stormbite": (7407, "Stormbite"), "ironJaws": (3560, "Iron Jaws"), "refulgentArrow": (7409, "Refulgent Arrow"),
    "quickNock": (106, "Quick Nock"), "rainOfDeath": (117, "Rain of Death"), "bloodletter": (110, "Bloodletter"),
    "empyrealArrow": (3558, "Empyreal Arrow"), "sidewinder": (3562, "Sidewinder"), "pitchPerfect": (7404, "Pitch Perfect"),
    "ragingStrikes": (101, "Raging Strikes"), "barrage": (107, "Barrage"), "magesBallad": (114, "Mage's Ballad"),
    "armysPaeon": (116, "Army's Paeon"), "wanderersMinuet": (3559, "the Wanderer's Minuet"), "battleVoice": (118, "Battle Voice"),
    "troubadour": (7405, "Troubadour"), "naturesMinne": (7408, "Nature's Minne"), "wardensPaean": (3561, "the Warden's Paean"),
    "repellingShot": (112, "Repelling Shot"), "headGraze": (7551, "Head Graze"), "peloton": (7557, "Peloton"),
    "invigorate": (7544, "Invigorate"), "secondWind": (7541, "Second Wind"), "sprint": (3, "Sprint"), "auto": (8, "Shot"),
}
BRD_STATUSES = {
    "straighterShot": 122, "straightShot": "Straight Shot", "causticBite": "Caustic Bite", "stormbite": "Stormbite",
    "ragingStrikes": "Raging Strikes", "barrage": "Barrage", "magesBallad": "Mage's Ballad", "armysPaeon": "Army's Paeon",
    "wanderersMinuet": 865, "battleVoice": "Battle Voice", "troubadour": "Troubadour",
    "naturesMinne": "Nature's Minne", "criticalUp": "Critical Up", "peloton": "Peloton", "sprint": "Sprint", "medicated": "Medicated",
}

# Machinist (Stormblood 4.06–4.58). Row 7410 was Cooldown; Shadowbringers renamed it Heat Blast.
MCH_ACTIONS = {
    "splitShot": (2866, "Split Shot"), "slugShot": (2868, "Slug Shot"), "cleanShot": (2873, "Clean Shot"),
    "heatedSplitShot": (7411, "Heated Split Shot"), "heatedSlugShot": (7412, "Heated Slug Shot"),
    "heatedCleanShot": (7413, "Heated Clean Shot"), "hotShot": (2872, "Hot Shot"), "cooldown": (7410, "Heat Blast"),
    "spreadShot": (2870, "Spread Shot"), "reload": (2867, "Reload"), "quickReload": (2879, "Quick Reload"),
    "reassemble": (2876, "Reassemble"), "gaussRound": (2874, "Gauss Round"), "ricochet": (2890, "Ricochet"),
    "wildfire": (2878, "Wildfire"), "rapidFire": (2881, "Rapid Fire"), "hypercharge": (2885, "Hypercharge"),
    "gaussBarrel": (2880, "Gauss Barrel"), "barrelStabilizer": (7414, "Barrel Stabilizer"), "flamethrower": (7418, "Flamethrower"),
    "rookAutoturret": (2864, "Rook Autoturret"), "rookOverdrive": (7415, "Rook Overdrive"), "rookOverload": (7416, "Rook Overload"),
    "volleyFire": (2891, "Volley Fire"), "invigorate": (7544, "Invigorate"), "secondWind": (7541, "Second Wind"),
    "headGraze": (7551, "Head Graze"), "peloton": (7557, "Peloton"), "sprint": (3, "Sprint"), "auto": (8, "Shot"),
    # Heavensward only (removed in 4.0, or the Archer and Lancer cross-class skills of 3.x).
    "leadShot": (2869, "Lead Shot"), "grenadoShot": (2871, "Grenado Shot"), "heartbreak": (2875, "Heartbreak"),
    "blank": (2888, "Blank"), "suppressiveFire": (2883, "Suppressive Fire"), "legGraze": (2877, "Leg Graze"),
    "footGraze": (2884, "Foot Graze"), "bishopAutoturret": (2865, "Bishop Autoturret"), "turretRetrieval": (3487, "Turret Retrieval"),
    "dismantle": (2887, "Dismantle"), "rendMind": (2882, "Rend Mind"), "ragingStrikes": (101, "Raging Strikes"),
    "hawksEye": (99, "Hawk's Eye"), "quellingStrikes": (104, "Quelling Strikes"), "bloodForBlood": (85, "Lance Charge"),
    "keenFlurry": (77, "Keen Flurry"), "feint": (76, "Feint"),
}
MCH_STATUSES = {
    "hotShot": 855, "enhancedSlugShot": "Enhanced Slug Shot", "cleanerShot": "Cleaner Shot", "reassembled": "Reassembled",
    "wildfire": "Wildfire", "rapidFire": "Rapid Fire", "gaussBarrel": "Gauss Barrel", "flamethrower": "Flamethrower",
    "vulnerabilityUp": "Vulnerability Up", "ammunition": 862, "peloton": "Peloton", "sprint": "Sprint", "medicated": "Medicated",
    "leadShot": "Lead Shot", "ragingStrikes": "Raging Strikes", "hawksEye": "Hawk's Eye", "bloodForBlood": "Blood for Blood",
    "quellingStrikes": "Quelling Strikes", "keenFlurry": "Keen Flurry", "dismantle": "Dismantle", "hypercharge": "Hypercharge",
}

# Warrior (Heavensward 3.x). Most of its 3.x kit was removed later, so many icons are struck through.
WAR_ACTIONS = {
    "heavySwing": (31, "Heavy Swing"), "skullSunder": (35, "Skull Sunder"), "butchersBlock": (47, "Butcher's Block"),
    "maim": (37, "Maim"), "stormsPath": (42, "Storm's Path"), "stormsEye": (45, "Storm's Eye"), "overpower": (41, "Overpower"),
    "tomahawk": (46, "Tomahawk"), "fracture": (33, "Fracture"), "fellCleave": (3549, "Fell Cleave"), "decimate": (3550, "Decimate"),
    "innerBeast": (49, "Inner Beast"), "steelCyclone": (51, "Steel Cyclone"), "brutalSwing": (39, "Brutal Swing"),
    "berserk": (38, "Berserk"), "defiance": (48, "Defiance"), "deliverance": (3548, "Deliverance"), "infuriate": (52, "Infuriate"),
    "unchained": (50, "Unchained"), "equilibrium": (3552, "Equilibrium"), "rawIntuition": (3551, "Raw Intuition"),
    "vengeance": (44, "Vengeance"), "holmgang": (43, "Holmgang"), "thrillOfBattle": (40, "Thrill of Battle"),
    "foresight": (32, "Foresight"), "bloodbath": (34, "Bloodbath"), "internalRelease": (59, "Internal Release"),
    "provoke": (18, "Provoke"), "awareness": (13, "Awareness"), "convalescence": (12, "Convalescence"), "flash": (14, "Flash"),
    "secondWind": (57, "Second Wind"), "sprint": (3, "Sprint"), "auto": (7, "attack"),
    # Endwalker.
    "fellCleaveEw": (3549, "Fell Cleave"), "innerChaos": (16465, "Inner Chaos"), "innerRelease": (7389, "Inner Release"),
    "primalRend": (25753, "Primal Rend"), "upheaval": (7387, "Upheaval"), "orogeny": (25752, "Orogeny"), "onslaught": (7386, "Onslaught"),
    "mythrilTempest": (16462, "Mythril Tempest"), "chaoticCyclone": (16463, "Chaotic Cyclone"), "bloodwhetting": (25751, "Bloodwhetting"),
    "shakeItOff": (7388, "Shake It Off"), "nascentFlash": (16464, "Nascent Flash"), "rampart": (7531, "Rampart"), "lowBlow": (7540, "Low Blow"), "interject": (7538, "Interject"),
    "reprisal": (7535, "Reprisal"), "shirk": (7537, "Shirk"), "armsLength": (7548, "Arm's Length"),
}
WAR_STATUSES = {
    "maim": "Maim", "stormsEye": "Storm's Eye", "fracture": "Fracture", "berserk": "Berserk", "pacification": "Pacification",
    "defiance": "Defiance", "deliverance": "Deliverance", "wrath": "Wrath", "abandon": "Abandon", "infuriated": "Infuriated",
    "uncontrollable": "Uncontrollable", "unchained": "Unchained", "rawIntuition": "Raw Intuition", "vengeance": "Vengeance",
    "holmgang": "Holmgang", "thrillOfBattle": "Thrill of Battle", "foresight": "Foresight", "bloodbath": "Bloodbath",
    "internalRelease": "Internal Release", "slashingResDown": "Slashing Resistance Down", "sprint": "Sprint", "medicated": "Medicated",
    "surgingTempest": "Surging Tempest", "innerRelease": 1177, "primalRendReady": "Primal Rend Ready", "nascentChaos": "Nascent Chaos",
    "bloodwhetting": "Bloodwhetting", "shakeItOff": "Shake It Off", "nascentFlash": "Nascent Flash", "rampart": "Rampart", "reprisal": "Reprisal", "armsLength": "Arm's Length",
}

# Ninja (Heavensward 3.x). Much of the 3.x kit was removed later, so many icons are struck through.
NIN_ACTIONS = {
    "spinningEdge": (2240, "Spinning Edge"), "gustSlash": (2242, "Gust Slash"), "aeolianEdge": (2255, "Aeolian Edge"),
    "armorCrush": (3563, "Armor Crush"), "dancingEdge": (2251, "Dancing Edge"), "shadowFang": (2257, "Shadow Fang"),
    "mutilate": (2244, "Mutilate"), "deathBlossom": (2254, "Death Blossom"), "throwingDagger": (2247, "Throwing Dagger"),
    "trickAttack": (2258, "Trick Attack"), "sneakAttack": (2250, "Sneak Attack"), "mug": (2248, "Mug"), "jugulate": (2256, "Jugulate"),
    "dreamWithinADream": (3566, "Dream Within a Dream"), "assassinate": (2246, "Assassinate"), "duality": (3567, "Duality"),
    "kassatsu": (2264, "Kassatsu"), "ten": (2259, "Ten"), "chi": (2261, "Chi"), "jin": (2263, "Jin"), "ninjutsu": (2260, "Ninjutsu"),
    "fumaShuriken": (2265, "Fuma Shuriken"), "katon": (2266, "Katon"), "raiton": (2267, "Raiton"), "hyoton": (2268, "Hyoton"),
    "huton": (2269, "Huton"), "doton": (2270, "Doton"), "suiton": (2271, "Suiton"), "rabbitMedium": (2272, "Rabbit Medium"),
    "kissOfTheWasp": (2243, "Kiss of the Wasp"), "kissOfTheViper": (2252, "Kiss of the Viper"), "hide": (2245, "Hide"),
    "shukuchi": (2262, "Shukuchi"), "goad": (2249, "Goad"), "shadeShift": (2241, "Shade Shift"), "shadewalker": (3564, "Shadewalker"),
    "smokeScreen": (3565, "Smoke Screen"),
    # Pugilist and Lancer cross-class skills (row 85 is Blood for Blood then).
    "internalRelease": (59, "Internal Release"), "bloodForBlood": (85, "Lance Charge"), "invigorate": (80, "Invigorate"),
    "secondWind": (57, "Second Wind"), "featherfoot": (55, "Featherfoot"), "mantra": (65, "Mantra"), "keenFlurry": (77, "Keen Flurry"),
    "feint": (76, "Feint"), "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
NIN_STATUSES = {
    "huton": "Huton", "suiton": "Suiton", "hidden": "Hidden", "mudra": "Mudra", "kassatsu": "Kassatsu", "duality": "Duality",
    "kissOfTheWasp": "Kiss of the Wasp", "kissOfTheViper": "Kiss of the Viper", "internalRelease": "Internal Release",
    "bloodForBlood": "Blood for Blood", "shadeShift": "Shade Shift", "shadewalker": "Shadewalker", "featherfoot": "Featherfoot",
    "mantra": "Mantra", "keenFlurry": "Keen Flurry", "shadowFang": "Shadow Fang", "mutilate": "Mutilation",
    "dancingEdge": "Slashing Resistance Down", "trickAttack": "Vulnerability Up", "doton": "Doton", "sprint": "Sprint", "medicated": "Medicated",
}

# Paladin (Dawntrail 7.x): the current kit, so nothing is struck through.
PLD_ACTIONS = {
    "fastBlade": (9, "Fast Blade"), "riotBlade": (15, "Riot Blade"), "royalAuthority": (3539, "Royal Authority"),
    "atonement": (16460, "Atonement"), "supplication": (36918, "Supplication"), "sepulchre": (36919, "Sepulchre"),
    "goringBlade": (3538, "Goring Blade"), "holySpirit": (7384, "Holy Spirit"), "holyCircle": (16458, "Holy Circle"),
    "confiteor": (16459, "Confiteor"), "bladeOfFaith": (25748, "Blade of Faith"), "bladeOfTruth": (25749, "Blade of Truth"),
    "bladeOfValor": (25750, "Blade of Valor"), "fightOrFlight": (20, "Fight or Flight"), "imperator": (36921, "Imperator"),
    "bladeOfHonor": (36922, "Blade of Honor"), "expiacion": (25747, "Expiacion"), "circleOfScorn": (23, "Circle of Scorn"),
    "intervene": (16461, "Intervene"), "shieldLob": (24, "Shield Lob"), "totalEclipse": (7381, "Total Eclipse"),
    "prominence": (16457, "Prominence"), "clemency": (3541, "Clemency"), "ironWill": (28, "Iron Will"),
    "holySheltron": (25746, "Holy Sheltron"), "intervention": (7382, "Intervention"), "cover": (27, "Cover"),
    "guardian": (36920, "Guardian"), "bulwark": (22, "Bulwark"), "hallowedGround": (30, "Hallowed Ground"),
    "divineVeil": (3540, "Divine Veil"), "passageOfArms": (7385, "Passage of Arms"), "requiescat": (7383, "Requiescat"),
    "sentinel": (17, "Sentinel"), "sheltron": (3542, "Sheltron"), "spiritsWithin": (29, "Spirits Within"),
    "rampart": (7531, "Rampart"), "lowBlow": (7540, "Low Blow"), "provoke": (7533, "Provoke"),
    "interject": (7538, "Interject"), "reprisal": (7535, "Reprisal"), "shirk": (7537, "Shirk"),
    "armsLength": (7548, "Arm's Length"), "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
PLD_STATUSES = {
    "fightOrFlight": 76, "requiescat": 1368, "confiteorReady": 3019, "goringBladeReady": 3847, "atonementReady": 1902,
    "supplicationReady": 3827, "sepulchreReady": 3828, "divineMight": 2673, "bladeOfHonorReady": 3831, "circleOfScorn": 248,
    "ironWill": 79, "holySheltron": "Holy Sheltron", "guardian": "Guardian", "bulwark": 77, "hallowedGround": 82,
    "divineVeil": "Divine Veil", "passageOfArms": "Passage of Arms", "rampart": "Rampart", "reprisal": "Reprisal", "swordOath": "Sword Oath",
    "sentinel": "Sentinel", "sheltron": "Sheltron", "goringBlade": "Goring Blade",
    "armsLength": "Arm's Length", "sprint": "Sprint", "medicated": "Medicated",
}

# Viper (Dawntrail 7.05+): the current kit.
VPR_ACTIONS = {
    "steelFangs": (34606, "Steel Fangs"), "reavingFangs": (34607, "Reaving Fangs"), "huntersSting": (34608, "Hunter's Sting"),
    "swiftskinsSting": (34609, "Swiftskin's Sting"), "flankstingStrike": (34610, "Flanksting Strike"),
    "flanksbaneFang": (34611, "Flanksbane Fang"), "hindstingStrike": (34612, "Hindsting Strike"), "hindsbaneFang": (34613, "Hindsbane Fang"),
    "steelMaw": (34614, "Steel Maw"), "reavingMaw": (34615, "Reaving Maw"), "huntersBite": (34616, "Hunter's Bite"),
    "swiftskinsBite": (34617, "Swiftskin's Bite"), "jaggedMaw": (34618, "Jagged Maw"), "bloodiedMaw": (34619, "Bloodied Maw"),
    "vicewinder": (34620, "Vicewinder"), "huntersCoil": (34621, "Hunter's Coil"), "swiftskinsCoil": (34622, "Swiftskin's Coil"),
    "vicepit": (34623, "Vicepit"), "huntersDen": (34624, "Hunter's Den"), "swiftskinsDen": (34625, "Swiftskin's Den"),
    "reawaken": (34626, "Reawaken"), "firstGeneration": (34627, "First Generation"), "secondGeneration": (34628, "Second Generation"),
    "thirdGeneration": (34629, "Third Generation"), "fourthGeneration": (34630, "Fourth Generation"), "ouroboros": (34631, "Ouroboros"),
    "writhingSnap": (34632, "Writhing Snap"), "uncoiledFury": (34633, "Uncoiled Fury"), "deathRattle": (34634, "Death Rattle"),
    "lastLash": (34635, "Last Lash"), "twinfangBite": (34636, "Twinfang Bite"), "twinbloodBite": (34637, "Twinblood Bite"),
    "twinfangThresh": (34638, "Twinfang Thresh"), "twinbloodThresh": (34639, "Twinblood Thresh"), "firstLegacy": (34640, "First Legacy"),
    "secondLegacy": (34641, "Second Legacy"), "thirdLegacy": (34642, "Third Legacy"), "fourthLegacy": (34643, "Fourth Legacy"),
    "uncoiledTwinfang": (34644, "Uncoiled Twinfang"), "uncoiledTwinblood": (34645, "Uncoiled Twinblood"), "slither": (34646, "Slither"),
    "serpentsIre": (34647, "Serpent's Ire"), "serpentsTail": (35920, "Serpent's Tail"), "twinfang": (35921, "Twinfang"),
    "twinblood": (35922, "Twinblood"),
    "trueNorth": (7546, "True North"), "feint": (7549, "Feint"), "bloodbath": (7542, "Bloodbath"),
    "secondWind": (7541, "Second Wind"), "armsLength": (7548, "Arm's Length"), "legSweep": (7863, "Leg Sweep"),
    "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
VPR_STATUSES = {
    "huntersInstinct": 3668, "swiftscaled": 3669, "readyToReawaken": 3671, "honedSteel": 3672, "honedReavers": 3772,
    "flankstungVenom": "Flankstung Venom", "flanksbaneVenom": "Flanksbane Venom", "hindstungVenom": "Hindstung Venom",
    "hindsbaneVenom": "Hindsbane Venom", "grimhuntersVenom": "Grimhunter's Venom", "grimskinsVenom": "Grimskin's Venom",
    "huntersVenom": "Hunter's Venom", "swiftskinsVenom": "Swiftskin's Venom", "fellhuntersVenom": "Fellhunter's Venom",
    "fellskinsVenom": "Fellskin's Venom", "poisedForTwinfang": "Poised for Twinfang", "poisedForTwinblood": "Poised for Twinblood",
    "reawakened": "Reawakened", "trueNorth": 1250, "bloodbath": 84, "feint": 1195, "armsLength": 1209, "sprint": "Sprint",
    "medicated": "Medicated",
}

# White Mage (Dawntrail 7.x): the current kit.
WHM_ACTIONS = {
    "glare3": (25859, "Glare III"), "glare4": (37009, "Glare IV"), "dia": (16532, "Dia"), "afflatusMisery": (16535, "Afflatus Misery"),
    "holy3": (25860, "Holy III"), "afflatusSolace": (16531, "Afflatus Solace"), "afflatusRapture": (16534, "Afflatus Rapture"),
    "medica3": (37010, "Medica III"), "cure2": (135, "Cure II"), "cure3": (131, "Cure III"), "regen": (137, "Regen"),
    "assize": (3571, "Assize"), "presenceOfMind": (136, "Presence of Mind"), "thinAir": (7430, "Thin Air"),
    "temperance": (16536, "Temperance"), "divineCaress": (37011, "Divine Caress"), "plenaryIndulgence": (7433, "Plenary Indulgence"),
    "tetragrammaton": (3570, "Tetragrammaton"), "divineBenison": (7432, "Divine Benison"), "asylum": (3569, "Asylum"),
    "benediction": (140, "Benediction"), "aquaveil": (25861, "Aquaveil"), "liturgyOfTheBell": (25862, "Liturgy of the Bell"),
    "aetherialShift": (37008, "Aetherial Shift"), "swiftcast": (7561, "Swiftcast"), "lucidDreaming": (7562, "Lucid Dreaming"),
    "surecast": (7559, "Surecast"), "rescue": (7571, "Rescue"), "esuna": (7568, "Esuna"), "repose": (16560, "Repose"),
    "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
WHM_STATUSES = {
    "presenceOfMind": 157, "sacredSight": 3879, "thinAir": "Thin Air", "temperance": "Temperance", "divineGrace": "Divine Grace",
    "confession": "Confession", "aquaveil": "Aquaveil", "dia": 1871, "swiftcast": "Swiftcast", "lucidDreaming": "Lucid Dreaming",
    "surecast": "Surecast", "sprint": "Sprint", "medicated": "Medicated",
}

# Reaper (Dawntrail 7.x): the current kit.
RPR_ACTIONS = {
    "slice": (24373, "Slice"), "waxingSlice": (24374, "Waxing Slice"), "infernalSlice": (24375, "Infernal Slice"),
    "spinningScythe": (24376, "Spinning Scythe"), "nightmareScythe": (24377, "Nightmare Scythe"), "shadowOfDeath": (24378, "Shadow of Death"),
    "whorlOfDeath": (24379, "Whorl of Death"), "soulSlice": (24380, "Soul Slice"), "gibbet": (24382, "Gibbet"), "gallows": (24383, "Gallows"),
    "guillotine": (24384, "Guillotine"), "plentifulHarvest": (24385, "Plentiful Harvest"), "harpe": (24386, "Harpe"), "soulsow": (24387, "Soulsow"),
    "harvestMoon": (24388, "Harvest Moon"), "bloodStalk": (24389, "Blood Stalk"), "unveiledGibbet": (24390, "Unveiled Gibbet"),
    "unveiledGallows": (24391, "Unveiled Gallows"), "grimSwathe": (24392, "Grim Swathe"), "gluttony": (24393, "Gluttony"),
    "enshroud": (24394, "Enshroud"), "voidReaping": (24395, "Void Reaping"), "crossReaping": (24396, "Cross Reaping"),
    "grimReaping": (24397, "Grim Reaping"), "communio": (24398, "Communio"), "lemuresSlice": (24399, "Lemure's Slice"),
    "hellsIngress": (24401, "Hell's Ingress"), "arcaneCrest": (24404, "Arcane Crest"), "arcaneCircle": (24405, "Arcane Circle"),
    "sacrificium": (36969, "Sacrificium"), "executionersGibbet": (36970, "Executioner's Gibbet"), "executionersGallows": (36971, "Executioner's Gallows"),
    "executionersGuillotine": (36972, "Executioner's Guillotine"), "perfectio": (36973, "Perfectio"),
    "trueNorth": (7546, "True North"), "feint": (7549, "Feint"), "bloodbath": (7542, "Bloodbath"),
    "secondWind": (7541, "Second Wind"), "armsLength": (7548, "Arm's Length"), "legSweep": (7863, "Leg Sweep"),
    "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
RPR_STATUSES = {
    "soulReaver": "Soul Reaver", "executioner": "Executioner", "enshrouded": "Enshrouded", "enhancedGibbet": "Enhanced Gibbet",
    "enhancedGallows": "Enhanced Gallows", "enhancedVoidReaping": "Enhanced Void Reaping", "enhancedCrossReaping": "Enhanced Cross Reaping",
    "oblatio": "Oblatio", "arcaneCircle": "Arcane Circle", "bloodsownCircle": "Bloodsown Circle", "immortalSacrifice": "Immortal Sacrifice",
    "idealHost": "Ideal Host", "perfectioOcculta": "Perfectio Occulta", "perfectioParata": "Perfectio Parata", "soulsow": "Soulsow",
    "arcaneCrest": "Crest of Time Borrowed", "deathsDesign": "Death's Design", "trueNorth": 1250, "bloodbath": 84, "feint": 1195,
    "armsLength": 1209, "sprint": "Sprint", "medicated": "Medicated",
}

# Sage (Endwalker 6.x): the current kit.
SGE_ACTIONS = {
    "dosis3": (24312, "Dosis III"), "eukrasia": (24290, "Eukrasia"), "eukrasianDosis3": (24314, "Eukrasian Dosis III"),
    "phlegma3": (24313, "Phlegma III"), "toxikon2": (24316, "Toxikon II"), "dyskrasia2": (24315, "Dyskrasia II"), "pneuma": (24318, "Pneuma"),
    "diagnosis": (24284, "Diagnosis"), "prognosis": (24286, "Prognosis"), "eukrasianDiagnosis": (24291, "Eukrasian Diagnosis"),
    "eukrasianPrognosis": (24292, "Eukrasian Prognosis"), "egeiro": (24287, "Egeiro"), "kardia": (24285, "Kardia"), "soteria": (24294, "Soteria"),
    "zoe": (24300, "Zoe"), "holos": (24310, "Holos"), "panhaima": (24311, "Panhaima"), "haima": (24305, "Haima"), "krasis": (24317, "Krasis"),
    "rhizomata": (24309, "Rhizomata"), "physis2": (24302, "Physis II"), "kerachole": (24298, "Kerachole"), "ixochole": (24299, "Ixochole"),
    "taurochole": (24303, "Taurochole"), "druochole": (24296, "Druochole"), "icarus": (24295, "Icarus"),
    "swiftcast": (7561, "Swiftcast"), "lucidDreaming": (7562, "Lucid Dreaming"), "surecast": (7559, "Surecast"), "rescue": (7571, "Rescue"),
    "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
SGE_STATUSES = {
    "eukrasia": "Eukrasia", "kardia": "Kardia", "soteria": "Soteria", "zoe": "Zoe", "swiftcast": "Swiftcast",
    "lucidDreaming": "Lucid Dreaming", "surecast": "Surecast", "eukrasianDosis3": "Eukrasian Dosis III", "sprint": "Sprint", "medicated": "Medicated",
}

# Dark Knight (Shadowbringers 5.x): the level 80 kit.
DRK_ACTIONS = {
    "hardSlash": (3617, "Hard Slash"), "syphonStrike": (3623, "Syphon Strike"), "souleater": (3632, "Souleater"),
    "unleash": (3621, "Unleash"), "stalwartSoul": (16468, "Stalwart Soul"), "unmend": (3624, "Unmend"), "grit": (3629, "Grit"),
    "bloodWeapon": (3625, "Blood Weapon"), "shadowWall": (3636, "Shadow Wall"), "darkMind": (3634, "Dark Mind"),
    "livingDead": (3638, "Living Dead"), "saltedEarth": (3639, "Salted Earth"), "plunge": (3640, "Plunge"),
    "abyssalDrain": (3641, "Abyssal Drain"), "carveAndSpit": (3643, "Carve and Spit"), "bloodspiller": (7392, "Bloodspiller"),
    "quietus": (7391, "Quietus"), "delirium": (7390, "Delirium"), "theBlackestNight": (7393, "The Blackest Night"),
    "floodOfShadow": (16469, "Flood of Shadow"), "edgeOfShadow": (16470, "Edge of Shadow"), "darkMissionary": (16471, "Dark Missionary"),
    "livingShadow": (16472, "Living Shadow"),
    "rampart": (7531, "Rampart"), "lowBlow": (7540, "Low Blow"), "provoke": (7533, "Provoke"), "interject": (7538, "Interject"),
    "reprisal": (7535, "Reprisal"), "shirk": (7537, "Shirk"), "armsLength": (7548, "Arm's Length"),
    "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
DRK_STATUSES = {
    "darkside": "Darkside", "bloodWeapon": 742, "delirium": "Delirium", "blackestNight": "Blackest Night",
    "darkArts": "Dark Arts", "grit": "Grit", "shadowWall": "Shadow Wall", "darkMind": "Dark Mind", "livingDead": "Living Dead",
    "darkMissionary": "Dark Missionary", "saltedEarth": "Salted Earth", "rampart": "Rampart", "reprisal": "Reprisal",
    "armsLength": "Arm's Length", "sprint": "Sprint", "medicated": "Medicated",
}

JOBS = {
    # Sharpcast's Endwalker art is still in the files at 002657, next to the rest of the Black Mage icons.
    "blm": {"actions": ACTIONS, "statuses": BLM_STATUSES, "overrides": {"sharpcast": 2657},
            "tincture": "Grade 8 Tincture of Intelligence", "classjob": 25},
    # Kaiten (Lv52) sits between Meikyo Shisui (003167) and Gyoten (003169); Kaeshi: Higanbana between
    # Tsubame-gaeshi (003180) and Kaeshi: Goken (003182). No current action uses either icon.
    "sam": {"actions": SAM_ACTIONS, "statuses": SAM_STATUSES, "overrides": {"kaiten": 3168, "kaeshiHiganbana": 3181},
            "tincture": "Grade 6 Tincture of Strength", "classjob": 34},
    # Rough Divide (removed in 7.0 for Trajectory) keeps its icon at 003418, between Sonic Break and Continuation.
    "gnb": {"actions": GNB_ACTIONS, "statuses": GNB_STATUSES, "overrides": {"roughDivide": 3418},
            "tincture": "Grade 8 Tincture of Strength", "classjob": 37},
    # Most of Stormblood Summoner's kit was removed in 6.0, and Dawntrail struck those icons through; uncross()
    # recovers them in roughly their old colours.
    # Draw, Redraw, Undraw and Minor Arcana point at the removed-action icon now; their art is still nearby. The
    # Stellar blasts use Stellar Detonation's. The Sects, Royal Road, Spread, Sleeve Draw and Time Dilation are struck
    # through, and uncross() recovers them.
    "ast": {"actions": AST_ACTIONS, "statuses": AST_STATUSES,
            "overrides": {"draw": 3101, "redraw": 3105, "undraw": 3102, "minorArcana": 3106, "stellarBurst": 3144, "stellarExplosion": 3144},
            "uncross": {"diurnalSect": "255,220,120", "nocturnalSect": "140,150,255", "royalRoad": "255,215,130",
                        "spread": "200,210,255", "sleeveDraw": "230,200,255", "timeDilation": "170,210,255",
                        "emptyRoad": "200,190,160", "undrawSpread": "200,210,255", "malefic": "200,170,255",
                        "malefic2": "210,160,255", "combust": "255,200,120", "luminiferousAether": "150,200,255",
                        "disable": "200,190,230", "aero": "140,230,170", "protect": "220,220,160", "stoneskin": "210,190,150"},
            "tincture": "Grade 8 Tincture of Mind", "classjob": 33},
    # Summon and Summon II point at the removed-action icon; Eos's and Selene's Embrace stand in for them.
    "sch": {"actions": SCH_ACTIONS, "statuses": SCH_STATUSES, "overrides": {"summon": 2826, "summon2": 2836},
            "uncross": {"miasma": "150,110,220", "miasma2": "170,120,230", "shadowFlare": "150,85,215", "bane": "190,120,235",
                        "bio2": "130,215,90", "broil": "200,150,255", "ruin": "170,200,255", "rouse": "240,175,80",
                        "eyeForAnEye": "200,200,160", "virus": "150,200,120", "leeches": "180,220,200", "aero": "140,230,170",
                        "protect": "220,220,160", "stoneskin": "210,190,150", "silentDusk": "140,170,240", "feyCaress": "150,200,255", "feyWind": "150,220,255",
                        "embrace": "120,230,170", "whisperingDawn": "150,240,170", "feyCovenant": "150,220,200",
                        "feyIllumination": "170,240,200", "dissipation": "130,210,180"},
            "tincture": "Grade 8 Tincture of Mind", "classjob": 28},
    # Removed in later expansions: struck through (uncross) or pointing at the removed-action icon (overrides).
    "drg": {"actions": DRG_ACTIONS, "statuses": DRG_STATUSES, "overrides": {"spineshatterDive": 2579, "dragonSight": 2587},
            "uncross": {"spineshatterDive": "120,150,255", "bloodOfTheDragon": "230,70,60", "heavyThrust": "230,180,120",
                        "piercingTalon": "200,200,230", "elusiveJump": "120,170,255"},
            "tincture": "Grade 8 Tincture of Strength", "classjob": 22},
    "mnk": {"actions": MNK_ACTIONS, "statuses": MNK_STATUSES,
            "overrides": {"steelPeak": 207, "howlingFist": 2530, "meditation": 218},
            "uncross": {"steelPeak": "240,170,90", "internalRelease": "240,120,80", "fistsOfFire": "255,110,60",
                        "fistsOfEarth": "200,170,110", "fistsOfWind": "140,230,170", "shoulderTackle": "230,170,110",
                        "purification": "160,210,255", "mantra": "150,230,160", "oneIlmPunch": "230,150,90",
                        "armOfTheDestroyer": "240,170,90", "anatman": "180,200,240", "touchOfDeath": "200,90,220", "fracture": "235,140,90",
                        "featherfoot": "150,220,170"},
            "tincture": "Grade 8 Tincture of Strength", "classjob": 20},
    "brd": {"actions": BRD_ACTIONS, "statuses": BRD_STATUSES, "overrides": {},
            "uncross": {"straightShot": "230,200,120", "quickNock": "220,190,140", "repellingShot": "200,220,240",
                        "rainOfDeath": "180,150,230", "pitchPerfect": "240,190,120", "ironJaws": "200,210,170"},
            "tincture": "Grade 8 Tincture of Dexterity", "classjob": 23},
    "mch": {"actions": MCH_ACTIONS, "statuses": MCH_STATUSES, "overrides": {"volleyFire": 3026},
            "uncross": {"splitShot": "230,190,120", "slugShot": "230,170,110", "cleanShot": "230,200,140", "heatedSplitShot": "255,150,80",
                        "heatedSlugShot": "255,140,70", "heatedCleanShot": "255,160,90", "cooldown": "140,200,255",
                        "spreadShot": "220,190,140", "reload": "210,210,170", "quickReload": "210,210,170", "rapidFire": "255,190,110",
                        "hypercharge": "255,140,90", "gaussBarrel": "170,210,255", "barrelStabilizer": "170,210,255",
                        "flamethrower": "255,120,60", "rookAutoturret": "170,190,230", "rookOverdrive": "255,150,90",
                        "rookOverload": "255,150,90", "leadShot": "200,200,210", "grenadoShot": "255,170,90", "heartbreak": "230,110,110",
                        "blank": "230,200,140", "suppressiveFire": "220,190,120", "legGraze": "200,190,150", "footGraze": "200,190,150",
                        "bishopAutoturret": "200,170,230", "turretRetrieval": "170,190,230", "dismantle": "200,200,200", "rendMind": "180,170,230",
                        "hawksEye": "230,200,120", "quellingStrikes": "170,200,230", "bloodForBlood": "230,100,90", "keenFlurry": "200,200,230",
                        "feint": "200,200,220"},
            "tincture": "Grade 8 Tincture of Dexterity", "classjob": 31},
    "rpr": {"actions": RPR_ACTIONS, "statuses": RPR_STATUSES, "overrides": {},
            "tincture": "Grade 4 Gemdraught of Strength", "classjob": 39},
    "sge": {"actions": SGE_ACTIONS, "statuses": SGE_STATUSES, "overrides": {},
            "tincture": "Grade 8 Tincture of Mind", "classjob": 40},
    "whm": {"actions": WHM_ACTIONS, "statuses": WHM_STATUSES, "overrides": {},
            "tincture": "Grade 4 Gemdraught of Mind", "classjob": 24},
    "vpr": {"actions": VPR_ACTIONS, "statuses": VPR_STATUSES, "overrides": {},
            "tincture": "Grade 4 Gemdraught of Dexterity", "classjob": 41},
    "drk": {"actions": DRK_ACTIONS, "statuses": DRK_STATUSES, "overrides": {},
            "tincture": "Grade 4 Tincture of Strength", "classjob": 32},
    "pld": {"actions": PLD_ACTIONS, "statuses": PLD_STATUSES, "overrides": {},
            "tincture": "Grade 4 Gemdraught of Strength", "classjob": 19},
    "nin": {"actions": NIN_ACTIONS, "statuses": NIN_STATUSES, "overrides": {},
            "uncross": {"spinningEdge": "190,210,200", "gustSlash": "160,210,170", "aeolianEdge": "140,220,200", "armorCrush": "160,200,230",
                        "dancingEdge": "230,120,160", "shadowFang": "150,110,210", "mutilate": "200,90,120", "deathBlossom": "220,120,180",
                        "throwingDagger": "200,200,210", "trickAttack": "180,120,230", "sneakAttack": "170,140,220", "mug": "220,180,90",
                        "jugulate": "210,90,90", "dreamWithinADream": "180,130,240", "assassinate": "200,80,100", "duality": "200,150,240",
                        "kassatsu": "230,120,120", "huton": "120,220,170", "hyoton": "130,200,255", "doton": "190,150,90",
                        "suiton": "100,170,255", "katon": "255,130,70", "raiton": "200,170,255", "fumaShuriken": "200,200,220",
                        "kissOfTheWasp": "240,200,80", "kissOfTheViper": "120,200,110", "goad": "220,200,120", "shadewalker": "140,120,200",
                        "smokeScreen": "170,170,190", "internalRelease": "240,170,90", "bloodForBlood": "230,100,90",
                        "invigorate": "120,200,120", "secondWind": "120,220,150", "featherfoot": "150,220,170", "mantra": "240,200,120",
                        "keenFlurry": "200,200,230", "feint": "200,200,220"},
            "tincture": "Draconian Potion of Dexterity", "classjob": 30},
    "war": {"actions": WAR_ACTIONS, "statuses": WAR_STATUSES, "overrides": {},
            "uncross": {k: "235,140,90" for k in ("heavySwing", "skullSunder", "butchersBlock", "maim", "stormsPath", "stormsEye",
                        "overpower", "tomahawk", "fracture", "fellCleave", "decimate", "innerBeast", "steelCyclone", "brutalSwing",
                        "berserk", "defiance", "deliverance", "infuriate", "unchained", "equilibrium", "rawIntuition", "vengeance",
                        "holmgang", "thrillOfBattle", "foresight", "bloodbath", "internalRelease", "awareness", "convalescence")},
            "tincture": "Grade 8 Tincture of Strength", "classjob": 21},
    "smn": {"actions": SMN_ACTIONS, "statuses": SMN_STATUSES, "overrides": {},
            "uncross": {"bio3": "130,215,90", "miasma3": "175,95,215", "bane": "190,120,235", "rouse": "240,175,80",
                        "shadowFlare": "150,85,215", "triBind": "120,165,235", "aetherpact": "120,225,165",
                        "enkindle": "255,175,90", "windBlade": "120,235,150", "shockwave": "170,230,170",
                        "aerialSlash": "110,230,185", "contagion": "160,225,95", "aerialBlast": "100,240,175",
                        "crimsonCyclone": "255,125,65", "burningStrike": "255,145,70", "radiantShield": "255,205,95",
                        "flamingCrush": "255,110,50", "inferno": "255,95,45", "miasma": "150,110,220", "spur": "240,170,80"},
            "tincture": "Grade 8 Tincture of Intelligence", "classjob": 27},
}


# ---------- Excel sheets (EXH/EXD, big-endian) ----------
class Sheet:
    def __init__(self, name):
        self.name = name.lower()
        exh = open(game.game_file(f"exd/{self.name}.exh"), "rb").read()
        assert exh[:4] == b"EXHF", name
        self.fixed, ncol, npage, nlang = struct.unpack_from(">HHHH", exh, 6)
        p = 0x20
        self.cols = [struct.unpack_from(">HH", exh, p + i * 4) for i in range(ncol)]
        p += ncol * 4
        self.pages = [struct.unpack_from(">II", exh, p + i * 8) for i in range(npage)]
        p += npage * 8
        langs = [exh[p + i * 2] for i in range(nlang)]
        self.suffix = "_en" if 2 in langs else ""
        self._rows = None

    def rows(self):
        if self._rows is None:
            self._rows = {}
            for start, _ in self.pages:
                local = game.game_file(f"exd/{self.name}_{start}{self.suffix}.exd")
                if not local:
                    continue
                d = open(local, "rb").read()
                isize = struct.unpack_from(">I", d, 8)[0]
                for i in range(isize // 8):
                    rid, off = struct.unpack_from(">II", d, 0x20 + i * 8)
                    self._rows[rid] = (d, off + 6)
        return self._rows

    def value(self, rid, col):
        d, base = self.rows()[rid]
        typ, off = self.cols[col]
        if typ == 0:
            s = base + self.fixed + struct.unpack_from(">I", d, base + off)[0]
            return d[s:d.index(b"\0", s)].decode("utf-8", "replace")
        fmt = {1: ">?", 2: ">b", 3: ">B", 4: ">h", 5: ">H", 6: ">i", 7: ">I", 9: ">f"}.get(typ)
        if fmt:
            return struct.unpack_from(fmt, d, base + off)[0]
        if 0x19 <= typ <= 0x20:
            return bool(d[base + off] >> (typ - 0x19) & 1)
        return None

    def string_cols(self):
        return [i for i, (t, _) in enumerate(self.cols) if t == 0]

    def int_cols(self):
        return [i for i, (t, _) in enumerate(self.cols) if t in (5, 6, 7)]


def icon_path(icon):
    return f"ui/icon/{icon // 1000 * 1000:06d}/{icon:06d}_hr1.tex"


def name_col(sheet, rid, name):
    for c in sheet.string_cols():
        if sheet.value(rid, c) == name:
            return c
    raise RuntimeError(f"{sheet.name}: row {rid} has no column equal to {name!r}")


def icon_col(sheet, rids, lo=1, hi=250000):
    """The integer column whose values are real icon files for every sample row, and differ between rows."""
    for c in sheet.int_cols():
        vals = [sheet.value(r, c) for r in rids]
        if len(set(vals)) < max(1, len(vals) * 0.6):
            continue
        if all(lo <= v < hi for v in vals) and all(game.exists(*[icon_path(v) for v in vals])):
            return c
    raise RuntimeError(f"{sheet.name}: no icon column found")


def png_data_url(icon):
    local = game.game_file(icon_path(icon))
    if not local:
        raise RuntimeError(f"icon {icon} is missing from the game")
    img = Image.fromarray(game.texture(local))
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return img, "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def is_crossed(img):
    """A struck-through removed-action icon: grey art (little colour outside the red stroke) with a red stroke."""
    import numpy as np
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r - np.maximum(g, b) > 45) & (r > 100)
    sat = (a.max(axis=2) - a.min(axis=2))[~red]
    return red.mean() > 0.03 and float(sat.mean()) < 18


def uncross(img, tint):
    """Dawntrail marks a removed action's icon with a grey copy of its art struck through in red, and the coloured
    art is gone from the files. Take the stroke out (each red pixel takes the mean of its unmarked neighbours),
    stretch the faded grey back to full contrast, and colour it black → tint → white."""
    import numpy as np
    a = np.asarray(img.convert("RGBA")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r - np.maximum(g, b) > 45) & (r > 100)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):                 # grow the mask a pixel to take the edges
        red = red | np.roll(np.roll(red, dy, 0), dx, 1)
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    known = ~red
    for _ in range(64):
        if known.all():
            break
        acc = np.zeros_like(lum); cnt = np.zeros_like(lum)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy or dx:
                    k = np.roll(np.roll(known, dy, 0), dx, 1)
                    acc += np.where(k, np.roll(np.roll(lum, dy, 0), dx, 1), 0); cnt += k
        grow = ~known & (cnt > 0)
        lum[grow] = acc[grow] / cnt[grow]
        known = known | grow
    lo, hi = np.percentile(lum, 2), np.percentile(lum, 98)
    lum = np.clip((lum - lo) / max(1e-3, hi - lo), 0, 1)
    t = np.array([int(c) for c in tint.split(",")], np.float32) / 255
    l3 = lum[..., None]
    rgb = np.where(l3 < 0.5, 2 * l3 * t, t + (2 * l3 - 1) * (1 - t))
    out = np.concatenate([rgb * 255, a[..., 3:4]], axis=2).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main():
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    icons, report = {}, []

    def put(key, icon, tint=None):
        img, url = png_data_url(icon)
        if tint and is_crossed(img):
            img = uncross(img, tint)
            buf = io.BytesIO(); img.save(buf, "PNG", optimize=True)
            url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        icons[key] = url
        img.save(OUT / "icons" / f"{key.replace(':', '_')}.png")
        report.append(f"{key:30s} {icon:06d}  {img.width}x{img.height}")

    action, status, item = Sheet("Action"), Sheet("Status"), Sheet("Item")
    ncol = name_col(action, 141, "Fire")
    srows = status.rows()
    scol = next(c for c in status.string_cols() if any(status.value(r, c) == "Firestarter" for r in srows))
    by_name = {}
    for r in sorted(srows):
        by_name.setdefault(status.value(r, scol), r)        # lowest row = the original PvE status
    stacks_col = None
    for c, (t, _) in enumerate(status.cols):              # MaxStacks: the u8 that is 3 for Triplecast, 0 for Swiftcast
        if t == 3 and status.value(1211, c) == 3 and status.value(167, c) == 0:
            stacks_col = c
            break
    irows = item.rows()
    incol = next(c for c in item.string_cols() if item.value(1, c) == "Gil")
    icol = None
    for job, cfg in JOBS.items():
        acts = cfg["actions"]
        for key, (rid, name) in acts.items():
            got = action.value(rid, ncol)
            if got != name:
                raise RuntimeError(f"Action {rid} is {got!r}, expected {name!r}")
        if icol is None:
            icol = icon_col(action, [r for r, _ in acts.values()])
        for key, (rid, _) in acts.items():
            put(f"{job}:{key}", cfg["overrides"].get(key) or action.value(rid, icol), cfg.get("uncross", {}).get(key))

        sids = {k: (v if isinstance(v, int) else by_name.get(v)) for k, v in cfg["statuses"].items()}
        for k in [k for k, v in sids.items() if v is None]:
            print(f"  no status named {cfg['statuses'][k]!r} ({job}:{k}); the drawn icon stays")
            del sids[k]
        sicol = icon_col(status, list(sids.values()), 10000)
        for key, rid in sids.items():
            base = status.value(rid, sicol)
            put(f"st:{job}:{key}", base)
            stacks = status.value(rid, stacks_col) if stacks_col is not None else 0
            for n in range(1, stacks + 1):                    # stacking statuses carry one icon per stack count
                put(f"st:{job}:{key}:{n}", base + n - 1)

        tid = next((r for r in irows if item.value(r, incol) == cfg["tincture"]), None)
        if tid is None:
            raise RuntimeError(f"no item named {cfg['tincture']!r}")
        potions = [r for r in irows if str(item.value(r, incol)).startswith("Grade 8 Tincture of")][:4]
        put(f"{job}:tincture", item.value(tid, icon_col(item, potions, 20000, 100000)))
        put(f"job:{job}", 62100 + cfg["classjob"])           # job icons: 062100 + ClassJob row

    js = "// Generated by tools/extract_icons.py from your FFXIV install. FINAL FANTASY XIV (c) SQUARE ENIX.\n"
    js += "window.BLM = window.BLM || {};\nBLM.GAME_ICONS = " + json.dumps(icons, indent=0) + ";\n"
    (OUT / "game-icons.js").write_text(js, encoding="utf-8")
    print("\n".join(report))
    print(f"\n{len(icons)} icons, {len(js) / 1024:.0f} KB -> {OUT / 'game-icons.js'}")


if __name__ == "__main__":
    try:
        main()
    finally:
        game.SERVE.close()
