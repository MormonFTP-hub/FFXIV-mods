"""Preview the built mod files (not the source): the built .mdl skinned on the built .sklb with
poses decoded from the built .pap, rendered in Blender (EEVEE) with a stand-in rider on n_mount.

python -P tools/preview.py <out prefix> <animation>:<frame>[,<animation>:<frame>...] [views]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from build_materials import MATERIALS, SURFACES  # noqa: E402
from build_textures import PAIR  # noqa: E402
from check_anims import decode, pose_frames  # noqa: E402
from wowsrc import ROOT, qmat, qmul, qconj  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

BLENDER = ROOT.parent / "Aerith/apps/blender-4.5.14-windows-x64/blender.exe"
XIVTOOL = ROOT / "apps/xivtool/xivtool.exe"
MOD = ROOT / "work/mod"
MDL = MOD / "chara/demihuman/d0001/obj/equipment/e0001/model/d0001e0001_dwn.mdl"
SKLB = MOD / "chara/demihuman/d0001/skeleton/base/b0001/skl_d0001b0001.sklb"
PAP = MOD / "chara/demihuman/d0001/animation/a0001/bt_common/resident/mount.pap"
TEX = ROOT / "work/tex"
OUT = ROOT / "work/preview"


def emissive_maps():
    """Per material: emissive colour per pixel = lerp(even row, odd row, 1 - id.G) of the pair in id.R
    (G = 255 is the pair's first row)."""
    out = {}
    for letter, (texset, _) in MATERIALS.items():
        idm = np.asarray(Image.open(TEX / f"{texset}_id.png")).astype(np.float32) / 255
        pair = np.rint(idm[..., 0] * 255 / 17).astype(int)
        g = 1 - idm[..., 1:2]
        emis = np.zeros(idm.shape[:2] + (3,), np.float32)
        for kind, p in PAIR.items():
            even, odd = SURFACES[kind]
            e0 = np.array(even.get("EmissiveColor", [0, 0, 0]), np.float32)
            e1 = np.array(odd.get("EmissiveColor", even.get("EmissiveColor", [0, 0, 0])), np.float32)
            m = pair == p
            emis[m] = (e0 * (1 - g[m]) + e1 * g[m])
        path = OUT / f"emis_{letter}.png"
        Image.fromarray(np.clip(emis / 2.5 * 255, 0, 255).astype(np.uint8)).save(path)
        out[letter] = path
    return out


def load_model():
    js = ROOT / "work/preview/dwn_built.json"
    subprocess.run([str(XIVTOOL), "mdlexport", str(MDL), str(js)], check=True, capture_output=True)
    return json.loads(js.read_text())


def skin(model, sk, names, wt, wr, ws):
    """LBS of every mesh for one frame; world qs arrays are (B,3),(B,4),(B,3)."""
    index = {n: i for i, n in enumerate(names)}
    inv_bind = np.linalg.inv(sk.world)
    mats = np.zeros((len(names), 4, 4))
    for b in range(len(names)):
        m = np.eye(4)
        m[:3, :3] = qmat(wr[b]) * ws[b]
        m[:3, 3] = wt[b]
        mats[b] = m @ inv_bind[b]
    out = []
    for mesh in model["meshes"]:
        p = np.c_[np.array(mesh["positions"]), np.ones(len(mesh["positions"]))]
        acc = np.zeros((len(p), 3))
        W = np.array(mesh["weights"], float)              # raw bytes, up to 8 influences
        W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
        for k in range(W.shape[1]):
            bi = np.array([index.get(b[k], 0) if k < len(b) and b[k] else 0 for b in mesh["bones"]])
            acc += W[:, k:k + 1] * np.einsum("nij,nj->ni", mats[bi], p)[:, :3]
        out.append(acc)
    return out


def rider(pos, rot):
    """A blocky seated figure (boxes) at the seat, oriented by rot (world quaternion delta)."""
    boxes = [((0, 0.35, -0.05), (0.32, 0.5, 0.22)),    # torso
             ((0, 0.78, 0), (0.2, 0.24, 0.22)),        # head
             ((0.2, -0.05, 0.15), (0.12, 0.12, 0.42)), ((-0.2, -0.05, 0.15), (0.12, 0.12, 0.42)),   # thighs
             ((0.24, -0.35, 0.33), (0.1, 0.5, 0.1)), ((-0.24, -0.35, 0.33), (0.1, 0.5, 0.1))]       # shins
    R = qmat(rot)
    verts, faces = [], []
    for c, s in boxes:
        base = len(verts)
        for dx in (-1, 1):
            for dy in (-1, 1):
                for dz in (-1, 1):
                    verts.append(pos + R @ (np.array(c) + np.array(s) / 2 * [dx, dy, dz]))
        for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            faces.append([base + i for i in f])
    return np.array(verts), faces


def blender_axes(v):
    """FFXIV (x left, y up, z forward) -> Blender Z-up (x, -z, y)."""
    v = np.asarray(v)
    return np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)


