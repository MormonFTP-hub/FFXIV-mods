"""Debug previews: write OBJ scenes from numpy meshes and render them with the portable Blender."""
import os
import subprocess

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = os.path.join(os.path.dirname(ROOT), "Aerith", "apps", "blender-4.5.14-windows-x64", "blender.exe")
SRC = os.path.join(ROOT, "source")


def write_obj(path, groups):
    """groups: list of dicts name, pos (N,3), faces (M,3), optional uv (N,2, OBJ v-up) and
    texture (file name in source/) or color (r,g,b) and alpha, and optionally alpha_texture (an
    opacity image, cut at 0.4 like an alpha-tested material)."""
    mtl = os.path.splitext(path)[0] + ".mtl"
    with open(path, "w") as f, open(mtl, "w") as m:
        f.write(f"mtllib {os.path.basename(mtl)}\n")
        base = 1
        for i, g in enumerate(groups):
            mat = f"{g['name']}_mat"
            m.write(f"newmtl {mat}\n")
            c = g.get("color", (0.8, 0.8, 0.8))
            m.write(f"Kd {c[0]} {c[1]} {c[2]}\nd {g.get('alpha', 1.0)}\n")
            if g.get("texture"):
                m.write(f"map_Kd {os.path.join(SRC, g['texture'])}\n")
            if g.get("alpha_texture"):
                m.write(f"map_d {g['alpha_texture']}\n")
            f.write(f"o {g['name']}\nusemtl {mat}\n")
            np.savetxt(f, g["pos"], fmt="v %.5f %.5f %.5f")
            # every group writes one vt per vertex so v and vt indices stay in step across groups
            uv = g["uv"] if g.get("uv") is not None else np.zeros((len(g["pos"]), 2))
            np.savetxt(f, uv, fmt="vt %.5f %.5f")
            fc = g["faces"] + base
            np.savetxt(f, np.repeat(fc, 2, axis=1), fmt="f %d/%d %d/%d %d/%d")
            base += len(g["pos"])


def render(obj_path, out_prefix, views="front,side", res=900, region=None, log=None):
    """region: (lo xyz, hi xyz) in FFXIV space to frame instead of the whole scene."""
    args = [BLENDER, "-b", "--factory-startup", "--python", os.path.join(ROOT, "tools", "blender", "render_obj.py"), "--",
            obj_path, out_prefix, views, str(res)]
    if region is not None:
        args += [",".join(f"{v:.4f}" for v in np.ravel(region))]
    r = subprocess.run(args, capture_output=True, text=True)
    if log:
        open(log, "w").write(r.stdout + r.stderr)
    if "RENDER DONE" not in r.stdout:
        raise RuntimeError(r.stdout[-3000:] + r.stderr[-3000:])
    return out_prefix + "_sheet.png"
