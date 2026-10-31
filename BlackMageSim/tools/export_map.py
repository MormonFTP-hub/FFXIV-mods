"""Export an in-game map for the sim's 3D scene from your FFXIV install: Wolves' Den Pier (La Noscea), the pier
outside the Wolves' Den with its striking dummies, and the fights in ZONES (the first: M2S's arena, Lovely Lovering).

Reads the zone's layout (level/bg.lgb: every placed model, and the shared groups (.sgb) it places, recursively), its
terrain (bgplate/terrain.tera and its plates) and the striking dummies on level/planmap.lgb, then writes each model
once (both texture layers of bg.shpk, blended by vertex alpha; the sea's water.shpk as water) and every placement as a
matrix. Also the game's own collision, what you stand on and bump into: each placed model's .pcb and the terrain's
tiles (collision/list.pcb), as one list of triangles near the pier (the flat tiles at sea level are left out: no
walking on the water). The map is moved so one of the pier's striking dummies stands at the sim's origin, turned to face the sim's
player (who starts on -Z), with its deck at y = 0; that dummy itself is left out, since the sim draws its own there.

A fight's map also carries the boss (its model on its skeleton, resolved by PMP Viewer, with its animations) and the
fight's timeline: cactbot's (github.com/OverlayPlugin/cactbot, Apache-2.0), each boss ability with the second it goes
off, with its cast time from the game's Action sheet, the untargetable windows and the enrage.

Writes BlackMageSim/work/<out> (BLM.GAME_MAPS[key]), which index.html loads and build_single.py publishes in chunks.
Run with the Python that runs PMP Viewer (numpy + Pillow):  python -P -E BlackMageSim/tools/export_map.py [zone ...]
(every zone without one).
"""
import base64
import io
import json
import re
import struct
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import export_models as X       # noqa: E402  (its Pack, textures and mesh packing; it also sets up PMP Viewer's path)
from export_models import game, shade, resolve, S      # noqa: E402
from extract_icons import Sheet, icon_col, png_data_url     # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "work"

ZONES = {
    "pier": {"name": "Wolves' Den Pier", "label": "Wolves' Den Pier · striking dummy", "bg": "bg/ffxiv/sea_s1/pvp/s1p1/",
             "out": "game-map.js", "sky": "day",
             # The dummy the sim's own stands in for: one of the four on the lower deck, the pair that faces the pier's
             # far end, so you look past it to the ships and the open sea. Its feet are at y 2.25.
             "dummy": (96.13, 2.25, -4.63),
             "dummy_layer": ("level/planmap.lgb", "LVD_kakashi_01"),
             "extra_layers": ("LVD_aetheryte_01",)},         # planmap's aetheryte crystal
    # M2S, AAC Light-heavyweight M2 (Savage): the boss at the arena's middle (100, 0, 100) facing south (+Z), where
    # the party starts.
    "m2s": {"name": "Lovely Lovering", "label": "M2S · Honey B. Lovely (testing)", "bg": "bg/ex5/01_xkt_x6/rad/x6r2/",
            "out": "game-map-m2s.js", "sky": "arena", "dummy": (100.0, 0.0, 100.0), "facing": 0.0,
            # The stage has three looks (a1-a3: floor, neon, lights), switched at the Honey B. Live beats; the pull
            # starts on a1, so the other two are left out (drawn together, their floors flickered through each other).
            "exclude": r"_a[23]_",
            "fight": {"duty": "AAC Light-heavyweight M2 (Savage)", "boss": "Honey B. Lovely", "timeline": "07-dt/raid/r2s",
                      "hitbox": 5.0,
                      # Monster m0906 (ModelChara 4159, BNpcBase 16938 at scale 1.2): the one model that has every
                      # animation her abilities name (mon_sp001-023), picked from the Dawntrail candidates by looking.
                      "model": {"kind": "monster", "id": 906, "body": 1, "variant": 1, "scale": 1.2,
                                "pap": "chara/monster/m0906/animation/a0001/bt_common/resident/monster.pap",
                                "anims": {"idle": "cbbm_id0", "castStart": "cbbm_sp_a_1", "cast": "cbbm_sp_a_2lp",
                                          "run": "cbbm_02f_lp0"},
                                "specials": "chara/monster/m0906/animation/a0001/bt_common/mon_sp/m0906/"}}},
    # M5S, AAC Cruiserweight M1 (Savage): Dancing Green in the middle of the dance floor (100, 0, 100), the party south.
    "m5s": {"name": "Dancing Green's floor", "label": "M5S · Dancing Green", "bg": "bg/ex5/01_xkt_x6/rad/x6r5/",
            "out": "game-map-m5s.js", "sky": "club", "dummy": (100.0, 0.0, 100.0), "facing": 0.0,
            "fight": {"duty": "AAC Cruiserweight M1 (Savage)", "boss": "Dancing Green", "timeline": "07-dt/raid/r5s",
                      "hitbox": 5.0,
                      # Monster m0934 (ModelChara 4412, BNpcBase 18358 at scale 3.5): the Dawntrail model with every
                      # animation his abilities name (mon_sp001-045). Mechanics, strats and HP: js/fights/m5s.js.
                      "model": {"kind": "monster", "id": 934, "body": 1, "variant": 1, "scale": 3.5,
                                "pap": "chara/monster/m0934/animation/a0001/bt_common/resident/monster.pap",
                                "anims": {"idle": "cbbm_id0", "castStart": "cbbm_sp_b_1", "cast": "cbbm_sp_b_2lp",
                                          "run": "cbbm_02f_lp0"},
                                "specials": "chara/monster/m0934/animation/a0001/bt_common/mon_sp/m0934/"},
                      # The statuses the fight puts on players (Status rows; BossMod's and FFLogs' ids), shown with the
                      # game's icons where the game shows them.
                      "statuses": {"burnBabyBurn": 4461, "wavelengthA": 4462, "wavelengthB": 4463, "inTheSpotlight": 4471,
                                   "magicVuln": 2941, "damageDown": 2911, "bleeding": 2088, "frogtourageFan": 3998,
                                   "sustainedDamage": 2935, "weakness": 43, "brinkOfDeath": 44}}},
}
ZONE = ZONES["pier"]        # the one being exported
LAYOUTS = ("level/bg.lgb",)
# PMP Viewer's model helper leaves out a model's water and vertical-fog meshes, where the light shafts and the glow
# over M5S's dance floor live; a helper built with the "extra" option (tools/xivserve, PMPVIEWER_XIVSERVE) has them.
EXTRA_MESHES = bool(__import__("os").environ.get("PMPVIEWER_XIVSERVE"))
TYPE_BG, TYPE_SG = 1, 6

