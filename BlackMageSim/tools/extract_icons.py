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
}
BLM_STATUSES = {
    "firestarter": "Firestarter", "thundercloud": "Thundercloud", "sharpcast": "Sharpcast",
    "triplecast": "Triplecast", "swiftcast": "Swiftcast", "leyLines": "Ley Lines",
    "circleOfPower": "Circle of Power", "lucidDreaming": "Lucid Dreaming", "manaward": "Manaward",
    "surecast": "Surecast", "sprint": "Sprint", "medicated": "Medicated", "thunder3": "Thunder III",
    "addle": "Addle", "enochian": "Enochian",
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
    "sprint": (3, "Sprint"), "auto": (7, "attack"),
}
# Dawntrail renamed some of these, so they go by row (1298 Fugetsu, 1299 Fuka).
SAM_STATUSES = {
    "fugetsu": 1298, "fuka": 1299, "kaiten": 1229, "meikyoShisui": 1233, "enhancedEnpi": 1236, "higanbana": 1228,
    "ogiNamikiriReady": 2959, "thirdEye": 1232, "meditate": 1231, "trueNorth": 1250, "bloodbath": 84, "feint": 1195,
    "armsLength": 1209, "sprint": "Sprint", "medicated": "Medicated",
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
}
GNB_STATUSES = {
    "noMercy": "No Mercy", "brutalShell": "Brutal Shell", "royalGuard": "Royal Guard", "camouflage": "Camouflage",
    "nebula": "Nebula", "aurora": "Aurora", "superbolide": "Superbolide", "sonicBreak": "Sonic Break",
    "bowShock": "Bow Shock", "readyToRip": "Ready to Rip", "readyToTear": "Ready to Tear",
    "readyToGouge": "Ready to Gouge", "readyToBlast": "Ready to Blast", "heartOfCorundum": "Heart of Corundum",
    "heartOfLight": "Heart of Light", "heartOfStone": "Heart of Stone", "rampart": "Rampart", "reprisal": "Reprisal", "armsLength": "Arm's Length",
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


def main():
    (OUT / "icons").mkdir(parents=True, exist_ok=True)
    icons, report = {}, []

    def put(key, icon):
        img, url = png_data_url(icon)
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
            put(f"{job}:{key}", cfg["overrides"].get(key) or action.value(rid, icol))

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
