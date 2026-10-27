"""Export the in-game models and animations the sim draws, from your FFXIV install.

For each job (see JOB_MODELS):
  - a Hyur Midlander man in that job's Endwalker artifact gear, holding its weapon (and sheath, for Samurai)
  - the game's own animations for him: the weapon's battle stance and run, and for every action the sim uses, the
    cast start / loop / release, weaponskill or ability motion its ActionTimeline names
Plus the housing striking dummies (Thavnairian, Glade, Oasis, Crystarium).

Characters, materials and textures go through PMP Viewer's resolver and material bake (the same path as its WebGL
preview); animations are decoded from the game's .pap files by its Havok reader. Identical textures (the face, skin
and hair every job shares) are stored once. Writes
  BlackMageSim/work/game-models.js   BLM.GAME_MODELS = {...} (loaded by index.html, inlined by the build)
work/ is git-ignored, so Square Enix's data stays out of the repo. Without the file the sim draws its own figures.

Run with the Python that runs PMP Viewer (numpy + Pillow):  python -P -E BlackMageSim/tools/export_models.py
"""
import base64
import gzip
import io
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "PmpViewer" / "server"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import anim                     # noqa: E402  (PmpViewer/server)
import game                     # noqa: E402
import resolve                  # noqa: E402
import shade                    # noqa: E402
import skeleton as S            # noqa: E402
from extract_icons import Sheet, JOBS as ICON_JOBS   # noqa: E402

OUT = ROOT / "work"
RACE = "c0101"
SLOTS = ("met", "top", "glv", "dwn", "sho")

