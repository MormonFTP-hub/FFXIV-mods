"""Render the game mesh with its baked textures (work/look/bake_*.png): colour, and colour x occlusion."""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake  # noqa: E402
import preview  # noqa: E402

ROOT = preview.ROOT
B = os.path.join(ROOT, "work", "bake")


def lit(name):
    """base x (0.45 + 0.55 ao): roughly how the occlusion reads in game."""
    base = np.asarray(Image.open(os.path.join(B, f"{name}_base.png")).convert("RGB"), float)
    ao = Image.open(os.path.join(B, f"{name}_ao.png")).convert("L").resize(base.shape[1::-1], Image.BILINEAR)
    out = base * (0.45 + 0.55 * np.asarray(ao, float)[..., None] / 255)
    p = os.path.join(B, f"{name}_lit.png")
    Image.fromarray(out.round().astype(np.uint8)).save(p)
    return p


if __name__ == "__main__":
    groups = []
    for name in bake.TEXSETS:
        d = np.load(os.path.join(B, f"low_{name}.npz"))
        groups.append(dict(name=name, pos=d["pos"], faces=d["faces"], uv=d["uv"], texture=lit(name)))
    scene = os.path.join(ROOT, "work", "look", "bake.obj")
    preview.write_obj(scene, groups)
    print(preview.render(scene, os.path.join(ROOT, "work", "look", "bake"), "front,side,back", 1000))
    print(preview.render(scene, os.path.join(ROOT, "work", "look", "bake_face"), "front,three", 900,
                         region=((-0.07, 0.85, -0.05), (0.07, 1.0, 0.1))))
