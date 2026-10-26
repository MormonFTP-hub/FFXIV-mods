"""Build every file of the Hero Chaos Chao mod into work/build (index.json lists them by game path).

One body model holds both the vanilla mammet and the Chao, told apart by attributes that the
model's IMC variants switch on and off (the vanilla model already does this for the GC flag):
  atr_bv_a  mammet body and flag   vanilla: off for Mammet #001 (variant 1), on for the GC mammets (2-4)
  atr_bv_b  Chao                   on for variant 1; pack.py's IMC edits turn it off for 2-4 (or swap them)
Mammet #001 shows the Chao with the vanilla IMC as it is, so it does not depend on the IMC edit.
"""
import json
import os
import shutil

import numpy as np
from PIL import Image

import chaosrc
import fit
import xivdata as xd
from gltf_writer import write_glb
from xiv_skeleton import Skeleton

B = os.path.join(xd.ROOT, "work", "build")
BODY = f"{fit.MAMMET}/obj/body/b0001"
MDL_PATH = f"{BODY}/model/m8001b0001.mdl"
TEX = f"{BODY}/texture/chao_{{}}.tex"
MATERIAL_SETS = (1, 2, 3, 4)          # v0001 Mammet #001, v0002-v0004 the GC mammets
MAMMET_ATTR, CHAO_ATTR = "atr_bv_a", "atr_bv_b"
DIFFUSE = {"c": "al_hcha00.png", "d": "al_hcha01.png", "e": "al_hcha02.png", "f": "HeroChaosChaoEyeColor.png"}
SPECULAR = {"c": 70, "d": 70, "e": 70, "f": 150}   # legacy specular map grey level; eyes a little glossier
# Colour lift (1.1.0, Neon's, the user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color
# intensity is what im looking for"). texture set -> (luminance gamma, saturation), applied to each diffuse band.
LIFT = {"c": (1.4, 1.2), "d": (1.4, 1.2), "e": (1.4, 1.2), "f": (1.4, 1.2)}
LUMA = np.array([0.2126, 0.7152, 0.0722])
# The four texture sets (fit.MATERIALS) share one material, mt_m8001b0001_c: a model may name at most 4 materials
# (Penumbra's MdlMaterialMaximum; vanilla monsters never exceed it) and the vanilla mammet keeps its own a and b.
# Its diffuse and specular maps are atlases of full-width bands, one per set, top to bottom in DIFFUSE's order.
# A band spans the whole width, so u is untouched and the sampler's wrap still repeats a set across it (the arms'
# u runs 0..2). v moves into the band, inset by PAD rows that repeat the band's edge, so filtering and the small
# mips don't bleed one set into the next.
ATLAS_MATERIAL = "c"
TEX_SIZE = 256                        # band width and height; the SA2 textures are 32x32 (eye 16x16), upscaled smoothly
PAD = 16                              # rows of edge padding above and below each band's texture
SPEC_SIZE = 64                        # the specular atlas's bands are flat, so it is smaller (same layout)


def band_v(s, v):
    """v (0 = top) of texture set s in the atlas."""
    r = list(DIFFUSE).index(s)
    return (r * TEX_SIZE + PAD + v * (TEX_SIZE - 2 * PAD)) / (TEX_SIZE * len(DIFFUSE))