# bg.shpk's samplers by layer: colour, normal, specular.
LAYER_SAMPLERS = ((0x1E6FEF9C, 0xAAB4D9E9, 0x1BBC2F12), (0x6968DF0A, 0xDDB3E97F, 0x6CBB1F84))
WATER_COLOR = 0xBA163700       # water.shpk's colour constant (linear RGB)
BG_DIFFUSE, BG_EMISSIVE = 0x2C2A34DD, 0x38A64362        # bg.shpk's g_DiffuseColor and g_EmissiveColor
SHAFT_COLOR, SHAFT_ALPHA = 0xD27C58B9, 0x17A52926       # lightshaft.shpk's colour and strength


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
            col = struct.unpack_from("<i", d, s + 52)[0] if typ == TYPE_BG else 0
            insts.append({"type": typ, "t": t, "r": r, "s": sc, "path": path, "col": cstr(d, s + col) if col else None})
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
COLLIDERS = []       # (.pcb path, world matrix)


def walk(insts, parent, out, depth=0):
    """Every model the instances place, with its world matrix; shared groups open into their own layers."""
    ex = ZONE.get("exclude")
    for i in insts:
        if ex and i["path"] and re.search(ex, i["path"]):
            continue
        w = parent @ matrix(i["t"], i["r"], i["s"])
        if i["type"] == TYPE_BG and i["col"]:
            COLLIDERS.append((i["col"], w))
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
    if ZONE.get("dummy_layer"):
        lgb, name = ZONE["dummy_layer"]
        for layer in read_lgb(open(game.game_file(base + lgb), "rb").read()):
            if layer["name"] == name:
                others = [i for i in layer["insts"] if np.linalg.norm(np.array(i["t"]) - k) > 0.5]
                mine = [i for i in layer["insts"] if i not in others]
                print(f"  striking dummies: {len(layer['insts'])}, {len(mine)} left for the sim's own")
                if mine:        # which way it faces (its +Z)
                    f = matrix(mine[0]["t"], mine[0]["r"], mine[0]["s"])[:3, 2]
                    ZONE["facing"] = float(np.arctan2(f[0], f[2]))
                walk(others, np.eye(4), out)
            elif layer["name"] in ZONE.get("extra_layers", ()):
                walk(layer["insts"], np.eye(4), out)
    # Terrain: one model per plate, placed by terrain.tera.
    local = game.game_file(base + "bgplate/terrain.tera")
    tera = open(local, "rb").read() if local else b"\0" * 12
    count, size = struct.unpack_from("<II", tera, 4)
    for i in range(count):
        x, z = struct.unpack_from("<hh", tera, 0x34 + i * 4)
        m = np.eye(4)
        m[0, 3], m[2, 3] = size * (x + 0.5), size * (z + 0.5)
        out.append((f"{base}bgplate/{i:04d}.mdl", m))
    # The terrain's collision tiles, already in world space.
    local = game.game_file(base + "collision/list.pcb")
    lst = open(local, "rb").read() if local else b"\0" * 4
    for i in range(struct.unpack_from("<I", lst, 0)[0]):
        COLLIDERS.append((f"{base}collision/tr{struct.unpack_from('<I', lst, 32 + i * 32)[0]:04d}.pcb", np.eye(4)))
    return out


