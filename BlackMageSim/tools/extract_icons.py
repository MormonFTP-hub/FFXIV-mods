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
}
SMN_STATUSES = {
    "bio3": "Bio III", "miasma3": "Miasma III", "dreadwyrmTrance": "Dreadwyrm Trance", "furtherRuin": "Further Ruin",
    "rouse": "Rouse", "devotion": "Devotion", "shadowFlare": "Shadow Flare", "swiftcast": "Swiftcast",
    "lucidDreaming": "Lucid Dreaming", "addle": "Addle", "surecast": "Surecast", "sprint": "Sprint", "medicated": "Medicated",
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
}
AST_STATUSES = {
    "theBalance": 829, "theBole": 830, "theArrow": 831, "theSpear": 832, "theEwer": 833, "theSpire": 834,
    "enhancedRoyalRoad": 816, "expandedRoyalRoad": 817, "extendedRoyalRoad": 818, "lightspeed": 841, "combust2": 843,
    "earthlyDominance": 1224, "giantDominance": 1248, "diurnalSect": 839, "nocturnalSect": 840, "clericStance": 145,
    "largesse": 1207, "lucidDreaming": "Lucid Dreaming", "swiftcast": "Swiftcast", "surecast": "Surecast",
    "sprint": "Sprint", "medicated": "Medicated",
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
                        "emptyRoad": "200,190,160", "undrawSpread": "200,210,255"},
            "tincture": "Grade 8 Tincture of Mind", "classjob": 33},
    "smn": {"actions": SMN_ACTIONS, "statuses": SMN_STATUSES, "overrides": {},
            "uncross": {"bio3": "130,215,90", "miasma3": "175,95,215", "bane": "190,120,235", "rouse": "240,175,80",
                        "shadowFlare": "150,85,215", "triBind": "120,165,235", "aetherpact": "120,225,165",
                        "enkindle": "255,175,90", "windBlade": "120,235,150", "shockwave": "170,230,170",
                        "aerialSlash": "110,230,185", "contagion": "160,225,95", "aerialBlast": "100,240,175",
                        "crimsonCyclone": "255,125,65", "burningStrike": "255,145,70", "radiantShield": "255,205,95",
                        "flamingCrush": "255,110,50", "inferno": "255,95,45"},
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

        sids = {k: (v if isinstance(v, int) else by_name[v]) for k, v in cfg["statuses"].items()}
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
