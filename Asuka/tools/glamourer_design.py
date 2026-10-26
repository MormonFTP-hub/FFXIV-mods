"""Glamourer designs for the Magitek set: the full-body Asuka (hat shown, her mod on), and the plugsuit alone (your own
head slot, the outfit mod on). Each turns the other mod off.

    python -P -E tools/glamourer_design.py   ->  out/Asuka - Glamourer design.json and
                                                 out/Asuka - Glamourer import code.txt

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
MOD_NAME = "Asuka Langley (Evangelion)"
OUTFIT_MOD = "Asuka Plugsuit (Evangelion)"         # the plugsuit alone (tools/pack_outfit.py): your own head
ITEMS = {"Head": 39303, "Body": 39304, "Hands": 39305, "Legs": 39306, "Feet": 39307}   # Magitek set (e6164)
SLOT_ENUM = {"MainHand": 1, "OffHand": 2, "Head": 3, "Body": 4, "Hands": 5, "Legs": 7, "Feet": 8,
             "Ears": 9, "Neck": 10, "Wrists": 11, "RFinger": 12, "LFinger": 14}
NOTHING = {k: 0xFFFFFFFF - 128 - v for k, v in SLOT_ENUM.items()}   # Glamourer's "empty slot" item ids


def item(item_id, apply):
    return {"ItemId": item_id, "Crest": False, "Apply": apply, "ApplyStain": apply, "ApplyCrest": False,
            "Stain": 0, "Stain2": 0}


def v(value):
    return {"Value": value, "Apply": False}


def design(outfit=False):
    """The full-body costume, or with outfit=True the plugsuit alone: the four suit slots, your own head slot, hat
    visibility and appearance untouched. Each turns its own mod on and the other off (they share the items)."""
    now = datetime.datetime(2026, 10, 22 if not outfit else 24, tzinfo=datetime.timezone.utc).isoformat()
    equipment = {s: item(NOTHING[s], False) for s in ("MainHand", "OffHand", "Ears", "Neck", "Wrists", "RFinger", "LFinger")}
    equipment.update({s: item(i, not (outfit and s == "Head")) for s, i in ITEMS.items()})
    equipment.update({"Hat": {"Show": True, "Apply": not outfit}, "VieraEars": {"Show": True, "Apply": False},
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
        "Identifier": str(uuid.uuid5(uuid.NAMESPACE_URL, "ffxiv-mods/asuka-evangelion/glamourer"
                                     + ("/outfit" if outfit else ""))),
        "CreationDate": now,
        "LastEdit": now,
        "Name": OUTFIT_MOD if outfit else MOD_NAME,
        "Description": (f"Magitek set as Asuka's red plugsuit on your own character. Needs the '{OUTFIT_MOD}' Penumbra mod."
                        if outfit else f"Magitek set as Asuka's red plugsuit. Needs the '{MOD_NAME}' Penumbra mod."),
        "ForcedRedraw": False,
        "ResetAdvancedDyes": False,
        "ResetTemporarySettings": False,
        "Color": "",
        "QuickDesign": True,
        "Tags": ["Asuka", "Evangelion", "Plugsuit"],
        "WriteProtected": False,
        "Equipment": equipment,
        "Bonus": {"Glasses": {"BonusId": 0, "Apply": False}},
        "Customize": customize,
        "Parameters": {},
        "Materials": {},
        "Mods": [{"Name": MOD_NAME, "Directory": MOD_NAME, "Enabled": not outfit, "Priority": 0,
                  "Settings": {"Hide your own face": []}},
                 {"Name": OUTFIT_MOD, "Directory": OUTFIT_MOD, "Enabled": outfit, "Priority": 0, "Settings": {}}],
        "Links": {"Before": [], "After": []},
    }


def share_code(d):
    """Glamourer clipboard format: base64(version byte 6 + gzip(utf-8 json))."""
    raw = json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.b64encode(bytes([6]) + gzip.compress(raw)).decode("ascii")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for tag, outfit in (("Asuka", False), ("Asuka Plugsuit", True)):
        d = design(outfit)
        json.dump(d, open(os.path.join(OUT, f"{tag} - Glamourer design.json"), "w", encoding="utf-8"), indent=2)
        with open(os.path.join(OUT, f"{tag} - Glamourer import code.txt"), "w", encoding="utf-8") as f:
            f.write("Copy the code below, then in Glamourer's Designs tab press 'Import design from clipboard'.\n\n")
            f.write(share_code(d) + "\n")
    print("wrote Glamourer designs")
