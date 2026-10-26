"""What the worn gear's EQP entries and IMC attribute masks hide: whole slots (gloves under a full-body suit, hair
under a hat) and submeshes tagged with attributes (atr_nek, atr_ude, ...).

The EQP combination follows Penumbra's EqpCache, which reimplements the game's GetEqpFlags: head, hands and legs
flags come from the body set when the body doesn't show that slot, feet from the legs' source when the legs don't
show feet, then two post-processing passes settle glove and boot lengths. The flag -> attribute table is the
community reference (xivmodding.com visibility tables, pre-Dawntrail), so treat edge cases as approximate; the boot
pass was checked against in-game footage (2026-10-24)."""
import meta as M

E = {  # Penumbra.GameData EqpEntry
    "BodyEnabled": 0x1, "BodyHideWaist": 0x2, "BodyHideThighs": 0x4, "BodyHideGlovesS": 0x8, "BodyHideGloveCuffs": 0x10,
    "BodyHideGlovesM": 0x20, "BodyHideGlovesL": 0x40, "BodyHideGorget": 0x80, "BodyShowLeg": 0x100, "BodyShowHand": 0x200,
    "BodyShowHead": 0x400, "BodyShowNecklace": 0x800, "BodyShowBracelet": 0x1000, "BodyShowTail": 0x2000,
    "BodyDisableBreastPhysics": 0x4000, "BodyUsesEvpTable": 0x8000,
    "LegsEnabled": 0x10000, "LegsHideKneePads": 0x20000, "LegsHideBootsS": 0x40000, "LegsHideBootsM": 0x80000,
    "Legs_20": 0x100000, "LegsShowFoot": 0x200000, "LegsShowTail": 0x400000,
    "HandsEnabled": 0x1000000, "HandsHideElbow": 0x2000000, "HandsHideForearm": 0x4000000, "HandShowBracelet": 0x10000000,
    "HandShowRingL": 0x20000000, "HandShowRingR": 0x40000000,
    "FeetEnabled": 0x100000000, "FeetHideKnee": 0x200000000, "FeetHideCalf": 0x400000000, "FeetHideAnkle": 0x800000000,
    "HeadEnabled": 0x10000000000, "HeadHideScalp": 0x20000000000, "HeadHideHair": 0x40000000000,
    "HeadShowHairOverride": 0x80000000000, "HeadHideNeck": 0x100000000000, "HeadShowNecklace": 0x200000000000,
    "HeadShowEarringsHyurRoe": 0x400000000000, "HeadShowEarringsLalaElezen": 0x800000000000,
    "HeadShowEarringsMiqoHrothViera": 0x1000000000000, "HeadShowEarringsAura": 0x2000000000000,
    "HeadShowEarHuman": 0x4000000000000, "HeadShowEarMiqote": 0x8000000000000, "HeadShowEarAuRa": 0x10000000000000,
    "HeadShowEarViera": 0x20000000000000, "HeadDisableBangsPhysics": 0x40000000000000,
    "HeadDisableHairPhysics": 0x80000000000000, "HeadShowHrothgarHat": 0x100000000000000,
    "HeadShowVieraHat": 0x200000000000000, "HeadUsesEvpTable": 0x400000000000000,
}

# Whole slots: (slot drawn, flag that must be set, why)
SLOT_RULES = [
    ("glv", "BodyShowHand", "the body piece's EQP lacks BodyShowHand"),
    ("dwn", "BodyShowLeg", "the body piece's EQP lacks BodyShowLeg"),
    ("met", "BodyShowHead", "the body piece's EQP lacks BodyShowHead"),
    ("sho", "LegsShowFoot", "the legs' EQP lacks LegsShowFoot"),
    ("nek", "BodyShowNecklace", "the body piece's EQP lacks BodyShowNecklace"),
    ("nek", "HeadShowNecklace", "the head piece's EQP lacks HeadShowNecklace"),
    ("wrs", "BodyShowBracelet", "the body piece's EQP lacks BodyShowBracelet"),
    ("wrs", "HandShowBracelet", "the hands' EQP lacks HandShowBracelet"),
    ("ril", "HandShowRingL", "the hands' EQP lacks HandShowRingL"),
    ("rir", "HandShowRingR", "the hands' EQP lacks HandShowRingR"),
    ("tail", "BodyShowTail", "the body piece's EQP lacks BodyShowTail"),
    ("tail", "LegsShowTail", "the legs' EQP lacks LegsShowTail"),
]
EARRING_FLAG = {"Midlander": "HeadShowEarringsHyurRoe", "Highlander": "HeadShowEarringsHyurRoe",
                "Roegadyn": "HeadShowEarringsHyurRoe", "Lalafell": "HeadShowEarringsLalaElezen",
                "Elezen": "HeadShowEarringsLalaElezen", "Miqote": "HeadShowEarringsMiqoHrothViera",
                "Hrothgar": "HeadShowEarringsMiqoHrothViera", "Viera": "HeadShowEarringsMiqoHrothViera",
                "AuRa": "HeadShowEarringsAura"}

