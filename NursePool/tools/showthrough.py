"""How much of the wearer's own face model shows past Nurse-Pool, seen from 36 directions round the head (from the
PeniParker port, via Loki's fixed copy).

Replaces poke.py's rays from the head centre, which counted the nape and the jaw behind her ears as covered because
those rays ran on into her braids, while a camera sees between the braids and the choker. Here the fitted Nurse-Pool
(racial deformer applied for other races; the wig's loose strand cards cut out by their alpha) and the race's vanilla
face
(without the ears and horns, which the head piece's EQP hides) render in flat colours, and the face's visible pixels are
counted against its pixels when nothing is in front.

python -P -E tools/showthrough.py <fit race> [race[:face] ...]   (default: the fit race's own faces)
  -> per race/face: % of the face's silhouette that shows, the worst view, and work/preview/show_<race>_<face>.png
"""
import json
import os
import pickle
import subprocess
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pbd  # noqa: E402
import preview  # noqa: E402
import rig  # noqa: E402
import srcdata as sd  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = rig.ROOT
WORK = os.path.join(ROOT, "work", "show")
FACES = ("f0001", "f0002", "f0003", "f0004", "f0005", "f0101", "f0102", "f0103", "f0104", "f0201", "f0202")
# the head piece's EQP (the Moogle Head's) shows no ears: human ears, Miqo'te ears and Au Ra horns are hidden
HIDDEN_EARS = {"atr_mim", "atr_top", "atr_hrn"}
ALPHA = {"hair_02": os.path.join(WORK, "hairfx_alpha.png")}     # the loose strand cards' alpha, as greyscale
HAIRFX_OPACITY = 0.9


def face_mesh(race, face):
    p = f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl"
    if not xd.exists(p):
        return None
    pos, faces, n = [], [], 0
    for me in xd.model(p)["meshes"]:
        if "_etc_" in me["material"]:   # lash and brow cards: alpha-tested, mostly see-through (GS shows none of them)
            continue
        keep = np.array([s < 0 or not set(me["sub_attrs"][s]) & HIDDEN_EARS for s in me["tri_sub"]], bool)
        f = me["faces"][keep]
        used, remap = np.unique(f, return_inverse=True)
        pos.append(me["pos"][used])
        faces.append(remap.reshape(-1, 3) + n)
        n += len(used)
    return np.vstack(pos), np.vstack(faces)


def run(job, tag):
    os.makedirs(WORK, exist_ok=True)
    jp = os.path.join(WORK, f"{tag}.json")
    json.dump(job, open(jp, "w"))
    r = subprocess.run([preview.BLENDER, "-b", "--factory-startup", "-P",
                        os.path.join(ROOT, "tools", "blender", "visibility.py"), "--", jp], capture_output=True, text=True)
    if "VISIBILITY DONE" not in r.stdout:
        raise RuntimeError(r.stdout[-2000:] + r.stderr[-2000:])
    return json.load(open(job["out"]))["counts"]


def check(fit_race, race, face, fit, D, parents):
    fm = face_mesh(race, face)
    if fm is None:
        return None
    deform = None if race == fit_race else pbd.chain(D, int(fit_race[1:]), int(race[1:]))
    tag = f"{race}_{face}"
    groups = []
    np.savez(os.path.join(WORK, f"{tag}_wearer_face.npz"), pos=fm[0], faces=fm[1])
    target = {"npz": os.path.join(WORK, f"{tag}_wearer_face.npz"), "role": "target"}
    lo, hi = fm[0].min(0) - 0.05, fm[0].max(0) + 0.05
    for name, p in fit["parts"].items():
        if p.get("variant"):
            continue
        pos = p["pos"] if deform is None else pbd.deform(p["pos"], p["bones"], p["weights"], deform, parents)
        if pos[:, 1].max() < lo[1]:         # (after the deformer: PeniParker's copy tested the fit race's heights,
            continue                        # which dropped every part but the hair on taller races)
        f = p["faces"][(pos[p["faces"]].mean(1) > lo - 0.1).all(1) & (pos[p["faces"]].mean(1) < hi + 0.1).all(1)]
        if not len(f):
            continue
        path = os.path.join(WORK, f"{tag}_{name}.npz")
        np.savez(path, pos=pos, faces=f, uv=p["uv"])
        groups.append({"npz": path, "role": "occ",
                       "alpha": ALPHA.get(name), "cut": 0.33})
    shots = os.path.join(WORK, tag)
    with_occ = run({"groups": groups + [target], "box": [lo.tolist(), hi.tolist()], "res": 384,
                    "out": shots + "_occ.json", "shots": shots + "_occ"}, tag + "_occ")
    alone = run({"groups": [target], "box": [lo.tolist(), hi.tolist()], "res": 384,
                 "out": shots + "_alone.json", "shots": shots + "_alone"}, tag + "_alone")
    shown = sum(with_occ.values()) / max(sum(alone.values()), 1)
    worst = sorted(with_occ, key=lambda k: -with_occ[k])[:4]
    ims = []
    for k in worst:
        az, el = map(int, k.split(","))
        ims.append(Image.open(f"{shots}_occ_{az:03d}_{el:+03d}.png").convert("RGBA"))
    sheet = Image.new("RGB", (sum(i.width for i in ims), ims[0].height), (90, 94, 100))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * im.width, 0), im)
    out = os.path.join(ROOT, "work", "preview", f"show_{fit_race}_{tag}.png")
    sheet.save(out)
    print(f"{fit_race} fit on {race} {face}: {shown * 100:5.2f}% of the face shows; worst views "
          + ", ".join(f"az {k.split(',')[0]} el {k.split(',')[1]} ({with_occ[k]} px)" for k in worst), flush=True)
    return shown


def main(fit_race="c0101", *targets):
    os.makedirs(WORK, exist_ok=True)
    a = np.asarray(Image.open(os.path.join(sd.TEX, "MI_1057801_Hair_02_opacityMask.png")).convert("L"), float)
    Image.fromarray(np.round(a * HAIRFX_OPACITY).astype(np.uint8)).save(ALPHA["hair_02"])
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", f"{fit_race}.pkl"), "rb"))
    _, parents, _ = rig.load_skeleton(f"skeleton_{fit_race}")
    D = pbd.read()
    todo = []
    for t in (targets or (fit_race,)):
        race, _, face = t.partition(":")
        todo += [(race, face)] if face else [(race, f) for f in FACES]
    for race, face in todo:
        check(fit_race, race, face, fit, D, parents)


if __name__ == "__main__":
    main(*sys.argv[1:])
