"""Which FFXIV texture set each source material lands in, and the atlas layouts.

A model may use at most 4 materials, so:
  * skin: the upper body (Body_01) and the legs and hands (Body_02) share one 2:1 atlas, left and right half
  * acc: the gold and gem pieces share one 2048 atlas, one 1024 quadrant per source texture: Equip_02 / Equip_05
    (one texture: the horned crown, the default jewellery, the sash with its back ornament and the thigh snake),
    Equip_06 (the horned sunglasses' frame, the shell jewellery) and Equip_07 (the crocodile clip, the starfish
    jewellery); the fourth quadrant holds a flat patch for the sunglasses' lenses (Equip_08 has no texture: it's a
    tinted glass shader, pink in the viewer; opaque here)
Rectangles are (x, y, w, h) in glTF uv (v down) of the set's texture.
"""
import numpy as np

TEXSET = {
    "MI_1016504_Head": "head",
    "MI_1016504_Hair_01": "hair",
    "MI_1016504_Eyes_01": "eyes",
    "MI_1016504_Body_01": "skin",
    "MI_1016504_Body_02": "skin",
    "MI_1016504_Equip_03": "suit",
    "MI_1016504_Equip_01": "skirt",
    "MI_1016504_Equip_02": "acc",
    "MI_1016504_Equip_05": "acc",
    "MI_1016504_Equip_06": "acc",
    "MI_1016504_Equip_07": "acc",
    "MI_1016504_Equip_08": "acc",            # sunglasses lenses -> LENS_UV patch
}
RECT = {
    "MI_1016504_Body_01": (0.0, 0.0, 0.5, 1.0),
    "MI_1016504_Body_02": (0.5, 0.0, 0.5, 1.0),
    "MI_1016504_Equip_02": (0.0, 0.0, 0.5, 0.5),     # same texture as Equip_05
    "MI_1016504_Equip_05": (0.0, 0.0, 0.5, 0.5),
    "MI_1016504_Equip_06": (0.5, 0.0, 0.5, 0.5),
    "MI_1016504_Equip_07": (0.0, 0.5, 0.5, 0.5),
}
CUTOUT = set()                               # atlas pieces whose albedo alpha becomes the alpha-test mask
LENS = "MI_1016504_Equip_08"
LENS_RECT = (0.5, 0.5, 0.5, 0.5)            # the accessory atlas's free quadrant
LENS_UV = (0.75, 0.75)
LENS_COLOR = (175, 95, 130)                  # sRGB, sampled from the viewer's style-1 lenses over her eyes
# texture set -> (width, height, specular 0-255, roughness 0-255)
# eyes: matte, as the source's (scleraRoughness = irisRoughness = 1); 1.1.0's glossy eyes (200, 40) mirrored the sky
# and the irises glowed in game
SETS = {"head": (1024, 1024, 50, 175), "hair": (1024, 1024, 110, 120), "eyes": (512, 512, 60, 220),
        "skin": (2048, 1024, 50, 175), "suit": (1024, 1024, 110, 115), "skirt": (1024, 1024, 90, 135),
        "acc": (2048, 2048, 150, 95)}
ORDER = ["head", "hair", "eyes", "skin", "suit", "skirt", "acc"]
# Skin on skin.shpk (1.3.0): on character.shpk (the gear shader) her skin went grey and flat out of the sun (the
# Sora/Jotaro finding, and the user's dusk shot of 1.2.0); vanilla skin keeps its warmth. The face set clones the
# vanilla face material, the body skin set the vanilla body material (materials.py).
SKIN_SETS = {"head": "chara/human/c0201/obj/face/f0001/material/mt_c0201f0001_fac_a.mtrl",
             "skin": "chara/human/c0201/obj/body/b0001/material/v0001/mt_c0201b0001_a.mtrl"}
SKIN_MASK = (151, 108, 160)     # skin.shpk _mask, flat: the vanilla face mask's means (R specular, G roughness, B)
SKIN_TINT = 0                   # _norm B: how much the character's skin colour tints her skin (0: her own tan)


def members(ts):
    """Source materials baked into one texture set, with their rectangle (whole texture if not atlased). Equip_02
    shares Equip_05's texture and rectangle, so only one of them is pasted."""
    return [(m, RECT.get(m, (0.0, 0.0, 1.0, 1.0))) for m, t in TEXSET.items()
            if t == ts and m not in ("MI_1016504_Equip_02", LENS)]


def atlas_uv(material, uv):
    """glTF uv (v down) of a source material -> glTF uv in its texture set (identity when not atlased)."""
    if material not in RECT:
        return uv
    x, y, w, h = RECT[material]
    f = np.clip(uv, 0.0, 1.0)
    return np.c_[x + f[:, 0] * w, y + f[:, 1] * h]
