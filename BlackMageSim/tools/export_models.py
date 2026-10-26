"""Export the in-game models and animations the sim draws, from your FFXIV install.

  - a Hyur Midlander man in the Endwalker Black Mage artifact gear (Archmage's, set 778) holding a Moonward Rod
  - the housing striking dummies (Thavnairian, Glade, Oasis, Crystarium)
  - the game's own animations for him: the two-handed staff battle stance, running, and for every action the sim
    uses, the cast start / loop / release or ability motion its ActionTimeline names

Characters, materials and textures go through PMP Viewer's resolver and material bake (the same path as its WebGL
preview); animations are decoded from the game's .pap files by its Havok reader. Writes
  BlackMageSim/work/game-models.js   BLM.GAME_MODELS = {...} (loaded by index.html, inlined by the build)
work/ is git-ignored, so Square Enix's data stays out of the repo. Without the file the sim draws its own figures.

Run with the Python that runs PMP Viewer (numpy + Pillow):  python -P -E BlackMageSim/tools/export_models.py
"""
import base64
import io
import json
import os
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "PmpViewer" / "server"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import anim                     # noqa: E402  (PmpViewer/server)
import game                     # noqa: E402
import resolve                  # noqa: E402
import shade                    # noqa: E402
import skeleton as S            # noqa: E402
from extract_icons import Sheet, ACTIONS   # noqa: E402

OUT = ROOT / "work"
RACE = "c0101"
GEAR = {slot: [778, 1] for slot in ("met", "top", "glv", "dwn", "sho")}     # Archmage's (Endwalker AF)
STAFF = {"kind": "weapon", "id": 1001, "body": 99, "variant": 1}            # Moonward Rod
STAFF_BONE = "n_buki_r"
STANCE = "bt_rod_emp"           # two-handed staff battle stance
DUMMIES = {"thavnair": ("Thavnairian", 236), "glade": ("Glade", 46), "oasis": ("Oasis", 45),
           "crystarium": ("Crystarium", 193)}
COLOR_MAX, NORMAL_MAX = 512, 256
ANIM_DIR = f"chara/human/{RACE}/animation/a0001/"


# ---------- packing ----------
class Pack:
    """Arrays laid end to end in one buffer; each recorded as [type, byte offset, length]."""
    def __init__(self):
        self.buf = bytearray()

    def put(self, a, kind):
        a = np.ascontiguousarray(a)
        while len(self.buf) % 4:
            self.buf.append(0)
        off = len(self.buf)
        self.buf.extend(a.tobytes())
        return [kind, off, int(a.size)]

    def b64(self):
        return base64.b64encode(bytes(self.buf)).decode()


