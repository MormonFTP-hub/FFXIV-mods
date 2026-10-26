"""Game file access for the Gregor build: extract-on-demand cache, models, materials, textures."""
import hashlib
import json
import os
import struct
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GAME = os.path.join(ROOT, "work", "game")
CACHE = os.path.join(ROOT, "work", "cache")
XIVTOOL = [os.path.join(ROOT, "apps", "xivtool", "xivtool.exe")]


def xivtool(*args):
    out = subprocess.run(XIVTOOL + [str(a) for a in args], capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stdout + out.stderr)
    return out.stdout


def local(game_path):
    return os.path.join(GAME, game_path.replace("/", os.sep))


def extract(*game_paths):
    """Make sure game files are in the local cache; returns local paths (None for missing files)."""
    need = [p for p in game_paths if not os.path.exists(local(p))]
    missing = set()
    for i in range(0, len(need), 40):
        out = xivtool("extract", GAME, *need[i:i + 40])
        missing |= {l[8:].strip() for l in out.splitlines() if l.startswith("MISSING")}
    return [None if p in missing else local(p) for p in game_paths]


def exists(game_path):
    return extract(game_path)[0] is not None


def _key(src):
    """Cache key: game-relative path for game files, path hash for anything else."""
    src = os.path.abspath(src)
    if src.startswith(os.path.abspath(GAME)):
        return os.path.relpath(src, GAME).replace(os.sep, "_")
    return os.path.basename(src) + "_" + hashlib.md5(src.encode()).hexdigest()[:10]


def _cached_json(kind, src, cmd):
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, f"{_key(src)}.{kind}.json")
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        xivtool(cmd, src, dst)
    return json.load(open(dst, encoding="utf-8"))


def model(path):
    """LOD0 meshes of a .mdl (game path or local file) as numpy arrays."""
    src = path if os.path.exists(path) else extract(path)[0]
    if src is None:
        raise FileNotFoundError(path)
    d = _cached_json("mdl", src, "mdlexport")
    meshes = []
    for m in d["meshes"]:
        idx = np.array(m["indices"], np.int64)
        tri_sub = np.full(len(idx) // 3, -1)
        attrs = []
        for si, sm in enumerate(m["submeshes"]):
            tri_sub[sm["start"] // 3:(sm["start"] + sm["count"]) // 3] = si
            attrs.append(sm["attrs"])
        weights = np.array(m["weights"], float)
        if weights.max() > 1.001:  # UByte4 (not normalized) blend weights come back as 0..255
            weights /= np.maximum(weights.sum(1, keepdims=True), 1e-9)
        meshes.append({
            "material": m["material"],
            "pos": np.array(m["positions"], float),
            "nrm": np.array(m["normals"], float),
            "uv": np.array(m["uvs"], float),
            "col": np.array(m["colors"], np.uint8),
            "bones": np.array(m["bones"], object),
            "weights": weights,
            "faces": idx.reshape(-1, 3),
            "tri_sub": tri_sub,
            "sub_attrs": attrs,
        })
    return {"meshes": meshes, "attributes": d["attributes"], "materials": d["materials"], "shapes": d["shapes"]}


def material(path):
    src = path if os.path.exists(path) else extract(path)[0]
    if src is None:
        raise FileNotFoundError(path)
    d = _cached_json("mtrl", src, "mtrljson")
    d["diffuse"] = np.array([r["diffuse"] for r in d["rows"]], float) if d["rows"] else None
    return d


def texture(path):
    """RGBA uint8 array of a .tex (game path or local file)."""
    os.makedirs(CACHE, exist_ok=True)
    src = path if os.path.exists(path) else extract(path)[0]
    if src is None:
        raise FileNotFoundError(path)
    key = _key(src)
    npy = os.path.join(CACHE, key + ".npy")
    if not os.path.exists(npy):
        base = os.path.join(CACHE, key)
        xivtool("tex2png", src, base)
        w, h = map(int, open(base + ".size").read().split())
        a = np.fromfile(base + ".raw", np.uint8).reshape(h, w, 4)
        np.save(npy, a)
        os.remove(base + ".raw")
        os.remove(base + ".size")
    return np.load(npy)


def imc_material_set(set_id, slot, variant):
    """Material set (v000N folder) an equipment variant uses, read from the set's .imc."""
    p = extract(f"chara/equipment/e{set_id:04d}/e{set_id:04d}.imc")[0]
    if p is None:
        return variant
    b = open(p, "rb").read()
    count, ptype = struct.unpack_from("<HH", b, 0)
    order = ["met", "top", "glv", "dwn", "sho"]
    i = order.index(slot)
    off = 4 + (variant * 5 + i) * 6   # variant 0 is the default block, then `count` variants
    if variant > count:
        return variant
    mat_id, decal, attr_and_sound, vfx, anim = struct.unpack_from("<BBHBB", b, off)
    return mat_id


def imc_attribute_mask(set_id, slot, variant):
    p = extract(f"chara/equipment/e{set_id:04d}/e{set_id:04d}.imc")[0]
    b = open(p, "rb").read()
    order = ["met", "top", "glv", "dwn", "sho"]
    off = 4 + (variant * 5 + order.index(slot)) * 6
    mat_id, decal, attr_and_sound, vfx, anim = struct.unpack_from("<BBHBB", b, off)
    return attr_and_sound & 0x3FF


def resolve_material(name, race, set_id=None, slot=None, variant=1):
    """Game path of a material named inside a .mdl (e.g. '/mt_c0201e6210_top_a.mtrl')."""
    n = name.lstrip("/")
    if n.startswith("mt_c") and "b0" in n[8:12]:          # skin: mt_c0201b0001_a.mtrl
        r, b = n[3:8], n[8:13]
        return f"chara/human/{r}/obj/body/{b}/material/v0001/{n}"
    if "e" in n[8:9]:                                    # equipment: mt_c0201e6210_top_a.mtrl
        e = int(n[9:13])
        ms = imc_material_set(set_id if set_id is not None else e, slot or n[14:17], variant)
        return f"chara/equipment/e{e:04d}/material/v{ms:04d}/{n}"
    raise ValueError(name)


def gear_model_path(set_id, slot, race):
    return f"chara/equipment/e{set_id:04d}/model/{race}e{set_id:04d}_{slot}.mdl"


def items():
    p = os.path.join(ROOT, "work", "items.json")
    if not os.path.exists(p):
        xivtool("allitems", p)
    return json.load(open(p, encoding="utf-8"))