# ---------- collision ----------
def read_pcb(b):
    """A .pcb's triangles (n, 3, 3): a binary tree whose groups (type 0x30) keep their first child 0x30 bytes in and
    their second at their size; the leaves hold float and 16-bit vertices (spread over the leaf's box) and triangles
    of three byte indices."""
    tris, stack = [], [0x18]
    while stack:
        off = stack.pop()
        typ, size = struct.unpack_from("<II", b, off)
        if typ == 0x30:
            stack += [off + size, off + 0x30]
            continue
        lo, hi = np.array(struct.unpack_from("<3f", b, off + 8)), np.array(struct.unpack_from("<3f", b, off + 20))
        n16, ni, nf = struct.unpack_from("<HHI", b, off + 32)
        p = off + 0x28
        vf = np.frombuffer(b, "<f4", nf * 3, p).reshape(-1, 3).astype(np.float64)
        p += nf * 12
        v16 = np.frombuffer(b, "<u2", n16 * 3, p).reshape(-1, 3) / 65535.0 * (hi - lo) + lo
        p += n16 * 6
        idx = np.frombuffer(b, np.uint8, ni * 12, p).reshape(-1, 12)[:, :3].astype(np.int64)
        if ni:
            tris.append(np.concatenate([vf, v16])[idx])
    tris = np.concatenate(tris) if tris else np.zeros((0, 3, 3))
    assert len(tris) == struct.unpack_from("<I", b, 0x0c)[0]
    return tris


def collision(sim, reach=160.0):
    """Every collision triangle within `reach` of the dummy, in the sim's frame, as float32 (n, 9)."""
    cache, out = {}, []
    for path, w in COLLIDERS:
        if path not in cache:
            local = game.game_file(path)
            t = read_pcb(open(local, "rb").read()) if local else np.zeros((0, 3, 3))
            if "/collision/tr" in path and len(t) and np.ptp(t[..., 1]) < 0.01:
                t = np.zeros((0, 3, 3))          # a flat tile at sea level: the water
            cache[path] = t
        t = cache[path]
        if not len(t):
            continue
        m = sim @ w
        v = t.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]
        v = v.reshape(-1, 3, 3)
        c = v.mean(1)
        keep = np.hypot(c[:, 0], c[:, 2]) < reach
        n = np.cross(v[:, 1] - v[:, 0], v[:, 2] - v[:, 0])
        keep &= np.linalg.norm(n, axis=1) > 1e-6
        out.append(v[keep])
    tris = (np.concatenate(out) if out else np.zeros((0, 3, 3))).astype(np.float32)
    print(f"  collision: {len(COLLIDERS)} colliders, {len(cache)} files, {len(tris)} triangles near the dummy")
    return tris.reshape(-1)


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


