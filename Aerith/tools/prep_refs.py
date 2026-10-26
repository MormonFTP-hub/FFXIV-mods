"""Gather the FFXIV reference data the Blender fit needs, as plain JSON in work/refs/.

* skeleton.json   c0201 base + face skeleton: name, parent, world matrix (FFXIV space: metres, Y up, +Z forward)
* bibo_<slot>.json  the user's Bibo+ (Medium) body pieces, LOD0 meshes
* face.json        vanilla c0201 face f0001, for fitting the hair around the head
* face_<race>_f<id>.json  every face of the Face option's races, for rigging Aerith's face (build_face.py)
"""
import json
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xivdata as xd  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

ROOT = xd.ROOT
REFS = os.path.join(ROOT, "work", "refs")
BIBO = r"E:\cum\Bibo+"
# The options the user's collection has enabled (Breasts/Bottoms option 1 = Medium); nude top for the fit surface.
BIBO_FILES = {
    "top": os.path.join(BIBO, "common", "39", "c0201e0279_top.mdl"),            # Nude - Medium
    "dwn": os.path.join(BIBO, "bottoms - emperor's new breeches", "sfw undies - medium",
                        "chara", "equipment", "e0279", "model", "c0201e0279_dwn.mdl"),
    "glv": os.path.join(BIBO, "common", "44", "c0201e0279_glv.mdl"),
    "sho": os.path.join(BIBO, "common", "45", "c0201e0279_sho.mdl"),
}
SKELETONS = ["chara/human/c0201/skeleton/base/b0001/skl_c0201b0001.sklb",
             "chara/human/c0201/skeleton/face/f0002/skl_c0201f0002.sklb"]
FACE = "chara/human/c0201/obj/face/f0001/model/c0201f0001_fac.mdl"
FACE_IDS = {"c0201": ["0001", "0002", "0003", "0004", "0005"]}    # the Face option's races and their faces

os.makedirs(REFS, exist_ok=True)

bones = {}
for p in SKELETONS:
    sk = Skeleton(xd.extract(p)[0])
    for i, n in enumerate(sk.names):
        par = sk.parents[i]
        if n not in bones:
            bones[n] = {"parent": sk.names[par] if par >= 0 else None, "world": sk.world[i].tolist()}
json.dump(bones, open(os.path.join(REFS, "skeleton.json"), "w"))
print(f"skeleton: {len(bones)} bones")

for slot, src in BIBO_FILES.items():
    local = os.path.join(REFS, f"bibo_{slot}.mdl")
    shutil.copyfile(src, local)
    xd.xivtool("mdlexport", local, os.path.join(REFS, f"bibo_{slot}.json"))
    d = json.load(open(os.path.join(REFS, f"bibo_{slot}.json")))
    print(f"bibo_{slot}: " + ", ".join(f"{m['material']} v={len(m['positions'])}" for m in d["meshes"]))

xd.xivtool("mdlexport", xd.extract(FACE)[0], os.path.join(REFS, "face.json"))
d = json.load(open(os.path.join(REFS, "face.json")))
print("face: " + ", ".join(f"{m['material']} v={len(m['positions'])}" for m in d["meshes"]))

for race, ids in FACE_IDS.items():
    for f in ids:
        out = os.path.join(REFS, f"face_{race}_f{f}.json")
        xd.xivtool("mdlexport", xd.extract(f"chara/human/{race}/obj/face/f{f}/model/{race}f{f}_fac.mdl")[0], out)
        print(f"face_{race}_f{f}: {len(json.load(open(out))['meshes'])} meshes")
