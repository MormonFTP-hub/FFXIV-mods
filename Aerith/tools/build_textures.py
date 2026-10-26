"""Convert Aerith's FF7R texture sets into FFXIV characterlegacy.shpk textures (BC7 .tex) under work/mod.

Per set (A = dress/accessories, B = jacket/boots/ribbon, H = hair, S = scalp under the hair):
  _d  diffuse: base colour, metals a little darker (FF7R's _O occlusion maps use a second UV layout the
      rip does not carry, so they cannot be baked in). FF7R's hair textures are a pale grey-tan that its hair
      shader tints, so hair and scalp get her chestnut brown here.
  _n  normal: RG = tangent-space normal (FF7R is DirectX-style, flipped to OpenGL), B = opacity, A = 255
  _s  characterlegacy specular map: a specular COLOUR, so grey (R = G = B = strength), as every vanilla legacy _s is.
      (1.2.0 and earlier wrote G = gloss here, which the game shows as green highlights.)
  _id colour-table row pair 0 (both rows plain white) with G = gloss (1 - FF7R roughness): G = 255 picks the pair's
      first row, the glossy one, and G = 0 the second, the matte one (shininess in tools/build_mod.py SHININESS)

The scalp set is cropped from Aerith's head texture to the box the fit wrote to work/scalp_uv.json.

Colour lift (1.8.0, Neon 1.2.0's, LIFT): the legacy diffuse of the dress, jacket, hair, scalp cap, eyes and mouth gets
its luminance raised by a gamma (dark and mid tones most), hue kept, then saturation scaled in linear light. Not lifted:
her face skin (skin.shpk, tinted by the character's skin colour), the lash cards, and every _n / _s / _id map (_s is a
grey specular colour).
Run tools/build_mod.py afterwards (its face step moves the face textures from work/mod into the Face option).
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tex import dds_to_tex  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
TMP = os.path.join(ROOT, "work", "texbuild")
MOD = os.path.join(ROOT, "work", "mod")
TEXCONV = r"E:\Program Files\FFXIV TexTools\FFXIV_TexTools\converters\texconv.exe"
SET_ID = 141
TEX_DIR = f"chara/equipment/e{SET_ID:04d}/texture"

SETS = {
    #      colour,   normal,    roughness,            metallic,            alpha,     size
    "A": ("BodyA_C", "BodyA_N", "BodyA_M_Roughness", "BodyA_M_Metallic", "BodyA_A", 2048),
    "B": ("BodyB_C", "BodyB_N", "BodyB_M_Roughness", "BodyB_M_Metallic", None, 2048),
    "H": ("Hair_C", "Hair_N", "Hair_M_Roughness", None, "Hair_A", 1024),
    "S": ("Head_C", "Head_N", "Head_M_Roughness", None, None, 1024),
}
# Aerith's hair in FF7 Remake: warm chestnut. Mid-tone targets (sRGB) for the strands and the painted scalp,
# which sits in the hair's shade. 1.4.0 lifted both 12% after the user found 1.3.0 a little dark in game.
HAIR_MEAN = np.array([116, 85, 64]) / 255
SCALP_MEAN = np.array([92, 67, 50]) / 255
# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
# set -> (luminance gamma, saturation) for the _d maps; FACE (skin.shpk) and LSH (lash cards) are left out. The hair and
# scalp cap use gamma 1.2: at 1.4 the chestnut lightened to a tan close to the golden blonde 1.1.0 moved away from (GS,
# work/lift/hair_backoff.png); 1.2 keeps it a warm brown, still lighter and richer than 1.7.1.
LIFT = {"A": (1.4, 1.2), "B": (1.4, 1.2), "H": (1.2, 1.2), "S": (1.2, 1.2), "EYE": (1.4, 1.2), "MTH": (1.4, 1.2)}
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


def lift_diffuse(key, col):
    """LIFT on a float 0-1 RGB colour map (unchanged for sets not in LIFT)."""
    if key not in LIFT:
        return col
    print(f"  colour lift {LIFT[key]}")
    return lift(np.clip(col * 255 + 0.5, 0, 255).astype(np.uint8), *LIFT[key]).astype(np.float32) / 255


def tex_path(set_key, kind):
    return f"{TEX_DIR}/aerith_{set_key.lower()}_{kind}.tex"


def load(name, size, mode="RGB", box=None):
    im = Image.open(os.path.join(SRC, f"PC0003_00_{name}.png")).convert(mode)
    if box:
        im = im.crop(box)
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255


def write(key, kind, rgba):
    # -sepalpha: texconv otherwise weights colour by alpha when it builds the mips, and alpha here is data, not
    # opacity. The face _norm (alpha = lipstick area, 0 everywhere) came out with every mip from 512 px down
    # all zero: in game, at normal camera distance, no skin tint and broken normals (a grey face with skin-coloured
    # patches where the top mip was used), 1.2.0-1.6.0
    png = os.path.join(TMP, f"aerith_{key.lower()}_{kind}.png")
    Image.fromarray(np.clip(rgba * 255 + 0.5, 0, 255).astype(np.uint8), "RGBA").save(png)
    subprocess.run([TEXCONV, "-nologo", "-y", "-f", "BC7_UNORM", "-m", "0", "-sepalpha", "-o", TMP, png], check=True,
                   stdout=subprocess.DEVNULL)
    out = os.path.join(MOD, *tex_path(key, kind).split("/"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    dds_to_tex(png[:-4] + ".dds", out)
    print("TEX", tex_path(key, kind))


def painted_hair(col):
    """How much a head-texture pixel is painted hair (grey-brown, darker) rather than skin (pink, light)."""
    lum = col @ np.array([0.3, 0.59, 0.11], np.float32)
    warm = col[..., 0] - col[..., 2]
    return np.clip((0.6 - lum) / 0.1, 0, 1) * np.clip((0.24 - warm) / 0.06, 0, 1)


def tint(col, target, weight=None):
    """Scale the colour so its (weighted) mean lands on target, with a little extra contrast."""
    w = np.ones(col.shape[:2], np.float32) if weight is None else weight
    mean = (col * w[..., None]).reshape(-1, 3).sum(0) / max(w.sum(), 1)
    out = (mean + (col - mean) * 1.1) * (target / mean)
    print(f"  tint: source mean {np.round(mean * 255)} -> {np.round(target * 255)}")
    return np.clip(out, 0, 1)


def build(key):
    c_name, n_name, r_name, m_name, a_name, size = SETS[key]
    box = None
    if key == "S":
        uv = json.load(open(os.path.join(ROOT, "work", "scalp_uv.json")))
        w, h = Image.open(os.path.join(SRC, f"PC0003_00_{c_name}.png")).size
        # Blender UVs run bottom-up: v1 is the top row of the crop
        box = (int(uv["u0"] * w), int((1 - uv["v1"]) * h), int(np.ceil(uv["u1"] * w)), int(np.ceil((1 - uv["v0"]) * h)))
    col = load(c_name, size, box=box)
    nrm = load(n_name, size, box=box)
    rough = load(r_name, size, "L", box=box)
    metal = load(m_name, size, "L") if m_name else np.zeros((size, size), np.float32)
    alpha = load(a_name, size, "L") if a_name else np.ones((size, size), np.float32)

    if key == "H":
        col = tint(col, HAIR_MEAN, alpha)
    if key == "S":
        hair = painted_hair(col)
        col = tint(col, SCALP_MEAN, hair)
        alpha = hair
    diff = col * (1 - 0.25 * metal)[..., None]            # metals read a little darker, their colour moves into specular
    gloss = np.clip(1 - rough, 0, 1)
    spec = (0.04 + 0.16 * gloss) * (1 - metal) + (0.35 + 0.4 * gloss) * metal   # cloth ~0.08, leather ~0.12, metal ~0.6
    if key in ("H", "S"):
        spec = 0.10 + 0.12 * gloss

    n_out = np.ones((size, size, 4), np.float32)
    n_out[..., 0] = nrm[..., 0]
    n_out[..., 1] = 1 - nrm[..., 1]                        # DirectX -> OpenGL green
    n_out[..., 2] = alpha
    write(key, "d", np.dstack([lift_diffuse(key, diff), np.ones((size, size))]))
    write(key, "n", n_out)
    write(key, "s", np.clip(np.dstack([spec, spec, spec, np.ones((size, size))]), 0, 1))
    write(key, "id", id_map(gloss[::2, ::2]))


# ---------------------------------------------------------------- the Face option
# skin.shpk (as vanilla faces): _base = skin albedo, multiplied in game by the character's skin colour where
# _norm B is 1; _norm RG normal, A = lipstick area; _mask G roughness. _mask R and B are NOT amounts: Bibo+'s body
# has R = 165 and B = 153 on 99.8% of texels, a vanilla face R = 165 on its skin. R reads like a material selector
# in steps of 17 (165 -> 10): her skin at 148-158 (-> 9) rendered grey, and only her glossy T-zone, which reached
# 165+, came out as skin. That gave pink patches on a grey face in game (1.2.0-1.5.0). So R and B are vanilla's
# constants, and only G carries her roughness.
SKIN_BASE = np.array([181, 148, 131]) / 255     # Bibo+ body base and the vanilla face base agree on this
FACE_TEX = {k: f"{TEX_DIR}/aerith_face_{k}.tex" for k in ("base", "norm", "mask")}
FACE_GAIN = 1.06            # her face a touch lighter than the body's skin base (1.3.0 read a little dark in game)
VANILLA_MASK = (165 / 255, 0.46, 156 / 255)   # vanilla face _mask R (skin selector), G (roughness), B on skin
# Below her jaw the face mesh is FFXIV's neck (build_face.py blends it onto the vanilla face's neck), so FF7R's
# neck normals and colour don't fit it and lit up as blotches in game: there the maps fade to flat normals,
# the body's skin base and vanilla's mask, from FACE_NECK[1] down to FACE_NECK[0] (FFXIV y, metres).
FACE_NECK = (1.425, 1.455)
# Share of FF7R's broad skin shading/blush and of its fine normal detail that the face keeps (lips and brows always
# keep theirs). 1.5.0 cut both to 0.35, blaming them for brown smudges seen in game; the smudges were really
# scalp-cap patches z-fighting with the face (fixed in fit_aerith.scalp_cap, 1.7.0). In the game-shader renderer
# the full FF7R detail matches the source best (pink blush, defined eyes), so it is back to 1.
SKIN_EVEN = 1.0
NORMAL_DETAIL = 1.0


def neck_weight(size):
    """1 on the texels of her face mesh's neck and on texels no triangle uses (cut off below the neck; they bleed
    into the lower mips), 0 on the face, from the exported face (work/export)."""
    from PIL import ImageDraw, ImageFilter
    m = next(m for m in json.load(open(os.path.join(ROOT, "work", "export", "face_c0201_f0001.json")))
             if m["material"].endswith("_aerith_fac.mtrl"))
    y = np.array(m["positions"])[:, 1]
    w = np.clip((FACE_NECK[1] - y) / (FACE_NECK[1] - FACE_NECK[0]), 0, 1)
    uv = np.array(m["uvs"]) * size
    im = Image.new("L", (size, size), 255)
    draw = ImageDraw.Draw(im)
    for tri in np.array(m["indices"]).reshape(-1, 3):
        draw.polygon([tuple(uv[i]) for i in tri], fill=int(round(w[tri].mean() * 255)))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(6)), np.float32) / 255


def blur(img, radius):
    from PIL import ImageFilter
    chans = [Image.fromarray(np.clip(img[..., c] * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
             for c in range(img.shape[2])]
    return np.dstack([np.asarray(c, np.float32) / 255 for c in chans])


def build_face_skin():
    size = 2048
    col = load("Head_C", size)
    nrm = load("Head_N", size)
    rough = load("Head_M_Roughness", size, "L")
    hair = painted_hair(col)
    skin_px = col[hair < 0.2]
    lum = skin_px @ np.array([0.3, 0.59, 0.11], np.float32)
    skin_mean = skin_px[(lum > 0.6)].mean(0)
    base = np.clip(col * (SKIN_BASE * FACE_GAIN / skin_mean), 0, 1)
    print(f"  face skin: source mean {np.round(skin_mean * 255)} -> {np.round(SKIN_BASE * FACE_GAIN * 255)}")
    lo = blur(base, 24)
    med = np.median(lo[hair < 0.05], axis=0)
    rg = blur(col, 12)
    rg = rg[..., 0] / np.maximum(rg[..., 1], 1e-3)
    lips = blur(np.clip((rg - 1.37) / 0.05, 0, 1)[..., None], 4)[..., 0]
    keep = SKIN_EVEN + (1 - SKIN_EVEN) * np.maximum(lips, np.clip(hair * 4, 0, 1))
    base = np.clip(med + (lo - med) * keep[..., None] + (base - lo), 0, 1)
    neck = neck_weight(size)[..., None]
    # the neck: the body's skin base, keeping only FF7R's fine detail (pores, freckles)
    base = base * (1 - neck) + np.clip(SKIN_BASE + (base - blur(base, 6)) * 0.5, 0, 1) * neck
    # the hair painted on her scalp gets the hair's chestnut and no skin tint
    scalp = tint(col, SCALP_MEAN, hair)
    base = base * (1 - hair[..., None]) + scalp * hair[..., None]
    n_out = np.zeros((size, size, 4), np.float32)
    nxy = np.dstack([nrm[..., 0], 1 - nrm[..., 1], np.full((size, size), 0.5)])
    nlo = blur(nxy, 16)
    nxy = (nlo + (nxy - nlo) * NORMAL_DETAIL)[..., :2]
    n_out[..., :2] = 0.5 + (nxy - 0.5) * (1 - neck)
    n_out[..., 2] = 1 - hair
    # roughness near vanilla's even value, keeping a quarter of FF7R's variation (lips glossier, ears and hairline
    # rougher)
    skin_rough = np.median(rough[hair < 0.2])
    roughness = np.clip(VANILLA_MASK[1] + 0.25 * (rough - skin_rough), 0.32, 0.65)
    n2 = neck[..., 0]
    roughness = roughness * (1 - n2) + VANILLA_MASK[1] * n2
    print(f"  face mask: FF7R skin roughness {skin_rough:.2f}; neck texels {int((n2 > 0.5).sum())}")
    m_out = np.dstack([np.full((size, size), VANILLA_MASK[0]), roughness, np.full((size, size), VANILLA_MASK[2]),
                       np.ones((size, size))])
    for kind, img in (("base", np.dstack([base, np.ones((size, size))])), ("norm", n_out), ("mask", m_out)):
        png = os.path.join(TMP, f"aerith_face_{kind}.png")
        Image.fromarray(np.clip(img * 255 + 0.5, 0, 255).astype(np.uint8), "RGBA").save(png)
        subprocess.run([TEXCONV, "-nologo", "-y", "-f", "BC7_UNORM", "-m", "0", "-sepalpha", "-o", TMP, png], check=True,
                       stdout=subprocess.DEVNULL)
        out = os.path.join(MOD, *FACE_TEX[kind].split("/"))
        os.makedirs(os.path.dirname(out), exist_ok=True)
        dds_to_tex(png[:-4] + ".dds", out)
        print("TEX", FACE_TEX[kind])


def id_map(gloss):
    """_id: colour-table pair 0, blended toward its glossy first row by G = gloss."""
    z = np.zeros(gloss.shape, np.float32)
    return np.dstack([z, np.clip(gloss, 0, 1), z, np.ones(gloss.shape, np.float32)])


def build_legacy(key, col, nrm, spec, gloss, alpha=None):
    """A characterlegacy set (_d, _n, _s, _id) for the eyes, mouth and lashes."""
    h, w = col.shape[:2]
    n_out = np.ones((h, w, 4), np.float32)
    n_out[..., :2] = 0.5 if nrm is None else np.dstack([nrm[..., 0], 1 - nrm[..., 1]])
    n_out[..., 2] = 1 if alpha is None else alpha
    write(key, "d", np.dstack([lift_diffuse(key, col), np.ones((h, w))]))
    write(key, "n", n_out)
    write(key, "s", np.dstack([np.full((h, w), spec)] * 3 + [np.ones((h, w))]))
    write(key, "id", id_map(np.full((64, 64), gloss, np.float32)))


def build_face_parts():
    eye = np.asarray(Image.open(os.path.join(SRC, "PC0003_00_Eye_C.png")).convert("RGB")).astype(np.float32) / 255
    build_legacy("EYE", eye, None, 0.5, 0.9)              # wet and glossy
    mouth = np.asarray(Image.open(os.path.join(SRC, "Common_LightMouth_Player_C.png")).convert("RGB")).astype(np.float32) / 255
    mn = np.asarray(Image.open(os.path.join(SRC, "Common_Mouth_Player_N.png")).convert("RGB")).astype(np.float32) / 255
    build_legacy("MTH", mouth, mn, 0.3, 0.6)
    lash = np.ones((64, 64, 3), np.float32) * np.array([0.09, 0.06, 0.045], np.float32)   # dark brown lashes
    build_legacy("LSH", lash, None, 0.05, 0.2)


if __name__ == "__main__":
    os.makedirs(TMP, exist_ok=True)
    for k in (sys.argv[1:] or list(SETS) + ["FACE"]):
        if k == "FACE":
            build_face_skin()
            build_face_parts()
        else:
            build(k)
    old = os.path.join(MOD, *f"{TEX_DIR}/aerith_id.tex".split("/"))     # the shared row-0 map before 1.3.0
    if os.path.exists(old):
        os.remove(old)