def image_url(name, limit, keep_alpha):
    img = Image.open(os.path.join(shade.BAKED, name))
    img.thumbnail((limit, limit), Image.LANCZOS)
    buf = io.BytesIO()
    if keep_alpha and img.mode == "RGBA" and np.asarray(img)[..., 3].min() < 250:
        img.save(buf, "PNG", optimize=True)
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    img.convert("RGB").save(buf, "JPEG", quality=85, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def material_out(mat):
    if not mat or mat.get("missing") or mat.get("visible") is False or not mat.get("color"):
        return None
    alpha = bool(mat.get("alphaUsed"))
    return {"color": image_url(mat["color"], COLOR_MAX, alpha),
            "normal": image_url(mat["normal"], NORMAL_MAX, False) if mat.get("normal") else None,
            "alphaTest": float(mat.get("alphaTest") or 0) if alpha else 0,
            "transparent": bool(mat.get("transparent")) and alpha,
            "doubleSided": bool(mat.get("doubleSided"))}


def mesh_out(pack, pos, nrm, uv, idx, material, bones=None, weights=None):
    """Keep only the vertices the index buffer uses; four strongest bone influences per vertex."""
    used, remap = np.unique(idx, return_inverse=True)
    out = {"material": material, "count": int(len(used)),
           "pos": pack.put(pos[used].astype("<f4"), "f32"),
           "nrm": pack.put(np.clip(np.round(nrm[used] * 32767), -32767, 32767).astype("<i2"), "i16"),
           "uv": pack.put(uv[used, :2].astype("<f4"), "f32")}
    idx = remap.astype(np.uint32)
    out["idx"] = pack.put(idx.astype("<u2") if len(used) < 65536 else idx.astype("<u4"),
                          "u16" if len(used) < 65536 else "u32")
    if bones is not None:
        b, w = bones[used], weights[used]
        order = np.argsort(-w, axis=1)[:, :4]
        b4 = np.take_along_axis(b, order, 1)
        w4 = np.take_along_axis(w, order, 1)
        w4[b4 < 0] = 0
        b4[b4 < 0] = 0
        s = w4.sum(1, keepdims=True)
        w4 = np.where(s > 0, w4 / np.maximum(s, 1e-9), np.array([1, 0, 0, 0], np.float32))
        out["skinIndex"] = pack.put(b4.astype("<u2"), "u16")
        out["skinWeight"] = pack.put(np.round(w4 * 255).astype(np.uint8), "u8")
    return out


# ---------- the mage ----------
def visible_triangles(m, me, blob):
    """The model's index buffer with shape keys applied and hidden submeshes (attributes) dropped."""
    idx = np.frombuffer(blob, np.uint32, me["idx"][1], me["idx"][0]).copy()
    for s in me["shapes"]:
        if s["name"] in (m.get("shapesOn") or []):
            v = np.frombuffer(blob, np.uint32, s["values"][1], s["values"][0]).reshape(-1, 2)
            idx[v[:, 0]] = v[:, 1]
    keep = np.ones(len(idx) // 3, bool)
    for sub in me["submeshes"]:
        if any((m["attrs"].get(a) or {}).get("show") is False for a in sub["attrs"]):
            keep[sub["start"] // 3:(sub["start"] + sub["count"]) // 3] = False
    return idx.reshape(-1, 3)[keep].reshape(-1)


def export_character(pack):
    spec = {"subject": "character", "race": RACE, "face": 1, "hair": 1, "gear": GEAR, "collection": False}
    sc, blob = resolve.character(None, spec)
    sk = sc["skeleton"]
    mats_in = sc["materials"]
    mat_index, materials, meshes = {}, [], []
    verts = 0
    for m in sc["models"]:
        if m["hidden"]:
            continue
        nb = len(m["bones"])
        gidx = np.array(m["bones"] + [-1], np.int64)
        deform = [np.array(d).reshape(4, 4).T for d in m["deform"]] if m.get("deform") else None
        for me in m["meshes"]:
            mi = me["material"]
            if mi < 0:
                continue
            if mi not in mat_index:
                mo = material_out(mats_in[mi])
                mat_index[mi] = len(materials) if mo else -1
                if mo:
                    materials.append(mo)
            if mat_index[mi] < 0:
                continue
            idx = visible_triangles(m, me, blob)
            if not len(idx):
                continue
            n = me["vertexCount"]
            arr = lambda r, dt, w: np.frombuffer(blob, dt, r[1], r[0]).reshape(n, w).astype(np.float64 if dt == np.float32 else dt)
            pos, nrm, uv = arr(me["pos"], np.float32, 3), arr(me["nrm"], np.float32, 3), arr(me["uv"], np.float32, 4)
            bi = np.frombuffer(blob, np.uint16, me["bi"][1], me["bi"][0]).reshape(n, 8).astype(np.int64)
            bw = np.frombuffer(blob, np.float32, me["bw"][1], me["bw"][0]).reshape(n, 8).astype(np.float64)
            bi = np.minimum(bi, nb)
            if deform is not None:      # another race's model reshaped for this one: bake the deformer in
                D = np.array(deform + [np.eye(4)])
                Dv = np.einsum("vk,vkij->vij", bw, D[bi])
                wsum = bw.sum(1)
                ok = wsum > 0
                Dv[ok] /= wsum[ok, None, None]
                Dv[~ok] = np.eye(4)
                pos = np.einsum("vij,vj->vi", Dv[:, :3, :3], pos) + Dv[:, :3, 3]
                nrm = np.einsum("vij,vj->vi", Dv[:, :3, :3], nrm)
            nrm = nrm / np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
            gb = gidx[bi]
            meshes.append(mesh_out(pack, pos, nrm, uv, idx, mat_index[mi], gb, bw.astype(np.float32)))
            verts += meshes[-1]["count"]
    print(f"mage: {len(meshes)} meshes, {verts} vertices, {len(materials)} materials, {len(sk['names'])} bones")
    return {"skeleton": {"names": sk["names"], "parents": sk["parents"], "world": sk["world"]},
            "meshes": meshes, "materials": materials}


def export_rigid(pack, sc, blob, label):
    mats, mat_index, meshes = [], {}, []
    for m in sc["models"]:
        for me in m["meshes"]:
            mi = me["material"]
            if mi < 0:
                continue
            if mi not in mat_index:
                mo = material_out(sc["materials"][mi])
                mat_index[mi] = len(mats) if mo else -1
                if mo:
                    mats.append(mo)
            if mat_index[mi] < 0:
                continue
            n = me["vertexCount"]
            pos = np.frombuffer(blob, np.float32, n * 3, me["pos"][0]).reshape(n, 3)
            nrm = np.frombuffer(blob, np.float32, n * 3, me["nrm"][0]).reshape(n, 3)
            uv = np.frombuffer(blob, np.float32, n * 4, me["uv"][0]).reshape(n, 4)
            idx = visible_triangles(m, me, blob)
            meshes.append(mesh_out(pack, pos, nrm, uv, idx, mat_index[mi]))
    print(f"{label}: {len(meshes)} meshes, {sum(x['count'] for x in meshes)} vertices")
    return meshes, mats


def export_staff(pack):
    sc, blob = resolve.creature(None, STAFF)
    meshes, mats = export_rigid(pack, sc, blob, "staff")
    pts = np.concatenate([np.frombuffer(blob, np.float32, me["pos"][1], me["pos"][0]).reshape(-1, 3)
                          for m in sc["models"] for me in m["meshes"]])
    tip = pts[np.argmax(np.linalg.norm(pts, axis=1))]
    return {"meshes": meshes, "materials": mats, "bone": STAFF_BONE, "tip": tip.round(4).tolist()}


def export_dummy(pack, key):
    """A housing striking dummy: a background model, drawn rigid."""
    gp = f"bgcommon/hou/outdoor/general/{key:04d}/bgparts/gar_b0_m{key:04d}.mdl"
    mdl = game.model(game.game_file(gp))
    sc = {"models": [{"meshes": [], "attrs": {}}], "materials": []}
    blob = bytearray()
    for name in mdl["materials"]:
        local = game.game_file(name.lstrip("/"))
        if not local:
            sc["materials"].append(None)
            continue
        mt = game.material(local)
        texs = {i: game.game_file(t["path"]) for i, t in enumerate(mt["textures"])}
        sc["materials"].append(shade.bake(mt, texs, {}, max_size=COLOR_MAX))

    def put(a):
        a = np.ascontiguousarray(a)
        off = len(blob)
        blob.extend(a.tobytes())
        return [off, int(a.size)]
    for me in mdl["meshes"]:
        mi = mdl["materials"].index(me["material"]) if me["material"] in mdl["materials"] else -1
        sc["models"][0]["meshes"].append({"material": mi, "vertexCount": me["vertexCount"],
                                          "pos": put(me["pos"].astype(np.float32)), "nrm": put(me["nrm"].astype(np.float32)),
                                          "uv": put(me["uv"].astype(np.float32)), "idx": put(me["idx"].astype(np.uint32)),
                                          "shapes": [], "submeshes": []})
    meshes, mats = export_rigid(pack, sc, bytes(blob), f"dummy m{key:04d}")
    pts = np.concatenate([me["pos"] for me in mdl["meshes"]])
    return {"meshes": meshes, "materials": mats, "height": float(pts[:, 1].max())}


# ---------- animations ----------
_paps = {}


def pap(path):
    if path not in _paps:
        local = game.game_file(path)
        _paps[path] = anim._pap(local) if local else None
    return _paps[path]


def find_anim(name, extra=()):
    """The .pap holding an animation by name: the action's own file first, then the shared battle pack."""
    for p in list(extra) + [ANIM_DIR + "bt_common/resident/action.pap"]:
        got = pap(p)
        if got and name in got[0]:
            return p
    return None


def anim_out(pack, path, name, base_names):
    names, hav, cont = pap(path)
    binding = cont["bindings"][hav[names.index(name)]]
    a = binding["animation"]
    frames = anim._decode(a)                                # (F, T, 10): translation, quaternion xyzw, scale
    fps = 1 / a["frameDuration"] if a.get("frameDuration") else 30
    tracks = [base_names[i] for i in binding["transformTrackToBoneIndices"]]
    F, T, _ = frames.shape
    t, q = frames[..., 0:3], frames[..., 3:7]
    tscale = max(float(np.abs(t).max()), 1e-6) / 32767
    const = (np.abs(frames[..., 0:7] - frames[0:1, :, 0:7]).max(axis=0).max(axis=1) < 1e-4)
    chunks = []
    for k in range(T):
        rows = slice(0, 1) if const[k] else slice(0, F)
        tt = np.round(t[rows, k] / tscale).astype("<i2")
        qq = np.round(q[rows, k] * 32767).astype("<i2")
        chunks.append(np.concatenate([tt, qq], axis=1).reshape(-1))
    data = np.concatenate(chunks)
    return {"name": name, "fps": float(fps), "frames": int(F), "tracks": tracks, "const": const.astype(int).tolist(),
            "tScale": tscale, "data": pack.put(data, "i16"), "seconds": round(F / fps, 3)}


def tmb_anim(key):
    """The body animation a timeline (.tmb) plays: its first cb* name."""
    local = game.game_file(f"chara/action/{key}.tmb")
    if not local:
        return None
    names = re.findall(rb"cb[a-z]{2}_[a-z0-9_]+", open(local, "rb").read())
    return names[0].decode() if names else None


def export_anims(pack):
    base = [n for n, _, _ in S.load_sklb(game.game_file(f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb"))]
    out = {"basic": {}, "actions": {}}
    basic = {"idle": (STANCE + "/resident/idle.pap", "cbbm_id0"),
             "run": (STANCE + "/resident/move_a.pap", "cbbm_02f_lp0"),
             "walkBack": (STANCE + "/resident/move_a.pap", "cbbm_01b_lp0"),
             "jump": (STANCE + "/resident/move_a.pap", "cbbm_jump_1"),
             "item": ("bt_common/resident/action.pap", "cbbm_itm_1")}
    for k, (rel, name) in basic.items():
        out["basic"][k] = anim_out(pack, ANIM_DIR + rel, name, base)

    action, timeline, cast = Sheet("Action"), Sheet("ActionTimeline"), Sheet("ActionCastTimeline")
    key_col = timeline.string_cols()[0]
    seen = {}
    for sim_id, (row, _) in ACTIONS.items():
        entry = {}
        end_key = timeline.value(action.value(row, 7), key_col) if action.value(row, 7) > 0 else ""
        start_row = action.value(row, 5)
        start_key = timeline.value(cast.value(start_row, 0), key_col) if start_row > 0 else ""
        if start_key:
            first = tmb_anim(start_key)
            if first and first.endswith("_1"):
                loop = first[:-2] + "_2lp"
                for part, nm in (("start", first), ("loop", loop)):
                    p = find_anim(nm)
                    if p:
                        entry[part] = seen.get(nm) or anim_out(pack, p, nm, base)
                        seen[nm] = entry[part]
        if end_key:
            nm = tmb_anim(end_key)
            if nm:
                p = find_anim(nm, [ANIM_DIR + f"bt_common/{end_key}.pap", ANIM_DIR + f"{STANCE}/{end_key}.pap"])
                if p:
                    entry["release"] = seen.get(nm) or anim_out(pack, p, nm, base)
                    seen[nm] = entry["release"]
        if entry:
            out["actions"][sim_id] = entry
        got = ", ".join(k + ":" + v["name"] for k, v in entry.items()) or "none"
        print(f"  {sim_id:16s} start={start_key or '-':28s} end={end_key or '-':30s} -> {got}")
    return out


def main():
    OUT.mkdir(exist_ok=True)
    pack = Pack()
    data = {"version": 1, "race": RACE}
    data["mage"] = export_character(pack)
    data["staff"] = export_staff(pack)
    data["dummies"] = {k: dict(export_dummy(pack, mid), label=label) for k, (label, mid) in DUMMIES.items()}
    data["anims"] = export_anims(pack)
    data["bin"] = pack.b64()
    js = ("// Generated by tools/export_models.py from your FFXIV install. FINAL FANTASY XIV (c) SQUARE ENIX.\n"
          "window.BLM = window.BLM || {};\nBLM.GAME_MODELS = " + json.dumps(data, separators=(",", ":")) + ";\n")
    (OUT / "game-models.js").write_text(js, encoding="utf-8")
    print(f"\nbinary {len(pack.buf) / 1048576:.1f} MB, file {len(js) / 1048576:.1f} MB -> {OUT / 'game-models.js'}")


if __name__ == "__main__":
    try:
        main()
    finally:
        game.SERVE.close()
