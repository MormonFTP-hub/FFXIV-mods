"""Gather the FFXIV reference data the White Fox fit needs and print a summary.

* work/refs/skeleton_<race>.json  base skeletons: bone parent and world matrix
                                  (FFXIV space: metres, Y up, +Z forward, +X = character's left)
* the racial deformer (human.pbd), the bare c0201 body (smallclothes e0000), the c0201 face 1 and the
  Island Resort set models / materials, via the xivdata cache
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

SET = 6173
RACES = ("c0101", "c0201", "c0901", "c1101", "c1401", "c1801")
REFS = os.path.join(xd.ROOT, "work", "refs")
PBD = "chara/xls/boneDeformer/human.pbd"
BODY = [f"chara/equipment/e0000/model/c0201e0000_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
MODELS = BODY + ["chara/human/c0201/obj/face/f0001/model/c0201f0001_fac.mdl"]


def main():
    os.makedirs(REFS, exist_ok=True)
    for r in RACES:
        p = f"chara/human/{r}/skeleton/base/b0001/skl_{r}b0001.sklb"
        sk = Skeleton(xd.extract(p)[0])
        bones = {n: {"parent": sk.names[sk.parents[i]] if sk.parents[i] >= 0 else None, "world": sk.world[i].tolist()}
                 for i, n in enumerate(sk.names)}
        json.dump(bones, open(os.path.join(REFS, f"skeleton_{r}.json"), "w"))
        print(f"{p}: {len(bones)} bones, j_kao at y={sk.pos('j_kao')[1]:.3f}")
    print(PBD, "->", xd.extract(PBD)[0])

    gear = [xd.gear_model_path(SET, s, r) for r in ("c0201", "c0101") for s in ("met", "top", "glv", "dwn", "sho")]
    for p in MODELS + gear:
        if not xd.exists(p):
            print("\n(not in game)", p)
            continue
        m = xd.model(p)
        print(f"\n{p}\n  materials={m['materials']}\n  attributes={m['attributes']}\n  shapes={m['shapes']}")
        for me in m["meshes"]:
            used = sorted({b for row in me["bones"] for b in row if b})
            lo, hi = me["pos"].min(0).round(3), me["pos"].max(0).round(3)
            print(f"  {me['material']}: v={len(me['pos'])} f={len(me['faces'])} bbox={lo}..{hi} subattrs={me['sub_attrs']}")
            print(f"     bones({len(used)}): {' '.join(used)}")

    print("\nEQP", hex(meta.eqp(SET)))
    for r in ("c0101", "c0201", "c0401", "c0801", "c1001", "c1101", "c1201", "c1401", "c1601", "c1801"):
        print("EQDP", r, bin(meta.eqdp(r, SET)))
    for v in range(0, 2):
        for s in ("met", "top", "glv", "dwn", "sho"):
            try:
                print("IMC v", v, s, meta.imc(SET, s, v))
            except Exception as e:  # noqa: BLE001
                print("IMC v", v, s, "ERR", e)


if __name__ == "__main__":
    main()

