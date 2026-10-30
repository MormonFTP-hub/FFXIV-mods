"""Export an in-game map for the sim's 3D scene from your FFXIV install: Wolves' Den Pier (La Noscea), the pier
outside the Wolves' Den with its striking dummies.

Reads the zone's layout (level/bg.lgb: every placed model, and the shared groups (.sgb) it places, recursively), its
terrain (bgplate/terrain.tera and its plates) and the striking dummies on level/planmap.lgb, then writes each model
once (both texture layers of bg.shpk, blended by vertex alpha; the sea's water.shpk as water) and every placement as a
matrix. The map is moved so one of the pier's striking dummies stands at the sim's origin, turned to face the sim's
player (who starts on -Z), with its deck at y = 0; that dummy itself is left out, since the sim draws its own there.

Writes BlackMageSim/work/game-map.js (BLM.GAME_MAP), which index.html loads and build_single.py publishes in chunks.
Run with the Python that runs PMP Viewer (numpy + Pillow):  python -P -E BlackMageSim/tools/export_map.py
"""
import base64
import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_models as X       # noqa: E402  (its Pack, textures and mesh packing; it also sets up PMP Viewer's path)
from export_models import game, shade      # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "work"

ZONE = {"name": "Wolves' Den Pier", "bg": "bg/ffxiv/sea_s1/pvp/s1p1/",
        # The dummy the sim's own stands in for: one of the four on the lower deck, the pair that faces the pier's
        # far end, so you look past it to the ships and the open sea. Its feet are at y 2.25.
        "dummy": (96.13, 2.25, -4.63)}
LAYOUTS = ("level/bg.lgb",)
DUMMY_LAYER = ("level/planmap.lgb", "LVD_kakashi_01")
EXTRA_LAYERS = ("LVD_aetheryte_01",)       # planmap's aetheryte crystal
TYPE_BG, TYPE_SG = 1, 6

# bg.shpk's samplers by layer: colour, normal, specular.
LAYER_SAMPLERS = ((0x1E6FEF9C, 0xAAB4D9E9, 0x1BBC2F12), (0x6968DF0A, 0xDDB3E97F, 0x6CBB1F84))
WATER_COLOR = 0xBA163700       # water.shpk's colour constant (linear RGB)


# ---------- layout files ----------
def cstr(d, o):
    return d[o:d.index(b"\0", o)].decode("utf-8", "replace")


def read_layers(d, start, layers_off, count):
    """A layer group's layers at `start`: each instance's type, name, transform and (models, shared groups) path."""
    out = []
    for i in range(count):
        ls = start + layers_off + struct.unpack_from("<i", d, start + layers_off + i * 4)[0]
        _, name_off, inst_off, inst_cnt = struct.unpack_from("<Iiii", d, ls)
        insts = []
        for k in range(inst_cnt):
            s = ls + inst_off + struct.unpack_from("<i", d, ls + inst_off + k * 4)[0]
            typ, _, _ = struct.unpack_from("<iIi", d, s)
            t, r, sc = (struct.unpack_from("<3f", d, s + o) for o in (12, 24, 36))
            path = cstr(d, s + struct.unpack_from("<i", d, s + 48)[0]) if typ in (TYPE_BG, TYPE_SG) else None
            insts.append({"type": typ, "t": t, "r": r, "s": sc, "path": path})
        out.append({"name": cstr(d, ls + name_off), "insts": insts})
    return out


def read_lgb(d):
    assert d[:4] == b"LGB1"
    layers, p = [], 12
    for _ in range(struct.unpack_from("<i", d, 8)[0]):
        assert d[p:p + 4] == b"LGP1"
        start = p + 8
        _, _, loff, lcnt = struct.unpack_from("<iiii", d, start)
        layers += read_layers(d, start, loff, lcnt)
        p = start + struct.unpack_from("<i", d, p + 4)[0]
    return layers


def read_sgb(d):
    assert d[:4] == b"SGB1" and d[12:16] == b"SCN1"
    goff, gcnt = struct.unpack_from("<ii", d, 0x14)
    layers = []
    for g in range(gcnt):
        gs = 0x14 + goff + g * 16
        _, _, loff, lcnt = struct.unpack_from("<iiii", d, gs)
        layers += read_layers(d, gs, loff, lcnt)
    return layers


def matrix(t, r, s):
    """The game's placement: scale, then rotate about X, Y and Z, then move."""
    cx, cy, cz = np.cos(r)
    sx, sy, sz = np.sin(r)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    m = np.eye(4)
    m[:3, :3] = rz @ ry @ rx @ np.diag(s)
    m[:3, 3] = t
    return m


