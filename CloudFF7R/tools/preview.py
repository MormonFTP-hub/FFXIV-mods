"""Software-render the converted meshes (FFXIV space) for sanity checks.

preview.py rest|posed <out.png>
Draws front and side orthographic views with per-triangle texture colour and
simple lighting; 'posed' deforms with the remapped FFXIV weights using a test
pose (bent elbows/knees, turned head) to check the rigging.
"""
import os
import pickle
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import xiv_skeleton  # noqa: E402

ROOT = os.path.dirname(HERE)
WORK = os.path.join(ROOT, "work")
SRC = os.path.join(ROOT, "source")
TEX = {
    "Head": "PC0000_00_Head_C.png", "Eyelashes": "PC0000_00_Head_C.png", "Eyes": "PC0000_00_Eye_C.png",
    "Hair": "PC0000_00_Hair_C.png", "Eyebrows": "PC0000_00_Hair_C.png", "Mouth": "Common_Mouth_Player_C.png",
    "Body A": "PC0000_00_BodyA_C.png", "Shirt": "PC0000_00_BodyA_C.png", "Skin": "PC0000_00_BodyA_C.png",
    "Bandage": "PC0000_00_BodyA_C.png", "Body B": "PC0000_00_BodyB_C.png", "Pants": "PC0000_00_BodyB_C.png",
}


def axis_rot(axis, deg):
    a = np.asarray(axis, float)
    a /= np.linalg.norm(a)
    t = np.radians(deg)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + np.sin(t) * K + (1 - np.cos(t)) * K @ K


def posed_world(names, parents, local, pose):
    """pose: bone -> (axis in bone-local space, degrees)."""
    out = [None] * len(names)
    for i in range(len(names)):
        L = local[i].copy()
        if names[i] in pose:
            ax, deg = pose[names[i]]
            L[:3, :3] = L[:3, :3] @ axis_rot(ax, deg)
        out[i] = L if parents[i] < 0 else out[parents[i]] @ L
    return out


def main(mode, out_path):
    meshes = pickle.load(open(os.path.join(WORK, "cloud_xiv_meshes.pkl"), "rb"))
    names, parents, local, world = xiv_skeleton.load(
        os.path.join(WORK, "game/chara/human/c0101/skeleton/base/b0001/skl_c0101b0001.sklb"))
    bidx = {n: i for i, n in enumerate(names)}
    skin = None
    if mode == "posed":
        pose = {
            "j_ude_b_l": ((0, 0, 1), 80), "j_ude_b_r": ((0, 0, 1), 80),
            "j_ude_a_l": ((0, 1, 0), -50), "j_ude_a_r": ((0, 1, 0), -50),
            "j_asi_c_l": ((0, 0, 1), -70), "j_asi_a_l": ((0, 0, 1), 50),
            "j_kubi": ((0, 0, 1), 15), "j_kao": ((1, 0, 0), 30),
            "j_naka_a_l": ((0, 0, 1), 60), "j_hito_a_l": ((0, 0, 1), 60),
        }
        pw = posed_world(names, parents, local, pose)
        skin = [pw[i] @ np.linalg.inv(world[i]) for i in range(len(names))]
        for axis_name in pose:
            pass

    tris_all = []
    for name, m in meshes.items():
        P = m["P"]
        if skin is not None:
            Q = np.zeros_like(P)
            for vi, d in enumerate(m["bw"]):
                top = sorted(d.items(), key=lambda kv: -kv[1])[:4]
                tot = sum(w for _, w in top)
                for b, w in top:
                    M = skin[bidx[b]]
                    Q[vi] += (w / tot) * (M[:3, :3] @ P[vi] + M[:3, 3])
            P = Q
        tex = TEX[name]
        uv = m["uv"]
        if tex:
            im = np.asarray(Image.open(os.path.join(SRC, tex)).convert("RGB"))
            H, W = im.shape[:2]
            c = uv[m["tris"]].mean(1)
            x = ((c[:, 0] % 1.0) * W).astype(int).clip(0, W - 1)
            y = ((c[:, 1] % 1.0) * H).astype(int).clip(0, H - 1)
            col = im[y, x].astype(float)
            if name in ("Hair", "Eyebrows"):
                col = col * np.array([1.0, 0.85, 0.55])
        else:
            col = np.tile([60.0, 45.0, 30.0], (len(m["tris"]), 1))
        tris_all.append((P[m["tris"]], col))
    T = np.concatenate([t for t, _ in tris_all])
    C = np.concatenate([c for _, c in tris_all])
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    n /= np.linalg.norm(n, axis=1, keepdims=True).clip(1e-12)

    S = 520
    canvas = Image.new("RGB", (S * 3, S), (90, 90, 100))
    views = [("front", 0), ("side", 1), ("back", 2)]
    for vname, k in views:
        if vname == "front":
            px, py, depth, light = T[..., 0], T[..., 1], T[..., 2], np.array([0.3, 0.4, 1.0])
        elif vname == "side":
            px, py, depth, light = T[..., 2], T[..., 1], -T[..., 0], np.array([-1.0, 0.4, 0.3])
        else:
            px, py, depth, light = -T[..., 0], T[..., 1], -T[..., 2], np.array([-0.3, 0.4, -1.0])
        light = light / np.linalg.norm(light)
        shade = 0.35 + 0.65 * np.abs(n @ light)
        order = np.argsort(depth.mean(1))
        img = Image.new("RGB", (S, S), (90, 90, 100))
        d = ImageDraw.Draw(img)
        scale = S / 2.0
        for i in order:
            pts = [(S / 2 + px[i, j] * scale, S - 10 - py[i, j] * scale * 1.0 + 0) for j in range(3)]
            pts = [(x, S - 10 - (S - 10 - y)) for x, y in pts]
            c = tuple(int(v) for v in (C[i] * shade[i]).clip(0, 255))
            d.polygon(pts, fill=c)
        if mode == "rest":
            for nm, w in zip(names, world):
                p = w[:3, 3]
                q = {"front": (p[0], p[1]), "side": (p[2], p[1]), "back": (-p[0], p[1])}[vname]
                x, y = S / 2 + q[0] * scale, S - 10 - q[1] * scale
                d.ellipse((x - 2, y - 2, x + 2, y + 2), fill=(255, 40, 40))
        canvas.paste(img, (k * S, 0))
    canvas.save(out_path)
    print("saved", out_path)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
