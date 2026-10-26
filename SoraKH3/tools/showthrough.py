"""How much of the wearer's own face shows past Sora's head (the hat model) and jacket, seen from 36 directions round
the head (the PeniParker / White Fox method, tools/blender/visibility.py from White Fox).

Sora's head and jacket (work/gltf/<race>/parts.npz, written by convert_model.py) and the race's vanilla face
(work/faces, prep_faces.py: without the ears and horns the hat's EQP hides, and without the alpha lash cards) render
in flat colours; the face's visible pixels are counted against its pixels with nothing in front.

python -P -E tools/showthrough.py <fit race> [face ...]   (default: every player face prepared for that race)
  -> % of the face's silhouette that shows, the worst views, and work/show/<race>_<face>_worst.png
"""
import glob
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = os.path.join(os.path.dirname(ROOT), "Aerith", "apps", "blender-4.5.14-windows-x64", "blender.exe")
WORK = os.path.join(ROOT, "work", "show")


def run(job, tag):
    jp = os.path.join(WORK, f"{tag}.json")
    json.dump(job, open(jp, "w"))
    r = subprocess.run([BLENDER, "-b", "--factory-startup", "-P", os.path.join(ROOT, "tools", "blender", "visibility.py"),
                        "--", jp], capture_output=True, text=True)
    if "VISIBILITY DONE" not in r.stdout:
        raise RuntimeError(r.stdout[-2000:] + r.stderr[-2000:])
    return json.load(open(job["out"]))["counts"]


def check(race, face, parts):
    z = np.load(os.path.join(ROOT, "work", "faces", f"{race}_{face}.npz"))
    tag = f"{race}_{face}"
    lo, hi = z["pos"].min(0) - 0.05, z["pos"].max(0) + 0.05
    target = {"npz": os.path.join(ROOT, "work", "faces", f"{race}_{face}.npz"), "role": "target"}
    groups = []
    for slot in ("met", "top"):
        pos, faces = parts[f"{slot}_pos"], parts[f"{slot}_faces"]
        c = pos[faces].mean(1)
        f = faces[((c > lo - 0.1) & (c < hi + 0.1)).all(1)]
        if len(f):
            path = os.path.join(WORK, f"{tag}_{slot}.npz")
            np.savez(path, pos=pos, faces=f)
            groups.append({"npz": path, "role": "occ"})
    shots = os.path.join(WORK, tag)
    occ = run({"groups": groups + [target], "box": [lo.tolist(), hi.tolist()], "res": 384,
               "out": shots + "_occ.json", "shots": shots + "_occ"}, tag + "_occ")
    alone = run({"groups": [target], "box": [lo.tolist(), hi.tolist()], "res": 384,
                 "out": shots + "_alone.json", "shots": shots + "_alone"}, tag + "_alone")
    shown = sum(occ.values()) / max(sum(alone.values()), 1)
    worst = sorted(occ, key=lambda k: -occ[k])[:4]
    ims = [Image.open(f"{shots}_occ_{int(k.split(',')[0]):03d}_{int(k.split(',')[1]):+03d}.png").convert("RGBA") for k in worst]
    sheet = Image.new("RGB", (sum(i.width for i in ims), ims[0].height), (90, 94, 100))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * im.width, 0), im)
    sheet.save(os.path.join(WORK, f"{tag}_worst.png"))
    print(f"{race} {face}: {shown * 100:5.2f}% of the face shows; worst views "
          + ", ".join(f"az {k.split(',')[0]} el {k.split(',')[1]} ({occ[k]} px)" for k in worst), flush=True)
    return shown


def main(race, *args):
    """args: faces, and for tuning without refitting: --scale k --dy m --dz m move the built head rigidly
    (scale about the wearer's eye point, then shift), as a change of PROFILES head / eye_dy / eye_dz would."""
    os.makedirs(WORK, exist_ok=True)
    opts = {a: float(args[i + 1]) for i, a in enumerate(args) if a.startswith("--")}
    faces = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or not args[i - 1].startswith("--"))]
    parts = dict(np.load(os.path.join(ROOT, "work", "gltf", race, "parts.npz")))
    if opts:
        eye = np.array(json.load(open(os.path.join(ROOT, "work", "fit", "eyes.json")))[race]["mid"])
        k = opts.get("--scale", 1.0)
        parts["met_pos"] = eye + k * (parts["met_pos"] - eye) + [0, opts.get("--dy", 0.0), opts.get("--dz", 0.0)]
        print("head moved:", opts)
    faces = faces or sorted(os.path.basename(p)[6:11] for p in glob.glob(os.path.join(ROOT, "work", "faces", f"{race}_f*.npz")))
    res = [check(race, f, parts) for f in faces]
    print(f"{race}: mean {np.mean(res) * 100:.2f}%, max {np.max(res) * 100:.2f}%")


if __name__ == "__main__":
    main(*sys.argv[1:])
