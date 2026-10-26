"""Glamourer design that puts on the Night of Devilry set with the hat shown and turns the Peni Parker mod on.

    python -P -E tools/glamourer_design.py   ->  out/Peni Parker - Glamourer design.json and out/Peni Parker - Glamourer import code.txt

Only the five gear slots (and showing the hat) apply; race, face and the rest of your appearance stay as they are.
"""
import base64
import datetime
import gzip
import json
import os
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "out")
MOD_NAME = "Peni Parker - Floral Frights (Marvel Rivals)"
ITEMS = {"Head": 43471, "Body": 43472, "Hands": 43473, "Legs": 43474, "Feet": 43475}   # Night of Devilry set (e6191)
SLOT_ENUM = {"MainHand": 1, "OffHand": 2, "Head": 3, "Body": 4, "Hands": 5, "Legs": 7, "Feet": 8,
             "Ears": 9, "Neck": 10, "Wrists": 11, "RFinger": 12, "LFinger": 14}
NOTHING = {k: 0xFFFFFFFF - 128 - v for k, v in SLOT_ENUM.items()}   # Glamourer's "empty slot" item ids


def item(item_id, apply):
    return {"ItemId": item_id, "Crest": False, "Apply": apply, "ApplyStain": apply, "ApplyCrest": False,
            "Stain": 0, "Stain2": 0}


def v(value):
    return {"Value": value, "Apply": False}


def design():
    now = datetime.datetime(2026, 10, 22, tzinfo=datetime.timezone.utc).isoformat()
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
    return {
        "FileVersion": 2,
        "Identifier": str(uuid.uuid5(uuid.NAMESPACE_URL, "ffxiv-mods/peni-parker-floral-frights/glamourer")),
        "CreationDate": now,
        "LastEdit": now,
        "Name": "Peni Parker (Floral Frights)",
        "Description": f"Night of Devilry set as Peni Parker (Floral Frights) from Marvel Rivals. Needs the '{MOD_NAME}' Penumbra mod.",
        "ForcedRedraw": False,
        "ResetAdvancedDyes": False,
        "ResetTemporarySettings": False,
        "Color": "",
        "QuickDesign": True,
        "Tags": ["Peni Parker", "Marvel Rivals"],
        "WriteProtected": False,
        "Equipment": equipment,
        "Bonus": {"Glasses": {"BonusId": 0, "Apply": False}},
        "Customize": customize,
        "Parameters": {},
        "Materials": {},
        "Mods": [{"Name": MOD_NAME, "Directory": MOD_NAME, "Enabled": True, "Priority": 0,
                  "Settings": {"Spider pack": ["With the spider"], "Hide your own face": []}}],
        "Links": {"Before": [], "After": []},
    }


def share_code(d):
    """Glamourer clipboard format: base64(version byte 6 + gzip(utf-8 json))."""
    raw = json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.b64encode(bytes([6]) + gzip.compress(raw)).decode("ascii")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    d = design()
    json.dump(d, open(os.path.join(OUT, "Peni Parker - Glamourer design.json"), "w", encoding="utf-8"), indent=2)
    with open(os.path.join(OUT, "Peni Parker - Glamourer import code.txt"), "w", encoding="utf-8") as f:
        f.write("Copy the code below, then in Glamourer's Designs tab press 'Import design from clipboard'.\n\n")
        f.write(share_code(d) + "\n")
    print("wrote Glamourer design")
