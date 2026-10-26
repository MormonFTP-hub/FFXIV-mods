"""Build every file of the Swift Spectral Tiger mod into work/build.

Chocobo (d0001, every chocobo mount without barding):
  - the chocobo body (e0001 top) becomes the tiger, head/legs/feet pieces become empty models
  - the chocobo skeleton, its attachment points, IK settings and physics are replaced by the
    FFXIV tiger's (m0464), so the tiger walks, runs, jumps, swims and flies with real tiger
    animations; the chocobo's mount, idle and companion animation sets are rebuilt from the
    FFXIV tiger's mount animations (chocobo-only names point at the nearest tiger animation)
FFXIV tigers (m0464 bodies 1-3: Centurio / war / battle tiger), optional:
  - the tiger body model is replaced, nothing else is needed (same skeleton)
"""
import json
import os
import shutil
import struct

import numpy as np
from PIL import Image

import xivdata as xd
from gltf_writer import write_glb
from pap import Pap, PapAnim
from reshape import SKEL, reshape
from weights import skin
from wowsrc import WowModel
from xiv_skeleton import Skeleton

B = os.path.join(xd.ROOT, "work", "build")
CHOCO = "chara/demihuman/d0001"
EQ = f"{CHOCO}/obj/equipment/e0001"
TIGER = "chara/monster/m0464"
TEX = f"{EQ}/texture/sst_{{}}.tex"
CHOCO_SLOTS = ("met", "top", "dwn", "sho")
CHOCO_MATERIAL_SETS = (1, 2)
TIGER_BODIES = (1, 2, 3)

# WoW primitives -> (mdl mesh, material suffix)
PARTS = {0: (0, "a"), 1: (0, "a"), 2: (1, "b"), 3: (2, "c")}
MATERIALS = {
    # suffix: diffuse source, emissive (linear), specular, alpha threshold
    "a": dict(tex="body", emissive=(0.05, 0.11, 0.22), spec=0.35, alpha=0.5),
    "b": dict(tex="saddle", emissive=(0.0, 0.0, 0.0), spec=0.25, alpha=0.5),
    "c": dict(tex="eye", emissive=(0.25, 1.4, 0.35), spec=0.0, alpha=0.3),
}

# chocobo animation names the FFXIV tiger does not have -> tiger animation to use
ALIAS = {
    "cbnm_swu_01b_lp0": "cbnm_fmt_01b_lp0", "cbnm_swu_01f_lp0": "cbnm_fmt_01f_lp0",
    "cbnm_swu_01l_lp0": "cbnm_fmt_01l_lp0", "cbnm_swu_01r_lp0": "cbnm_fmt_01r_lp0",
    "cbnm_swu_02f_lp0": "cbnm_fmt_02f_lp0", "cbnm_swu_02l_lp0": "cbnm_fmt_02l_lp0",
    "cbnm_swu_02r_lp0": "cbnm_fmt_02r_lp0", "cbnm_swu_down": "cbnm_fmt_down",
    "cbnm_swu_glide_lp": "cbnm_fmt_glide_lp", "cbnm_swu_id0": "cbnm_fmt_id0", "cbnm_swu_up": "cbnm_fmt_up",
    "cbnp_1_by_eqp": "cbnm_id0", "cbbm_mgc_thm_2lp": "cbnm_id0", "cbbm_mgc_thm_3": "cbnm_id0",
}
PAPS = ("mount", "idle", "demihuman")
# Colour lift (1.1.0, Neon's, the user on Neon 1.2.0: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like color
# intensity is what im looking for"). texture -> (luminance gamma, saturation). The body and saddle diffuse only: the
# eye glow texture and the materials' emissive rows (the ghost's blue glow, the green eyes) stay as they are.
LIFT = {"body": (1.4, 1.2), "saddle": (1.4, 1.2)}
LUMA = np.array([0.2126, 0.7152, 0.0722])

