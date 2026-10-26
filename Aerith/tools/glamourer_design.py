"""Glamourer designs that put on the Spring Dress set, give Aerith's green eyes and turn the mod on.

    python -P -E tools/glamourer_design.py   ->  out/Aerith - Glamourer design.json, out/Aerith with her face -
                                                 Glamourer design.json and out/Aerith - Glamourer import code.txt

The outfit design applies only equipment and eye colour (and sets the mod's Face option to your own face). The
face design also turns the Face option on and makes the character a Midlander woman, the only race her face is
built for; everything else about the character stays as it is.
"""
import base64
import datetime
import gzip
import json
import os
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
MOD_NAME = "Aerith Gainsborough (FF7 Remake)"
ITEMS = {"Head": 7539, "Body": 7540, "Hands": 7536, "Legs": 7541, "Feet": 7542}   # Spring Dress set (e0141)
SLOT_ENUM = {"MainHand": 1, "OffHand": 2, "Head": 3, "Body": 4, "Hands": 5, "Legs": 7, "Feet": 8,
             "Ears": 9, "Neck": 10, "Wrists": 11, "RFinger": 12, "LFinger": 14}
NOTHING = {k: 0xFFFFFFFF - 128 - v for k, v in SLOT_ENUM.items()}   # Glamourer's "empty slot" item ids
EYES = (74, 132, 108)   # Aerith's green, a touch brighter than her iris texture so it reads in game
MIDLANDER_WOMAN = {"Race": 1, "Gender": 1, "Clan": 1}   # Glamourer customize values: Hyur, female, Midlander


def item(item_id, apply):
    return {"ItemId": item_id, "Crest": False, "Apply": apply, "ApplyStain": apply, "ApplyCrest": False,
            "Stain": 0, "Stain2": 0}


def v(value):
    return {"Value": value, "Apply": False}


def design(face=False):
    now = datetime.datetime(2026, 10, 21, tzinfo=datetime.timezone.utc).isoformat()
    equipment = {s: item(NOTHING[s], False) for s in ("MainHand", "OffHand", "Ears", "Neck", "Wrists", "RFinger", "LFinger")}
    equipment.update({s: item(i, True) for s, i in ITEMS.items()})
    equipment.update({"Hat": {"Show": True, "Apply": True}, "VieraEars": {"Show": True, "Apply": False},
                      "Visor": {"IsToggled": False, "Apply": False}, "Weapon": {"Show": True, "Apply": False}})
    customize = {"ModelId": 0}
    for k in ("Race", "Gender", "BodyType", "Height", "Clan", "Face", "Hairstyle", "Highlights", "SkinColor",
              "EyeColorRight", "HairColor", "HighlightsColor", "FacialFeature1", "FacialFeature2", "FacialFeature3",
              "FacialFeature4", "FacialFeature5", "FacialFeature6", "FacialFeature7", "LegacyTattoo", "TattooColor",
              "Eyebrows", "EyeColorLeft", "EyeShape", "SmallIris", "Nose", "Jaw", "Mouth", "Lipstick", "LipColor",
              "MuscleMass", "TailShape", "BustSize", "FacePaint", "FacePaintReversed", "FacePaintColor"):
        customize[k] = v(0)
    customize["Wetness"] = {"Value": False, "Apply": False}
    if face:
        customize.update({k: {"Value": val, "Apply": True} for k, val in MIDLANDER_WOMAN.items()})
    eye = {"Red": EYES[0] / 255, "Green": EYES[1] / 255, "Blue": EYES[2] / 255, "Apply": True}
    return {
        "FileVersion": 2,
        "Identifier": str(uuid.uuid5(uuid.NAMESPACE_URL, "ffxiv-mods/aerith/glamourer" + ("/face" if face else ""))),
        "CreationDate": now,
        "LastEdit": now,
        "Name": "Aerith Gainsborough" + (" (her face)" if face else ""),
        "Description": (f"Spring Dress set as Aerith (FF7 Remake) with her green eyes"
                        + (", her face, and a Midlander woman's body (the race her face is built for)" if face else "")
                        + f". Needs the '{MOD_NAME}' Penumbra mod."),
        "ForcedRedraw": False,
        "ResetAdvancedDyes": False,
        "ResetTemporarySettings": False,
        "Color": "",
        "QuickDesign": True,
        "Tags": ["Final Fantasy VII"],
        "WriteProtected": False,
        "Equipment": equipment,
        "Bonus": {"Glasses": {"BonusId": 0, "Apply": False}},
        "Customize": customize,
        "Parameters": {"LeftEye": dict(eye), "RightEye": dict(eye)},
        "Materials": {},
        "Mods": [{"Name": MOD_NAME, "Directory": MOD_NAME, "Enabled": True, "Priority": 0,
                  "Settings": {"Head": ["Aerith's hair"], "Face": ["Aerith's face" if face else "Your own face"]}}],
        "Links": {"Before": [], "After": []},
    }


def share_code(d):
    """Glamourer clipboard format: base64(version byte 6 + gzip(utf-8 json))."""
    raw = json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.b64encode(bytes([6]) + gzip.compress(raw)).decode("ascii")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    outfit, with_face = design(), design(face=True)
    json.dump(outfit, open(os.path.join(OUT, "Aerith - Glamourer design.json"), "w", encoding="utf-8"), indent=2)
    json.dump(with_face, open(os.path.join(OUT, "Aerith with her face - Glamourer design.json"), "w", encoding="utf-8"),
              indent=2)
    with open(os.path.join(OUT, "Aerith - Glamourer import code.txt"), "w", encoding="utf-8") as f:
        f.write("Copy one code below, then in Glamourer's Designs tab press 'Import design from clipboard'.\n\n")
        f.write("Outfit only (your own face):\n" + share_code(outfit) + "\n\n")
        f.write("With her face (also makes the character a Midlander woman):\n" + share_code(with_face) + "\n")
    print("wrote Glamourer designs")