# weapons: (label, creature spec, character bone it hangs from)
JOB_MODELS = {
    "blm": {
        "gear": {s: [778, 1] for s in SLOTS},                              # Archmage's (Endwalker AF)
        "weapons": [("main", {"kind": "weapon", "id": 1001, "body": 99, "variant": 1}, "n_buki_r")],   # Moonward Rod
        "stance": "bt_rod_emp",                                            # two-handed staff
        # PMP Viewer's EQP visibility tables are pre-Dawntrail approximations. With these hand-only gloves they hide
        # the coat's arm section (atr_ude), which leaves the upper arms empty; in game the sleeves show.
        "attrs": {"top": {"atr_ude": True}},
    },
    # Shadowbringers Black Mage: Spaekona's (the ShB artifact gear) and the Edenmorn Rod from Eden's Promise (5.4).
    # Same animations as the Endwalker one, so only the character is new.
    "blm-shb": {
        "actionsFrom": "blm",
        "gear": {s: [684, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1001, "body": 95, "variant": 1}, "n_buki_r")],
        "stance": "bt_rod_emp",
        "attrs": {"top": {"atr_ude": True}},
    },
    # Stormblood Black Mage: Seventh Hell (the SB artifact gear) and the Omega Rod from Alphascape (4.4).
    "blm-sb": {
        "actionsFrom": "blm",
        "gear": {s: [324, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1001, "body": 71, "variant": 1}, "n_buki_r")],
        "stance": "bt_rod_emp",
        "attrs": {"top": {"atr_ude": True}},
    },
    # Stormblood Monk: Seventh Heaven (the 4.x artifact gear) and the Omega Knuckles, a pair (w1601 and w1651).
    "mnk-sb": {
        "actionsFrom": "mnk",
        "gear": {s: [323, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1601, "body": 2, "variant": 1}, "n_buki_r"),
                    ("off", {"kind": "weapon", "id": 1651, "body": 2, "variant": 1}, "n_buki_l")],
        "stance": "bt_2ff_emp",
        "attrs": {},
    },
    # Stormblood Dragoon: Trueblood (the 4.x artifact gear) and the Omega Trident.
    "drg-sb": {
        "actionsFrom": "drg",
        "gear": {s: [321, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 501, "body": 73, "variant": 1}, "n_buki_r")],
        "stance": "bt_2sp_emp",
        "attrs": {},
    },
    # Stormblood Bard: Storyteller's (the 4.x artifact gear), the Omega Bow in the left hand and its quiver at the hip.
    "brd-sb": {
        "actionsFrom": "brd",
        "gear": {s: [322, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 601, "body": 64, "variant": 1}, "n_buki_l"),
                    ("quiver", {"kind": "weapon", "id": 698, "body": 68, "variant": 1}, "j_buki_kosi_r")],
        "stance": "bt_2bw_emp",
        "attrs": {},
    },
    # Stormblood Machinist: Gunner's (the 4.x artifact gear) and Omegafire, with its holster at the hip.
    "mch-sb": {
        "actionsFrom": "mch",
        "gear": {s: [329, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2022, "body": 1, "variant": 1}, "n_buki_r"),
                    ("holster", {"kind": "weapon", "id": 2099, "body": 1, "variant": 1}, "j_buki_kosi_r")],
        "stance": "bt_2gn_emp",
        "attrs": {},
    },
    # Heavensward Warrior: Ravager's (the 3.x artifact gear) and the Alexandrian Metal Axe (Alexander Savage, 3.4).
    "war-hw": {
        "actionsFrom": "war",
        "gear": {s: [162, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 408, "body": 1, "variant": 1}, "n_buki_r")],
        "stance": "bt_2ax_emp",
        "attrs": {},
    },
    # Heavensward Monk: Tantra (the 3.x artifact gear) and the Alexandrian Metal Knuckles (w328 / w378).
    "mnk-hw": {
        "actionsFrom": "mnk",
        "gear": {s: [161, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 328, "body": 1, "variant": 1}, "n_buki_r"),
                    ("off", {"kind": "weapon", "id": 378, "body": 1, "variant": 1}, "n_buki_l")],
        "stance": "bt_2ff_emp",
        "attrs": {},
    },
    # Heavensward Summoner: Caller's (the 3.x artifact gear) and the Alexandrian Metal Grimoire.
    "smn-hw": {
        "actionsFrom": "smn",
        "gear": {s: [167, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1726, "body": 1, "variant": 1}, "n_buki_r")],
        "stance": "bt_2bk_emp",
        "attrs": {},
    },
    # Endwalker Paladin and Warrior: the 6.4 savage set (Ascension of Fending, e0826) with the Sword and Kite Shield of
    # Ascension (w217 b3, w101 b125) and the Bardiche of Ascension (w401 b132).
    "pld-ew": {
        "actionsFrom": "pld",
        "gear": {s: [826, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 217, "body": 3, "variant": 1}, "n_buki_r"),
                    ("shield", {"kind": "weapon", "id": 101, "body": 125, "variant": 1}, "n_buki_tate_l")],
        "stance": "bt_swd_sld",
        "attrs": {},
    },
    "war-ew": {
        "actionsFrom": "war",
        "gear": {s: [826, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 401, "body": 132, "variant": 1}, "n_buki_r")],
        "stance": "bt_2ax_emp",
        "attrs": {},
    },
    # Endwalker Monk: the 6.4 savage set (Ascension of Striking, e0827) and the Knuckles of Ascension (w323 / w373 b46).
    "mnk-ew": {
        "actionsFrom": "mnk",
        "gear": {s: [827, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 323, "body": 46, "variant": 1}, "n_buki_r"),
                    ("off", {"kind": "weapon", "id": 373, "body": 46, "variant": 1}, "n_buki_l")],
        "stance": "bt_clw_clw",
        "attrs": {},
    },
    # Dawntrail Paladin: the 7.4 savage set (Grand Champion's, e0908), the Grand Champion's Falchion (w220 b24) and
    # Kite Shield (w114 b22).
    "pld-dt": {
        "actionsFrom": "pld",
        "gear": {s: [908, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 220, "body": 24, "variant": 1}, "n_buki_r"),
                    ("shield", {"kind": "weapon", "id": 114, "body": 22, "variant": 1}, "n_buki_tate_l")],
        "stance": "bt_swd_sld",
        "attrs": {},
    },
    # Dawntrail Reaper: the 7.4 savage set (Grand Champion's of Maiming, e0908 v2) and the Grand Champion's War Scythe (w2804 b3).
    "rpr-dt": {
        "actionsFrom": "rpr",
        "gear": {s: [908, 2] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2804, "body": 3, "variant": 1}, "n_buki_r")],
        "stance": "bt_2km_emp",
        "attrs": {},
    },
    # Endwalker Sage: the 6.4 savage set (Ascension of Healing, e0828) and the Wings of Ascension nouliths (w2701 b25).
    "sge-ew": {
        "actionsFrom": "sge",
        "gear": {s: [828, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2701, "body": 25, "variant": 1}, "n_buki_r")],
        "stance": "bt_2ff_emp",
        "attrs": {},
    },
    # Dawntrail White Mage: the 7.4 savage set (Grand Champion's of Healing, e0910) and the Grand Champion's Cane (w827 b18).
    "whm-dt": {
        "actionsFrom": "whm",
        "gear": {s: [910, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 827, "body": 18, "variant": 1}, "n_buki_r")],
        "stance": "bt_rod_emp",
        "attrs": {},
    },
    # Dawntrail Viper: the 7.4 savage set (Grand Champion's of Scouting, e0909) and the Grand Champion's Twinfangs
    # (w3101 / w3151 b29).
    "vpr-dt": {
        "actionsFrom": "vpr",
        "gear": {s: [909, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 3101, "body": 29, "variant": 1}, "n_buki_r"),
                    ("off", {"kind": "weapon", "id": 3151, "body": 29, "variant": 1}, "n_buki_l")],
        "stance": "bt_bld_bld",
        "attrs": {},
    },
    # Heavensward Ninja: Iga (the 3.x artifact gear) and the Alexandrian Metal Daggers (w1805 / w1855).
    "nin-hw": {
        "actionsFrom": "nin",
        "gear": {s: [169, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1805, "body": 1, "variant": 1}, "n_buki_r"),
                    ("off", {"kind": "weapon", "id": 1855, "body": 1, "variant": 1}, "n_buki_l")],
        "stance": "bt_dgr_dgr",
        # The dagger stance has only an idle; the fist stance's run keeps the hands free the same way.
        "run": ("bt_2ff_emp/resident/move_a.pap", "cbbm_02f_lp0"),
        "attrs": {},
    },
    # Heavensward Machinist: Machinist's (the 3.x artifact gear) and the Alexandrian Metal Cannon (w2018, holster w2099).
    "mch-hw": {
        "actionsFrom": "mch",
        "gear": {s: [265, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2018, "body": 1, "variant": 1}, "n_buki_r"),
                    ("holster", {"kind": "weapon", "id": 2099, "body": 1, "variant": 1}, "j_buki_kosi_r")],
        "stance": "bt_2gn_emp",
        "attrs": {},
    },
    # Stormblood Scholar: Orator's (the 4.x artifact gear) and the Omega Codex (Alphascape, 4.4).
    "sch-sb": {
        "actionsFrom": "sch",
        "gear": {s: [326, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1701, "body": 71, "variant": 1}, "n_buki_r")],
        "stance": "bt_2bk_emp",
        "attrs": {},
    },
    # Stormblood Astrologian: Constellation (the 4.x artifact gear) and the Omega Torquetum (Alphascape, 4.4).
    "ast-sb": {
        "actionsFrom": "ast",
        "gear": {s: [330, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2101, "body": 62, "variant": 1}, "n_buki_r")],
        "stance": "bt_2gl_emp",
        "attrs": {},
    },
    # Heavensward Astrologian: Welkin (the 3.x artifact gear) and the Alexandrian Metal Meter (w2101 b48).
    "ast-hw": {
        "actionsFrom": "ast",
        "gear": {s: [266, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2101, "body": 48, "variant": 1}, "n_buki_r")],
        "stance": "bt_2gl_emp",
        "attrs": {},
    },
    # Heavensward Scholar: Savant's (the 3.x artifact gear) and the Alexandrian Metal Codex (w1727).
    "sch-hw": {
        "actionsFrom": "sch",
        "gear": {s: [168, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1727, "body": 1, "variant": 1}, "n_buki_r")],
        "stance": "bt_2bk_emp",
        "attrs": {},
    },
    # Stormblood Summoner: Channeler's (the 4.x artifact gear) and the Omega Grimoire (Alphascape, 4.4).
    "smn-sb": {
        "actionsFrom": "smn",
        "gear": {s: [325, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1733, "body": 1, "variant": 1}, "n_buki_r")],
        "stance": "bt_2bk_emp",
        "attrs": {},
    },
    "sam": {
        "gear": {s: [785, 1] for s in SLOTS},                              # Sakonji (Endwalker AF)
        "weapons": [("main", {"kind": "weapon", "id": 2201, "body": 63, "variant": 1}, "n_buki_r"),   # Classical Samurai Blade (6.1)
                    ("sheath", {"kind": "weapon", "id": 2251, "body": 81, "variant": 1}, "j_buki_kosi_l")],
        "stance": "bt_2kt_emp",                                            # katana
        "attrs": {},
    },
    # Shadowbringers Gunbreaker: Bodyguard's (the ShB artifact gear) and the Edenmorn Gunblade from Eden's Promise.
    # Stormblood Samurai: Myochin (the SB artifact gear) and the Omega Samurai Blade from Alphascape (4.4), with its sheath.
    "sam-sb": {
        "actionsFrom": "sam",
        "gear": {s: [377, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2201, "body": 34, "variant": 1}, "n_buki_r"),
                    ("sheath", {"kind": "weapon", "id": 2251, "body": 48, "variant": 1}, "j_buki_kosi_l")],
        "stance": "bt_2kt_emp",
        "attrs": {},
    },
    # Shadowbringers Paladin, Warrior and Dark Knight: their artifact gear (Chevalier's e0527, Boii e0529, Bale e0537) and
    # the Edenmorn weapons from Eden's Promise (5.4): Bastard Sword w201 b135 and Scutum w101 b99, Battleaxe w401 b108,
    # Zweihander w1501 b101.
    "pld-shb": {
        "actionsFrom": "pld",
        "gear": {s: [527, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 201, "body": 135, "variant": 1}, "n_buki_r"),
                    ("shield", {"kind": "weapon", "id": 101, "body": 99, "variant": 1}, "n_buki_tate_l")],
        "stance": "bt_swd_sld",
        "attrs": {},
    },
    "war-shb": {
        "actionsFrom": "war",
        "gear": {s: [529, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 401, "body": 108, "variant": 1}, "n_buki_r")],
        "stance": "bt_2ax_emp",
        "attrs": {},
    },
    "drk-shb": {
        "actionsFrom": "drk",
        "gear": {s: [537, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1501, "body": 101, "variant": 1}, "n_buki_r")],
        "stance": "bt_2sw_emp",
        "attrs": {},
    },
    # Shadowbringers Samurai, Dragoon and Ninja: their artifact gear (Kasuga e0540, Pteroslaver e0530, Hattori e0536) and
    # the Edenmorn weapons from Eden's Promise: Samurai Blade w2201 b62 with its sheath w2251 b80, Halberd w501 b99,
    # Main Gauches w1801 / w1851 b101.
    "sam-shb": {
        "actionsFrom": "sam",
        "gear": {s: [540, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2201, "body": 62, "variant": 1}, "n_buki_r"),
                    ("sheath", {"kind": "weapon", "id": 2251, "body": 80, "variant": 1}, "j_buki_kosi_l")],
        "stance": "bt_2kt_emp",
        "attrs": {},
    },
    "drg-shb": {
        "actionsFrom": "drg",
        "gear": {s: [530, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 501, "body": 99, "variant": 1}, "n_buki_r")],
        "stance": "bt_2sp_emp",
        "attrs": {},
    },
    "nin-shb": {
        "actionsFrom": "nin",
        "gear": {s: [536, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 1801, "body": 101, "variant": 1}, "n_buki_r"),
                    ("off", {"kind": "weapon", "id": 1851, "body": 101, "variant": 1}, "n_buki_l")],
        "stance": "bt_dgr_dgr",
        "run": ("bt_2ff_emp/resident/move_a.pap", "cbbm_02f_lp0"),
        "attrs": {},
    },
    # Shadowbringers White Mage, Machinist, Red Mage and Dancer: their artifact gear (Ebers e0532, Gunslinger's e0538,
    # Estoqueur's e0541, Dancer's e0543) and the Edenmorn weapons: Cane w821 b2, Pistol w2001 b76 with its holster,
    # Rapier w2301 b73 with its focus w2351 b61, Chakrams w2601 / w2651 b39.
    "whm-shb": {
        "actionsFrom": "whm",
        "gear": {s: [532, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 821, "body": 2, "variant": 1}, "n_buki_r")],
        "stance": "bt_rod_emp",
        "attrs": {},
    },
    "mch-shb": {
        "actionsFrom": "mch",
        "gear": {s: [538, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2001, "body": 76, "variant": 1}, "n_buki_r"),
                    ("holster", {"kind": "weapon", "id": 2099, "body": 1, "variant": 1}, "j_buki_kosi_r")],
        "stance": "bt_2gn_emp",
        "attrs": {},
    },
    "rdm-shb": {
        "actionsFrom": "rdm",
        "gear": {s: [541, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2301, "body": 73, "variant": 1}, "n_buki_r"),
                    ("focus", {"kind": "weapon", "id": 2351, "body": 61, "variant": 1}, "n_buki_l")],
        "stance": "bt_2rp_emp",
        "attrs": {},
    },
    "dnc-shb": {
        "actionsFrom": "dnc",
        "gear": {s: [543, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2601, "body": 39, "variant": 1}, "n_buki_r"),
                    ("off", {"kind": "weapon", "id": 2651, "body": 39, "variant": 1}, "n_buki_l")],
        "stance": "bt_chk_chk",
        "attrs": {},
    },
    "gnb-shb": {
        "actionsFrom": "gnb",
        "gear": {s: [542, 1] for s in SLOTS},
        "weapons": [("main", {"kind": "weapon", "id": 2501, "body": 41, "variant": 1}, "n_buki_r")],
        "stance": "bt_2gb_emp",
        "attrs": {},
    },
    "gnb": {
        "gear": {s: [787, 1] for s in SLOTS},                              # Bastion's (Endwalker AF)
        "weapons": [("main", {"kind": "weapon", "id": 2501, "body": 37, "variant": 2}, "n_buki_r")],   # Diadochos Gunblade (6.4)
        "stance": "bt_2gb_emp",                                            # gunblade
        "attrs": {},
    },
}
DUMMIES = {"thavnair": ("Thavnairian", 236), "glade": ("Glade", 46), "oasis": ("Oasis", 45),
           "crystarium": ("Crystarium", 193)}
