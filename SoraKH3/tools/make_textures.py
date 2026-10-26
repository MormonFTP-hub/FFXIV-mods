"""Convert Sora's KH3 PNG textures into FFXIV .tex files and build matching .mtrl files.

run_blender.ps1 make_textures.py <game_dir> <sora_source_dir> <mod_dir>

Writes files under <mod_dir>/<game path> and <mod_dir>/files.json (game path -> mod-relative file).
Clothes and eyes: cloned from a vanilla Dawntrail character.shpk material that samples a base (colour) texture, with
every colour-table row set to a neutral white so the textures show as-is.
Skin (face, neck, arms, legs; 1.2.0): skin.shpk, cloned from the vanilla Midlander male face and body materials, as
the game's own skin and Aerith's face. Lit by the gear shader, his skin went grey and dim whenever the sun wasn't on
it (GS, backlit), while vanilla skin keeps its warmth. skin.shpk multiplies _base by the character's skin colour where
_norm B is 1, so his skin texels are rescaled to the vanilla face albedo (features keep their colour, B = 0), and the
Glamourer design sets a light skin colour.
Hair (1.2.0): characterlegacy.shpk, Aerith's recipe: grey _s specular colour, colour-table rows with shininess 32
(even) / 3 (odd) blended by _id G. On character.shpk it read as matte clay with white streaks.
Colour lift (1.3.0): gear sets A/B/C, the eye atlas (iris, eye whites, mouth) and the hair _d go through Neon's
lift (LIFT, lift()); the skin sets are made from the unlifted maps.
2.0.0 (every race, head in the hat slot of the Air Cell set e0907): every texture lives in the set's folder and each
material serves every fitted race's file name. Clothes get more saturation (user: "maybe sat clothes a little
more?"). Skin keeps the look the user approved on 1.3.0 everywhere: the tint his design's skin colour (Midlander man
swatch 1) gave is baked into _base and _norm B is 0, so a character's own skin colour no longer changes Sora.
"""
import json
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from atlas import CELL_PX, cell_slice
from mtrl import Mtrl
from sqpack import Repo
from tex import FMT_BC1, FMT_BC3, FMT_BGRA8, write_tex

GAME_DIR, SRC, MOD = sys.argv[1:4]
SET, RACE, FACE = "e0907", "c0101", "f0001"     # RACE / FACE: the vanilla skin materials cloned for the skin sets
FIT_RACES = ("c0101", "c0201", "c0901", "c1101")
TEMPLATE = "chara/equipment/e0039/material/v0001/mt_c0101e0039_top_a.mtrl"  # character.shpk + base texture
ROW_TEMPLATE = "chara/equipment/e0084/material/v0002/mt_c0101e0084_top_a.mtrl"  # remastered cloth/metal rows

GEAR_TEX = FACE_TEX = HAIR_TEX = f"chara/equipment/{SET}/texture"
SKIN_SWATCH = np.array([0.9098, 0.8941, 0.8549], np.float32)  # Midlander man skin swatch 1 (1.2.0-1.3.0's design)

# Colour lift (1.3.0, Neon's, the user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color
# intensity is what im looking for"). texset -> (luminance gamma, saturation). Gear sets A/B/C (character.shpk), the
# eye atlas's iris, eye-white and mouth cells, and the legacy hair _d. The skin sets (skin.shpk, tinted by the
# character's skin colour) are made from the unlifted maps, and the lash cell (alpha only) keeps its colour.
# The hair is backed off to (1.2, 1.0): at (1.4, 1.2) his chestnut turned ginger-orange in GS (work/lift/cmp_lift.png).
# 2.0.0: clothes saturation 1.2 -> 1.35 (user on 1.3.0 in game: "maybe sat clothes a little more? face and skin good
# hair too")
LIFT = {"a": (1.4, 1.35), "b": (1.4, 1.35), "c": (1.4, 1.35), "eye": (1.4, 1.2), "hair": (1.2, 1.0)}
EYE_LIFT_CELLS = ("iris", "eyewhite", "mouth")
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
    """img (float RGBA 0..1, sRGB-encoded) with LIFT[texset] applied to RGB; alpha untouched."""
    out = img.copy()
    rgb8 = (np.clip(img[:, :, :3], 0, 1) * 255 + 0.5).astype(np.uint8)
    out[:, :, :3] = lift(rgb8, *LIFT[texset]).astype(np.float32) / 255.0
    return out


