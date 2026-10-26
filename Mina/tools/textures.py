"""Build the FFXIV textures (Dawntrail character.shpk layout) from the Deadlock textures packed in the .blend.

Per texture set:  _base  RGB colour                                                           BC7
                  _mask  R specular, G roughness (per set, the rip's ORM roughness is flat 1),
                         B occlusion (the rip's ORM red)                                        BC7
                  _id    R colour-table row pair (always 0), G picks the row within the pair: 255 = the
                         first (plain) row, 0 = the second, which glows. G = 255 - the rip's
                         self-illumination, so only the glowing texels pick the second row      BC5
The rip has no normal maps, so every material shares one flat _norm (B = opacity); sets without
self-illumination share one _id that always picks the first row.
Colour lift (1.2.0, Neon's): luminance is raised by a gamma (dark and mid tones most), hue kept, then saturation
scaled in linear light. Her near-black-to-red hair gets the saturation only (gamma greyed the black, as on Lady Loki).

Skin (1.3.0): her face and neck, and the bare skin on her chest and thighs (SKIN_SETS), are for skin.shpk, as the
vanilla body's skin. On the gear shader her face went grey and flat whenever the sun wasn't on it (the user's in-game
shot at night; GS backlit). _base = her own colour x SKIN_GAIN, no lift (the rule is to leave skin.shpk skin alone);
the shared _norm has B = SKIN_TINT = 0 (the character's skin colour doesn't tint her pale vampire skin) and A = 0
(no lipstick); the shared _mask is flat SKIN_MASK (the vanilla face's means). After the Nurse-Pool and Sora ports.
"""
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6264/texture/mina"
# texset -> (colour, ORM, self-illumination or None, size, specular 0-255, roughness 0-255)
# Matte, as in Deadlock: Valve's own materials (the Deadlock wiki's in-game model) are fully rough and non-metal,
# and give the eyes, charm and umbrella self-illumination maps with an emissive strength of 0 (no glow).
TEXSETS = {
    "upper": ("mina_upper_color_tga_1cf2c09c", "mina_upper_ao_tga_5aebc4aa_orm_2326959906", None, 2048, 55, 205),
    "lower": ("mina_lower_color_tga_48124993", "mina_lower_ao_tga_2f39b512_orm_2001519296", None, 2048, 60, 195),
    "hair": ("mina_hair_color_tga_776ce20d", "mina_hair_ao_tga_96a79fe2_orm_225015552", None, 1024, 80, 170),
    "eyes": ("vampire_bat_eye_color_psd_e6346769", None, None, 512, 140, 70),
    "bag": ("mina_bag_color_tga_4c770cbe", "mina_bag_ao_tga_c989f9c2_orm_18448663", None, 1024, 70, 185),
    "charm": ("mina_charm_color_png_984ee5d6", "mina_charm_ao_png_dbd09d76_orm_2009570409", None, 512, 90, 160),
}
# skin.shpk sets: texset -> (colour, size). "head" is her whole head mesh (face, ears, neck; lips and make-up keep
# their colour since nothing tints them); skin_upper / skin_lower are the skin triangles of the upper and lower
# atlases (fit.split_skin picks them by the texel under them).
SKIN_SETS = {"head": ("mina_head_material__color_png_77d536c8", 2048),
             "skin_upper": ("mina_upper_color_tga_1cf2c09c", 2048),
             "skin_lower": ("mina_lower_color_tga_48124993", 2048)}
