"""Character customization the way the game stores it: colour palettes and racial height scaling from
chara/xls/charamake/human.cmp, and Glamourer designs (clipboard code or JSON) turned into a viewer subject.

human.cmp layout (Penumbra.GameData CmpData): two blocks of shared colours (render, then the swatches the character
creator shows) of 2304 RGBA entries each: eyes 256, hair highlights 256, lips dark 128, face paint dark 128,
features 256, lips light 128, face paint light 128, then unused. Then 32 clan/gender blocks of 1280 entries: skin 256,
hair 256 x (main, sheen), skin swatches 256, hair swatches 256. Then racial scaling: 8 x 10 entries of 14 floats
(male height min/max, male tail, female height, female tail, bust xyz min/max), indexed [(clan-1)>>1][(clan-1)&1].
"""
import base64
import gzip
import json
import struct

import numpy as np

import game
import meta as M

CMP = "chara/xls/charamake/human.cmp"
SHARED, BLOCK = 2304, 1280
CLANS = {1: "Midlander", 2: "Highlander", 3: "Wildwood", 4: "Duskwight", 5: "Plainsfolk", 6: "Dunesfolk",
         7: "Seeker of the Sun", 8: "Keeper of the Moon", 9: "Sea Wolf", 10: "Hellsguard", 11: "Raen", 12: "Xaela",
         13: "Hellion", 14: "The Lost", 15: "Rava", 16: "Veena"}
RACE_CLANS = {"Midlander": (1,), "Highlander": (2,), "Elezen": (3, 4), "Lalafell": (5, 6), "Miqote": (7, 8),
              "Roegadyn": (9, 10), "AuRa": (11, 12), "Hrothgar": (13, 14), "Viera": (15, 16)}
GLAM_RACE = {1: "Hyur", 2: "Elezen", 3: "Lalafell", 4: "Miqote", 5: "Roegadyn", 6: "AuRa", 7: "Hrothgar", 8: "Viera"}
GLAM_SLOT = {"Head": "met", "Body": "top", "Hands": "glv", "Legs": "dwn", "Feet": "sho", "Ears": "ear", "Neck": "nek",
             "Wrists": "wrs", "RFinger": "rir", "LFinger": "ril"}
# palette part -> (offset of render colours, count shown in the character creator)
SHARED_PARTS = {"eye": (0, 192), "highlight": (256, 192)}
DEFAULTS = {"skin": (238, 195, 166), "hair": (90, 58, 34), "highlight": (122, 82, 50), "eye": (90, 128, 166)}

_cmp = None


def _data():
    global _cmp
    if _cmp is None:
        d = open(game.game_file(CMP), "rb").read()
        _cmp = (d, np.frombuffer(d, np.uint8, (2 * SHARED + 32 * BLOCK) * 4).reshape(-1, 4)[:, :3])
    return _cmp


def clans(race_code):
    return RACE_CLANS[M.GENDER_RACE[race_code][1]]


def _part(kind, clan, female):
    """(render colours, swatch colours) of one palette, as uint8 arrays of 192 entries."""
    _, c = _data()
    if kind in SHARED_PARTS:
        off, n = SHARED_PARTS[kind]
        return c[off:off + n], c[SHARED + off:SHARED + off + n]
    base = 2 * SHARED + ((clan - 1) * 2 + int(female)) * BLOCK
    if kind == "skin":
        return c[base:base + 192], c[base + 768:base + 768 + 192]
    if kind == "hair":
        return c[base + 256:base + 256 + 384:2], c[base + 1024:base + 1024 + 192]
    raise ValueError(kind)


def palettes(race_code, clan):
    """Swatches (what the character creator shows) per palette, plus default indices."""
    female = M.GENDER_RACE[race_code][0] == "Female"
    out = {"clans": [{"id": k, "name": CLANS[k]} for k in clans(race_code)]}
    for kind in ("skin", "hair", "highlight", "eye"):
        _, ui = _part(kind, clan, female)
        want = np.array(DEFAULTS[kind], float)
        out[kind] = {"swatches": ["#%02x%02x%02x" % tuple(int(v) for v in x) for x in ui],
                     "default": int(np.argmin(((ui.astype(float) - want) ** 2).sum(1)))}
    return out


