"""Bake FF7R textures into FFXIV diffuse/normal/specular maps and write the
matching characterlegacy.shpk materials into the mod folder.

Colour lift (1.1.0, Neon 1.2.0's, LIFT): every _d (jacket, trousers, face, hair, eyes, mouth) gets its luminance raised
by a gamma (dark and mid tones most), hue kept, then saturation scaled in linear light. The _d alpha (opacity) and the
_n / _s maps are unchanged."""
import os
import struct
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tt_wrap  # noqa: E402
from mtrl import Mtrl  # noqa: E402

ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "source")
WORK = os.path.join(ROOT, "work", "tex")
MOD = os.path.join(ROOT, "out", "mod")
TEXCONV = os.path.join(HERE, "tt", "converters", "texconv.exe")
SET = "e0263"
TEX_DIR = f"chara/equipment/{SET}/texture"
MAT_DIR = f"chara/equipment/{SET}/material/v0001"
ID_TEX = f"{TEX_DIR}/cloud_id.tex"

# material -> source textures and shading options
MATERIALS = {
    # BodyA_O, BodyB_O and Eye_O are baked for a second UV set that isn't in the export, so they're unused.
    "top_a": dict(c="PC0000_00_BodyA_C", n="PC0000_00_BodyA_N", rough="PC0000_00_BodyA_M_Roughness",
                  metal="PC0000_00_BodyA_M_Metallic", alpha="PC0000_00_BodyA_A"),
    "top_b": dict(c="PC0000_00_BodyB_C", n="PC0000_00_BodyB_N", rough="PC0000_00_BodyB_M_Roughness",
                  metal="PC0000_00_BodyB_M_Metallic"),
    "glv_a": dict(c="PC0000_00_Head_C", n="PC0000_00_Head_N", ao="PC0000_00_Head_O", rough="PC0000_00_Head_M_Roughness",
                  ao_strength=0.35),
    "glv_b": dict(c="PC0000_00_Hair_C", n="PC0000_00_Hair_N", rough="PC0000_00_Hair_M_Roughness", alpha="PC0000_00_Hair_A",
                  variant="PC0000_00_Hair_M_Variant", tint=(1.0, 0.86, 0.58), double_sided=True),
    "dwn_a": dict(c="PC0000_00_Eye_C", spec=0.35),
    "dwn_b": dict(c="Common_Mouth_Player_C", n="Common_Mouth_Player_N", ao="Common_Mouth_Player_O",
                  rough="Common_Mouth_Player_M_Roughness", ao_strength=0.7),
}

# The user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color intensity is what im looking for"
LIFT = {m: (1.4, 1.2) for m in MATERIALS}       # material -> (luminance gamma, saturation) for its _d
LUMA = np.array([0.2126, 0.7152, 0.0722])

COLOR_ROW = [1, 1, 1, 12, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
             0, 0, 0, 0, 0, 0, 0, 0, 0, 0.008, 1, 0, 16, 0, 0, 16]


def load(name, mode="L", size=None):
    im = Image.open(os.path.join(SRC, name + ".png"))
    if mode == "L" and im.mode in ("LA", "RGB", "RGBA"):
        im = im.getchannel(0)
    else:
        im = im.convert(mode)
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0


def to_u8(a):
    return (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)


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