# chocobo attachment points (eid) the tiger lacks: id -> (tiger bone, translation, rotation)
EID_EXTRA = {
    16: ("n_root", (0.0, 1.9, 2.3), (0, 0, 0)),
    17: ("j_head", (0.412, -0.137, 0.0), (2.758, 10.996, 6.283)),
    26: ("j_head", (0.3, -0.2, 0.0), (2.758, 10.996, 6.283)),
    27: ("j_head", (0.412, -0.137, 0.0), (2.758, 10.996, 6.283)),
    28: ("j_spine_b", (0, 0, 0), (0, 0, 0)),
    31: ("j_hip", (0, 0, 0), (0, 0, 0)),
    32: ("j_hand_r", (0, 0, 0), (0, 0, 0)),
    33: ("j_hand_l", (0, 0, 0), (0, 0, 0)),
    42: ("n_root", (0.0, 3.0, 0.0), (0, 0, 0)),
    43: ("j_head", (0.35, -0.1, -0.12), (2.758, 10.996, 6.283)),
    44: ("j_head", (0.35, -0.1, 0.12), (2.758, 10.996, 6.283)),
    89: ("n_root", (0.0, 2.15, -0.6), (0, 0, 0)),
    92: ("n_root", (0.0, 3.4, -0.5), (0, 0, 0)),
}
EMPTY_PHYB = struct.pack("<IIII", 0x01000001, 0, 0x10, 0x10)  # same bytes as vanilla m0586/m0765