_sgb = {}


def walk(insts, parent, out, depth=0):
    """Every model the instances place, with its world matrix; shared groups open into their own layers."""
    for i in insts:
        w = parent @ matrix(i["t"], i["r"], i["s"])
        if i["type"] == TYPE_BG and i["path"]:
            out.append((i["path"], w))
        elif i["type"] == TYPE_SG and i["path"] and depth < 8:
            if i["path"] not in _sgb:
                local = game.game_file(i["path"])
                _sgb[i["path"]] = read_sgb(open(local, "rb").read()) if local else []
            for layer in _sgb[i["path"]]:
                walk(layer["insts"], w, out, depth + 1)


def placements():
    base = ZONE["bg"]
    out = []
    for name in LAYOUTS:
        for layer in read_lgb(open(game.game_file(base + name), "rb").read()):
            walk(layer["insts"], np.eye(4), out)
    k = np.array(ZONE["dummy"])
    for layer in read_lgb(open(game.game_file(base + DUMMY_LAYER[0]), "rb").read()):
        if layer["name"] == DUMMY_LAYER[1]:
            others = [i for i in layer["insts"] if np.linalg.norm(np.array(i["t"]) - k) > 0.5]
            mine = [i for i in layer["insts"] if i not in others]
            print(f"  striking dummies: {len(layer['insts'])}, {len(mine)} left for the sim's own")
            if mine:        # which way it faces (its +Z)
                f = matrix(mine[0]["t"], mine[0]["r"], mine[0]["s"])[:3, 2]
                ZONE["facing"] = float(np.arctan2(f[0], f[2]))
            walk(others, np.eye(4), out)
        elif layer["name"] in EXTRA_LAYERS:
            walk(layer["insts"], np.eye(4), out)
    # Terrain: one model per plate, placed by terrain.tera.
    tera = open(game.game_file(base + "bgplate/terrain.tera"), "rb").read()
    count, size = struct.unpack_from("<II", tera, 4)
    for i in range(count):
        x, z = struct.unpack_from("<hh", tera, 0x34 + i * 4)
        m = np.eye(4)
        m[0, 3], m[2, 3] = size * (x + 0.5), size * (z + 0.5)
        out.append((f"{base}bgplate/{i:04d}.mdl", m))
    return out


def to_sim():
    """Game to sim: the chosen dummy's feet to the origin, turned about Y so it faces the sim's -Z (you start there)."""
    k = ZONE["dummy"]
    t = np.eye(4)
    t[:3, 3] = [-k[0], -k[1], -k[2]]
    a = np.pi - ZONE.get("facing", 0.0)
    r = np.eye(4)
    r[0, 0], r[0, 2], r[2, 0], r[2, 2] = np.cos(a), np.sin(a), -np.sin(a), np.cos(a)
    return r @ t


