"""Feasibility probe for an animated face: drive Peni's fitted head with the game's own blink.

Her eyelid region comes from her Marvel Rivals face rig (weights on FACIAL_*_EyelidUpper* / EyelidLower*), moved by
the Midlander woman's face bones (j_f_mabup_01 / j_f_mabdn_01) as cfxb_blink1 in face.pap poses them.
Not part of the mod build.

python -P -E tools/blink_probe.py   ->  work/preview/blink_probe_sheet.png (rest, mid-blink, closed; front and side)
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                                "PmpViewer", "server"))
import anim  # noqa: E402  (PMP Viewer's .pap decoder)
import preview  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402
from check_fit import TEX  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
SKEL = "chara/human/c0201/skeleton/face/f0002/skl_c0201f0002.sklb"
PAP = "chara/human/c0201/animation/f0002/resident/face.pap"
HEAD_PARTS = {"head": 4, "lashes": 15, "eyes": 12, "stockings_shoes": 2}   # fitted part -> source mesh


def trs(f):
    x, y, z, w = f[3:7]
    r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    m = np.eye(4)
    m[:3, :3] = r * f[7:10]
    m[:3, 3] = f[0:3]
    return m


def blink_deltas():
    """Per frame: {bone: 4x4 world delta from rest} for the four eyelid bones. Face animations are additive (their
    base pose, cfxf_base, is the identity), so each frame turns the bone in its own frame about its own joint."""
    sk = Skeleton(xd.extract(SKEL)[0])
    names, hav, cont = anim._pap(xd.extract(PAP)[0])
    b = cont["bindings"][hav[names.index("cfxb_blink1")]]
    frames = anim._decode(b["animation"])
    track = {sk.names[k]: t for t, k in enumerate(b["transformTrackToBoneIndices"])}
    out = []
    for f in range(len(frames)):
        d = {}
        for bone in ("j_f_mabup_01_l", "j_f_mabdn_01_l", "j_f_mabup_01_r", "j_f_mabdn_01_r"):
            w = sk.world[sk.names.index(bone)]
            d[bone] = w @ trs(frames[f, track[bone]]) @ np.linalg.inv(w)
        out.append(d)
    return out


def lid_weights(src):
    """(N, 4) weight of each vertex on her upper-left, lower-left, upper-right, lower-right eyelid bones."""
    m = sd.mesh(src)
    w = np.zeros((len(m["pos"]), 4))
    for k, (side, lid) in enumerate((("L", "Upper"), ("L", "Lower"), ("R", "Upper"), ("R", "Lower"))):
        sel = np.char.startswith(m["bones"].astype(str), f"FACIAL_{side}_Eyelid{lid}")
        w[:, k] = np.where(sel, m["weights"], 0).sum(1)
    return w


def posed(fit, deltas):
    gs = []
    order = ("j_f_mabup_01_l", "j_f_mabdn_01_l", "j_f_mabup_01_r", "j_f_mabdn_01_r")
    for part, src in HEAD_PARTS.items():
        p = fit["parts"][part]
        w = lid_weights(src)
        if part == "stockings_shoes":           # only its face-paint decals ride the head
            keep = np.isin(p["bones"], ["j_kao"]).any(1)
            faces = p["faces"][keep[p["faces"]].all(1)]
        else:
            faces = p["faces"]
        pos = p["pos"].copy()
        hom = np.c_[p["pos"], np.ones(len(pos))]
        rest = 1 - w.sum(1, keepdims=True)
        pos = pos * rest
        for k, bone in enumerate(order):
            pos += w[:, k:k + 1] * (hom @ deltas[bone].T)[:, :3]
        gs.append(dict(name=part, pos=pos, faces=faces, uv=p["uv"],
                       texture=os.path.join(sd.TEX, TEX[p["texset"]])))
    return gs


if __name__ == "__main__":
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", "c0201.pkl"), "rb"))
    frames = blink_deltas()
    ang = [np.degrees(np.arccos(np.clip((np.trace(d["j_f_mabup_01_l"][:3, :3]) - 1) / 2, -1, 1))) for d in frames]
    closed = int(np.argmax(ang))
    print("upper lid rotation per frame:", np.round(ang, 1), "-> closed at frame", closed)
    jk = fit["joints"]["j_kao"]
    region = ((-0.09, jk[1] - 0.02, -0.05), (0.09, jk[1] + 0.09, 0.15))
    out = os.path.join(ROOT, "work", "preview")
    sheets = []
    for tag, f in (("rest", 0), ("half", max(1, closed // 2)), ("closed", closed)):
        scene = os.path.join(ROOT, "work", f"blink_{tag}.obj")
        preview.write_obj(scene, posed(fit, frames[f]))
        sheets.append(preview.render(scene, os.path.join(out, f"blink_{tag}"), "front,side", 600, region=region))
    from PIL import Image
    ims = [Image.open(s) for s in sheets]
    sheet = Image.new("RGB", (ims[0].width, sum(i.height for i in ims)))
    y = 0
    for im in ims:
        sheet.paste(im, (0, y))
        y += im.height
    sheet.save(os.path.join(out, "blink_probe_sheet.png"))
    print(os.path.join(out, "blink_probe_sheet.png"))
