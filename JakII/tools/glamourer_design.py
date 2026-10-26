"""Glamourer design that turns your character into Jak: Hyur Midlander male with face 1 and hairstyle 1, the
Scion Rogue's set on, the head slot empty, and the Jak mod (with his head) enabled.

    python -P -E tools/glamourer_design.py   ->  out/Jak - Glamourer design.json and out/Jak - Glamourer import code.txt

Only race, clan, gender, face and hairstyle are applied from the customisation; everything else stays yours.
"""
import base64
import datetime
import gzip
import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pack import FACE_OPTION, GROUP, HAIR_OPTION, NAME as MOD_NAME  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
ITEMS = {"Body": 15938, "Hands": 15939, "Legs": 15940, "Feet": 15941}   # Scion Rogue's set (e6027)
SLOT_ENUM = {"MainHand": 1, "OffHand": 2, "Head": 3, "Body": 4, "Hands": 5, "Legs": 7, "Feet": 8,
             "Ears": 9, "Neck": 10, "Wrists": 11, "RFinger": 12, "LFinger": 14}
NOTHING = {k: 0xFFFFFFFF - 128 - v for k, v in SLOT_ENUM.items()}   # Glamourer's "empty slot" item ids
CUSTOMIZE = {"Race": 1, "Clan": 1, "Gender": 0, "Face": 1, "Hairstyle": 1}   # Hyur, Midlander, male


def item(item_id, apply):
    return {"ItemId": item_id, "Crest": False, "Apply": apply, "ApplyStain": apply, "ApplyCrest": False,
            "Stain": 0, "Stain2": 0}


def v(value, apply=False):
    return {"Value": value, "Apply": apply}


def design():
    now = datetime.datetime(2026, 10, 21, tzinfo=datetime.timezone.utc).isoformat()
    equipment = {s: item(NOTHING[s], False) for s in ("MainHand", "OffHand", "Ears", "Neck", "Wrists", "RFinger", "LFinger")}
    equipment["Head"] = item(NOTHING["Head"], True)
    equipment.update({s: item(i, True) for s, i in ITEMS.items()})
    equipment.update({"Hat": {"Show": True, "Apply": False}, "VieraEars": {"Show": True, "Apply": False},
                      "Visor": {"IsToggled": False, "Apply": False}, "Weapon": {"Show": True, "Apply": False}})
    customize = {"ModelId": 0}
    for k in ("Race", "Gender", "BodyType", "Height", "Clan", "Face", "Hairstyle", "Highlights", "SkinColor",
              "EyeColorRight", "HairColor", "HighlightsColor", "FacialFeature1", "FacialFeature2", "FacialFeature3",
              "FacialFeature4", "FacialFeature5", "FacialFeature6", "FacialFeature7", "LegacyTattoo", "TattooColor",
              "Eyebrows", "EyeColorLeft", "EyeShape", "SmallIris", "Nose", "Jaw", "Mouth", "Lipstick", "LipColor",
              "MuscleMass", "TailShape", "BustSize", "FacePaint", "FacePaintReversed", "FacePaintColor"):
        customize[k] = v(CUSTOMIZE[k], True) if k in CUSTOMIZE else v(0)
    customize["Wetness"] = {"Value": False, "Apply": False}
    return {
        "FileVersion": 2,
        "Identifier": str(uuid.uuid5(uuid.NAMESPACE_URL, "ffxiv-mods/jak2/glamourer")),
        "CreationDate": now,
        "LastEdit": now,
        "Name": "Jak (Jak II)",
        "Description": f"Hyur Midlander male, face 1, hairstyle 1, Scion Rogue's set, no hat. Needs the '{MOD_NAME}' Penumbra mod.",
        "ForcedRedraw": False,
        "ResetAdvancedDyes": False,
        "ResetTemporarySettings": False,
        "Color": "",
        "QuickDesign": True,
        "Tags": ["Jak and Daxter"],
        "WriteProtected": False,
        "Equipment": equipment,
        "Bonus": {"Glasses": {"BonusId": 0, "Apply": False}},
        "Customize": customize,
        "Parameters": {},
        "Materials": {},
        "Mods": [{"Name": MOD_NAME, "Directory": MOD_NAME, "Enabled": True, "Priority": 0,
                  "Settings": {GROUP: [FACE_OPTION, HAIR_OPTION]}}],
        "Links": {"Before": [], "After": []},
    }


def share_code(d):
    """Glamourer clipboard format: base64(version byte 6 + gzip(utf-8 json))."""
    raw = json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.b64encode(bytes([6]) + gzip.compress(raw)).decode("ascii")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    d = design()
    json.dump(d, open(os.path.join(OUT, "Jak - Glamourer design.json"), "w", encoding="utf-8"), indent=2)
    with open(os.path.join(OUT, "Jak - Glamourer import code.txt"), "w", encoding="utf-8") as f:
        f.write("Copy the code below, then in Glamourer's Designs tab press 'Import design from clipboard'.\n\n")
        f.write(share_code(d) + "\n")
    print("wrote Glamourer design")
