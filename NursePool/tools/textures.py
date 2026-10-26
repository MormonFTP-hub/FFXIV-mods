"""Build the FFXIV textures (Dawntrail character.shpk layout) from the decoded Marvel Rivals textures (work/src/tex).

Per texture set:  _base  RGB colour, then Neon's colour lift, stronger since 1.3.0 (LIFT)              BC7
                  _norm  RG tangent normal (the rip's maps are green-down, FFXIV's green-up: G flipped),
                         B opacity (the wig's loose strand cards only)                                BC7
                  _mask  R specular, G roughness (the rip's ORM green), B = 255: no baked occlusion. Only one
                         small piece asks for it (aoIntensity), and the game's own GTAO and shadows
                         already darken; baked on top they doubled it (Loki 1.2.0)                     BC7
Every set shares one empty _id: the materials' colour-table rows are all plain white (materials.py), so it can't pick
metal. 1.0.x wrote the rip's metalness into _id G with a metal second row, but G = 255 picks the FIRST row, so
almost every texel came out metal (near-black in GS); the rip has no texel over 0.5 metal anyway.
The wig is drawn with its second UV set: colour = overlay(grey strand texture on UV set 0 x baseTint, shadow-colour
map on UV set 1), the viewer's hair blend, rasterised into the shadow-colour map's layout (after the Mantis port).
The bare skin (SKIN_SETS) is for skin.shpk since 1.3.0, as the vanilla body skin is: on the gear shader it went grey and
dim whenever the sun wasn't on it. _base = his own skin x SKIN_GAIN (no colour lift: the rule is to leave skin.shpk
skin alone), _norm B = SKIN_TINT (0: the character's skin colour doesn't tint his own) and A = 0 (no lipstick),
_mask flat SKIN_MASK (the vanilla face's means). From the Loki and WhiteFox ports.
"""
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import raster  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = xd.ROOT
OUT = os.path.join(ROOT, "work", "build", "tex")
GAME_DIR = "chara/equipment/e6016/texture/nursepool"
P = "MI_1057801_"
# texset -> (colour, normal, ORM, size, specular 0-255, roughness override 0-255 or None)
TEXSETS = {
    "gear": (P + "Equip_02_gltf_baseColor", P + "Equip_02_gltf_normal", P + "Equip_02_gltf_orm", 2048, 90, None),
    "dress": (P + "Equip_01_gltf_baseColor", P + "Equip_01_gltf_normal", P + "Equip_01_gltf_orm", 2048, 70, None),
    "legs": (P + "Equip_04_gltf_baseColor", P + "Equip_04_gltf_normal", P + "Equip_04_gltf_orm", 2048, 80, None),
    "skin": (P + "Body_01_gltf_baseColor", P + "Body_01_gltf_normal", P + "Body_01_gltf_orm", 2048, 60, None),
    "hair": (None, None, None, 2048, 110, 120),         # its normal map is laid out for UV set 0: flat
    "hairfx": (P + "Hair_02_gltf_baseColor", None, None, 2048, 110, 120),
}
# The source lights skin with toon bands that never drop far into shade; in the game's daylight his bare skin read
# dark at the source's colours (Loki 1.2.0 found the same). Linear gain, clipped. Tuned in GS on skin.shpk (1.3.0).
SKIN_GAIN = {"skin": 1.4}         # 1.3 matched 1.2.0's skin; 1.5 began to flatten the shoulders' shading (GS)
SKIN_SETS = {"skin": "chara/human/c0101/obj/body/b0001/material/v0001/mt_c0101b0001_a.mtrl"}   # materials.py clones it
SKIN_MASK = (151, 108, 160)     # skin.shpk _mask, flat: the vanilla face mask's means (R specular, G roughness, B)
SKIN_TINT = 0                   # _norm B: how much the character's skin colour tints his skin (0: his own)
HAIRFX_OPACITY = 0.9            # Hair_02's opacityMultiplier
# Colour lift (1.2.0, Neon 1.2.0's): the user on Neon 1.2.0, "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for". texset -> (luminance gamma, saturation). 1.3.0 ("could you make the colors
# brighter somehow"): 1.6 / 1.3 instead of 1.4 / 1.2, +9% luminance and +6% saturation over 1.2.0 in GS, sun or shade.
# Not on the skin (skin.shpk).
LIFT = {"gear": (1.6, 1.3), "dress": (1.6, 1.3), "legs": (1.6, 1.3), "hair": (1.6, 1.3), "hairfx": (1.6, 1.3)}
LUMA = np.array([0.2126, 0.7152, 0.0722])
FLAT = 64


def png(name, size, mode="RGB"):
    im = Image.open(os.path.join(sd.TEX, name + ".png")).convert(mode)
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).copy()


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


to_linear, to_srgb = srgb_to_lin, lin_to_srgb       # Neon's names


def lift(rgb, gamma, sat):
    """Brighter colours (Neon's): luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat
    in linear light; a channel past white scales the whole pixel down, keeping the hue."""
    lin = to_linear(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)
    return (to_srgb(lin / peak) * 255 + 0.5).astype(np.uint8)