COLOR_MAX, NORMAL_MAX = 512, 256
ANIM_DIR = f"chara/human/{RACE}/animation/a0001/"


# ---------- packing ----------
class Pack:
    """Arrays laid end to end in one buffer; each recorded as [type, byte offset, length]."""
    def __init__(self):
        self.buf = bytearray()

    def put(self, a, kind):
        a = np.ascontiguousarray(a)
        while len(self.buf) % 4:
            self.buf.append(0)
        off = len(self.buf)
        self.buf.extend(a.tobytes())
        return [kind, off, int(a.size)]

    def b64(self):
        """Gzipped (the page inflates it with DecompressionStream): about 40% smaller, which keeps the shared
        single-file build under Discord's 10 MB."""
        return base64.b64encode(gzip.compress(bytes(self.buf), 9, mtime=0)).decode()


TEXTURES, _tex_index = [], {}


def texture(name, limit, keep_alpha):
    """Lossy WebP (with alpha where the material uses it), stored once however many materials use it."""
    img = Image.open(os.path.join(shade.BAKED, name))
    img.thumbnail((limit, limit), Image.LANCZOS)
    alpha = keep_alpha and img.mode == "RGBA" and np.asarray(img)[..., 3].min() < 250
    img = img.convert("RGBA" if alpha else "RGB")
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=82, alpha_quality=90, method=6)
    url = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    if url not in _tex_index:
        _tex_index[url] = len(TEXTURES)
        TEXTURES.append(url)
    return _tex_index[url]