def path(*p):
    full = os.path.join(B, *p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    return full


# ---------------------------------------------------------------- model

def mammet_nodes(skel):
    """The vanilla mammet's LOD0, one node per submesh, keeping its attributes and adding atr_bv_a."""
    nodes = []
    for mi, m in enumerate(fit.mammet(skel)):
        for si, attrs in enumerate(m["sub_attrs"]):
            tri = m["faces"][m["tri_sub"] == si]
            used = np.unique(tri)
            remap = np.full(len(m["pos"]), -1)
            remap[used] = np.arange(len(used))
            idx = remap[tri].reshape(-1)
            pos, nrm, uv = m["pos"][used], m["nrm"][used], m["uv"][used]
            nodes.append({"name": f"mammet_{mi}.{si}", "material": "/" + m["material"].lstrip("/"),
                          "positions": pos, "normals": nrm, "uvs": uv,
                          "tangents": fit.tangents(pos, nrm, uv, idx), "colors": m["col"][used] / 255.0,
                          "joints": m["joints"][used], "weights": m["weights"][used], "indices": idx,
                          "attributes": sorted(set(attrs) | {MAMMET_ATTR})})
    return nodes


def chao_nodes(skel, first_mesh):
    nodes = []
    for k, m in enumerate(fit.chao(skel)):
        n = len(m["positions"])
        uv = np.c_[m["uvs"][:, 0], band_v(m["suffix"], m["uvs"][:, 1])]   # tangents don't change: v only scales
        nodes.append({"name": f"chao_{first_mesh + k}.0", "material": f"/mt_m8001b0001_{ATLAS_MATERIAL}.mtrl",
                      "positions": m["positions"], "normals": m["normals"], "uvs": uv, "tangents": m["tangents"],
                      "colors": np.ones((n, 4)), "joints": m["joints"], "weights": m["weights"],
                      "indices": m["indices"], "attributes": [CHAO_ATTR]})
    return nodes


def build_model(skel):
    mammet = mammet_nodes(skel)
    nodes = mammet + chao_nodes(skel, len({n["name"].split("_")[1].split(".")[0] for n in mammet}))
    glb = path("glb", "m8001b0001.glb")
    write_glb(glb, skel, nodes)
    mdl = path("mdl", "m8001b0001.mdl")
    out = xd.xivtool("import", glb, mdl)
    warn = [l for l in out.splitlines() if l.startswith("WARN")]
    print("  ", out.strip().splitlines()[-1], f"({len(warn)} warnings)")
    for w in warn[:5]:
        print("    ", w)
    # the importer writes no flags and a 1 m radius: keep the vanilla ones (WavingAnimationDisabled, 0.81 m)
    xd.xivtool("mdlflags", mdl, mdl, xd.extract(MDL_PATH)[0])
    return {MDL_PATH: mdl}


# ---------------------------------------------------------------- textures and materials

def rgba_tex(rgba, name, fmt):
    rgba = np.ascontiguousarray(rgba, np.uint8)
    raw = path("tex", name + ".raw")
    rgba.tofile(raw)
    out = path("tex", name + ".tex")
    xd.xivtool("rgba2tex", raw, rgba.shape[1], rgba.shape[0], out, fmt)
    os.remove(raw)
    return out


def flat(rgba, size=64):
    return np.zeros((size, size, 4), np.uint8) + np.array(rgba, np.uint8)


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


def build_textures():
    files = {}
    bands = []
    for s, name in DIFFUSE.items():
        im = Image.open(os.path.join(chaosrc.SRC, name)).convert("RGBA").resize((TEX_SIZE, TEX_SIZE - 2 * PAD),
                                                                                 Image.BICUBIC)
        band = np.asarray(im).copy()
        if s in LIFT:
            band[..., :3] = lift(band[..., :3], *LIFT[s])      # alpha untouched
        bands.append(np.pad(band, ((PAD, PAD), (0, 0), (0, 0)), mode="edge"))
    d = np.vstack(bands)
    d[..., 3] = 255
    files[TEX.format("d")] = rgba_tex(d, "chao_d", "bc7")
    spec = np.vstack([flat([SPECULAR[s]] * 3 + [255], SPEC_SIZE) for s in DIFFUSE])
    files[TEX.format("s")] = rgba_tex(spec, "chao_s", "bgra")
    files[TEX.format("n")] = rgba_tex(flat([128, 128, 255, 255]), "chao_n", "bgra")
    files[TEX.format("id")] = rgba_tex(flat([18, 255, 0, 255]), "chao_id", "bgra")   # same as the mammet's
    return files


def build_materials():
    template = xd.extract(f"{BODY}/material/v0001/mt_m8001b0001_a.mtrl")[0]   # characterlegacy.shpk
    files = {}
    s = ATLAS_MATERIAL
    spec = {"textures": [TEX.format("d"), TEX.format("n"), TEX.format("s"), TEX.format("id")],
            "baseRow": 0}   # every colour table row = row 0: white diffuse and specular, no glow
    sp = path("mtrl", f"{s}.json")
    json.dump(spec, open(sp, "w"))
    out = path("mtrl", f"mt_m8001b0001_{s}.mtrl")
    xd.xivtool("mtrlbuild", template, out, sp)
    for v in MATERIAL_SETS:
        files[f"{BODY}/material/v{v:04d}/mt_m8001b0001_{s}.mtrl"] = out
    return files


def build():
    if os.path.isdir(B):
        shutil.rmtree(B)
    skel = Skeleton(fit.SKEL)
    print("model")
    files = build_model(skel)
    print("textures")
    files.update(build_textures())
    print("materials")
    files.update(build_materials())
    json.dump(files, open(path("index.json"), "w"), indent=1)
    print(f"{len(files)} files")


if __name__ == "__main__":
    build()
