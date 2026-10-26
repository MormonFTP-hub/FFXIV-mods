"""Where Mina's hands hang against the bat-wing overskirt in the game's own standing animations.

For each glove vertex: the overskirt's widest point at that height and angle round the body (+-8 deg, +-2 cm).
A hand vertex closer to the body axis than that is inside or behind the overskirt.

python -P -E tools/hands.py [race]
"""
import os
import pickle
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import game_pose  # noqa: E402
import rig  # noqa: E402

ROOT = rig.ROOT
HAND = ("j_te_", "j_oya_", "j_hito_", "j_naka_", "j_kusu_", "j_ko_")


def hidden(fit, deltas, overskirt="dress_upper"):
    parts = fit["parts"]
    up = parts["body_upper"]
    is_hand = np.array([any(b.startswith(HAND) for b in row if b) and w[0] > 0.5
                        for row, w in zip(up["bones"], up["weights"])])
    hp, _ = rig.skin(up["pos"][is_hand], up["bones"][is_hand], up["weights"][is_hand], deltas)
    d = parts[overskirt]
    dp, _ = rig.skin(d["pos"], d["bones"], d["weights"], deltas)
    out = {}
    for side, sel in (("l", hp[:, 0] > 0), ("r", hp[:, 0] < 0)):
        h = hp[sel]
        th_h = np.degrees(np.arctan2(h[:, 0], h[:, 2]))
        th_d = np.degrees(np.arctan2(dp[:, 0], dp[:, 2]))
        r_h, r_d = np.hypot(h[:, 0], h[:, 2]), np.hypot(dp[:, 0], dp[:, 2])
        inside = np.zeros(len(h), bool)
        for i in range(len(h)):
            near = (np.abs(((th_d - th_h[i]) + 180) % 360 - 180) < 8) & (np.abs(dp[:, 1] - h[i, 1]) < 0.02)
            inside[i] = near.any() and r_h[i] < r_d[near].max()
        out[side] = dict(frac=inside.mean(), y=(h[:, 1].min(), h[:, 1].max()), r=np.median(r_h), theta=np.median(th_h))
    return out


if __name__ == "__main__":
    race = sys.argv[1] if len(sys.argv) > 1 else "c0201"
    fit = pickle.load(open(os.path.join(ROOT, "work", "fit", f"{race}.pkl"), "rb"))
    for overskirt in ("dress_upper", "dress_upper_draped"):
        for kind in ("idle", "pose2", "pose3", "pose4"):
            res = hidden(fit, game_pose.deltas(race, kind), overskirt)
            print(f"{race} {overskirt:18s} {kind:6s} " + "  ".join(
                f"{s}: {v['frac'] * 100:5.1f}% inside, y {v['y'][0]:.2f}..{v['y'][1]:.2f}, r {v['r']:.3f}, "
                f"angle {v['theta']:+.0f}" for s, v in res.items()))