# Submesh attributes a flag hides: (attribute, slot of the model carrying it, flag, which piece sets the flag)
ATTR_RULES = [
    ("atr_kod", "dwn", "BodyHideWaist", "body"),
    ("atr_inr", "met", "BodyHideGorget", "body"),
    ("atr_lpd", "sho", "LegsHideKneePads", "legs"),
    ("atr_ude", "top", "HandsHideElbow", "hands"),
    ("atr_hij", "top", "HandsHideForearm", "hands"),
    ("atr_hiz", "dwn", "FeetHideKnee", "feet"),
    ("atr_sne", "dwn", "FeetHideCalf", "feet"),
    ("atr_nek", "top", "HeadHideNeck", "head"),
    ("atr_kam", "hair", "HeadHideScalp", "head"),
]
VARIANT_PREFIX = {"met": "mv", "top": "tv", "glv": "gv", "dwn": "dv", "sho": "sv", "ear": "ev", "nek": "nv",
                  "wrs": "wv", "rir": "rv", "ril": "rv"}
TAILED = ("Miqote", "AuRa", "Hrothgar")


def variant_attributes(mdl, imc, prefix, skip_a=False):
    """IMC attribute mask bit k shows atr_<prefix>_<a+k> submeshes (prefix may be a tuple). Accessories: Penumbra
    applies bits 1-9 only."""
    mask = (imc or {}).get("AttributeMask", 0x3FF)
    out = {}
    for a in mdl["attributes"]:
        p = next((f"atr_{x}_" for x in ((prefix,) if isinstance(prefix, str) else prefix) if a.startswith(f"atr_{x}_")), None)
        if p and len(a) == len(p) + 1:
            k = ord(a[-1]) - ord("a")
            if skip_a and k == 0:
                continue
            out[a] = {"show": bool(mask >> k & 1), "why": f"IMC attribute mask 0x{mask:03X}, bit {a[-1]}"}
    return out