def overlay(a, b):
    """The viewer's hair blend (its function `on`): 2ab below 0.5, screen-like above."""
    return np.where(a < 0.5, 2 * a * b, 1 - 2 * (1 - a) * (1 - b))


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


def bleed(rgb, hit, rings=4):
    """Grow colour a few texels past the covered area so mips and BC blocks don't pull in black."""
    rgb, hit = rgb.copy(), hit.copy()
    for _ in range(rings):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(hit.shape + (1,))
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(np.roll(rgb, dy, 0), dx, 1)
            hs = np.roll(np.roll(hit, dy, 0), dx, 1)
            acc += sh * hs[..., None]
            cnt += hs[..., None]
        grow = ~hit & (cnt[..., 0] > 0)
        rgb[grow] = acc[grow] / cnt[grow]
        hit |= grow
    return rgb


def bake_wig(size):
    """Wig colour on its second UV set: overlay(strand grey (UV set 0) x baseTint, shadow colour (UV set 1)), linear."""
    m = sd.mesh()
    sel = m["mat"] == m["materials"].index(P + "Hair_01")
    faces = m["faces"][sel]
    tint = np.array(sd.material(P + "Hair_01")["extras"]["inputs"].get("baseTint", [1, 1, 1]))
    grey = srgb_to_lin(png(P + "Hair_02_gltf_baseColor", None).astype(float) / 255)
    shadow = srgb_to_lin(png(P + "Hair_01_shadowColorMap", size).astype(float) / 255)
    tri, bary = raster.rasterize(m["uv1"], faces, size, pad=2)
    hit = tri >= 0
    uv0 = np.einsum("nk,nkj->nj", bary[hit], m["uv0"][faces[tri[hit]]])
    col = np.zeros((size, size, 3))
    col[hit] = overlay(np.clip(raster.sample(grey, uv0) * tint, 0, 1), shadow[hit])
    print(f"  wig: {hit.mean() * 100:.0f}% of the colour map covered")
    col = bleed(col, hit)
    return np.round(lin_to_srgb(col) * 255).astype(np.uint8)


def base_color(texset, color, size):
    if texset == "hair":
        return bake_wig(size)
    base = png(color, size)
    gain = SKIN_GAIN.get(texset)
    if gain:
        base = np.round(lin_to_srgb(srgb_to_lin(base / 255.0) * gain) * 255).astype(np.uint8)
    return base


def build():
    out = {}
    flat = np.full((FLAT, FLAT), 255, np.uint8)
    zero = np.zeros((FLAT, FLAT), np.uint8)
    out["flat_norm"] = write("flat_norm", stack(np.full((FLAT, FLAT), 128), np.full((FLAT, FLAT), 128), flat, flat), "bc7")
    out["flat_id"] = write("flat_id", stack(zero, flat, zero, flat), "bc5")
    for texset, (color, normal, orm, size, spec, rough) in TEXSETS.items():
        print(texset)
        base = base_color(texset, color, size)
        if texset in LIFT:
            base = lift(base, *LIFT[texset])
        out[f"{texset}_base"] = write(f"{texset}_base", np.dstack([base, np.full(base.shape[:2], 255, np.uint8)]), "bc7")
        if texset == "hairfx":
            ns = size
            a = np.round(png(P + "Hair_02_opacityMask", ns, "L") * HAIRFX_OPACITY).astype(np.uint8)
            out[f"{texset}_norm"] = write(f"{texset}_norm", stack(np.full((ns, ns), 128), np.full((ns, ns), 128), a,
                                                                  np.full((ns, ns), 255)), "bc7")
        elif normal:
            ns = 1024
            n = png(normal, ns)
            skin = texset in SKIN_SETS
            out[f"{texset}_norm"] = write(f"{texset}_norm", stack(n[..., 0], 255 - n[..., 1],
                                                                  np.full((ns, ns), SKIN_TINT if skin else 255),
                                                                  np.full((ns, ns), 0 if skin else 255)), "bc7")
        if texset in SKIN_SETS:
            out[f"{texset}_mask"] = write(f"{texset}_mask", stack(*[np.full((FLAT, FLAT), v) for v in SKIN_MASK],
                                                                  flat), "bc7")
        elif orm and rough is None:
            ms = 1024
            g = png(orm, ms)[..., 1]
            out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full((ms, ms), spec), g, np.full((ms, ms), 255),
                                                                  np.full((ms, ms), 255)), "bc7")
        else:
            out[f"{texset}_mask"] = write(f"{texset}_mask", stack(np.full((FLAT, FLAT), spec),
                                                                  np.full((FLAT, FLAT), rough), flat, flat), "bc7")
    for stale in ("gear_id", "dress_id", "legs_id", "skin_id", "hair_id", "hairfx_id"):
        p = os.path.join(OUT, stale + ".tex")
        if os.path.exists(p):
            os.remove(p)
    with open(os.path.join(OUT, "index.pkl"), "wb") as f:
        pickle.dump({k: (v, f"{GAME_DIR}_{k}.tex") for k, v in out.items()}, f)
    return out


def has(texset, kind):
    return os.path.exists(os.path.join(OUT, f"{texset}_{kind}.tex"))


if __name__ == "__main__":
    build()