def material_out(mat, opaque=False):
    """opaque: background (bg.shpk) textures keep other data in alpha, so it isn't coverage there."""
    if not mat or mat.get("missing") or mat.get("visible") is False or not mat.get("color"):
        return None
    alpha = bool(mat.get("alphaUsed")) and not opaque
    return {"color": texture(mat["color"], COLOR_MAX, alpha),
            "normal": texture(mat["normal"], NORMAL_MAX, False) if mat.get("normal") else None,
            "alpha": alpha,
            "alphaTest": float(mat.get("alphaTest") or 0) if alpha else 0,
            "transparent": bool(mat.get("transparent")) and alpha,
            "doubleSided": bool(mat.get("doubleSided"))}


def mesh_out(pack, pos, nrm, uv, idx, material, bones=None, weights=None):
    """Keep only the vertices the index buffer uses; four strongest bone influences per vertex."""
    used, remap = np.unique(idx, return_inverse=True)
    out = {"material": material, "count": int(len(used)),
           "pos": pack.put(pos[used].astype("<f4"), "f32"),
           "nrm": pack.put(np.clip(np.round(nrm[used] * 32767), -32767, 32767).astype("<i2"), "i16"),
           "uv": pack.put(uv[used, :2].astype("<f4"), "f32")}
    idx = remap.astype(np.uint32)
    out["idx"] = pack.put(idx.astype("<u2") if len(used) < 65536 else idx.astype("<u4"),
                          "u16" if len(used) < 65536 else "u32")
    if bones is not None:
        b, w = bones[used], weights[used]
        order = np.argsort(-w, axis=1)[:, :4]
        b4 = np.take_along_axis(b, order, 1)
        w4 = np.take_along_axis(w, order, 1)
        w4[b4 < 0] = 0
        b4[b4 < 0] = 0
        s = w4.sum(1, keepdims=True)
        w4 = np.where(s > 0, w4 / np.maximum(s, 1e-9), np.array([1, 0, 0, 0], np.float32))
        out["skinIndex"] = pack.put(b4.astype("<u2"), "u16")
        out["skinWeight"] = pack.put(np.round(w4 * 255).astype(np.uint8), "u8")
    return out


