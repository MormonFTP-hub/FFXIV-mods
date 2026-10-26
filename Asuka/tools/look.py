"""Debug renders of numpy meshes in game axes, coloured per vertex: PLY -> background Blender (workbench)."""
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preview  # noqa: E402

ROOT = preview.ROOT
OUT = os.path.join(ROOT, "work", "look")


def write_ply(path, pos, faces, colors=None):
    """Game axes (Y up, +Z front) -> Blender axes (Z up, -Y front). colors: (N,3) floats 0..1 or uint8."""
    p = np.stack([pos[:, 0], -pos[:, 2], pos[:, 1]], 1).astype("<f4")
    if colors is None:
        colors = np.full((len(pos), 3), 200, np.uint8)
    c = np.asarray(colors)
    if c.dtype != np.uint8:
        c = (np.clip(c, 0, 1) * 255).round().astype(np.uint8)
    vert = np.zeros(len(p), [("p", "<f4", 3), ("c", "u1", 3)])
    vert["p"], vert["c"] = p, c[:, :3]
    face = np.zeros(len(faces), [("n", "u1"), ("i", "<i4", 3)])
    face["n"], face["i"] = 3, faces
    head = (f"ply\nformat binary_little_endian 1.0\nelement vertex {len(p)}\nproperty float x\nproperty float y\n"
            f"property float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\n"
            f"element face {len(faces)}\nproperty list uchar int vertex_indices\nend_header\n")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(head.encode())
        f.write(vert.tobytes())
        f.write(face.tobytes())


def render(name, pos, faces, colors=None, views="front,left,back", res=900, region=None, grid=None):
    """region: (centre xyz in game axes, size). grid: spacing of labelled coordinate lines drawn over the
    orthographic views (game axes). Returns the written PNG paths."""
    ply = os.path.join(OUT, f"{name}.ply")
    write_ply(ply, pos, faces, colors)
    if region is None:
        lo, hi = pos.min(0), pos.max(0)
        region = ((lo + hi) / 2, float(max(hi - lo)))
    (cx, cy, cz), size = region
    args = [preview.BLENDER, "-b", "--factory-startup", "-P", os.path.join(ROOT, "tools", "blender", "render_ply.py"),
            "--", ply, os.path.join(OUT, name), views, str(res), f"{cx},{-cz},{cy},{size}"]
    r = subprocess.run(args, capture_output=True, text=True)
    if "done" not in r.stdout:
        raise RuntimeError(r.stdout[-3000:] + r.stderr[-3000:])
    os.remove(ply)
    paths = [os.path.join(OUT, f"{name}_{v}.png") for v in views.split(",")]
    if grid:
        for v, p in zip(views.split(","), paths):
            draw_grid(p, v, (cx, cy, cz), size, grid)
    return paths


# orthographic view -> (game axis shown left-to-right, its sign, centre index)
SCREEN_X = {"front": (0, 1), "back": (0, -1), "left": (2, -1), "right": (2, 1)}


def draw_grid(png, view, centre, size, step):
    """Label the game coordinates on an orthographic render: vertical lines for the horizontal axis (x for
    front/back, z for the side views), horizontal lines for height (y)."""
    from PIL import Image, ImageDraw
    if view not in SCREEN_X:
        return
    im = Image.open(png).convert("RGB")
    d = ImageDraw.Draw(im)
    res = im.size[0]
    span = size * 1.05
    ax, sign = SCREEN_X[view]
    c = centre[ax]

    def px(val):
        return res / 2 + sign * (val - c) / span * res

    def py(val):
        return res / 2 - (val - centre[1]) / span * res

    lo = np.floor((c - span / 2) / step) * step
    for k in np.arange(lo, c + span / 2 + step, step):
        x = px(k)
        d.line([(x, 0), (x, res)], fill=(255, 255, 0) if abs(k) < 1e-9 else (90, 200, 255), width=1)
        d.text((x + 2, 2), f"{'xyz'[ax]}{k:+.3f}", fill=(255, 255, 255))
    lo = np.floor((centre[1] - span / 2) / step) * step
    for k in np.arange(lo, centre[1] + span / 2 + step, step):
        y = py(k)
        d.line([(0, y), (res, y)], fill=(90, 200, 255), width=1)
        d.text((2, y + 2), f"y{k:.3f}", fill=(255, 255, 255))
    im.save(png)


def palette(labels, colors):
    """labels (N,) ints -> (N,3) colours from a {label: (r, g, b)} dict (grey for unknown)."""
    out = np.full((len(labels), 3), 0.5)
    for k, c in colors.items():
        out[labels == k] = c
    return out