def emit(game_path, data):
    dst = os.path.join(MOD, *game_path.split("/"))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "wb") as f:
        f.write(data)
    files[game_path] = game_path.replace("/", "\\")


def load(name):
    img = bpy.data.images.load(os.path.join(SRC, name))
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    px = np.array(img.pixels[:], np.float32).reshape(h, w, 4)[::-1].copy()
    bpy.data.images.remove(img)
    return px


def resize(img, size):
    if img.shape[0] == size:
        return img
    tmp = bpy.data.images.new("tmp", img.shape[1], img.shape[0], alpha=True, float_buffer=True)
    tmp.pixels[:] = img[::-1].ravel()
    tmp.scale(size, size)
    out = np.array(tmp.pixels[:], np.float32).reshape(size, size, 4)[::-1].copy()
    bpy.data.images.remove(tmp)
    return out


def srgb(linear):
    c = np.asarray(linear, np.float32)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(np.maximum(c, 0), 1 / 2.4) - 0.055)


def solid(rgba, size=4):
    return np.broadcast_to(np.asarray(rgba, np.float32), (size, size, 4)).copy()


def make_norm(normal_png, opacity=None, size=None):
    n = load(normal_png) if isinstance(normal_png, str) else normal_png
    if size:
        n = resize(n, size)
    out = np.ones_like(n)
    out[:, :, 0] = n[:, :, 0]
    out[:, :, 1] = n[:, :, 1]
    out[:, :, 2] = 1.0 if opacity is None else resize(opacity, n.shape[0])[:, :, 0]
    return out


def make_mask(ao, roughness, size=None):
    if ao is None:
        ao = solid((1, 1, 1, 1), size or 4)
    elif size:
        ao = resize(ao, size)
    a = 0.5 + 0.5 * ao[:, :, 0]  # KH AO maps are black outside each material's islands
    out = np.ones(ao.shape, np.float32)
    out[:, :, 0] = a          # specular / occlusion
    out[:, :, 1] = roughness  # roughness
    out[:, :, 2] = a          # ambient occlusion
    return out


def gray(png):
    return load(png)[:, :, :1].repeat(4, 2)


SKIN_FACE_TEMPLATE = f"chara/human/{RACE}/obj/face/{FACE}/material/mt_{RACE}{FACE}_fac_a.mtrl"   # skin.shpk
SKIN_BODY_TEMPLATE = f"chara/human/{RACE}/obj/body/b0001/material/v0001/mt_{RACE}b0001_a.mtrl"  # skin.shpk
LEGACY_TEMPLATE = "chara/equipment/e0001/material/v0001/mt_c0101e0001_top_a.mtrl"            # characterlegacy
VANILLA_SKIN = np.array([160, 128, 113], np.float32) / 255  # vanilla c0101 face _base mean (sRGB)
FACE_MASK = (151 / 255, 108 / 255, 160 / 255, 1.0)           # vanilla face _mask means: specular, roughness, B


def skin_texels(base):
    """Skin-coloured texels (warm, mid saturation, not dark): what the character's skin colour should tint."""
    rgb = base[:, :, :3]
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    return (rgb[:, :, 0] > rgb[:, :, 1]) & (rgb[:, :, 1] > rgb[:, :, 2]) & (mx > 110 / 255) & (sat > 0.2) & (sat < 0.65)