# ---------- characters ----------
def visible_triangles(m, me, blob):
    """The model's index buffer with shape keys applied and hidden submeshes (attributes) dropped."""
    idx = np.frombuffer(blob, np.uint32, me["idx"][1], me["idx"][0]).copy()
    for s in me["shapes"]:
        if s["name"] in (m.get("shapesOn") or []):
            v = np.frombuffer(blob, np.uint32, s["values"][1], s["values"][0]).reshape(-1, 2)
            idx[v[:, 0]] = v[:, 1]
    keep = np.ones(len(idx) // 3, bool)
    for sub in me["submeshes"]:
        if any((m["attrs"].get(a) or {}).get("show") is False for a in sub["attrs"]):
            keep[sub["start"] // 3:(sub["start"] + sub["count"]) // 3] = False
    return idx.reshape(-1, 3)[keep].reshape(-1)


def export_character(pack, job, cfg):
    spec = {"subject": "character", "race": RACE, "face": 1, "hair": 1, "gear": cfg["gear"], "collection": False}
    sc, blob = resolve.character(None, spec)
    sk = sc["skeleton"]
    mats_in = sc["materials"]
    mat_index, materials, meshes = {}, [], []
    verts = 0
    for m in sc["models"]:
        if m["hidden"]:
            continue
        for a, show in cfg["attrs"].get(m["slot"], {}).items():
            m["attrs"].setdefault(a, {})["show"] = show
        nb = len(m["bones"])
        gidx = np.array(m["bones"] + [-1], np.int64)
        deform = [np.array(d).reshape(4, 4).T for d in m["deform"]] if m.get("deform") else None
        for me in m["meshes"]:
            mi = me["material"]
            if mi < 0:
                continue
            if mi not in mat_index:
                mo = material_out(mats_in[mi])
                mat_index[mi] = len(materials) if mo else -1
                if mo:
                    materials.append(mo)
            if mat_index[mi] < 0:
                continue
            idx = visible_triangles(m, me, blob)
            if not len(idx):
                continue
            n = me["vertexCount"]
            arr = lambda r, dt, w: np.frombuffer(blob, dt, r[1], r[0]).reshape(n, w).astype(np.float64 if dt == np.float32 else dt)
            pos, nrm, uv = arr(me["pos"], np.float32, 3), arr(me["nrm"], np.float32, 3), arr(me["uv"], np.float32, 4)
            bi = np.frombuffer(blob, np.uint16, me["bi"][1], me["bi"][0]).reshape(n, 8).astype(np.int64)
            bw = np.frombuffer(blob, np.float32, me["bw"][1], me["bw"][0]).reshape(n, 8).astype(np.float64)
            bi = np.minimum(bi, nb)
            if deform is not None:      # another race's model reshaped for this one: bake the deformer in
                D = np.array(deform + [np.eye(4)])
                Dv = np.einsum("vk,vkij->vij", bw, D[bi])
                wsum = bw.sum(1)
                ok = wsum > 0
                Dv[ok] /= wsum[ok, None, None]
                Dv[~ok] = np.eye(4)
                pos = np.einsum("vij,vj->vi", Dv[:, :3, :3], pos) + Dv[:, :3, 3]
                nrm = np.einsum("vij,vj->vi", Dv[:, :3, :3], nrm)
            nrm = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
            gb = gidx[bi]
            meshes.append(mesh_out(pack, pos, nrm, uv, idx, mat_index[mi], gb, bw.astype(np.float32)))
            verts += meshes[-1]["count"]
    print(f"{job}: {len(meshes)} meshes, {verts} vertices, {len(materials)} materials, {len(sk['names'])} bones")
    return {"skeleton": {"names": sk["names"], "parents": sk["parents"], "world": sk["world"]},
            "meshes": meshes, "materials": materials}


def export_rigid(pack, sc, blob, label, opaque=False):
    mats, mat_index, meshes = [], {}, []
    for m in sc["models"]:
        for me in m["meshes"]:
            mi = me["material"]
            if mi < 0:
                continue
            if mi not in mat_index:
                mo = material_out(sc["materials"][mi], opaque)
                mat_index[mi] = len(mats) if mo else -1
                if mo:
                    mats.append(mo)
            if mat_index[mi] < 0:
                continue
            n = me["vertexCount"]
            pos = np.frombuffer(blob, np.float32, n * 3, me["pos"][0]).reshape(n, 3)
            nrm = np.frombuffer(blob, np.float32, n * 3, me["nrm"][0]).reshape(n, 3)
            uv = np.frombuffer(blob, np.float32, n * 4, me["uv"][0]).reshape(n, 4)
            idx = visible_triangles(m, me, blob)
            meshes.append(mesh_out(pack, pos, nrm, uv, idx, mat_index[mi]))
    print(f"  {label}: {len(meshes)} meshes, {sum(x['count'] for x in meshes)} vertices")
    return meshes, mats


# An off-hand can use its main hand's material (the Alexandrian Metal Daggers' w1855 names /mt_w1805b0001_a.mtrl),
# which lives in that weapon's folder, not the off-hand's.
_material_path = resolve.nonhuman_material_path


def _weapon_material_path(name, folder, material_id):
    m = re.match(r"/?mt_w(\d{4})b(\d{4})_", name)
    if m and f"/w{m.group(1)}/" not in folder:
        folder = f"chara/weapon/w{m.group(1)}/obj/body/b{m.group(2)}"
    return _material_path(name, folder, material_id)


resolve.nonhuman_material_path = _weapon_material_path


def export_weapon(pack, label, spec, bone):
    sc, blob = resolve.creature(None, spec)
    meshes, mats = export_rigid(pack, sc, blob, label)
    pts = np.concatenate([np.frombuffer(blob, np.float32, me["pos"][1], me["pos"][0]).reshape(-1, 3)
                          for m in sc["models"] for me in m["meshes"]])
    tip = pts[np.argmax(np.linalg.norm(pts, axis=1))]
    return {"label": label, "meshes": meshes, "materials": mats, "bone": bone, "tip": tip.round(4).tolist()}


def export_dummy(pack, key):
    """A housing striking dummy: a background model, drawn rigid."""
    gp = f"bgcommon/hou/outdoor/general/{key:04d}/bgparts/gar_b0_m{key:04d}.mdl"
    mdl = game.model(game.game_file(gp))
    sc = {"models": [{"meshes": [], "attrs": {}}], "materials": []}
    blob = bytearray()
    for name in mdl["materials"]:
        local = game.game_file(name.lstrip("/"))
        if not local:
            sc["materials"].append(None)
            continue
        mt = game.material(local)
        texs = {i: game.game_file(t["path"]) for i, t in enumerate(mt["textures"])}
        sc["materials"].append(shade.bake(mt, texs, {}, max_size=COLOR_MAX))

    def put(a):
        a = np.ascontiguousarray(a)
        off = len(blob)
        blob.extend(a.tobytes())
        return [off, int(a.size)]
    for me in mdl["meshes"]:
        mi = mdl["materials"].index(me["material"]) if me["material"] in mdl["materials"] else -1
        sc["models"][0]["meshes"].append({"material": mi, "vertexCount": me["vertexCount"],
                                          "pos": put(me["pos"].astype(np.float32)), "nrm": put(me["nrm"].astype(np.float32)),
                                          "uv": put(me["uv"].astype(np.float32)), "idx": put(me["idx"].astype(np.uint32)),
                                          "shapes": [], "submeshes": []})
    meshes, mats = export_rigid(pack, sc, bytes(blob), f"dummy m{key:04d}", opaque=True)
    pts = np.concatenate([me["pos"] for me in mdl["meshes"]])
    return {"meshes": meshes, "materials": mats, "height": float(pts[:, 1].max())}


# ---------- animations ----------
_paps = {}


def pap(path):
    if path not in _paps:
        local = game.game_file(path)
        _paps[path] = anim._pap(local) if local else None
    return _paps[path]


def find_anim(name, extra=()):
    """The .pap holding an animation by name: the action's own file first, then the shared battle pack."""
    for p in list(extra) + [ANIM_DIR + "bt_common/resident/action.pap"]:
        got = pap(p)
        if got and name in got[0]:
            return p
    return None


def anim_out(pack, path, name, base_names):
    names, hav, cont = pap(path)
    binding = cont["bindings"][hav[names.index(name)]]
    a = binding["animation"]
    frames = anim._decode(a)                                # (F, T, 10): translation, quaternion xyzw, scale
    fps = 1 / a["frameDuration"] if a.get("frameDuration") else 30
    tracks = [base_names[i] for i in binding["transformTrackToBoneIndices"]]
    F, T, _ = frames.shape
    t, q = frames[..., 0:3], frames[..., 3:7]
    tscale = max(float(np.abs(t).max()), 1e-6) / 32767
    # Most bones only rotate, so position and rotation are each stored once when they don't change.
    t_const = np.abs(t - t[0:1]).max(axis=0).max(axis=1) < 1e-4
    q_const = np.abs(q - q[0:1]).max(axis=0).max(axis=1) < 1e-4
    # A rotation and its negative are the same, so keep w >= 0 and store only x, y, z (the page rebuilds w).
    q = q * np.where(q[..., 3:4] < 0, -1, 1)
    chunks = []
    for k in range(T):
        chunks.append(np.round(t[0:1 if t_const[k] else F, k] / tscale).astype("<i2").reshape(-1))
        chunks.append(np.round(q[0:1 if q_const[k] else F, k, 0:3] * 32767).astype("<i2").reshape(-1))
    data = np.concatenate(chunks)
    return {"name": name, "fps": float(fps), "frames": int(F), "tracks": tracks,
            "tConst": t_const.astype(int).tolist(), "qConst": q_const.astype(int).tolist(),
            "tScale": tscale, "data": pack.put(data, "i16"), "seconds": round(F / fps, 3)}


def tmb_anim(key):
    """The body animation a timeline (.tmb) plays: its first cb* name."""
    local = game.game_file(f"chara/action/{key}.tmb")
    if not local:
        return None
    names = re.findall(rb"cb[a-z]{2}_[a-z0-9_]+", open(local, "rb").read())
    return names[0].decode() if names else None


_seen = {}      # animations shared between jobs (the item motion, role actions) are stored once


def export_anims(pack, job, cfg):
    base = [n for n, _, _ in S.load_sklb(game.game_file(f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb"))]
    stance = cfg["stance"]
    out = {"basic": {}, "actions": {}}
    basic = {"idle": (stance + "/resident/idle.pap", "cbbm_id0"),
             "run": cfg.get("run") or (stance + "/resident/move_a.pap", "cbbm_02f_lp0"),
             "item": ("bt_common/resident/action.pap", "cbbm_itm_1")}
    seen = _seen
    for k, (rel, name) in basic.items():
        key = rel + ":" + name
        out["basic"][k] = seen.get(key) or anim_out(pack, ANIM_DIR + rel, name, base)
        seen[key] = out["basic"][k]

    action, timeline, cast = Sheet("Action"), Sheet("ActionTimeline"), Sheet("ActionCastTimeline")
    key_col = timeline.string_cols()[0]
    for sim_id, (row, _) in ICON_JOBS[cfg.get("actionsFrom", job)]["actions"].items():
        entry = {}
        end_key = timeline.value(action.value(row, 7), key_col) if action.value(row, 7) > 0 else ""
        start_row = action.value(row, 5)
        start_key = timeline.value(cast.value(start_row, 0), key_col) if start_row > 0 else ""
        if start_key:
            first = tmb_anim(start_key)
            if first and first.endswith("_1"):
                loop = first[:-2] + "_2lp"
                for part, nm in (("start", first), ("loop", loop)):
                    p = find_anim(nm)
                    if p:
                        entry[part] = seen.get(nm) or anim_out(pack, p, nm, base)
                        seen[nm] = entry[part]
        if end_key:
            nm = tmb_anim(end_key)
            if nm:
                p = find_anim(nm, [ANIM_DIR + f"bt_common/{end_key}.pap", ANIM_DIR + f"{stance}/{end_key}.pap"])
                if p:
                    entry["release"] = seen.get(nm) or anim_out(pack, p, nm, base)
                    seen[nm] = entry["release"]
        if entry:
            out["actions"][sim_id] = entry
        got = ", ".join(k + ":" + v["name"] for k, v in entry.items()) or "none"
        print(f"  {sim_id:18s} start={start_key or '-':28s} end={end_key or '-':30s} -> {got}")
    return out


def main():
    OUT.mkdir(exist_ok=True)
    pack = Pack()
    data = {"version": 2, "race": RACE, "jobs": {}}
    for job, cfg in JOB_MODELS.items():
        ch = export_character(pack, job, cfg)
        ch["weapons"] = [export_weapon(pack, label, spec, bone) for label, spec, bone in cfg["weapons"]]
        ch["anims"] = export_anims(pack, job, cfg)
        data["jobs"][job] = ch
    data["dummies"] = {k: dict(export_dummy(pack, mid), label=label) for k, (label, mid) in DUMMIES.items()}
    data["textures"] = TEXTURES
    data["bin"] = pack.b64()
    data["binEncoding"] = "gzip"
    js = ("// Generated by tools/export_models.py from your FFXIV install. FINAL FANTASY XIV (c) SQUARE ENIX.\n"
          "window.BLM = window.BLM || {};\nBLM.GAME_MODELS = " + json.dumps(data, separators=(",", ":")) + ";\n")
    (OUT / "game-models.js").write_text(js, encoding="utf-8")
    tex = sum(len(t) for t in TEXTURES)
    print(f"\nbinary {len(pack.buf) / 1048576:.1f} MB, {len(TEXTURES)} textures {tex / 1048576:.1f} MB, "
          f"file {len(js) / 1048576:.1f} MB -> {OUT / 'game-models.js'}")


if __name__ == "__main__":
    try:
        main()
    finally:
        game.SERVE.close()