def write_obj(path, model, skinned, rider_mesh, emis):
    skinned = [blender_axes(p) for p in skinned]
    rider_mesh = (blender_axes(rider_mesh[0]), rider_mesh[1])
    mtl = path.with_suffix(".mtl")
    with open(path, "w") as f, open(mtl, "w") as m:
        f.write(f"mtllib {mtl.name}\n")
        written = set()
        base = 1
        for mesh, pos in zip(model["meshes"], skinned):
            letter = mesh["material"].split("_")[-1][0]
            texset = MATERIALS[letter][0]
            if letter not in written:
                m.write(f"newmtl {letter}\nKd 1 1 1\nKe 1 1 1\nmap_Kd {TEX / (texset + '_base.png')}\n"
                        f"map_d {TEX / (texset + '_base.png')}\nmap_Ke {emis[letter]}\n")
                written.add(letter)
            f.write(f"o mesh_{base}\nusemtl {letter}\n")
            for v in pos:
                f.write(f"v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
            for t in mesh["uvs"]:
                f.write(f"vt {t[0]:.5f} {1 - t[1]:.5f}\n")
            idx = np.array(mesh["indices"]).reshape(-1, 3) + base
            for a, b, c in idx:
                f.write(f"f {a}/{a} {b}/{b} {c}/{c}\n")
            base += len(pos)
        rv, rf = rider_mesh
        m.write("newmtl rider\nKd 0.85 0.55 0.35\n")
        f.write("o rider\nusemtl rider\n")
        for v in rv:
            f.write(f"v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
        for face in rf:
            f.write("f " + " ".join(str(base + i) for i in face) + "\n")


def main():
    prefix = sys.argv[1]
    shots = [s.split(":") for s in sys.argv[2].split(",")]
    views = sys.argv[3] if len(sys.argv) > 3 else "persp,side"
    OUT.mkdir(parents=True, exist_ok=True)
    skel = json.loads((ROOT / "work/skeleton.json").read_text())
    names = skel["names"]
    sk = Skeleton(str(SKLB))
    model = load_model()
    emis = emissive_maps()
    mount = names.index("n_mount")
    objs = []
    for anim, frame in shots:
        tracks, tr, _ = decode(PAP, anim)
        f = min(int(frame), len(tr) - 1)
        wt, wr, ws = pose_frames(skel, tracks, tr[f:f + 1])
        skinned = skin(model, sk, names, wt[0], wr[0], ws[0])
        ref_rot = np.array(skel["pose"])  # rider orientation relative to the chocobo's rest seat
        _, rest_r, _ = pose_frames(skel, [], np.zeros((1, 0, 12)))
        delta = qmul(wr[0, mount], qconj(rest_r[0, mount]))
        obj = OUT / f"{prefix}_{anim}_{f}.obj"
        write_obj(obj, model, skinned, rider(wt[0, mount], delta), emis)
        objs.append(obj)
        print("frame", anim, f, "seat", wt[0, mount].round(2))
    for obj in objs:
        r = subprocess.run([str(BLENDER), "-b", "--factory-startup", "-P", str(ROOT / "tools/blender/render_frame.py"), "--",
                            str(obj), str(obj.with_suffix("")), views], capture_output=True, text=True)
        if "RENDER DONE" not in r.stdout:
            raise RuntimeError(r.stdout[-2000:] + r.stderr[-2000:])
        print("rendered", obj.stem)


if __name__ == "__main__":
    main()