def bake(mat, cfg):
    base = load(cfg["c"], "RGB")
    size = (base.shape[1], base.shape[0])
    alpha = load(cfg["alpha"], size=size) if "alpha" in cfg else np.ones(base.shape[:2], np.float32)
    ao = load(cfg["ao"], size=size) if "ao" in cfg else np.ones(base.shape[:2], np.float32)
    metal = load(cfg["metal"], size=size) if "metal" in cfg else np.zeros(base.shape[:2], np.float32)
    rough = load(cfg["rough"], size=size) if "rough" in cfg else np.full(base.shape[:2], 0.6, np.float32)
    ao = 1.0 - cfg.get("ao_strength", 0.5) * (1.0 - ao)

    diffuse = base * ao[..., None]
    if "tint" in cfg:
        diffuse = diffuse * np.asarray(cfg["tint"], np.float32)
    if "variant" in cfg:
        diffuse = diffuse * (0.72 + 0.28 * load(cfg["variant"], size=size))[..., None]
    diffuse = diffuse * (1.0 - 0.45 * metal)[..., None]

    gloss = (1.0 - rough) ** 2
    dielectric = cfg.get("spec", 0.04) + 0.30 * gloss
    spec = dielectric[..., None] * (1 - metal[..., None]) + (0.75 * base * (0.4 + 0.6 * gloss)[..., None]) * metal[..., None]
    if "spec" in cfg:
        spec = np.full_like(spec, cfg["spec"])
    spec = spec * ao[..., None]

    if "n" in cfg:
        n = load(cfg["n"], "RGB", size=size)
        n[..., 1] = 1.0 - n[..., 1]  # FF7R/UE4 is green-down; FFXIV is green-up
    else:
        n = np.zeros(base.shape, np.float32)
        n[..., 0] = n[..., 1] = 0.5
    normal = np.dstack([n[..., 0], n[..., 1], alpha, np.ones_like(alpha)])

    d_rgb = lift(to_u8(diffuse), *LIFT[mat]) if mat in LIFT else to_u8(diffuse)

    half = (max(size[0] // 2, 256), max(size[1] // 2, 256))
    out = {
        "d": Image.fromarray(np.dstack([d_rgb, to_u8(alpha)]), "RGBA"),
        "n": Image.fromarray(to_u8(normal), "RGBA"),
        "s": Image.fromarray(to_u8(np.dstack([spec, np.ones_like(alpha)])), "RGBA").resize(half, Image.LANCZOS),
    }
    return out


def encode(png_path, game_path):
    dds_dir = os.path.join(WORK, "dds")
    os.makedirs(dds_dir, exist_ok=True)
    subprocess.run([TEXCONV, "-nologo", "-y", "-f", "BC7_UNORM", "-m", "0", "-o", dds_dir, png_path],
                   check=True, capture_output=True)
    dds = os.path.join(dds_dir, os.path.splitext(os.path.basename(png_path))[0] + ".dds")
    tex = os.path.join(MOD, *game_path.split("/"))
    os.makedirs(os.path.dirname(tex), exist_ok=True)
    tt_wrap.wrap_texture(dds, tex)
    return tex


def write_mtrl(mat, double_sided):
    m = Mtrl()
    m.shader = "characterlegacy.shpk"
    m.textures = [(f"{TEX_DIR}/cloud_{mat}_{k}.tex", 0) for k in "dns"] + [(ID_TEX, 0)]
    m.uv_sets = [("map1", 0, 0)]
    m.color_sets = [("colorSet1", 0, 0)]
    m.additional = struct.pack("<I", 0x534)  # 8x32 colour table, no dye table
    m.color_table = np.tile(np.asarray(COLOR_ROW, np.float16), 32).tobytes()
    m.shader_keys = [(0xB616DC5A, 0x600EF9DF), (0xF52CCF05, 0xA7D2FF60)]  # diffuse texture mode
    for cid, val in [(0x29AC0223, 0.5), (0xB7FA33E2, 1.0), (0x15B70E35, 0.0), (0x641E0F22, 1.0),
                     (0xD26FF0AE, 1.0), (0x39551220, 0.0)]:
        m.set_constant(cid, [val])
    m.samplers = [(0x115306BE, 0x000F8340, 0), (0x0C5EC1F1, 0x000F8000, 1),
                  (0x8A4E82B6, 0x000F8340, 2), (0x565F8FD8, 0x000F8000, 3)]
    m.flags = 0x0C if double_sided else 0x0D  # bit 0 hides backfaces
    data = m.build()
    assert Mtrl.parse(data).build() == data
    path = os.path.join(MOD, *MAT_DIR.split("/"), f"mt_c0101{SET}_{mat}.mtrl")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(data)
    return path


def main():
    only = sys.argv[1:]
    png_dir = os.path.join(WORK, "png")
    os.makedirs(png_dir, exist_ok=True)
    idp = os.path.join(png_dir, "cloud_id.png")
    Image.new("RGBA", (8, 8), (0, 0, 0, 255)).save(idp)
    encode(idp, ID_TEX)
    for mat, cfg in MATERIALS.items():
        if only and mat not in only:
            continue
        for kind, im in bake(mat, cfg).items():
            p = os.path.join(png_dir, f"cloud_{mat}_{kind}.png")
            im.save(p)
            encode(p, f"{TEX_DIR}/cloud_{mat}_{kind}.tex")
        write_mtrl(mat, cfg.get("double_sided", False))
        print("built", mat)


if __name__ == "__main__":
    main()
