"""A/B the _mask gloss (specular R, roughness G) per texture set in the game's shaders, without repacking: writes
variant masks to work/gs/ab/<variant>/ and renders the head and the full figure with tools/gs_render.py --swap.

python -P -E tools/gloss_ab.py   ->  work/gs/ab_<variant>_{head,full}.png and work/gs/ab_sheet_{head,full}.png
"""
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import textures as tx  # noqa: E402

ROOT = tx.ROOT
GS = os.path.join(ROOT, "work", "gs")
# variant -> texset -> (specular, roughness or None for the body's baked variation around this level)
VARIANTS = {
    "a_built": {"head": (45, 185), "hair": (100, 120), "body": (115, 70)},
    "b_satin": {"head": (60, 140), "hair": (130, 80), "body": (150, 40)},
    "c_gloss": {"head": (80, 110), "hair": (160, 55), "body": (190, 22)},
}


def mask(texset, spec, rough, out_dir):
    ao = tx.png(f"{texset}_ao", "L")
    sz = ao.shape
    if texset == "body":
        r = tx.png(f"{texset}_rough", "L", sz[0]).astype(float)
        _, gain, lo, hi = tx.BODY_ROUGH
        med = np.median(r[r > 5])
        g = np.clip(rough + gain * (r - med), min(lo, rough), hi)
    else:
        g = np.full(sz, rough)
    tx.OUT = out_dir
    return tx.write(f"{texset}_mask", tx.stack(np.full(sz, spec), g, ao, np.full(sz, 255)), "bc7")


def main():
    for name, sets in VARIANTS.items():
        d = os.path.join(GS, "ab", name)
        swaps = []
        for texset, (spec, rough) in sets.items():
            local = mask(texset, spec, rough, d)
            swaps += ["--swap", f"{tx.GAME_DIR}_{texset}_mask.tex={local}"]
        for cam in ("head", "full"):
            out = os.path.join(GS, f"ab_{name}_{cam}.png")
            r = subprocess.run([sys.executable, "-P", "-E", os.path.join(ROOT, "tools", "gs_render.py"), out,
                                "--cam", cam] + swaps, capture_output=True, text=True)
            print(name, cam, (r.stdout + r.stderr).strip().splitlines()[-2:])
    for cam in ("head", "full"):
        subprocess.run([sys.executable, "-P", "-E", os.path.join(ROOT, "tools", "sheet.py"),
                        os.path.join(GS, f"ab_sheet_{cam}.png")] +
                       [os.path.join(GS, f"ab_{n}_{cam}.png") for n in VARIANTS] + ["--scale", "0.6"])


if __name__ == "__main__":
    main()
