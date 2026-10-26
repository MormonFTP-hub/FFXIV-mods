"""Which FFXIV texture set each source material lands in, and the accessory atlas layout.

A model may use at most 4 materials, so the four accessory textures (scarf / goggles / belt, back drape, cap /
collar / braided belt, badge / tie / ribbons / garter) share one 2048 atlas, one 1024 quadrant each. The goggle
lenses have no texture of their own: they sample a flat patch painted into a free corner of the eye texture.
"""
TEXSET = {
    "MI_1061302_Body": "skin",
    "MI_1061302_Head": "head",
    "MI_1061302_Equip_01": "suit",
    "MI_1061302_Equip_05": "legs",
    "MI_1061302_Equip_04": "legs2",
    "MI_1061302_Eyes_01": "eyes",
    "MI_1061302_Equip_03": "eyes",      # goggle lenses -> LENS_UV patch
    "MI_1061302_Hair_01": "hair",
    "MI_1061302_Equip_02": "acc",
    "MI_1061302_Equip_06": "acc",
    "MI_1061500_Equip_10": "acc",
    "MI_1061500_Equip_11": "acc",
    "MI_1061500_Equip_09": "acc",
    "MI_1061500_Equip_12": "acc",
}
# atlas quadrant (column, row from the top) per source material, and the baked albedo that fills each quadrant
QUADRANT = {"MI_1061302_Equip_02": (0, 0), "MI_1061302_Equip_06": (1, 0), "MI_1061500_Equip_10": (0, 1),
            "MI_1061500_Equip_11": (1, 1), "MI_1061500_Equip_09": (1, 1), "MI_1061500_Equip_12": (1, 1)}
QUADRANT_SRC = {(0, 0): "MI_1061302_Equip_02", (1, 0): "MI_1061302_Equip_06", (0, 1): "MI_1061500_Equip_10",
                (1, 1): "MI_1061500_Equip_11"}
CUTOUT = {(1, 0)}                     # quadrants whose albedo alpha becomes the alpha-test mask (the drape's fade)
LENS_UV = (0.955, 0.955)              # glTF uv of the lens patch in the eye texture (a corner the eyeball never uses)
LENS_COLOR = (238, 168, 214)          # sRGB, the lenses' pink
# texture set -> (size, specular 0-255, roughness 0-255)
SETS = {"skin": (1024, 50, 175), "head": (1024, 50, 175), "suit": (1024, 120, 120), "legs": (1024, 120, 120),
        "legs2": (1024, 120, 120), "eyes": (512, 200, 40), "hair": (1024, 110, 120), "acc": (2048, 110, 120)}
ORDER = ["head", "hair", "eyes", "skin", "suit", "legs", "legs2", "acc"]


def untile(uv, faces):
    """Move every triangle's UVs from its own tile into 0..1. The rip spreads its textures over UDIM-style tiles
    (suit u 1..2 / v -1..0, trousers u 3..4, face u 3..4, ...), and the material template samples with Mirror,
    so in game every odd tile showed its texture flipped. No triangle crosses a tile edge; each vertex takes the
    tile of the triangles using it, so a corner sitting exactly on an edge (u = 2.0 in tile 1) stays at 1.0."""
    import numpy as np
    tile = np.floor(uv[faces].mean(1))
    vt = np.full(uv.shape, np.nan)
    for k in range(3):
        old = vt[faces[:, k]]
        assert np.all(np.isnan(old) | (old == tile)), "a vertex is shared by triangles on different tiles"
        vt[faces[:, k]] = tile
    loose = np.isnan(vt[:, 0])
    vt[loose] = np.floor(uv[loose])
    return uv - vt


def atlas_uv(material, uv):
    """glTF uv (v down, already in 0..1) of a source material -> glTF uv in the accessory atlas."""
    import numpy as np
    qx, qy = QUADRANT[material]
    return np.c_[(qx + uv[:, 0]) * 0.5, (qy + uv[:, 1]) * 0.5]