def path(*p):
    full = os.path.join(B, *p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    return full


# ---------------------------------------------------------------- model

def mdl_meshes(meshes, material_prefix):
    out = {}
    for prim, (mi, suffix) in PARTS.items():
        m = meshes[prim]
        if mi not in out:
            out[mi] = {"name": f"sst_{mi}.0", "material": f"/{material_prefix}_{suffix}.mtrl", "parts": []}
        out[mi]["parts"].append(m)
    result = []
    for mi in sorted(out):
        o = out[mi]
        pos, nrm, uv, J, W, idx = [], [], [], [], [], []
        base = 0
        for m in o["parts"]:
            used = np.unique(m["indices"])
            remap = np.full(len(m["positions"]), -1)
            remap[used] = np.arange(len(used)) + base
            pos.append(m["positions"][used])
            nrm.append(m["normals"][used])
            uv.append(m["uvs"][used])
            J.append(m["xiv_joints"][used])
            W.append(m["xiv_weights"][used])
            idx.append(remap[m["indices"]])
            base += len(used)
        n = base
        result.append({"name": o["name"], "material": o["material"], "positions": np.concatenate(pos),
                       "normals": np.concatenate(nrm), "uvs": np.concatenate(uv), "colors": np.ones((n, 4)),
                       "joints": np.concatenate(J), "weights": np.concatenate(W), "indices": np.concatenate(idx)})
    return result


def import_glb(glb, mdl):
    out = xd.xivtool("import", glb, mdl)
    warn = [l for l in out.splitlines() if l.startswith("WARN")]
    print("  ", out.strip().splitlines()[-1], f"({len(warn)} warnings)")
    for w in warn[:5]:
        print("    ", w)


def build_models(skel):
    meshes = skin(reshape(WowModel(), skel), skel)
    files = {}
    glb = path("glb", "choco_top.glb")
    parts = mdl_meshes(meshes, "mt_d0001e0001_top")
    write_glb(glb, skel, parts)
    top = path("mdl", "choco_top.mdl")
    import_glb(glb, top)
    # the importer writes a 1 m bounding radius; the tiger is ~7 m long
    radius = 1.1 * max(np.linalg.norm(m["positions"], axis=1).max() for m in parts)
    xd.xivtool("mdlradius", top, top, f"{radius:.3f}")
    files[f"{EQ}/model/d0001e0001_top.mdl"] = top
    # empty head/leg/feet pieces: one zero-area triangle
    hip = skel.index["j_hip"]
    p = skel.pos("j_hip")
    for slot in ("met", "dwn", "sho"):
        glb = path("glb", f"choco_{slot}.glb")
        write_glb(glb, skel, [{"name": "empty_0.0", "material": f"/mt_d0001e0001_{slot}_a.mtrl",
                               "positions": np.array([p, p + [0, 1e-4, 0], p + [1e-4, 0, 0]]),
                               "normals": np.tile([0.0, 1.0, 0.0], (3, 1)), "uvs": np.zeros((3, 2)),
                               "colors": np.ones((3, 4)), "joints": np.full((3, 4), hip),
                               "weights": np.tile([1.0, 0, 0, 0], (3, 1)), "indices": np.array([0, 1, 2])}])
        mdl = path("mdl", f"choco_{slot}.mdl")
        import_glb(glb, mdl)
        files[f"{EQ}/model/d0001e0001_{slot}.mdl"] = mdl
    tiger_files = {}
    for b in TIGER_BODIES:
        spec = path("mdl", f"rename_b{b:04d}.json")
        json.dump({"materials": {f"/mt_d0001e0001_top_{s}.mtrl": f"/mt_m0464b{b:04d}_{s}.mtrl" for s in MATERIALS}},
                  open(spec, "w"))
        mdl = path("mdl", f"tiger_b{b:04d}.mdl")
        xd.xivtool("mdlcopy", top, mdl, spec)
        tiger_files[f"{TIGER}/obj/body/b{b:04d}/model/m0464b{b:04d}.mdl"] = mdl
    return files, tiger_files


# ---------------------------------------------------------------- textures and materials

def rgba_tex(rgba, name, fmt):
    rgba = np.ascontiguousarray(rgba, np.uint8)
    raw = path("tex", name + ".raw")
    rgba.tofile(raw)
    out = path("tex", name + ".tex")
    xd.xivtool("rgba2tex", raw, rgba.shape[1], rgba.shape[0], out, fmt)
    os.remove(raw)
    return out


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


def lifted(rgba, name):
    if name in LIFT:
        rgba[..., :3] = lift(rgba[..., :3], *LIFT[name])        # alpha untouched
    return rgba


def build_textures():
    src = os.path.join(xd.ROOT, "source", "wow", "creature")
    files = {}

    def load(rel, scale):
        im = Image.open(os.path.join(src, rel)).convert("RGBA")
        return np.asarray(im.resize((im.width * scale, im.height * scale), Image.LANCZOS))

    body = lifted(load("spectraltiger/spectralridingtigerarmored.png", 4).copy(), "body")
    body[..., 3] = 255
    files[TEX.format("body_d")] = rgba_tex(body, "body_d", "bc7")
    saddle = lifted(load("spectraltiger/spectralridingtigersaddle.png", 4).copy(), "saddle")
    saddle[..., 3] = 255
    files[TEX.format("saddle_d")] = rgba_tex(saddle, "saddle_d", "bc7")
    eye = load("frostsabre/pvpridingtigereyeglowgreen.png", 4)
    files[TEX.format("eye_d")] = rgba_tex(eye, "eye_d", "bgra")
    # flat normal maps (blue = opacity for the legacy character shader); the eye one carries the glow's alpha
    flat = np.zeros((64, 64, 4), np.uint8) + [128, 128, 255, 255]
    files[TEX.format("flat_n")] = rgba_tex(flat, "flat_n", "bgra")
    eye_n = np.zeros(eye.shape, np.uint8) + [128, 128, 255, 255]
    eye_n[..., 2] = eye[..., 3]
    files[TEX.format("eye_n")] = rgba_tex(eye_n, "eye_n", "bgra")
    files[TEX.format("mask_s")] = rgba_tex(np.zeros((64, 64, 4), np.uint8) + [172, 27, 215, 255], "mask_s", "bgra")
    files[TEX.format("id")] = rgba_tex(np.zeros((64, 64, 4), np.uint8) + [120, 0, 0, 255], "id", "bgra")
    return files


def build_material(suffix):
    m = MATERIALS[suffix]
    tex = [TEX.format(f"{m['tex']}_d"), TEX.format("eye_n" if m["tex"] == "eye" else "flat_n"),
           TEX.format("mask_s"), TEX.format("id")]
    template = xd.extract(f"{TIGER}/obj/body/b0001/material/v0001/mt_m0464b0001_a.mtrl")[0]
    rows = {str(r): {"DiffuseColor": [1, 1, 1], "SpecularColor": [m["spec"]] * 3, "EmissiveColor": list(m["emissive"])}
            for r in range(32)}
    spec = {"textures": tex, "flags": 0xC, "baseRow": 0, "rows": rows, "constants": {"0x29AC0223": [m["alpha"]]}}
    sp = path("mtrl", f"{suffix}.json")
    json.dump(spec, open(sp, "w"))
    out = path("mtrl", f"sst_{suffix}.mtrl")
    xd.xivtool("mtrlbuild", template, out, sp)
    return out


def build_materials():
    local = {s: build_material(s) for s in MATERIALS}
    choco, tiger = {}, {}
    for v in CHOCO_MATERIAL_SETS:
        for s, f in local.items():
            choco[f"{EQ}/material/v{v:04d}/mt_d0001e0001_top_{s}.mtrl"] = f
    for b in TIGER_BODIES:
        for s, f in local.items():
            tiger[f"{TIGER}/obj/body/b{b:04d}/material/v0001/mt_m0464b{b:04d}_{s}.mtrl"] = f
    return choco, tiger


# ---------------------------------------------------------------- skeleton and animations

def build_skeleton(skel):
    files = {}
    tiger_dir = f"{TIGER}/skeleton/base/b0001"
    choco_dir = f"{CHOCO}/skeleton/base/b0001"
    # skeleton: the tiger's, with the header's model id/type set to the chocobo's (demihuman 1)
    sk = bytearray(open(xd.extract(f"{tiger_dir}/skl_m0464b0001.sklb")[0], "rb").read())
    struct.pack_into("<HH", sk, 0x14, 1, 2)
    files[f"{choco_dir}/skl_d0001b0001.sklb"] = path("skel", "skl_d0001b0001.sklb")
    open(files[f"{choco_dir}/skl_d0001b0001.sklb"], "wb").write(sk)
    files[f"{choco_dir}/skl_d0001b0001.skp"] = xd.extract(f"{tiger_dir}/skl_m0464b0001.skp")[0]
    # attachment points: the tiger's, plus the chocobo-only ids moved onto tiger bones
    eid = open(xd.extract(f"{tiger_dir}/eid_m0464b0001.eid")[0], "rb").read()
    count = struct.unpack_from("<I", eid, 8)[0]
    entries = [eid[16 + i * 64:16 + (i + 1) * 64] for i in range(count)]
    have = {struct.unpack_from("<I", e, 32)[0] for e in entries}
    for i, (bone, t, r) in sorted(EID_EXTRA.items()):
        if i not in have and bone in skel.index:
            entries.append(struct.pack("<32sI6fI", bone.encode(), i, *t, *r, 0))
    eid = eid[:8] + struct.pack("<I", len(entries)) + eid[12:16] + b"".join(entries)
    files[f"{choco_dir}/eid_d0001b0001.eid"] = path("skel", "eid_d0001b0001.eid")
    open(files[f"{choco_dir}/eid_d0001b0001.eid"], "wb").write(eid)
    files[f"{choco_dir}/phy_d0001b0001.phyb"] = path("skel", "phy_d0001b0001.phyb")
    open(files[f"{choco_dir}/phy_d0001b0001.phyb"], "wb").write(EMPTY_PHYB)
    return files


def build_paps():
    tiger = Pap.read(open(xd.extract(f"{TIGER}/animation/a0001/bt_common/resident/mount.pap")[0], "rb").read())
    by_name = {a.name: (a, t) for a, t in zip(tiger.anims, tiger.timelines)}
    files = {}
    for name in PAPS:
        gp = f"{CHOCO}/animation/a0001/bt_common/resident/{name}.pap"
        choco = Pap.read(open(xd.extract(gp)[0], "rb").read())
        out = Pap(choco.version, choco.model_id, choco.model_type, choco.variant)
        out.havok = tiger.havok
        wanted = [a.name for a in choco.anims]
        if name == "mount":  # keep the tiger's extra flying transitions too
            wanted += [a.name for a in tiger.anims if a.name not in wanted]
        for n in wanted:
            src, tl = by_name[n if n in by_name else ALIAS[n]]
            out.anims.append(PapAnim(n, src.kind, src.havok_index, src.is_face))
            out.timelines.append(tl)
        files[gp] = path("pap", f"{name}.pap")
        open(files[gp], "wb").write(out.write())
        print(f"   {name}.pap: {len(out.anims)} animations ({sum(n not in by_name for n in wanted)} aliased)")
    return files


def build():
    if os.path.isdir(B):
        shutil.rmtree(B)
    skel = Skeleton(SKEL)
    print("models")
    choco_models, tiger_models = build_models(skel)
    print("textures")
    textures = build_textures()
    print("materials")
    choco_mtrl, tiger_mtrl = build_materials()
    print("skeleton")
    skeleton = build_skeleton(skel)
    print("animations")
    paps = build_paps()
    index = {"choco": {**choco_models, **choco_mtrl, **skeleton, **paps}, "tiger": {**tiger_models, **tiger_mtrl},
             "textures": textures}
    json.dump(index, open(path("index.json"), "w"), indent=1)
    for k, v in index.items():
        print(f"{k}: {len(v)} files")


if __name__ == "__main__":
    build()
