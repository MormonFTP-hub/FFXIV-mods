"""Her joints, measured on the T-pose mesh (work/src/joints.json; game axes, figure metres, she stands 1.0 tall).

Arms lie along x, so they are sliced across x: a line through the slice centres of the upper arm and forearm, with
the joints on it at SHOULDER_X, the wrist cuff's middle (WRIST_X) and ELBOW_AT of the way between (the FFXIV elbow
sits about half-way, and her sleeve's elbow pads give no sharper mark). Legs are sliced across y: a line through
the thigh and the shin, joints at HIP_Y (a little above the crotch, as on the FFXIV bodies), KNEE_Y (the kneecap's
middle) and ANKLE_Y (inside the boot, above the heel). Neck and head joints sit on the neck's axis.

python -P -E tools/joints.py [render]
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import labels  # noqa: E402
import src  # noqa: E402

ROOT = src.ROOT
OUT = os.path.join(ROOT, "work", "src", "joints.json")
SHOULDER_X = 0.088      # head of the upper arm, under the shoulder pad
WRIST_X = 0.288         # middle of the wrist cuff
ELBOW_AT = 0.52
CROTCH_Y = 0.555
HIP_Y = 0.585
KNEE_Y = 0.315
ANKLE_Y = 0.078
NECK_Y = 0.845          # base of the neck (j_kubi), inside the collar
HEAD_Y = 0.872          # top of the neck, under the jaw
NECK_TOP_Y = 0.857      # just under the collar's top edge at the front (0.859; 0.868 at the back)
SLICE = 0.002
# Her left hand (palm down, fingers along +x; mirrored for the right): the fingers part at KNUCKLE_X, each finger's
# lane (z of its centre) and tip, from slices across the hand. The thumb is everything in front of THUMB_Z(x).
KNUCKLE_X = 0.348
KNUCKLE_Y = 0.809
FINGERS = {"index": (0.024, 0.397), "middle": (0.010, 0.401), "ring": (-0.002, 0.396), "pinky": (-0.013, 0.383)}
THUMB_Z = ((0.30, 0.0185), (0.36, 0.0335))     # (x, z) ends of the line between thumb and index
THUMB = ((0.302, 0.800, 0.024), (0.362, 0.797, 0.040))      # its root by the wrist cuff, and its tip
TIP_Y = 0.807


def centres(p, axis, vals, radius=0.06):
    """Bounding-box centres of thin slices across `axis`, dropping strays far from the slice median."""
    out = []
    other = [a for a in range(3) if a != axis]
    for v in vals:
        q = p[np.abs(p[:, axis] - v) < SLICE]
        if len(q) < 10:
            continue
        m = np.median(q, 0)
        q = q[np.linalg.norm((q - m)[:, other], axis=1) < radius]
        c = (q.min(0) + q.max(0)) / 2
        c[axis] = v
        out.append(c)
    return np.array(out)


def fit_line(c, axis):
    """Least-squares line through slice centres, parametrised by the slicing axis -> (point(t), direction)."""
    A = np.c_[c[:, axis], np.ones(len(c))]
    k = [np.linalg.lstsq(A, c[:, a], rcond=None)[0] if a != axis else np.array([1.0, 0.0]) for a in range(3)]

    def at(t):
        return np.array([k[a][0] * t + k[a][1] for a in range(3)])
    return at, np.array([k[a][0] for a in range(3)])


def measure():
    d = np.load(src.OUT)
    pos = d["pos"]
    lab = np.load(labels.OUT)
    L = labels.LABEL
    suit = lab == L["suit"]
    J = {}
    for s, sign in (("l", 1), ("r", -1)):
        arm = pos[suit & (sign * pos[:, 0] > 0.09) & (pos[:, 1] > 0.78) & (pos[:, 1] < 0.85)]
        arm = arm * [sign, 1, 1]
        up, _ = fit_line(centres(arm, 0, np.arange(0.11, 0.18, 0.005), 0.03), 0)
        lo, _ = fit_line(centres(arm, 0, np.arange(0.20, 0.27, 0.005), 0.03), 0)
        ex = SHOULDER_X + ELBOW_AT * (WRIST_X - SHOULDER_X)
        m = np.array([sign, 1, 1])
        J[f"shoulder_{s}"] = up(SHOULDER_X) * m
        J[f"elbow_{s}"] = (up(ex) + lo(ex)) / 2 * m
        J[f"wrist_{s}"] = lo(WRIST_X) * m
        hand = arm[arm[:, 0] > WRIST_X + 0.01]
        tip = hand[np.argmax(hand[:, 0])]
        J[f"fingertip_{s}"] = tip * m
        for f, (z, tx) in FINGERS.items():
            J[f"knuckle_{f}_{s}"] = np.array([sign * KNUCKLE_X, KNUCKLE_Y, z])
            J[f"tip_{f}_{s}"] = np.array([sign * tx, TIP_Y, z])
        J[f"knuckle_thumb_{s}"] = np.array(THUMB[0]) * m
        J[f"tip_thumb_{s}"] = np.array(THUMB[1]) * m
        J[f"hand_{s}"] = J[f"knuckle_middle_{s}"]
        leg = pos[(lab == L["suit"]) & (sign * pos[:, 0] > 0.0) & (pos[:, 1] < CROTCH_Y)]
        thigh, _ = fit_line(centres(leg, 1, np.arange(0.36, 0.52, 0.01)), 1)
        shin, _ = fit_line(centres(leg, 1, np.arange(0.14, 0.28, 0.01)), 1)
        J[f"hip_{s}"] = thigh(HIP_Y)
        J[f"knee_{s}"] = (thigh(KNEE_Y) + shin(KNEE_Y)) / 2
        J[f"ankle_{s}"] = shin(ANKLE_Y)
        foot = leg[(leg[:, 1] < 0.03) & (np.linalg.norm((leg - J[f"ankle_{s}"])[:, [0, 2]], axis=1) < 0.15)]
        J[f"toe_{s}"] = foot[np.argmax(foot[:, 2])] * [1, 0, 1] + [0, 0.012, 0]
        J[f"heel_{s}"] = foot[np.argmin(foot[:, 2])] * [1, 0, 1]
    neck = pos[(np.abs(pos[:, 1] - NECK_Y - 0.015) < SLICE) & (lab == L["suit"]) &
               (np.hypot(pos[:, 0], pos[:, 2] - labels.NECK_Z) < 0.04)]
    zc = (neck[:, 2].min() + neck[:, 2].max()) / 2
    J["neck"] = np.array([0.0, NECK_Y, zc])
    J["head"] = np.array([0.0, HEAD_Y, zc])
    J["neck_top"] = np.array([0.0, NECK_TOP_Y, zc])
    face = pos[lab == L["face"]]
    eye = face[(face[:, 1] > 0.9) & (face[:, 1] < 0.925) & (face[:, 2] > 0.04)]
    J["eyes"] = np.array([0.0, 0.913, np.percentile(eye[:, 2], 60)])
    J["crotch"] = np.array([0.0, CROTCH_Y, 0.04])
    for k, v in J.items():
        print(f"  {k:12s} {np.round(v, 4)}")
    json.dump({k: v.tolist() for k, v in J.items()}, open(OUT, "w"), indent=1)
    return pos, d["faces"], lab, J


def load():
    return {k: np.array(v) for k, v in json.load(open(OUT)).items()}


def render(pos, faces, lab, J):
    import look
    col = labels.colours(lab) * 0.5 + 0.5 * np.load(src.OUT)["colour"]
    P, F, C = [pos], [faces], [col]
    n = len(pos)
    octa = np.array([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], float) * 0.006
    of = np.array([[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]])
    for v in J.values():
        P.append(v + octa)
        F.append(of + n)
        C.append(np.tile([0.0, 1.0, 0.2], (6, 1)))
        n += 6
    look.render("joints", np.concatenate(P), np.concatenate(F), np.concatenate(C), "front,left", 1200, grid=0.05)


if __name__ == "__main__":
    pos, faces, lab, J = measure()
    if "render" in sys.argv:
        render(pos, faces, lab, J)
