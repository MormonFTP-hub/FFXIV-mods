"""The game's own body animations (idle, /cpose poses, walk, run) as skinning deltas for the fitted parts.

Uses the PMP viewer's .pap decoder (../PmpViewer/server/anim.py). A delta takes bind-pose world space to the
posed world space of one bone: posed_world @ inv(bind_world), as rig.skin expects.
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
VIEWER = os.path.join(os.path.dirname(os.path.dirname(HERE)), "PmpViewer", "server")
sys.path.insert(1, VIEWER)
import anim  # noqa: E402  (PmpViewer)
import game  # noqa: E402  (PmpViewer)
import skeleton as S  # noqa: E402  (PmpViewer)
from xiv_skeleton import quat_to_mat  # noqa: E402


def _mat(t, q, s):
    m = np.eye(4)
    m[:3, :3] = quat_to_mat(q) * np.asarray(s)
    m[:3, 3] = t
    return m


def deltas(race, kind="idle", frame=0):
    a = anim.load(race, kind)
    bones = S.load_sklb(game.game_file(f"chara/human/{race}/skeleton/base/b0001/skl_{race}b0001.sklb"))
    names = [b[0] for b in bones]
    track_of = {}
    if a["race"] == race:
        track_of = {bi: k for k, bi in enumerate(a["bones"])}
    else:   # another race's animation: match tracks by bone name
        own = [b[0] for b in S.load_sklb(game.game_file(a["skeleton"]))]
        idx = {n: i for i, n in enumerate(names)}
        track_of = {idx[own[bi]]: k for k, bi in enumerate(a["bones"]) if own[bi] in idx}
    f = a["frames"][min(frame, len(a["frames"]) - 1)]
    index = {n: i for i, n in enumerate(names)}
    pose_w = []
    for i, (name, parent, bind) in enumerate(bones):
        p = index[parent] if parent is not None else -1
        lb = bind if p < 0 else np.linalg.inv(bones[p][2]) @ bind
        k = track_of.get(i)
        lp = _mat(f[k, 0:3], f[k, 3:7], f[k, 7:10]) if k is not None else lb
        pose_w.append(lp if p < 0 else pose_w[p] @ lp)
    return {n: pose_w[i] @ np.linalg.inv(bones[i][2]) for i, n in enumerate(names)}
