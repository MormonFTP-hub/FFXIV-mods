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

# Sim id -> (sheet row, expected English name). Ids are the PvE rows; names are checked so a wrong id shows up.
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
}
STATUSES = {
    "firestarter": "Firestarter", "thundercloud": "Thundercloud", "sharpcast": "Sharpcast",
    "triplecast": "Triplecast", "swiftcast": "Swiftcast", "leyLines": "Ley Lines",
    "circleOfPower": "Circle of Power", "lucidDreaming": "Lucid Dreaming", "manaward": "Manaward",
    "surecast": "Surecast", "sprint": "Sprint", "medicated": "Medicated", "thunder3": "Thunder III",
    "addle": "Addle",
}
# Dawntrail removed Sharpcast and pointed its row at the generic removed-action icon (000786);
# its Endwalker art is still in the files at 002657, next to the rest of the Black Mage icons.
ICON_OVERRIDES = {"sharpcast": 2657}
TINCTURE = "Grade 8 Tincture of Intelligence"
BLM_JOB = 25


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
        report.append(f"{key:24s} {icon:06d}  {img.width}x{img.height}")

    action = Sheet("Action")
    ncol = name_col(action, 141, "Fire")
    for key, (rid, name) in ACTIONS.items():
        got = action.value(rid, ncol)
        if got != name:
            raise RuntimeError(f"Action {rid} is {got!r}, expected {name!r}")
    icol = icon_col(action, [r for r, _ in ACTIONS.values()])
    for key, (rid, _) in ACTIONS.items():
        put(key, ICON_OVERRIDES.get(key) or action.value(rid, icol))

    status = Sheet("Status")
    rows = status.rows()
    scol = next(c for c in status.string_cols() if any(status.value(r, c) == "Firestarter" for r in rows))
    by_name = {}
    for r in sorted(rows):
        by_name.setdefault(status.value(r, scol), r)        # lowest row = the original PvE status
    sids = {key: by_name[name] for key, name in STATUSES.items()}
    sicol = icon_col(status, list(sids.values()), 10000)
    stacks_col = None
    for c, (t, _) in enumerate(status.cols):              # MaxStacks: the u8 that is 3 for Triplecast, 0 for Swiftcast
        if t == 3 and status.value(sids["triplecast"], c) == 3 and status.value(sids["swiftcast"], c) == 0:
            stacks_col = c
            break
    for key, rid in sids.items():
        base = status.value(rid, sicol)
        put("st:" + key, base)
        stacks = status.value(rid, stacks_col) if stacks_col is not None else 0
        for n in range(1, stacks + 1):                    # stacking statuses carry one icon per stack count
            put(f"st:{key}:{n}", base + n - 1)

    item = Sheet("Item")
    irows = item.rows()
    tid = incol = None
    for c in item.string_cols():
        tid = next((r for r in irows if item.value(r, c) == TINCTURE), None)
        if tid is not None:
            incol = c
            break
    if tid is None:
        raise RuntimeError(f"no item named {TINCTURE!r}")
    potions = [r for r in irows if str(item.value(r, incol)).startswith("Grade 8 Tincture of")][:4]
    put("tincture", item.value(tid, icon_col(item, potions, 20000, 100000)))

    put("job", 62100 + BLM_JOB)                            # job icons: 062100 + ClassJob row

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