class Visibility:
    def __init__(self, eqp, race, gear, atr_off=(), features=0, beard=False):
        """eqp: {slot: (entry of that slot's own set, source)} for the five gear slots (entry None = empty).
        features: the customization's facial-feature bits (atr_fv_a..g); beard: facial hair (atr_hig)."""
        self.features, self.beard = int(features), bool(beard)
        self.race = race
        self.gender, self.model_race = M.GENDER_RACE[race]
        self.gear = gear
        self.atr_off = set(atr_off)
        own = {s: (M.EQP_DEFAULT if v is None else v) for s, (v, _) in eqp.items()}
        self.src = {s: src or "empty slot" for s, (_, src) in eqp.items()}
        body = own["top"]
        # whose entry each slot's bits come from
        take = {"top": "top", "met": "met" if body & E["BodyShowHead"] else "top",
                "glv": "glv" if body & E["BodyShowHand"] else "top", "dwn": "dwn" if body & E["BodyShowLeg"] else "top"}
        legs_src = take["dwn"]
        take["sho"] = "sho" if own[legs_src] & E["LegsShowFoot"] else legs_src
        self.take = take
        full = 0
        for s in M.EQUIP:
            full |= own[take[s]] & M.EQP_MASK[s]
        # glove length: HideForearm decides between mid and long gloves
        if full & E["HandsHideForearm"]:
            t = full & (E["BodyHideGlovesL"] if full & E["HandsHideElbow"] else E["BodyHideGlovesM"])
            full = (full | E["BodyHideGloveCuffs"]) & ~E["BodyHideGlovesS"] if t else full & ~(E["BodyHideGloveCuffs"] | E["BodyHideGlovesS"])
        # boot length. FeetHideKnee only counts with FeetHideCalf (knee-high boots carry both): in game the Bygone Brass
        # Boots of Casting (FeetHideKnee alone, as on 264 sets) show the shorts' knee part, while the Sabatons of Striking
        # (FeetHideCalf) hide the shin and show the knee
        self.knee_dropped = bool(full & E["FeetHideKnee"] and not full & E["FeetHideCalf"])
        if self.knee_dropped:
            full &= ~E["FeetHideKnee"]
        if full & E["FeetHideCalf"]:
            if full & E["FeetHideKnee"] or not full & E["Legs_20"]:
                full &= ~(E["LegsHideBootsS"] | E["LegsHideBootsM"])
            else:
                full = (full | E["LegsHideBootsM"]) & ~E["LegsHideBootsS"]
        self.full = full
        self.problems = []

    def has(self, flag):
        return bool(self.full & E[flag])

    def slot_hidden(self, slot):
        why = [text for s, flag, text in SLOT_RULES if s == slot and not self.has(flag)]
        hat = bool(self.gear.get("met")) and self.take["met"] == "met"
        if slot == "hair" and not self.has("HeadShowHairOverride") and self.has("HeadHideHair") and self.has("HeadHideScalp"):
            why.append("the head EQP has HeadHideHair and HeadHideScalp")
        elif slot == "hair" and not self.has("HeadShowHairOverride") and self.has("HeadHideHair"):
            why.append("the head EQP has HeadHideHair")
        if slot == "zear" and not self.has("HeadShowEarViera"):
            why.append("the head EQP lacks HeadShowEarViera")
        if slot == "ear" and not self.has(EARRING_FLAG[self.model_race]):
            why.append(f"the head EQP lacks {EARRING_FLAG[self.model_race]}")
        if slot == "met" and hat and self.model_race == "Viera" and not self.has("HeadShowVieraHat"):
            why.append("the head EQP lacks HeadShowVieraHat: not drawn on Viera")
        if slot == "met" and hat and self.model_race == "Hrothgar" and not self.has("HeadShowHrothgarHat"):
            why.append("the head EQP lacks HeadShowHrothgarHat: not drawn on Hrothgar")
        return why or None

    def attributes(self, slot, mdl, imc):
        attrs = mdl["attributes"]
        out = {}
        if slot in VARIANT_PREFIX:
            out.update(variant_attributes(mdl, imc, VARIANT_PREFIX[slot], skip_a=slot in M.ACCES))
        for attr, s, flag, who in ATTR_RULES:
            if s == slot and attr in attrs:
                hide = self.has(flag)
                out[attr] = {"show": not hide, "why": f"{who} EQP {flag} {'set' if hide else 'not set'}"}
                if attr == "atr_hiz" and self.knee_dropped:
                    out[attr]["why"] = "feet EQP FeetHideKnee without FeetHideCalf: the game shows the knee"
        if slot == "glv" and "atr_arm" in attrs:
            hide = self.has("BodyHideGlovesS") or self.has("BodyHideGloveCuffs")
            out["atr_arm"] = {"show": not hide, "why": "body sleeves cover the glove top" if hide else "no glove-hiding body flag"}
        if slot == "sho" and "atr_leg" in attrs:
            hide = self.has("LegsHideBootsS") or self.has("LegsHideBootsM")
            out["atr_leg"] = {"show": not hide, "why": "legs cover the boot top" if hide else "no boot-hiding legs flag"}
        if slot == "face":
            features = self.features
            for a in attrs:
                if a.startswith("atr_fv_") and len(a) == 8:
                    k = ord(a[-1]) - ord("a")
                    out[a] = {"show": bool(features >> k & 1), "why": f"facial feature {k + 1} {'on' if features >> k & 1 else 'off'} (customization)"}
            if "atr_hig" in attrs:
                out["atr_hig"] = {"show": self.beard, "why": f"facial hair {'on' if self.beard else 'off'} (customization)"}
            ears = {"atr_mim": "HeadShowEarHuman", "atr_hrn": "HeadShowEarAuRa"}
            if self.model_race == "Miqote":
                ears["atr_top"] = "HeadShowEarMiqote"
            for a, flag in ears.items():
                if a in attrs:
                    out[a] = {"show": self.has(flag), "why": f"head EQP {flag} {'set' if self.has(flag) else 'not set'}"}
        if slot == "hair" and self.model_race == "Miqote" and "atr_top" in attrs:
            out["atr_top"] = {"show": self.has("HeadShowEarMiqote"), "why": "head EQP HeadShowEarMiqote"}
        for a in attrs:
            if a == "atr_tlh":
                out[a] = {"show": self.model_race not in TAILED, "why": "tail-less races only"}
            elif a == "atr_tls":
                out[a] = {"show": self.model_race in TAILED, "why": "tailed races only"}
            elif a.startswith("atrx_") and a in self.atr_off:
                out[a] = {"show": False, "why": "Penumbra Atr manipulation"}
        return out

    def summary(self):
        names = {}
        for s in M.EQUIP:
            names[s] = {"source": self.src[s], "takenFrom": self.take[s],
                        "flags": [k for k, b in E.items() if self.full & b and M.EQP_MASK[s] & b]}
        names["value"] = f"0x{self.full:016X}"
        return names
