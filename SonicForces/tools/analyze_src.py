"""Look at the rip: list each SMD's islands by dominant bone and render the source (work/preview/src_*.png)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import smd  # noqa: E402
from islands import components as islands  # noqa: E402

ROOT = preview.ROOT
SRC = os.path.join(ROOT, "source", "Sonic Forces", "Sonic")
IMG = os.path.join(SRC, "images")


def summary(name):
    d = smd.read(os.path.join(SRC, name))
    m = smd.weld(d["tris"])
    comp = islands(m["vid"][m["faces"]], m["vid"].max() + 1)[m["vid"][m["faces"][:, 0]]]
    print(f"\n{name}: {len(m['pos'])} verts {len(m['faces'])} tris, bbox {m['pos'].min(0).round(3)}..{m['pos'].max(0).round(3)}")
    rows = []
    for c in np.unique(comp):
        tri = np.nonzero(comp == c)[0]
        vs = np.unique(m["faces"][tri])
        acc = np.zeros(len(d["names"]))
        np.add.at(acc, m["bones"][vs].ravel(), m["weights"][vs].ravel())
        top = np.argsort(-acc)[:3]
        rows.append((len(tri), m["mat"][tri[0]], [f"{d['names'][b]}:{acc[b] / len(vs):.2f}" for b in top if acc[b] > 0],
                     m["pos"][vs].min(0).round(3), m["pos"][vs].max(0).round(3)))
    for r in sorted(rows, key=lambda r: -r[0]):
        print(f"  {r[0]:6d} tris {r[1]:28s} {' '.join(r[2]):60s} {r[3]} .. {r[4]}")
    return d, m


def main():
    groups = []
    for i, name in enumerate(["Sonic.SMD", "Sonic_MouthL.SMD", "Sonic_MouthR.SMD", "Sonic_Eyelids.SMD", "SuperSonic.SMD"]):
        d, m = summary(name)
        off = np.array([0.0, 0, 0]) if i < 4 else np.array([0.9, 0, 0])
        if name in ("Sonic_MouthL.SMD", "Sonic_Eyelids.SMD"):
            off = np.array([-0.9 if "Mouth" in name else 1.8, 0, 0])
        for mat in np.unique(m["mat"]):
            sel = m["mat"] == mat
            f = m["faces"][sel]
            groups.append(dict(name=f"{name[:-4]}_{mat[:-4]}", pos=m["pos"] + off, faces=f, uv=m["uv"],
                               texture=os.path.join(IMG, mat)))
    scene = os.path.join(ROOT, "work", "src.obj")
    preview.write_obj(scene, groups)
    print(preview.render(scene, os.path.join(ROOT, "work", "preview", "src"), "front,side,back", 900))


if __name__ == "__main__":
    main()
