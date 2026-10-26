"""Gather the FFXIV reference data the Sonic fit needs and print a summary.

* work/refs/skeleton.json        c0101 (Midlander male) base bones: parent, world matrix. Viera males have
                                 no body or gear models of their own: the game deforms c0101 models with human.pbd
* work/refs/skeleton_c1701.json  the Viera male skeleton, to preview Sonic on a Viera male
                           (FFXIV space: metres, Y up, +Z forward, +X = character's left)
* vanilla naked body, face and the target gear set's models / materials, via the xivdata cache
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import meta  # noqa: E402
import xivdata as xd  # noqa: E402
from xiv_skeleton import Skeleton  # noqa: E402

RACE, VIERA, FACE, SET = "c0101", "c1701", "f0001", 6047
REFS = os.path.join(xd.ROOT, "work", "refs")
SKELETONS = {"skeleton": f"chara/human/{RACE}/skeleton/base/b0001/skl_{RACE}b0001.sklb"}
SKELETONS.update({f"skeleton_{r}": f"chara/human/{r}/skeleton/base/b0001/skl_{r}b0001.sklb" for r in ("c0101", "c0201", "c1101", "c1701")})
PBD = "chara/xls/boneDeformer/human.pbd"
BODY = [f"chara/human/{RACE}/obj/body/b0001/model/{RACE}b0001_{s}.mdl" for s in ("top", "glv", "dwn", "sho")]
MODELS = BODY + [f"chara/human/{VIERA}/obj/face/{FACE}/model/{VIERA}{FACE}_fac.mdl"]


def main():
    os.makedirs(REFS, exist_ok=True)
    for out, p in SKELETONS.items():
        sk = Skeleton(xd.extract(p)[0])
        bones = {n: {"parent": sk.names[sk.parents[i]] if sk.parents[i] >= 0 else None, "world": sk.world[i].tolist()}
                 for i, n in enumerate(sk.names)}
        json.dump(bones, open(os.path.join(REFS, f"{out}.json"), "w"))
        print(f"{p}: {len(bones)} bones, j_kao at y={sk.pos('j_kao')[1]:.3f}")
    print(PBD, "->", xd.extract(PBD)[0])

    gear = [p for r in (RACE,) for p in (xd.gear_model_path(SET, s, r) for s in ("met", "top", "glv", "dwn", "sho"))]
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
    for r in ["c0101", "c1701"]:
        print("EQDP", r, bin(meta.eqdp(r, SET)))
    for v in range(0, 3):
        for s in ("met", "top", "glv", "dwn", "sho"):
            try:
                print("IMC v", v, s, meta.imc(SET, s, v))
            except Exception as e:  # noqa: BLE001
                print("IMC v", v, s, "ERR", e)


if __name__ == "__main__":
    main()
