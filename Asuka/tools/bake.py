"""Run the Blender bake (tools/blender/bake.py): game mesh, UVs and baked textures in work/bake.

Texture sets, by region label (labels.py): head (face, ears, eyes, the A10 clips), hair, body (the plugsuit).
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import labels  # noqa: E402
import preview  # noqa: E402

ROOT = preview.ROOT
TEXSETS = ("head", "hair", "body")
CONFIG = {
    "targets": {"head": 9000, "hair": 36000, "body": 64000},     # triangles per texture set
    "ao_distance": 0.04,
    "ao_samples": 64,
    "uv_angle": 66.0,
    "uv_margin": 0.003,
    "cage": 0.0015,
    "ray": 0.004,
    "margin": 8,
    "texsets": list(TEXSETS),
    "colour": "Color_f4c13d47-8345-4cfa-aa4c-163b8c876573_0.png",
    "normal": "NormalGL_f4c13d47-8345-4cfa-aa4c-163b8c876573_2.png",
    "rough": "ORM_f4c13d47-8345-4cfa-aa4c-163b8c876573_1@channels=G.png",
    "sizes": {"head": {"base": 1024, "ao": 512, "rough": 512, "nrm": 1024},
              "hair": {"base": 2048, "ao": 1024, "rough": 1024, "nrm": 2048},
              "body": {"base": 2048, "ao": 1024, "rough": 1024, "nrm": 2048}},
}


def texset_of(lab):
    L = labels.LABEL
    t = np.full(len(lab), TEXSETS.index("body"), np.int8)
    t[lab == L["hair"]] = TEXSETS.index("hair")
    t[np.isin(lab, [L["face"], L["clip"]])] = TEXSETS.index("head")
    return t


def main():
    out = os.path.join(ROOT, "work", "bake")
    os.makedirs(out, exist_ok=True)
    np.save(os.path.join(out, "texset.npy"), texset_of(np.load(labels.OUT)))
    cfg = os.path.join(out, "config.json")
    json.dump(CONFIG, open(cfg, "w"), indent=1)
    log = os.path.join(out, "bake.log")
    with open(log, "w") as f:
        r = subprocess.run([preview.BLENDER, "-b", "--factory-startup", "-P",
                            os.path.join(ROOT, "tools", "blender", "bake.py"), "--", ROOT, cfg],
                           stdout=f, stderr=subprocess.STDOUT, text=True)
    text = open(log).read()
    print("\n".join(l for l in text.splitlines() if l.startswith("[") or "Error" in l))
    if r.returncode != 0 or "BAKE DONE" not in text:
        raise RuntimeError(f"bake failed, see {log}")


if __name__ == "__main__":
    main()
