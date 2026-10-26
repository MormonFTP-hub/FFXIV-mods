"""Her joints, measured on the sculpt (work/src/joints.json; game axes, figure metres).

The figure has no rig, so the limbs are found from the paint regions (labels.py) and measured in horizontal
slices: a line is fitted through the slice centres of each upper/lower limb, and the joints sit on those lines
at heights read off the sculpt (KNEE_Y etc.: knee crease, boot ankle, crotch). The elbow is where the upper-arm and
forearm lines pass closest. Her head joint and eyes come from the neck slices and the eye recesses.

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
CROTCH_X = -0.015
HIP_Y = 0.955           # hip joints: ~5 cm (figure) above the crotch (0.905), as on the FFXIV bodies
KNEE_Y = 0.54
ANKLE_Y = 0.13          # inside the boot, above her heel
SHOULDER_Y = 1.465      # head of the upper arm, under the puff sleeve
NECK_Y = 1.555          # bottom of the choker
HEAD_Y = 1.615          # top of the neck, under the jaw
ELBOW_AT = 0.53
SLICE = 0.004


def slice_centres(p, ys):
    out = []
    for y in ys:
        s = np.abs(p[:, 1] - y) < SLICE
        if s.sum() > 10:
            q = p[s]
            c = np.median(q, 0)
            q = q[np.linalg.norm((q - c)[:, [0, 2]], axis=1) < 0.1]        # drop strays from other parts
            out.append(((q.min(0) + q.max(0)) / 2) * [1, 0, 1] + [0, y, 0])
    return np.array(out)


def fit_line(c):
    """x(y), z(y) least squares through slice centres -> function y -> point."""
    A = np.c_[c[:, 1], np.ones(len(c))]
    kx = np.linalg.lstsq(A, c[:, 0], rcond=None)[0]
    kz = np.linalg.lstsq(A, c[:, 2], rcond=None)[0]
    return lambda y: np.array([kx[0] * y + kx[1], y, kz[0] * y + kz[1]]), np.array([kx[0], 1.0, kz[0]])


def closest(p1, d1, p2, d2):
    """Midpoint of the closest approach of two lines."""
    w = p1 - p2
    a, b, c, d, e = d1 @ d1, d1 @ d2, d2 @ d2, d1 @ w, d2 @ w
    den = a * c - b * b
    s, t = (b * e - c * d) / den, (a * e - b * d) / den
    return (p1 + s * d1 + p2 + t * d2) / 2


def measure():
    pos, faces, nrm = src.load()
    lab = np.load(labels.OUT)
    L = labels.LABEL
    J = {}
    leg = np.isin(lab, [L["skin"], L["boot"], L["crescent"]]) & (pos[:, 1] < 0.95)
    upper_arm = (lab == L["skin"]) & (pos[:, 1] > 1.2) & (pos[:, 1] < 1.5) & (np.abs(pos[:, 0]) > 0.12)
    forearm = (lab == L["glove"]) & (np.abs(pos[:, 0]) > 0.12)
    for s, sign in (("l", 1), ("r", -1)):
        p = pos[leg & (sign * (pos[:, 0] - CROTCH_X) > 0)]
        thigh, _ = fit_line(slice_centres(p, np.arange(0.62, 0.89, 0.02)))
        shin, _ = fit_line(slice_centres(p, np.arange(0.20, 0.46, 0.02)))
        J[f"hip_{s}"] = thigh(HIP_Y)
        J[f"knee_{s}"] = (thigh(KNEE_Y) + shin(KNEE_Y)) / 2
        J[f"ankle_{s}"] = shin(ANKLE_Y)
        foot = p[(p[:, 1] < 0.03) & (np.linalg.norm((p - J[f"ankle_{s}"])[:, [0, 2]], axis=1) < 0.25)]
        J[f"toe_{s}"] = foot[np.argmax(foot[:, 2])] * [1, 0, 1] + [0, 0.02, 0]
        J[f"heel_{s}"] = foot[np.argmin(foot[:, 2])] * [1, 0, 1]
        up, du = fit_line(slice_centres(pos[upper_arm & (sign * pos[:, 0] > 0)], np.arange(1.30, 1.43, 0.01)))
        lo, dl = fit_line(slice_centres(pos[forearm & (sign * pos[:, 0] > 0)], np.arange(1.04, 1.20, 0.01)))
        J[f"shoulder_{s}"] = up(SHOULDER_Y)
        # wrist: the narrowest glove slice between the forearm and the hand
        g = pos[(lab == L["glove"]) & (sign * pos[:, 0] > 0.12)]
        ys = np.arange(0.97, 1.06, 0.004)
        width = [np.ptp(g[np.abs(g[:, 1] - y) < SLICE][:, [0, 2]], 0).max() for y in ys]
        wy = ys[int(np.argmin(width))]
        J[f"wrist_{s}"] = lo(wy)
        # her arms hang nearly straight, so the two lines barely bend: the elbow goes where the FFXIV arm has it,
        # 53% of the way from shoulder to wrist (her gloves' cuffs sit above it, as the anime's opera gloves do)
        ey = SHOULDER_Y - ELBOW_AT * (SHOULDER_Y - wy)
        J[f"elbow_{s}"] = (up(ey) + lo(ey)) / 2
        hand = g[g[:, 1] < wy - 0.01]
        tip = hand[np.argmax(np.linalg.norm(hand - J[f"wrist_{s}"], axis=1))]
        J[f"fingertip_{s}"] = tip
        J[f"hand_{s}"] = J[f"wrist_{s}"] + 0.45 * (tip - J[f"wrist_{s}"])      # knuckles, roughly
        print(f"  {s}: wrist at y {wy:.3f} (glove width {min(width) * 1000:.1f} mm)")
    # neck centre: half-way between the choker's front and back on the midline, at its bottom and its top (the
    # jaw hides the neck's front higher up)
    band = (lab == L["choker"]) & (np.abs(pos[:, 0]) < 0.008)
    for name, y, at in (("neck", NECK_Y, NECK_Y + 0.008), ("head", HEAD_Y, HEAD_Y - 0.022)):
        b = pos[band & (np.abs(pos[:, 1] - at) < SLICE)]
        J[name] = np.array([0.0, y, (b[:, 2].min() + b[:, 2].max()) / 2])
    eye = pos[lab == L["eye"]]
    J["eyes"] = np.array([0.0, (eye[:, 1].min() + eye[:, 1].max()) / 2, eye[:, 2].mean()])
    J["crotch"] = np.array([CROTCH_X, 0.905, 0.05])
    for k, v in J.items():
        print(f"  {k:12s} {np.round(v, 3)}")
    json.dump({k: v.tolist() for k, v in J.items()}, open(OUT, "w"), indent=1)
    return pos, faces, lab, J


def load():
    return {k: np.array(v) for k, v in json.load(open(OUT)).items()}


def render(pos, faces, lab, J):
    import look
    col = labels.colours(lab) * 0.6 + 0.4
    P, F, C = [pos], [faces], [col]
    n = len(pos)
    octa = np.array([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], float) * 0.012
    of = np.array([[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]])
    for v in J.values():
        P.append(v + octa)
        F.append(of + n)
        C.append(np.tile([0.0, 0.8, 0.2], (6, 1)))
        n += 6
    look.render("joints", np.concatenate(P), np.concatenate(F), np.concatenate(C), "front,left", 1200, grid=0.1)


if __name__ == "__main__":
    pos, faces, lab, J = measure()
    if "render" in sys.argv:
        render(pos, faces, lab, J)