# ---------- materials ----------
def raw_texture(local, limit):
    """A texture as the game stores it (the sea's wave normals), as lossy WebP in the shared list."""
    img = Image.fromarray(np.ascontiguousarray(game.texture(local)[..., :3]))
    img.thumbnail((limit, limit), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=85, method=6)
    X.TEXTURES.append("data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode())
    return len(X.TEXTURES) - 1


def layer_view(mt, k):
    """The material with only layer k's samplers, so the bake picks that layer's textures."""
    ids = LAYER_SAMPLERS[k]
    sam = [s for s in mt["samplers"] if s["id"] in ids]
    return dict(mt, samplers=sam) if sam else None


def material(name):
    local = game.game_file(name.lstrip("/"))
    if not local:
        return None
    mt = game.material(local)
    if mt["shader"] == "water.shpk":
        consts = {c["id"]: c["values"] for c in mt["constants"]}
        normals = [t["path"] for t in mt["textures"] if "_n_wave" in t["path"]]
        nl = game.game_file(normals[0]) if normals else None
        nrm = raw_texture(nl, 256) if nl else None
        col = (consts.get(WATER_COLOR) or [0.1, 0.34, 0.36])[:3]
        return {"water": True, "tint": [round(c, 4) for c in col], "normal": nrm}
    texs = {i: game.game_file(t["path"]) for i, t in enumerate(mt["textures"])}
    v0 = layer_view(mt, 0) or mt
    b0 = shade.bake(v0, texs, {}, max_size=X.COLOR_MAX)
    alpha = (b0.get("alphaTest") or 0) > 0
    out = X.material_out(b0, opaque=not alpha)
    if not out:
        return None
    # A second layer with its own colour map, blended in by the vertices' alpha.
    v1 = layer_view(mt, 1)
    c0 = next((s["tex"] for s in v0["samplers"] if s["id"] == LAYER_SAMPLERS[0][0]), None)
    c1 = next((s["tex"] for s in (v1 or {}).get("samplers", []) if s["id"] == LAYER_SAMPLERS[1][0]), None)
    if v1 and c1 is not None and c1 != c0:
        b1 = shade.bake(v1, texs, {}, max_size=X.COLOR_MAX)
        o1 = X.material_out(b1, opaque=True)
        if o1:
            out["color1"], out["normal1"] = o1["color"], o1["normal"]
    return out


# ---------- models ----------
def model_out(pack, path, mats, mat_index):
    local = game.game_file(path)
    if not local:
        return None
    mdl = game.model(local)
    meshes = []
    for me in mdl["meshes"]:
        name = me["material"]
        if name not in mat_index:
            m = material(name)
            mat_index[name] = len(mats) if m else -1
            if m:
                mats.append(m)
        mi = mat_index[name]
        if mi < 0 or not len(me["idx"]):
            continue
        out = X.mesh_out(pack, me["pos"], me["nrm"], me["uv"], me["idx"], mi)
        m = mats[mi]
        if "color1" in m:       # the second layer's UVs and blend weight
            used = np.unique(me["idx"])
            out["uv1"] = pack.put(me["uv"][used, 2:4].astype("<f4"), "f32")
            out["blend"] = pack.put(me["col"][used, 3].astype(np.uint8), "u8")
        meshes.append(out)
    if not meshes:
        return None
    pts = np.concatenate([me["pos"] for me in mdl["meshes"]])
    return {"meshes": meshes, "lo": pts.min(0).round(3).tolist(), "hi": pts.max(0).round(3).tolist()}


def main():
    OUT.mkdir(exist_ok=True)
    pack = X.Pack()
    print(ZONE["name"])
    places = placements()
    sim = to_sim()
    paths = sorted({p for p, _ in places})
    game.extract(*paths)
    mats, mat_index, models, index = [], {}, [], {}
    for p in paths:
        m = model_out(pack, p, mats, mat_index)
        if m:
            index[p] = len(models)
            models.append(dict(m, path=p, inst=[]))
    sea = None
    for p, w in places:
        if p in index:
            models[index[p]]["inst"].append((sim @ w)[:3, :].T.reshape(-1))    # column-major 4x3
        elif sea is None:
            # The sea is a model of water meshes only (which the model reader leaves out): keep its height and look,
            # and the page draws it as one plane out to the horizon.
            mdl = game.model(game.game_file(p))
            water = [n for n in mdl["materials"] if game.game_file(n.lstrip("/"))
                     and game.material(game.game_file(n.lstrip("/")))["shader"] == "water.shpk"]
            if water:
                sea = dict(material(water[0]), y=round(float((sim @ w @ [0, mdl["bbox"][5], 0, 1])[1]), 3))
    for m in models:
        m["instances"] = pack.put(np.array(m.pop("inst"), np.float32), "f32")
    data = {"version": 1, "name": ZONE["name"], "zone": ZONE["bg"], "dummy": ZONE["dummy"], "sea": sea,
            "models": models, "materials": mats, "textures": X.TEXTURES, "bin": pack.b64(), "binEncoding": "gzip"}
    js = ("// Generated by tools/export_map.py from your FFXIV install. FINAL FANTASY XIV (c) SQUARE ENIX.\n"
          "window.BLM = window.BLM || {};\nBLM.GAME_MAP = " + json.dumps(data, separators=(",", ":")) + ";\n")
    (OUT / "game-map.js").write_text(js, encoding="utf-8")
    verts = sum(me["count"] for m in models for me in m["meshes"])
    tex = sum(len(t) for t in X.TEXTURES)
    print(f"{len(places)} placements, {len(models)} models ({verts} vertices), {len(mats)} materials, "
          f"{len(X.TEXTURES)} textures {tex / 1048576:.1f} MB, binary {len(pack.buf) / 1048576:.1f} MB, "
          f"file {len(js) / 1048576:.1f} MB -> {OUT / 'game-map.js'}")


if __name__ == "__main__":
    try:
        main()
    finally:
        game.SERVE.close()