def color(kind, clan, female, index):
    """Render colour (0..1 floats) the game passes to the shader for this palette index."""
    render, _ = _part(kind, clan, female)
    return (render[max(0, min(int(index), len(render) - 1))] / 255).round(4).tolist()


FACE_PAINT = "chara/common/texture/decal_face/_decal_{}.tex"


def paint_color(index):
    """Face paint colour (0..1 floats) for the customize index: 0-127 the dark colours, 128-255 the light ones."""
    _, c = _data()
    i = max(0, min(int(index), 255))
    return (c[640 + i] if i < 128 else c[1152 + i - 128]) / 255


# Glamourer's advanced colour parameters -> the viewer's customize keys (the game's g_CustomizeParameter inputs, given
# the way Glamourer shows them: colours before the game squares them)
GLAM_PARAMS = {"SkinDiffuse": "skin", "HairDiffuse": "hair", "HairHighlight": "highlight", "RightEye": "eye",
               "LeftEye": "eyeLeft", "LipDiffuse": "lip", "FeatureColor": "option", "DecalColor": "decal",
               "MuscleTone": "muscle", "LeftLimbalIntensity": "leftW", "RightLimbalIntensity": "rightW",
               "FacePaintUvMultiplier": "paintScale", "FacePaintUvOffset": "paintOffset"}


def glamourer_parameters(params):
    out = {}
    for name, key in GLAM_PARAMS.items():
        v = params.get(name)
        if not isinstance(v, dict) or v.get("Apply", True) is False:
            continue
        if "Red" in v:
            out[key] = [float(v.get(c, 1.0)) for c in ("Red", "Green", "Blue")] + ([float(v["Alpha"])] if "Alpha" in v else [])
        elif "Percentage" in v or "Value" in v:
            out[key] = [float(v.get("Percentage", v.get("Value", 0)))]
    return out


RSP = ("MaleMinSize", "MaleMaxSize", "MaleMinTail", "MaleMaxTail", "FemaleMinSize", "FemaleMaxSize", "FemaleMinTail",
       "FemaleMaxTail", "BustMinX", "BustMinY", "BustMinZ", "BustMaxX", "BustMaxY", "BustMaxZ")


def scaling(clan, rsp=()):
    """The clan's 14 racial scaling floats (Penumbra RspAttribute order), with the mod's Rsp manipulations applied."""
    d, _ = _data()
    idx = clan - 1
    o = (2 * SHARED + 32 * BLOCK) * 4 + ((idx >> 1) * 10 + (idx & 1)) * 56
    f = dict(zip(RSP, struct.unpack_from("<14f", d, o)))
    name = CLANS[clan].replace(" ", "").replace("The", "")
    for m in rsp:
        if str(m.get("SubRace", "")).replace(" ", "") in (name, CLANS[clan].replace(" ", "")) and m.get("Attribute") in f:
            f[m["Attribute"]] = float(m["Entry"])
    return f


def _lerp(lo, hi, t):
    return lo + (hi - lo) * max(0, min(100, float(t))) / 100


def height_scale(clan, female, height, rsp=()):
    """Model scale for the height slider (0..100), with the mod's RSP manipulations applied."""
    f = scaling(clan, rsp)
    g = "Female" if female else "Male"
    return _lerp(f[g + "MinSize"], f[g + "MaxSize"], height)


def bust_scale(clan, female, bust, rsp=()):
    """Local scale of j_mune_l / j_mune_r for the bust slider (0..100): the game lerps BustMin to BustMax per axis.
    Women only (the slider doesn't exist for men)."""
    if not female:
        return None
    f = scaling(clan, rsp)
    return [round(_lerp(f["BustMin" + a], f["BustMax" + a], bust), 4) for a in "XYZ"]