SKIN_TEMPLATE = "chara/human/c0201/obj/body/b0001/material/v0001/mt_c0201b0001_a.mtrl"   # materials.py clones it
SKIN_GAIN = 1.0                 # linear gain on her skin colour (tuned in GS)
SKIN_MASK = (151, 108, 160)     # skin.shpk _mask, flat: the vanilla face mask's means (R specular, G roughness, B)
SKIN_TINT = 0                   # _norm B: how much the character's skin colour tints hers (0: her own)
FLAT = 64
# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
# texset -> (luminance gamma, saturation) for its _base colour map; near-black hair gets saturation only
LIFT = {t: (1.4, 1.2) for t in TEXSETS}
LIFT["hair"] = (1.0, 1.2)
LUMA = np.array([0.2126, 0.7152, 0.0722])


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours: luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat."""
    lin = to_linear(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)         # a channel past white scales the pixel, keeping hue
    return (to_srgb(lin / peak) * 255 + 0.5).astype(np.uint8)


def png(name, size, mode="RGB"):
    im = Image.open(os.path.join(sd.TEX, name + ".png")).convert(mode)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def write(name, rgba, fmt):
    os.makedirs(OUT, exist_ok=True)
    raw = os.path.join(OUT, name + ".raw")
    np.ascontiguousarray(rgba, np.uint8).tofile(raw)
    dst = os.path.join(OUT, name + ".tex")
    out = subprocess.run(xd.XIVTOOL + ["rgba2tex", raw, str(rgba.shape[1]), str(rgba.shape[0]), dst, fmt],
                         capture_output=True, text=True)
    os.remove(raw)
    if out.returncode != 0 or "wrote" not in out.stdout:
        raise RuntimeError(out.stdout + out.stderr)
    print(" ", out.stdout.strip())
    return dst


def stack(*chans):
    shape = next(np.shape(c) for c in chans if np.ndim(c) == 2)
    return np.stack([np.broadcast_to(np.asarray(c, np.uint8), shape) for c in chans], -1)


def is_skin(rgb):
    """Her bare skin's texels: pale pink, red over green and blue (which sit close together), little saturation.
    Chest 176/146/146, thighs 221/192/183, face 207/183/183; jacket, gloves, stockings and hair fall outside."""
    rgb = rgb.astype(np.float64)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    sat = (rgb.max(-1) - rgb.min(-1)) / np.maximum(rgb.max(-1), 1)
    return (r > 140) & (r > g + 10) & (np.abs(g - b) < 20) & (sat > 0.06) & (sat < 0.32)


def build():
    out = {}
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    out["flat_norm"] = write("flat_norm", stack(np.full((FLAT, FLAT), 128), np.full((FLAT, FLAT), 128), flat, flat), "bc7")
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_id"] = write("flat_id", stack(zero, flat, zero, flat), "bc5")
    half = np.full((FLAT, FLAT), 128, np.uint8)
    out["skin_norm"] = write("skin_norm", stack(half, half, np.full((FLAT, FLAT), SKIN_TINT), zero), "bc7")
    out["skin_mask"] = write("skin_mask", stack(*[np.full((FLAT, FLAT), v) for v in SKIN_MASK], flat), "bc7")
    for texset, (color, size) in SKIN_SETS.items():
        print(texset, "(skin.shpk)")
        base = png(color, size)
        if SKIN_GAIN != 1:
            base = (to_srgb(to_linear(base / 255.0) * SKIN_GAIN) * 255 + 0.5).astype(np.uint8)
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([base, np.full(base.shape[:2], 255, np.uint8)]), "bc7")
    for texset, (color, orm, glow, size, spec, rough) in TEXSETS.items():
        print(texset)
        base = png(color, size)
        if texset in LIFT:
            base = lift(base, *LIFT[texset])
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([base, np.full(base.shape[:2], 255, np.uint8)]), "bc7")
        ms = min(size, 1024)        # occlusion is soft: the mask does not need the colour's resolution
        ao = png(orm, ms)[..., 0] if orm else np.full((ms, ms), 255, np.uint8)
        out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full((ms, ms), spec), np.full((ms, ms), rough), ao,
                                                              np.full((ms, ms), 255)), "bc7")
        if glow:
            g = 255 - png(glow, size, "L")
            out[f"{texset}_id"] = write(f"{texset}_id", stack(np.zeros((size, size)), g, np.zeros((size, size)),
                                                              np.full((size, size), 255)), "bc5")
    for stale in ("head_mask",):     # 1.2.0's head set was on the gear shader
        p = os.path.join(OUT, stale + ".tex")
        if os.path.exists(p):
            os.remove(p)
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


if __name__ == "__main__":
    build()
