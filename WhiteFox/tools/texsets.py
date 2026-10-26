"""Which FFXIV texture set each source material lands in, and the atlas layouts.

A model may use at most 4 materials, so:
  * skin: the upper body (body_01) and the legs (body_02) share one 2:1 atlas, left and right half
  * acc: the hat / fox ears / jewellery (Equip_03), the flowers (Equip_04), the bow and ribbons (Equip_05) and the
    tail strands (Tail_02) share one 2048 atlas, one 1024 quadrant each; only the tail quadrant cuts out
  * the sunglasses' lenses have no texture of their own: they sample a flat patch painted into a free corner of the
    eye texture
Rectangles are (x, y, w, h) in glTF uv (v down) of the set's texture.
"""
import numpy as np

TEXSET = {
    "MI_10600_1060301_Head": "head",
    "MI_10600_1060301_Hair_01": "hair",
    "MI_10600_1060301_Eyes_01": "eyes",
    "MI_10600_1060301_Equip_03_02": "eyes",      # sunglasses lenses -> LENS_UV patch
    "MI_10600_1060301_body_01": "skin",
    "MI_10600_1060301_body_02": "skin",
    "MI_10600_1060301_Equip_01": "suit",
    "MI_10600_1060301_Equip_02": "jacket",
    "MI_10600_1060301_Equip_03": "acc",
    "MI_10600_1060501_Equip_04": "acc",
    "MI_10600_1060501_Equip_05": "acc",
    "MI_10600_1060301_Tail_02": "acc",
}
RECT = {
    "MI_10600_1060301_body_01": (0.0, 0.0, 0.5, 1.0),
    "MI_10600_1060301_body_02": (0.5, 0.0, 0.5, 1.0),
    "MI_10600_1060301_Equip_03": (0.0, 0.0, 0.5, 0.5),
    "MI_10600_1060501_Equip_04": (0.5, 0.0, 0.5, 0.5),
    "MI_10600_1060501_Equip_05": (0.0, 0.5, 0.5, 0.5),
    "MI_10600_1060301_Tail_02": (0.5, 0.5, 0.5, 0.5),
}
CUTOUT = {"MI_10600_1060301_Tail_02"}       # atlas pieces whose albedo alpha becomes the alpha-test mask
LENS_UV = (0.955, 0.955)                     # glTF uv of the lens patch in the eye texture (a corner the eyeball never uses)
LENS_COLOR = (236, 150, 200)                 # sRGB, the sunglasses' pink
# texture set -> (width, height, specular 0-255, roughness 0-255)
# eyes: matte, as Loki's after her 1.2.0 (glossy eyes, 200 / 40, mirrored the sky and the irises glowed in game); the
# lens patch shares the set, so the lenses are matte too
SETS = {"head": (1024, 1024, 50, 175), "hair": (1024, 1024, 110, 120), "eyes": (512, 512, 60, 220),
        "skin": (2048, 1024, 50, 175), "suit": (1024, 1024, 120, 110), "jacket": (1024, 1024, 90, 140),
        "acc": (2048, 2048, 110, 120)}
ORDER = ["head", "hair", "eyes", "skin", "suit", "jacket", "acc"]
# skin.shpk sets (textures.py skin_set, materials.py): her face and body skin, as vanilla skin is. The game multiplies
# them by the character's skin colour, and they keep their warmth out of the sun, where the gear shader turned skin grey
SKIN_SHADER = {"head", "skin"}
# colour lift on the gear-shader sets' _base (Neon 1.2.0's lift(), which the user asked for on every mod on
# 2026-10-25: "this like color intensity is what im looking for"): texset -> (luminance gamma, saturation). Not on the
# skin.shpk skin (the game tints it by the character's skin colour) and not on the eyes.
LIFT = {"suit": (1.4, 1.2), "jacket": (1.4, 1.2), "acc": (1.4, 1.2), "hair": (1.4, 1.2)}


def members(ts):
    """Source materials baked into one texture set, with their rectangle (whole texture if not atlased)."""
    return [(m, RECT.get(m, (0.0, 0.0, 1.0, 1.0))) for m, t in TEXSET.items()
            if t == ts and m != "MI_10600_1060301_Equip_03_02"]


def atlas_uv(material, uv):
    """glTF uv (v down) of a source material -> glTF uv in its texture set (identity when not atlased)."""
    if material not in RECT:
        return uv
    x, y, w, h = RECT[material]
    f = np.clip(uv, 0.0, 1.0)
    return np.c_[x + f[:, 0] * w, y + f[:, 1] * h]