def box_blur(a, passes=2):
    for _ in range(passes):
        p = np.pad(a, 1, mode="edge")
        a = sum(p[1 + dy:p.shape[0] - 1 + dy, 1 + dx:p.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
    return a


def skin_set(base_png, norm_png):
    """(base, norm) for skin.shpk: skin texels rescaled so their mean is the vanilla face albedo, then the tint the
    1.2.0-1.3.0 design's skin colour gave them baked in; _norm B = 0 (the wearer's skin colour doesn't tint Sora on
    any race), A = 0 (no lipstick)."""
    base = load(base_png)
    sk = skin_texels(base)
    ratio = VANILLA_SKIN / base[:, :, :3][sk].mean(0)
    print(f"  skin {base_png}: {sk.mean() * 100:.0f}% of texels, mean {np.round(base[:, :, :3][sk].mean(0) * 255)} "
          f"-> x{np.round(ratio, 3)}")
    out = base.copy()
    out[:, :, :3] = np.clip(base[:, :, :3] * ratio, 0, 1)
    tint = box_blur(sk.astype(np.float32))[..., None]
    out[:, :, :3] *= (1 - tint) + tint * SKIN_SWATCH
    out[:, :, 3] = 1
    nrm = make_norm(norm_png)
    nrm[:, :, 2] = 0
    nrm[:, :, 3] = 0
    return out, nrm


# ------------------------------------------------------------------ textures
print("building textures...")
tex = {}


def put(key, folder, name, img, fmt=FMT_BC1):
    path = f"{folder}/sora_{name}.tex"
    emit(path, write_tex(img, fmt))
    tex[key] = path
    print(f"  {path} {img.shape[1]}x{img.shape[0]} fmt {fmt:#x}")


# _id R = row pair 0, G = 255 picks the pair's first row (Penumbra: rowBlend = 1 - G/255)
put("id", GEAR_TEX, "id", solid((0, 1, 0, 1), 8), FMT_BGRA8)

# Gear set A (mat0 + skin), B (mat1), C (mat2 metal)
for key, d, n, ao, rough in (("a", "p_ex001_0d00.png", "p_ex001_0n00.png", "p_ex001_0o00_r.png", 0.6),
                             ("b", "p_ex001_0d01.png", "p_ex001_0n01.png", "p_ex001_0o00_g.png", 0.65),
                             ("c", "p_ex001_0d02.png", "p_ex001_0n02.png", "p_ex001_0d02_a.png", 0.3)):
    base = lifted(load(d), key)
    base[:, :, 3] = 1
    put(f"{key}_base", GEAR_TEX, f"{key}_base", base)
    put(f"{key}_norm", GEAR_TEX, f"{key}_norm", make_norm(n))
    ao_img = gray(ao)
    put(f"{key}_mask", GEAR_TEX, f"{key}_mask", make_mask(ao_img, rough, size=min(1024, ao_img.shape[0])))

# Iris: KH3 builds it in-shader from EyeG_ColorMask channels and two colours.
r = load("EyeG_ColorMask_r.png")[:, :, 0]
g = load("EyeG_ColorMask_g.png")[:, :, 0]
size = r.shape[0]
yy, xx = np.mgrid[0:size, 0:size]
rad = np.hypot(xx - (size - 1) / 2, yy - (size - 1) / 2) / (size / 2)
profile = np.array([r[(rad >= a) & (rad < a + 0.02)].mean() for a in np.arange(0, 1, 0.02)])
edge = 0.02 * (np.argmax(profile[10:] < 0.06) + 10) if np.any(profile[10:] < 0.06) else 0.95
print(f"  iris edge radius {edge:.2f} of texture half-width")
light = np.array([0.15, 1.0, 0.9575])
dark = np.array([0.082, 0.0943, 0.82])
t = np.clip(r * 0.75, 0, 1)[..., None]
iris_lin = (dark * (1 - t) + light * t) * (0.35 + 0.65 * g[..., None])
iris = np.ones((size, size, 4), np.float32)
iris[:, :, :3] = srgb(np.clip(iris_lin, 0, 1))
alpha = (rad < edge).astype(np.float32)
iris[:, :, 3] = alpha
flat = solid((0.5, 0.5, 1, 1), size)

# Eye whites
ew = load("EyeWhiteBaseColor.png")
ew[:, :, 3] = 1

# Eyelashes: colour from the material, mask in the texture's alpha
lash_mask = load("p_ex001_E_0d01.png")[:, :, 3]
lash = np.ones(lash_mask.shape + (4,), np.float32)
lash[:, :, :3] = srgb(np.array([0.04, 0.013927, 0.003061]))
lash[:, :, 3] = (lash_mask > 0.35).astype(np.float32)

# Mouth
mouth = load("Mouth_M_0d00.png")
mouth[:, :, 3] = 1

# One 2x2 atlas for iris / eye whites / lashes / mouth (atlas.py); opacity rides in base A and norm B.
cells = {  # cell -> (base, normal source, opacity or None, roughness)
    "iris": (iris, flat, alpha, 0.15),
    "eyewhite": (ew, load("EyeWhiteBaseNormal.png"), None, 0.3),
    "lash": (lash, load("p_ex001_E_0n01.png"), lash[:, :, 3], 0.8),
    "mouth": (mouth, load("Mouth_M_0n00.png"), None, 0.5),
}
A = 2 * CELL_PX
eye_base = np.ones((A, A, 4), np.float32)
eye_norm = np.ones((A, A, 4), np.float32)
eye_mask = np.ones((A, A, 4), np.float32)
for cell, (base, nrm, opacity, rough) in cells.items():
    rs, cs = cell_slice(cell)
    eye_base[rs, cs] = lifted(resize(base, CELL_PX), "eye") if cell in EYE_LIFT_CELLS else resize(base, CELL_PX)
    n = resize(nrm, CELL_PX)
    eye_norm[rs, cs, 0] = n[:, :, 0]
    eye_norm[rs, cs, 1] = n[:, :, 1]
    if opacity is not None:
        o = resize(np.repeat(opacity[..., None], 4, 2), CELL_PX)[:, :, 0]
        eye_norm[rs, cs, 2] = o
        eye_base[rs, cs, 3] = o
    eye_mask[rs, cs, 1] = rough
put("eye_base", FACE_TEX, "eyes_base", eye_base, FMT_BC3)
put("eye_norm", FACE_TEX, "eyes_norm", eye_norm)
put("eye_mask", FACE_TEX, "eyes_mask", eye_mask)

# Hair: KH3 colours it in-shader (HairColor -> HairPointEndColor); shade it with the hair AO.
hair_ao = gray("p_ex001_0o00_b.png")[:, :, 0]
root = srgb(np.array([0.05, 0.026687, 0.015]))
tip = srgb(np.array([0.19, 0.083055, 0.0247]))
k = np.power(np.clip(hair_ao, 0, 1), 0.6)[..., None]
hair = np.ones(hair_ao.shape + (4,), np.float32)
hair[:, :, :3] = root * (1 - k) + tip * k
# matched to the source render in GS: hair came out ~10% brighter and slightly more saturated than the rip
lum = hair[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)
hair[:, :, :3] = 0.9 * (lum[..., None] + 0.9 * (hair[:, :, :3] - lum[..., None]))
hair = lifted(hair, "hair")
# Legacy hair set (_d, _n, _s grey specular colour, _id G = gloss: 255 picks the glossy even row)
put("hir_d", HAIR_TEX, "hair_d", hair)
put("hir_n", HAIR_TEX, "hair_n", make_norm("p_ex001_H_0n00.png"))
put("hir_s", HAIR_TEX, "hair_s", solid((43 / 255, 43 / 255, 43 / 255, 1)))
put("hir_id", HAIR_TEX, "hair_id", solid((0, 148 / 255, 0, 1), 8), FMT_BGRA8)

# Skin sets (skin.shpk): face, and the arm/leg/neck skin, which lives in texture set A
fb, fn = skin_set("p_ex001_F_0d00.png", "p_ex001_F_0n00.png")
put("fac_skin_base", FACE_TEX, "fac_skin_base", fb)
put("fac_skin_norm", FACE_TEX, "fac_skin_norm", fn, FMT_BC3)
put("fac_skin_mask", FACE_TEX, "fac_skin_mask", solid(FACE_MASK))
sb, sn = skin_set("p_ex001_0d00.png", "p_ex001_0n00.png")
put("s_base", GEAR_TEX, "s_base", sb)
put("s_norm", GEAR_TEX, "s_norm", sn, FMT_BC3)

# ----------------------------------------------------------------- materials
repo = Repo(GAME_DIR)
template = repo.read(TEMPLATE)
rows_src = Mtrl(repo.read(ROW_TEMPLATE))
row_table = np.frombuffer(rows_src.data_set[:2048], np.float16).reshape(32, 32).astype(np.float32)
CLOTH_ROW = row_table[0].copy()
SHINY_ROW = row_table[0].copy()
for row in (CLOTH_ROW, SHINY_ROW):
    row[0:3] = 1.0   # diffuse multiplier: let the base texture through untouched
    row[8:11] = 0.0  # no emissive
    row[26] = 0.0    # no tiled detail overlay
# Buttons, zipper, buckle, chain and crown: glossier, but NOT metal. A metal row (half 18 = 1) rendered them
# near-black in GS (the game's metals only reflect the environment); the source shows bright silver and pale gold.
SHINY_ROW[16] = 0.35
SHINY_ROW[18] = 0.0
print("cloth row", np.round(CLOTH_ROW, 3))
print("shiny row", np.round(SHINY_ROW, 3))


DECAL_KEY, DECAL_OFF = 0xD2777173, 0x4242B842


def build_mtrl(base, norm, mask, row):
    m = Mtrl(template)
    m.textures = [[tex[base], 0], [tex[norm], 0], [tex[mask], 0], [tex["id"], 0]]
    # character.shpk's decal (crest) key: the e0039 body template has it on (0xF35F5131, as vanilla head/body gear),
    # and in the face slot the game binds the character's FACE PAINT as that decal. Face paints are BC4 masks (alpha
    # reads 1), so the paint colour covered Sora's whole face and eyes (dark in game under a black paint). Vanilla
    # hands/legs/feet use the no-decal value.
    m.keys = [[k, DECAL_OFF if k == DECAL_KEY else v] for k, v in m.keys]
    table = np.tile(row.astype(np.float16), (32, 1))
    m.data_set = table.tobytes() + bytes(len(m.data_set) - 2048)  # empty dye table
    return m.to_bytes()


def emit_shared(data, slots, letter):
    """One material file, mapped to every fitted race's name for it in each slot (Penumbra points many game paths
    at one file): chara/equipment/e0907/material/v0001/mt_<race>e0907_<slot>_<letter>.mtrl."""
    first = None
    for slot in slots:
        for race in FIT_RACES:
            gp = f"chara/equipment/{SET}/material/v0001/mt_{race}{SET}_{slot}_{letter}.mtrl"
            if first is None:
                emit(gp, data)
                first = files[gp]
            else:
                files[gp] = first


BODY_SLOTS = ("top", "glv", "dwn", "sho")
MATERIALS = {
    "a": ("a_base", "a_norm", "a_mask", CLOTH_ROW),
    "b": ("b_base", "b_norm", "b_mask", CLOTH_ROW),
    "c": ("c_base", "c_norm", "c_mask", SHINY_ROW),
}
for letter, spec in MATERIALS.items():
    emit_shared(build_mtrl(*spec), BODY_SLOTS, letter)

def clone(template_path, textures):
    """A vanilla material with its textures swapped (None keeps the template's own, e.g. the shared skin mask), and
    the decal key off where it has one."""
    m = Mtrl(repo.read(template_path))
    assert len(textures) == len(m.textures), (template_path, len(m.textures))
    m.textures = [[t or old, f] for t, (old, f) in zip(textures, m.textures)]
    m.keys = [[k, DECAL_OFF if k == DECAL_KEY else v] for k, v in m.keys]
    return m


def legacy_hair():
    m = clone(LEGACY_TEMPLATE, [tex["hir_d"], tex["hir_n"], tex["hir_s"], tex["hir_id"]])
    table = np.frombuffer(m.data_set[:2048], np.float16).reshape(32, 32).astype(np.float32).copy()
    row = table[0].copy()
    row[0:3] = 1.0    # diffuse multiplier: the texture as-is
    row[4:7] = 1.0    # specular colour multiplier: the grey _s carries the strength
    row[8:11] = 0.0   # no emissive
    for r in range(32):
        table[r] = row
        table[r, 3] = 32.0 if r % 2 == 0 else 3.0   # shininess: glossy even rows, matte odd rows
    m.data_set = table.astype(np.float16).tobytes() + bytes(len(m.data_set) - 2048)  # empty dye table
    return m.to_bytes()


# body skin: letter d on every body piece (convert_model.LETTER); the hat (met) model: a = face skin, b = eyes,
# c = hair
emit_shared(clone(SKIN_BODY_TEMPLATE, [tex["s_base"], tex["s_norm"], None]).to_bytes(), BODY_SLOTS, "d")
emit_shared(clone(SKIN_FACE_TEMPLATE, [tex["fac_skin_base"], tex["fac_skin_norm"], tex["fac_skin_mask"]]).to_bytes(),
            ("met",), "a")
emit_shared(build_mtrl("eye_base", "eye_norm", "eye_mask", CLOTH_ROW), ("met",), "b")
emit_shared(legacy_hair(), ("met",), "c")

with open(os.path.join(MOD, "files_textures.json"), "w") as f:
    json.dump(files, f, indent=1, sort_keys=True)
print(f"wrote {len(files)} game paths")
