"""Convert Jotaro's PNG textures into FFXIV .tex files and build the matching .mtrl files.

usage: python make_textures.py            -> work/mod/<game path> files + work/mod/files.json

Everything on Jotaro uses one 2048x1024 atlas (four colour variants of it: white, purple, blue,
lavender), plus the iris and eyelash textures. Materials are copies of a vanilla Dawntrail
character.shpk material (base/norm/mask/id) with every colour-table row neutral, so the painted
textures show as they are.

Skin (1.1.0): his face and hands use skin.shpk, cloned from the vanilla Midlander male face (fac_a) and body
(glv_b) materials, like the game's own skin and the Aerith port's face. On the gear shader his skin went dull and
dark whenever the sun wasn't on it (GS, backlit; in game he "came out darker"). skin.shpk multiplies _base by the
character's skin colour where _norm B is 1, so the atlas's skin texels are rescaled to the vanilla face albedo (the
painted lines and hatching keep their colour, B = 0). The cap and hair stay on the atlas material (etc_a).

Colour lift (1.2.0): the atlas variants and the iris go through Neon's lift (LIFT, lift()); the skin set is made from
the unlifted atlas.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mtrl import Mtrl  # noqa: E402
from tex import FMT_BC1, FMT_BC3, FMT_BGRA8, write_tex  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source", "Jotaro Kujo (Part 4)", "Textures")
GAME = os.path.join(ROOT, "work", "game")
MOD = os.path.join(ROOT, "work", "mod")
SET, RACE, FACE = "e0279", "c0101", "f0001"
TEMPLATE = "chara/equipment/e0039/material/v0001/mt_c0101e0039_top_a.mtrl"      # character.shpk, base/norm/mask/id
ROW_TEMPLATE = "chara/equipment/e0084/material/v0002/mt_c0101e0084_top_a.mtrl"  # Dawntrail cloth row
TEX = f"chara/equipment/{SET}/texture"
SKIN_FACE_TEMPLATE = f"chara/human/{RACE}/obj/face/{FACE}/material/mt_{RACE}{FACE}_fac_a.mtrl"   # skin.shpk
SKIN_BODY_TEMPLATE = f"chara/human/{RACE}/obj/body/b0001/material/v0001/mt_{RACE}b0001_a.mtrl"  # skin.shpk
VANILLA_SKIN = np.array([160, 128, 113], np.float32) / 255  # vanilla c0101 face _base mean (sRGB)
FACE_MASK = (151 / 255, 108 / 255, 160 / 255, 1.0)           # vanilla face _mask means: specular, roughness, B
VARIANTS = {"White (default)": "t_4jtr01_body01_d.png", "Purple": "t_4jtr01_body01_d_#1.png",
            "Blue": "t_4jtr01_body01_d_#2.png", "Lavender": "t_4jtr01_body01_d_#3.png"}
# Colour lift (1.2.0, Neon's, the user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color
# intensity is what im looking for"). texset -> (luminance gamma, saturation). Only character.shpk colour maps: the
# skin set (skin.shpk, tinted by the character's skin colour) and the lashes (alpha only) stay as they are.
LIFT = {"body": (1.4, 1.2), "iris": (1.4, 1.2)}
LUMA = np.array([0.2126, 0.7152, 0.0722])

files = {}


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


def lifted(img, texset):
    """img (float RGBA 0..1) with LIFT[texset] applied to RGB; alpha untouched."""
    out = img.copy()
    rgb8 = (np.clip(img[:, :, :3], 0, 1) * 255 + 0.5).astype(np.uint8)
    out[:, :, :3] = lift(rgb8, *LIFT[texset]).astype(np.float32) / 255.0
    return out


def emit(game_path, data, local=None):
    """Write a file for game_path into the mod folder (at `local`, default the game path itself)."""
    local = local or game_path
    dst = os.path.join(MOD, *local.split("/"))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "wb") as f:
        f.write(data)
    return local.replace("/", "\\")


def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert("RGBA"), np.float32) / 255.0


def solid(rgba, size=8):
    return np.broadcast_to(np.asarray(rgba, np.float32), (size, size, 4)).copy()


def tex(name, img, fmt=FMT_BC1, local=None):
    path = f"{TEX}/jotaro_{name}.tex"
    files[path] = emit(path, write_tex(img, fmt), local)
    print(f"  {local or path} {img.shape[1]}x{img.shape[0]} fmt {fmt:#x}")
    return path


print("building textures...")
# Atlas colour: the default variant is the base file, the others are option files Penumbra swaps in.
base_path = None
variant_files = {}
for i, (label, png) in enumerate(VARIANTS.items()):
    img = lifted(load(png), "body")
    img[:, :, 3] = 1
    local = None if i == 0 else f"options/colour_{i}/jotaro_body_base.tex"
    p = tex("body_base", img, local=local)
    variant_files[label] = (local or p).replace("/", "\\")
    base_path = base_path or p
files[base_path] = variant_files["White (default)"]

norm = load("t_4jtr01_body01_n.png")
norm[:, :, 2] = 1  # blue = opacity
norm[:, :, 3] = 1
norm_path = tex("body_norm", norm)

# mask: R specular, G roughness, B ambient occlusion. The rip's specular map marks the shiny bits
# (gold buckles, the chain, the cap badge); scale it up to the atlas.
spc = Image.open(os.path.join(SRC, "t_4jtr01_body01_spc.png")).convert("L").resize((1024, 512), Image.BILINEAR)
spc = np.asarray(spc, np.float32) / 255.0
mask = np.ones((512, 1024, 4), np.float32)
mask[:, :, 0] = 0.35 + 0.65 * spc
mask[:, :, 1] = 0.8 - 0.45 * spc
mask[:, :, 2] = 1.0
mask_path = tex("body_mask", mask)
id_path = tex("id", solid((0, 0, 0, 1)), FMT_BGRA8)


def box_blur(a, passes=2):
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
    return a


# Skin set (skin.shpk): bright skin texels set the rescale and get the skin-colour tint (B); everything else on the
# atlas keeps its colour (only the skin triangles use these textures)
atlas = load(VARIANTS["White (default)"])
rgb = atlas[:, :, :3]
mx, mn = rgb.max(2), rgb.min(2)
sat = (mx - mn) / np.maximum(mx, 1e-4)
skin = (rgb[:, :, 0] > rgb[:, :, 1]) & (rgb[:, :, 1] > rgb[:, :, 2]) & (mx > 110 / 255) & (sat > 0.2) & (sat < 0.65)
ratio = VANILLA_SKIN / rgb[skin].mean(0)
print(f"  skin: {skin.mean() * 100:.0f}% of the atlas, mean {np.round(rgb[skin].mean(0) * 255)} -> x{np.round(ratio, 3)}")
skin_base = atlas.copy()
skin_base[:, :, :3] = np.clip(rgb * ratio, 0, 1)
skin_base[:, :, 3] = 1
skin_base_path = tex("skin_base", skin_base)
skin_norm = norm.copy()
skin_norm[:, :, 2] = box_blur(skin.astype(np.float32))
skin_norm[:, :, 3] = 0
skin_norm_path = tex("skin_norm", skin_norm, FMT_BC3)
face_mask_path = tex("face_mask", solid(FACE_MASK), FMT_BGRA8)

# Iris: the rip centres it on the texture corner (wrapping); roll it to the middle (the model's
# UVs were shifted by half to match).
iris = load("t_4jtr01_iris.png")
iris = lifted(np.roll(iris, (iris.shape[0] // 2, iris.shape[1] // 2), (0, 1)), "iris")
iris[:, :, 3] = 1
iris_path = tex("iris_base", iris)

# Eyelashes: black strokes in the alpha channel; alpha-tested through base alpha and normal blue.
lash_a = load("t_4jtr01_eyelash.png")[:, :, 3]
lash = np.zeros(lash_a.shape + (4,), np.float32)
lash[:, :, 3] = (lash_a > 0.35).astype(np.float32)
lash_path = tex("lash_base", lash, FMT_BC3)
lash_norm = np.ones_like(lash)
lash_norm[:, :, 0] = lash_norm[:, :, 1] = 0.5
lash_norm[:, :, 2] = lash[:, :, 3]
lash_norm_path = tex("lash_norm", lash_norm, FMT_BC3)
flat_norm_path = tex("flat_norm", solid((0.5, 0.5, 1, 1)), FMT_BGRA8)
eye_mask_path = tex("eye_mask", solid((0.9, 0.15, 1, 1)), FMT_BGRA8)

# ----------------------------------------------------------------- materials
template = open(os.path.join(GAME, *TEMPLATE.split("/")), "rb").read()
rows_src = Mtrl(open(os.path.join(GAME, *ROW_TEMPLATE.split("/")), "rb").read())
row = np.frombuffer(rows_src.data_set[:2048], np.float16).reshape(32, 32).astype(np.float32)[0].copy()
row[0:3] = 1.0   # diffuse multiplier: let the base texture through untouched
row[8:11] = 0.0  # no emissive
row[26] = 0.0    # no tiled detail overlay
print("colour row", np.round(row, 3))


DECAL_KEY, DECAL_OFF = 0xD2777173, 0x4242B842


def build_mtrl(base, norm_tex, mask_tex):
    m = Mtrl(template)
    m.textures = [[base, 0], [norm_tex, 0], [mask_tex, 0], [id_path, 0]]
    # character.shpk's decal key: the e0039 body template has it on (Free Company crests). In the face slot the game
    # binds the character's FACE PAINT as that decal, and face paints are masks with full alpha, so the face, irises
    # and lashes took the paint colour (Sora 1.1.0 in game). Vanilla's no-decal value, as hands, legs and feet use.
    m.keys = [[k, DECAL_OFF if k == DECAL_KEY else v] for k, v in m.keys]
    table = np.tile(row.astype(np.float16), (32, 1))
    m.data_set = table.tobytes() + bytes(len(m.data_set) - 2048)  # empty dye table
    return m.to_bytes()


body = build_mtrl(base_path, norm_path, mask_path)
first = None
for slot in ("top", "glv", "dwn", "sho"):
    gp = f"chara/equipment/{SET}/material/v0001/mt_{RACE}{SET}_{slot}_a.mtrl"
    if first is None:
        first = files[gp] = emit(gp, body)
    else:
        files[gp] = first  # Penumbra can point many game paths at one file
face_dir = f"chara/human/{RACE}/obj/face/{FACE}/material"
files[f"{face_dir}/mt_{RACE}{FACE}_etc_a.mtrl"] = first  # the cap and hair share the body atlas


def clone(template_path, textures):
    """A vanilla material with its textures swapped (None keeps the template's own, e.g. the shared skin mask)."""
    m = Mtrl(open(os.path.join(GAME, *template_path.split("/")), "rb").read())
    assert len(textures) == len(m.textures), (template_path, len(m.textures))
    m.textures = [[t or old, f] for t, (old, f) in zip(textures, m.textures)]
    return m.to_bytes()


files[f"{face_dir}/mt_{RACE}{FACE}_fac_a.mtrl"] = emit(f"{face_dir}/mt_{RACE}{FACE}_fac_a.mtrl",
                                                      clone(SKIN_FACE_TEMPLATE, [skin_base_path, skin_norm_path,
                                                                                 face_mask_path]))
glv_b = f"chara/equipment/{SET}/material/v0001/mt_{RACE}{SET}_glv_b.mtrl"
files[glv_b] = emit(glv_b, clone(SKIN_BODY_TEMPLATE, [skin_base_path, skin_norm_path, None]))
files[f"{face_dir}/mt_{RACE}{FACE}_iri_a.mtrl"] = emit(f"{face_dir}/mt_{RACE}{FACE}_iri_a.mtrl",
                                                      build_mtrl(iris_path, flat_norm_path, eye_mask_path))
files[f"{face_dir}/mt_{RACE}{FACE}_etc_b.mtrl"] = emit(f"{face_dir}/mt_{RACE}{FACE}_etc_b.mtrl",
                                                      build_mtrl(lash_path, lash_norm_path, eye_mask_path))

with open(os.path.join(MOD, "files_textures.json"), "w") as f:
    json.dump(dict(files=files, variants=variant_files, variant_game_path=base_path), f, indent=1, sort_keys=True)
print(f"wrote {len(files)} game paths")