def glow_texture(local, limit):
    """A light shaft's texture with its alpha multiplied in (it's added over the scene, so dark = no light)."""
    px = game.texture(local).astype(np.float32)
    rgb = px[..., :3] * (px[..., 3:4] / 255.0 if px.shape[-1] > 3 else 1.0)
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
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
    consts = {c["id"]: c["values"] for c in mt["constants"]}
    rgb = lambda v: [round(float(c), 4) for c in v[:3]]     # noqa: E731
    if mt["shader"] == "lightshaft.shpk":
        # Light shafts, the glow over the dance floor's tiles, pools of light: its texture added over what's behind,
        # in its colour, at its strength.
        if not texs.get(0) or "_nul" in mt["textures"][0]["path"]:      # "nul": a placeholder the game doesn't draw
            return None
        return {"glow": True, "color": glow_texture(texs[0], 256), "normal": None,
                "tint": rgb(consts.get(SHAFT_COLOR) or [1, 1, 1]), "opacity": round(float((consts.get(SHAFT_ALPHA) or [1])[0]), 4)}
    v0 = layer_view(mt, 0) or mt
    b0 = shade.bake(v0, texs, {}, max_size=X.COLOR_MAX)
    alpha = (b0.get("alphaTest") or 0) > 0
    out = X.material_out(b0, opaque=not alpha)
    if not out:
        return None
    if mt["shader"] == "bg.shpk":
        # Its colour constants: the texture's tint, and light of its own (the neon signs: black, lit in a colour).
        dif, emi = consts.get(BG_DIFFUSE), consts.get(BG_EMISSIVE)
        if dif and any(abs(c - 1) > 1e-3 for c in dif[:3]):
            out["diffuse"] = rgb(dif)
        if emi and any(c > 1e-3 for c in emi[:3]):
            out["emissive"] = rgb(emi)
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
    mdl = game.model(local, extra=EXTRA_MESHES)        # with its light shafts and glows, where the helper has them
    meshes = []
    for me in mdl["meshes"]:
        name = me["material"]
        if name not in mat_index:
            m = material(name)
            mat_index[name] = len(mats) if m else -1
            if m:
                mats.append(m)
        mi = mat_index[name]
        if mi < 0 or not len(me["idx"]) or mats[mi].get("water"):      # the sea is drawn as one plane (main())
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


# ---------- fights ----------
def statuses_out(ids):
    """The fight's statuses: name, the game's description, its icon (as the status bar shows it) and whether it's a debuff."""
    st = Sheet("Status")
    rows = st.rows()
    strings = st.string_cols()
    icol = icon_col(st, list(ids.values()), 10000)
    out = {}
    for key, rid in ids.items():
        if rid not in rows:
            continue
        texts = [st.value(rid, c) for c in strings]
        name = texts[0] if texts else key
        desc = texts[1] if len(texts) > 1 else ""
        _, url = png_data_url(st.value(rid, icol))
        out[key] = {"id": rid, "name": name, "desc": desc, "icon": url}
        print(f"  status {key}: {ascii(name)} - {ascii(desc[:70])}")
    return out


def boss_out(pack, m, events):
    """The boss: its model on its own skeleton (resolve.creature), its idle, run and cast animations, the one each of
    its abilities plays (mon_spNNN, by the events' "anim"), and its size."""
    sc, blob = resolve.creature(None, {k: m[k] for k in ("kind", "id", "body", "variant")})
    out = X.skinned_out(pack, sc, blob, {}, "  boss")
    letter = {"monster": "m", "demihuman": "d"}[m["kind"]]
    skel = f"chara/{m['kind']}/{letter}{m['id']:04d}/skeleton/base/b0001/skl_{letter}{m['id']:04d}b0001.sklb"
    base = [n for n, _, _ in S.load_sklb(game.game_file(skel))]
    out["anims"] = {k: X.anim_out(pack, m["pap"], name, base) for k, name in m["anims"].items()}
    for key in sorted({e["anim"] for e in events if e.get("anim")}):
        path = m.get("specials", "") + key + ".pap"
        if not game.game_file(path):
            continue
        names = X.pap(path)[0]
        out["anims"][key] = X.anim_out(pack, path, names[0], base)
    print(f"  boss animations: {', '.join(out['anims'])}")
    out["weapons"] = []
    out["scale"] = m.get("scale", 1.0)
    return out


