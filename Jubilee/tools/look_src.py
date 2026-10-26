"""Render the extracted source meshes (work/src) with their colour maps: python -P -E tools/look_src.py [mesh ...]
-> work/preview/src_sheet.png (front, side, back)."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402
import srcdata as sd  # noqa: E402

OUT = os.path.join(sd.ROOT, "work", "preview")


def groups(names):
    out = []
    for n in names:
        m = sd.mesh(n)
        uv = np.c_[m["uv"][:, 0], 1 - m["uv"][:, 1]]
        out.append(dict(name=n, pos=m["pos"], faces=m["faces"], uv=uv, texture=sd.texture_path(n)))
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or [n for n in sd.names() if n not in ("Rim_HeroDetails", "Eyes_02")]
    tag = "src" if not sys.argv[1:] else "src_" + "_".join(sys.argv[1:])
    obj = os.path.join(OUT, f"{tag}.obj")
    preview.write_obj(obj, groups(names))
    print(preview.render(obj, os.path.join(OUT, tag), views="front,side,back", res=900))
