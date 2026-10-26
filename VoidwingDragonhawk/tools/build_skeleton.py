"""Chocobo skeleton + dragonhawk bones -> work/skeleton.json and the new skl_d0001b0001.sklb.

The 86 chocobo bones keep their names, order and reference pose, so every vanilla
chocobo animation still binds to the same indices. The dragonhawk bones (only those
that carry skin weight, plus their parents) follow, renamed bone_X -> dh_X and
parented to n_root.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import havok_tag  # noqa: E402
from havok_tag import HkObject, IntArray  # noqa: E402
from wowsrc import ROOT, SCALE, Source, to_xiv_vec  # noqa: E402

GAME = ROOT / "work/game/chara/demihuman/d0001/skeleton/base/b0001/skl_d0001b0001.sklb"
OUT_SKLB = ROOT / "work/mod/chara/demihuman/d0001/skeleton/base/b0001/skl_d0001b0001.sklb"
OUT_JSON = ROOT / "work/skeleton.json"


def weighted_joints(src):
    g, j = src.g, src.g.j
    used = set()
    for m in j["meshes"]:
        for p in m["primitives"]:
            idx = np.unique(g.accessor(p["indices"]).ravel())
            jj = g.accessor(p["attributes"]["JOINTS_0"])[idx]
            ww = g.accessor(p["attributes"]["WEIGHTS_0"])[idx].astype(float)
            used |= set(np.unique(jj[ww > 0.001]).tolist())
    keep = set(used)
    for k in list(used):
        p = src.parent[k]
        while p >= 0:
            keep.add(p)
            p = src.parent[p]
    return keep


def main():
    data = GAME.read_bytes()
    havok_off = int.from_bytes(data[0xC:0x10], "little")
    tf = havok_tag.read(data[havok_off:])
    sk = next(o for o in tf.objects if o.klass.name == "hkaSkeleton")
    base_names = [b["name"] for b in sk["bones"]]
    nbase = len(base_names)

    src = Source()
    keep = weighted_joints(src)
    order = []

    def visit(k):
        order.append(k)
        for c in range(len(src.names)):
            if src.parent[c] == k and c in keep:
                visit(c)

    for k in range(len(src.names)):
        if src.parent[k] < 0 and k in keep:
            visit(k)

    new_index = {k: nbase + i for i, k in enumerate(order)}
    names = list(base_names)
    parents = list(sk["parentIndices"])
    pose = [list(p) for p in sk["referencePose"]]
    for k in order:
        names.append("dh_" + src.names[k].removeprefix("bone_"))
        parents.append(new_index[src.parent[k]] if src.parent[k] >= 0 else 0)
        t = to_xiv_vec(src.pivot_rel[k]) * SCALE
        pose.append([*t, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0])
    assert len(set(names)) == len(names)
    assert all(p < i for i, p in enumerate(parents))

    sk["bones"] = [HkObject(sk["bones"][0].klass, {"name": n}) for n in names]
    sk["parentIndices"] = IntArray(parents, sk["parentIndices"].width)
    sk["referencePose"] = pose
    out = data[:havok_off] + havok_tag.write(tf)
    OUT_SKLB.parent.mkdir(parents=True, exist_ok=True)
    OUT_SKLB.write_bytes(out)

    # check: read back
    tf2 = havok_tag.read(out[havok_off:])
    sk2 = next(o for o in tf2.objects if o.klass.name == "hkaSkeleton")
    assert [b["name"] for b in sk2["bones"]] == names and list(sk2["parentIndices"]) == parents

    OUT_JSON.write_text(json.dumps({
        "names": names, "parents": parents, "pose": pose, "base_count": nbase,
        "source_joint": {names[new_index[k]]: k for k in order}, "scale": SCALE,
    }, indent=1))
    print(f"skeleton: {nbase} chocobo + {len(order)} dragonhawk = {len(names)} bones -> {OUT_SKLB.name} ({len(out)} bytes)")


if __name__ == "__main__":
    main()
