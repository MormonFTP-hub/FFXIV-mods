"""Vanilla player faces for the all-race fit (2.0.0): where each fitted race's eyes sit, and the face surfaces Sora's
head has to cover.

python -P -E tools/prep_faces.py <game_dir>
  -> work/fit/eyes.json   {race: {"mid": eye midpoint, "left", "right", "faces": [...]}} averaged over faces 1-4
     work/faces/<race>_<face>.npz   pos, faces: the face model without the parts the hat's EQP hides (human ears,
                                    Miqo'te ears, Au Ra horns) and without the alpha lash/brow cards (_etc_)
Only indexed vertices count: vanilla face buffers append shape-key vertices after the base mesh.
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XIVTOOL = os.path.join(ROOT, "apps", "xivtool", "xivtool.exe")
GAME = os.path.join(ROOT, "work", "game")
FIT_RACES = ("c0101", "c0201", "c0901", "c1101")
CHECK_RACES = ("c0101", "c0201", "c0301", "c0401", "c0501", "c0601", "c0701", "c0801", "c0901", "c1001", "c1101",
               "c1201", "c1301", "c1401", "c1501", "c1601", "c1701", "c1801")
FACES = ("f0001", "f0002", "f0003", "f0004", "f0005", "f0101", "f0102", "f0103", "f0104")
HIDDEN = {"atr_mim", "atr_top", "atr_hrn"}   # hidden by the hat's EQP (the Moogle Head's)


def xivtool(*args):
    r = subprocess.run([XIVTOOL, *map(str, args)], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stdout + r.stderr)
    return r.stdout


def face_model(race, face):
    gp = f"chara/human/{race}/obj/face/{face}/model/{race}{face}_fac.mdl"
    local = os.path.join(GAME, *gp.split("/"))
    if not os.path.exists(local):
        if "MISSING" in xivtool("extract", GAME, gp):
            return None
    js = local + ".json"
    if not os.path.exists(js) or os.path.getmtime(js) < os.path.getmtime(local):
        xivtool("mdlexport", local, js)
    return json.load(open(js, encoding="utf-8"))


def main():
    os.makedirs(os.path.join(ROOT, "work", "faces"), exist_ok=True)
    eyes = {}
    for race in CHECK_RACES:
        for face in FACES:
            d = face_model(race, face)
            if d is None:
                continue
            pos_all, tris, n = [], [], 0
            for m in d["meshes"]:
                idx = np.array(m["indices"], np.int64).reshape(-1, 3)
                pos = np.array(m["positions"], float)
                if "_iri_" in m["material"] and race in FIT_RACES and face in FACES[:4]:
                    p = pos[np.unique(idx)]
                    e = eyes.setdefault(race, {"left": [], "right": [], "faces": []})
                    e["left"].append(p[p[:, 0] > 0].mean(0).tolist())
                    e["right"].append(p[p[:, 0] < 0].mean(0).tolist())
                    e["faces"].append(face)
                if "_etc_" in m["material"] or "_iri_" in m["material"]:
                    continue
                tri_sub = np.full(len(idx), -1)
                for si, sm in enumerate(m["submeshes"]):
                    tri_sub[sm["start"] // 3:(sm["start"] + sm["count"]) // 3] = si
                keep = np.array([s < 0 or not set(m["submeshes"][s]["attrs"]) & HIDDEN for s in tri_sub], bool)
                f = idx[keep]
                used, remap = np.unique(f, return_inverse=True)
                pos_all.append(pos[used])
                tris.append(remap.reshape(-1, 3) + n)
                n += len(used)
            np.savez(os.path.join(ROOT, "work", "faces", f"{race}_{face}.npz"), pos=np.vstack(pos_all), faces=np.vstack(tris))
    for race, e in eyes.items():
        left, right = np.mean(e["left"], 0), np.mean(e["right"], 0)
        e.update(left=left.tolist(), right=right.tolist(), mid=((left + right) / 2).tolist())
        print(f"{race}: eye midpoint {np.round(e['mid'], 4)}, eye distance {np.linalg.norm(left - right) * 100:.1f} cm "
              f"(faces {', '.join(e['faces'])})")
    os.makedirs(os.path.join(ROOT, "work", "fit"), exist_ok=True)
    json.dump(eyes, open(os.path.join(ROOT, "work", "fit", "eyes.json"), "w"), indent=1)
    print(len(os.listdir(os.path.join(ROOT, "work", "faces"))), "face surfaces in work/faces")


if __name__ == "__main__":
    main()