def face_candidates(race_code, clan, face):
    """Face model ids to try for a customize face number: second clans mostly use 101+, the Lost 5-8."""
    out = []
    if clan in (14,):
        out.append(face + 4)
    if clan % 2 == 0 and race_code not in ("c0301", "c0401"):
        out.append(face + 100)
    return out + [face]


def decode_glamourer(text):
    """Glamourer design: JSON, or the clipboard code base64(version byte + gzip(JSON))."""
    text = text.strip()
    if text.startswith("{"):
        return json.loads(text)
    raw = base64.b64decode(text + "=" * (-len(text) % 4))
    for body in (raw[1:], raw):
        try:
            return json.loads(gzip.decompress(body).decode("utf-8"))
        except (OSError, ValueError):
            try:
                return json.loads(body.decode("utf-8"))
            except (UnicodeDecodeError, ValueError):
                continue
    raise ValueError("not a Glamourer design (expected its clipboard code or JSON)")


def from_glamourer(text):
    """A viewer subject (race, clan, face, hair, colours, height, gear) from a Glamourer design."""
    d = decode_glamourer(text)
    c = d.get("Customize") or {}

    def val(k, default=0):
        v = c.get(k)
        return v.get("Value", default) if isinstance(v, dict) else default

    def applies(*keys):
        return all(isinstance(c.get(k), dict) and c[k].get("Apply", True) for k in keys)

    spec = {"subject": "character", "name": d.get("Name", ""), "notes": []}
    if applies("Clan"):       # only what the design applies; the clan sets the race too (Glamourer leaves Race unticked)
        clan, female = int(val("Clan", 1)), int(val("Gender", 0)) == 1
        race = next(r for r, cs in RACE_CLANS.items() if clan in cs)
        spec.update(race=M.RACE_OF[("Female" if female else "Male", race)], clan=clan)
    for key, field in (("face", "Face"), ("hair", "Hairstyle"), ("tail", "TailShape"), ("ear", "TailShape"),
                       ("height", "Height"), ("bust", "BustSize"), ("skinIndex", "SkinColor"), ("hairIndex", "HairColor"),
                       ("eyeIndex", "EyeColorRight")):
        if applies(field):
            spec[key] = int(val(field, 0)) or (1 if key in ("face", "hair", "tail", "ear") else 0)
    if applies("Highlights", "HighlightsColor"):
        spec["highlightIndex"] = int(val("HighlightsColor", 0)) if val("Highlights", False) else None
    if applies(*[f"FacialFeature{i + 1}" for i in range(7)]):
        spec["features"] = sum(1 << i for i in range(7) if val(f"FacialFeature{i + 1}", False))
    if applies("FacePaint"):      # the game binds the face paint as the face model's decal
        spec["facePaint"] = int(val("FacePaint", 0))
        spec["facePaintReversed"] = bool(val("FacePaintReversed", 0)) if applies("FacePaintReversed") else False
    if applies("FacePaintColor"):
        spec["facePaintIndex"] = int(val("FacePaintColor", 0))
    params = glamourer_parameters(d.get("Parameters") or {})
    if params:
        spec["design"] = params
        spec["notes"].append("the design's advanced colours replace the palette colours (" + ", ".join(sorted(params)) + ")")
    items = {it["id"]: it for it in game.items()}
    gear = {}
    eq = d.get("Equipment") or {}
    for gslot, slot in GLAM_SLOT.items():
        e = eq.get(gslot)
        if not isinstance(e, dict) or not e.get("Apply", True):
            continue
        it = items.get(int(e.get("ItemId", 0)))
        # [set, variant, dye 1, dye 2]: the game-shader renderer dyes the colour tables like the game
        gear[slot] = [it["model"] & 0xFFFF, (it["model"] >> 16) & 0xFFFF, int(e.get("Stain") or 0), int(e.get("Stain2") or 0)] if it else None
    hat = eq.get("Hat")
    if isinstance(hat, dict) and hat.get("Apply", True) and hat.get("Show") is False:
        gear["met"] = None
        spec["notes"].append("the design hides the hat, so no head piece is loaded")
    spec["gear"] = gear
    return spec
