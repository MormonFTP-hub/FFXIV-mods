"""A/B her face's material in the game's shaders, without repacking: the gear shader (character.shpk) at several gloss
levels against the game's skin shader (skin.shpk, from the vanilla Midlander woman's face material), rendered with
tools/gs_render.py --swap in the viewer's daylight.

python -P -E tools/face_ab.py   ->  work/gs/face_<variant>.png and work/gs/face_sheet.png
"""
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mtrl  # noqa: E402
import textures as tx  # noqa: E402
import xivdata as xd  # noqa: E402

ROOT = tx.ROOT
GS = os.path.join(ROOT, "work", "gs")
AB = os.path.join(GS, "ab", "face")
HEAD_MTRL = "chara/equipment/e6164/material/v0001/mt_c0201e6164_met_b.mtrl"
SKIN_TEMPLATE = "chara/human/c0201/obj/face/f0001/material/mt_c0201f0001_fac_a.mtrl"


def tex(name, rgba, fmt="bc7"):
    tx.OUT = AB
    return tx.write(name, rgba, fmt)


def skin_material(name, norm_b, mask):
    """skin.shpk material on her head textures: _norm B (skin-colour tint) = norm_b, A (lipstick) = 0; _mask as given."""
    n = tx.png("head_nrm")
    sz = n.shape[:2]
    local_n = tex(f"{name}_norm", tx.stack(n[..., 0], n[..., 1], np.full(sz, norm_b), np.zeros(sz)))
    ao = tx.png("head_ao", "L")
    r, g, b = mask
    local_m = tex(f"{name}_mask", tx.stack(np.full(ao.shape, r), np.full(ao.shape, g), np.full(ao.shape, b),
                                           np.full(ao.shape, 255)))
    m = mtrl.Mtrl.read(xd.extract(SKIN_TEMPLATE)[0])
    games = [f"{tx.GAME_DIR}_head_base.tex", f"{tx.GAME_DIR}_{name}_norm.tex", f"{tx.GAME_DIR}_{name}_mask.tex"]
    for t, g_ in zip(m.textures, games):
        t[0] = g_
    out = os.path.join(AB, f"{name}.mtrl")
    m.write(out)
    return out, {games[1]: local_n, games[2]: local_m}


def gear_mask(name, spec, rough):
    ao = tx.png("head_ao", "L")
    return {f"{tx.GAME_DIR}_head_mask.tex": tex(f"{name}_mask", tx.stack(np.full(ao.shape, spec),
                                                                         np.full(ao.shape, rough), ao,
                                                                         np.full(ao.shape, 255)))}


def render(name, swaps):
    out = os.path.join(GS, f"face_{name}.png")
    args = [sys.executable, "-P", "-E", os.path.join(ROOT, "tools", "gs_render.py"), out, "--cam", "head",
            "--env", "day"]
    for g, local in swaps.items():
        args += ["--swap", f"{g}={local}"]
    r = subprocess.run(args, capture_output=True, text=True)
    print(name, (r.stdout + r.stderr).strip().splitlines()[-2])
    return out


def main():
    os.makedirs(AB, exist_ok=True)
    shots = [render("built", {}),
             render("gear_matte", gear_mask("gear_matte", 30, 200))]
    for name, nb in (("skin_own", 0), ("skin_tint", 255)):
        m, swaps = skin_material(name, nb, (165, 117, 156))
        swaps[HEAD_MTRL] = m
        shots.append(render(name, swaps))
    subprocess.run([sys.executable, "-P", "-E", os.path.join(ROOT, "tools", "sheet.py"),
                    os.path.join(GS, "face_sheet.png")] + shots + ["--scale", "0.6"])


if __name__ == "__main__":
    main()
