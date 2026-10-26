"""Gather the FFXIV reference data the Griffith fit needs and print a summary.

* work/refs/skeleton.json  c0101 base + face f0001 + hair h0001 bones: parent, world matrix
                           (FFXIV space: metres, Y up, +Z forward, +X = character's left)
* vanilla naked body, face, hair and the target gear set's models / materials, via the xivdata cache
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

RACE, FACE, HAIR, SET = "c0101", "f0001", "h0001", 110
REFS = os.path.join(xd.ROOT, "work", "refs")
SKELETONS = [f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb",
             f"chara/human/{RACE}/skeleton/face/f0002/skl_{RACE}f0002.sklb",
]
MODELS = [f"chara/human/{RACE}/obj/body/b0001/model/{RACE}b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")] + [
    f"chara/human/{RACE}/obj/face/{FACE}/model/{RACE}{FACE}_fac.mdl",
    f"chara/human/{RACE}/obj/hair/{HAIR}/model/{RACE}{HAIR}_hir.mdl"] + [
    xd.gear_model_path(SET, s, RACE) for s in ("met", "top", "glv", "dwn", "sho")]

os.makedirs(REFS, exist_ok=True)
bones = {}
for p in SKELETONS:
    sk = Skeleton(xd.extract(p)[0])
    print(f"{p}: {len(sk.names)} bones")
    for i, n in enumerate(sk.names):
        par = sk.parents[i]
        if n not in bones:
            bones[n] = {"parent": sk.names[par] if par >= 0 else None, "world": sk.world[i].tolist(), "src": p.split("/")[-1]}
json.dump(bones, open(os.path.join(REFS, "skeleton.json"), "w"))
print(f"skeleton: {len(bones)} bones")

for p in MODELS:
    m = xd.model(p)
    print(f"\n{p}\n  materials={m['materials']}\n  attributes={m['attributes']}\n  shapes={m['shapes']}")
    for me in m["meshes"]:
        used = sorted({b for row in me["bones"] for b in row if b})
        lo, hi = me["pos"].min(0).round(3), me["pos"].max(0).round(3)
        print(f"  {me['material']}: v={len(me['pos'])} f={len(me['faces'])} bbox={lo}..{hi} subattrs={me['sub_attrs']}")
        print(f"     bones({len(used)}): {' '.join(used)}")

print("\nEQP", hex(meta.eqp(SET)))
for r in ["c0101", "c0301", "c0501", "c0701", "c0901", "c1101", "c1301", "c1501", "c1701"]:
    print("EQDP", r, bin(meta.eqdp(r, SET)))
for v in range(0, 4):
    for s in ("met", "top", "glv", "dwn", "sho"):
        try:
            print("IMC v", v, s, meta.imc(SET, s, v))
        except Exception as e:  # noqa: BLE001
            print("IMC v", v, s, "ERR", e)