def timeline(f):
    """cactbot's timeline for the fight, as the boss's abilities in order: the second each goes off, its name (the
    alternatives a random pick chooses between, "A/B"), its cast (from the Action sheet; the cast bar ends at the
    second), how long a lasting one lasts, and the windows the boss can't be targeted; plus the enrage."""
    cache = OUT / "timelines" / (f["timeline"].replace("/", "_") + ".txt")
    if not cache.exists():
        cache.parent.mkdir(exist_ok=True)
        url = f"https://raw.githubusercontent.com/OverlayPlugin/cactbot/main/ui/raidboss/data/{f['timeline']}.txt"
        cache.write_bytes(urllib.request.urlopen(url, timeout=30).read())
    action, tl = Sheet("Action"), Sheet("ActionTimeline")
    key_col = tl.string_cols()[0]
    CAST = 38           # Action's Cast<100ms> column (Fire III 35, Call Me Honey 50)
    events, untarget, start = [], [], None
    for line in cache.read_text(encoding="utf-8").splitlines():
        m = re.match(r'^(\d+(?:\.\d+)?)\s+"([^"]+)"(.*)$', line)
        if not m:
            continue
        t, name, rest = float(m.group(1)), m.group(2), m.group(3)
        low = name.lower()
        if "untargetable" in low:
            start = t
            continue
        if low.strip("-") == "targetable" and start is not None:
            untarget.append([start, t])
            start = None
            continue
        if name.startswith("--"):
            continue
        ids = [int(x, 16) for x in re.findall(r'"([0-9A-Fa-f]{3,5})"', rest.split("}")[0])] if "id:" in rest else []
        cast, anim = 0.0, None
        for i in ids:
            try:
                cast = max(cast, (action.value(i, CAST) or 0) / 10)
                key = tl.value(action.value(i, 7), key_col) if action.value(i, 7) else ""      # the motion it plays
                if not anim and key.startswith("mon_sp/[SKL_ID]/"):
                    anim = key.split("/")[-1]
            except Exception:       # noqa: BLE001  (an id the sheet doesn't have)
                pass
        dur = re.search(r"\bduration\s+(\d+(?:\.\d+)?)", rest)
        kind = "cast" if "(cast)" in low else "enrage" if "enrage" in low else "hit"
        show = re.sub(r"\s*\((cast|damage|enrage)\)", "", name)
        ev = {"t": t, "name": show, "kind": kind}
        if cast and "(damage)" not in low:          # the "(damage)" half of a split pair follows its "(cast)"
            ev["cast"] = cast
        if dur:
            ev["dur"] = float(dur.group(1))
        if anim:
            ev["anim"] = anim
        events.append(ev)
    # A "(damage)" that just finishes the cast before it says nothing new: keep it, quietly.
    enrage = next((e["t"] for e in reversed(events) if e["kind"] == "enrage"), events[-1]["t"] if events else 600)
    print(f"  timeline: {len(events)} events, {len(untarget)} untargetable windows, enrage at {enrage:.1f}s "
          f"({sum(1 for e in events if e.get('cast'))} with a cast)")
    return {"events": events, "untargetable": untarget, "enrage": enrage}


def main(key):
    global ZONE
    ZONE = ZONES[key]
    COLLIDERS.clear()
    X.TEXTURES.clear()
    X._tex_index.clear()
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
    data = {"version": 1, "key": key, "name": ZONE["name"], "label": ZONE["label"], "zone": ZONE["bg"],
            "dummy": ZONE["dummy"], "sky": ZONE.get("sky", "day"), "sea": sea, "collision": pack.put(collision(sim), "f32"),
            "models": models, "materials": mats}
    f = ZONE.get("fight")
    if f:
        tl = timeline(f)
        tl["statuses"] = statuses_out(f["statuses"]) if f.get("statuses") else {}
        data["fight"] = dict({k: f[k] for k in ("duty", "boss", "hitbox")}, **tl, model=boss_out(pack, f["model"], tl["events"]),
                             source="cactbot (github.com/OverlayPlugin/cactbot), Apache-2.0")
    data.update(textures=X.TEXTURES, bin=pack.b64(), binEncoding="gzip")
    js = ("// Generated by tools/export_map.py from your FFXIV install. FINAL FANTASY XIV (c) SQUARE ENIX.\n"
          "window.BLM = window.BLM || {};\nBLM.GAME_MAPS = BLM.GAME_MAPS || {};\n"
          f"BLM.GAME_MAPS[{json.dumps(key)}] = " + json.dumps(data, separators=(",", ":")) + ";\n")
    (OUT / ZONE["out"]).write_text(js, encoding="utf-8")
    verts = sum(me["count"] for m in models for me in m["meshes"])
    tex = sum(len(t) for t in X.TEXTURES)
    print(f"{len(places)} placements, {len(models)} models ({verts} vertices), {len(mats)} materials, "
          f"{len(X.TEXTURES)} textures {tex / 1048576:.1f} MB, binary {len(pack.buf) / 1048576:.1f} MB, "
          f"file {len(js) / 1048576:.1f} MB -> {OUT / ZONE['out']}")


if __name__ == "__main__":
    try:
        for k in sys.argv[1:] or list(ZONES):
            main(k)
    finally:
        game.SERVE.close()
