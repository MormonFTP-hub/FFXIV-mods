"""Decode the built paps and compare every dh_ bone's world transform with the WoW source.

Also reports where the rider seat (n_mount) sits relative to the dragonhawk's back.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import havok_spline  # noqa: E402
import havok_tag  # noqa: E402
from build_anims import MAP, OUT, Converter  # noqa: E402
from pap import Pap  # noqa: E402
from wowsrc import FPS, ROOT, SCALE, fk, to_xiv_quat, to_xiv_vec  # noqa: E402


def decode(pap_path, name):
    p = Pap.read(Path(pap_path).read_bytes())
    tf = havok_tag.read(p.havok)
    cont = next(o for o in tf.objects if o.klass.name == "hkaAnimationContainer")
    e = next(a for a in p.anims if a.name == name)
    b = cont["bindings"][e.havok_index]
    a = b["animation"]
    tracks = list(b["transformTrackToBoneIndices"])
    if a.klass.name == "hkaSplineCompressedAnimation":
        dec = havok_spline.decode(a)                       # (F, N, 10): t3 r4 s3
        tr = np.zeros(dec.shape[:2] + (12,))
        tr[..., 0:3], tr[..., 4:8], tr[..., 8:11] = dec[..., 0:3], dec[..., 3:7], dec[..., 7:10]
    else:
        tr = np.array(a["transforms"]).reshape(-1, len(tracks), 12)
    return tracks, tr, a["duration"]


def pose_frames(skel, tracks, tr):
    pose = np.array(skel["pose"])
    F = len(tr)
    t = np.repeat(pose[None, :, 0:3], F, 0)
    r = np.repeat(pose[None, :, 4:8], F, 0)
    s = np.repeat(pose[None, :, 8:11], F, 0)
    for i, bone in enumerate(tracks):
        t[:, bone] = tr[:, i, 0:3]
        r[:, bone] = tr[:, i, 4:8]
        s[:, bone] = tr[:, i, 8:11]
    return fk(skel["parents"], t, r, s)


def main():
    conv = Converter()
    skel = conv.skel
    src = conv.src
    worst = 0
    for name in ["cbnm_id0", "cbnm_02f_lp0", "cbnm_fmt_02f_lp0", "cbnm_fmt_takeoff"]:
        tracks, tr, dur = decode(OUT / "mount.pap", name)
        wt, wr, ws = pose_frames(skel, tracks, tr)
        ai = src.anim_index(MAP[name])
        times = np.linspace(0, src.duration(ai), len(tr))
        at, ar, as_ = src.sample(ai, times)
        st, sr, ss = fk(src.parent, src.pivot_rel[None] + at, ar, as_)
        errs = []
        # the clips are re-levelled by moving the dragonhawk root, so compare relative to it
        rb = skel["names"].index("dh_Main")
        rk = skel["source_joint"]["dh_Main"]
        for n, k in skel["source_joint"].items():
            b = skel["names"].index(n)
            exp = to_xiv_vec(st[:-1, k] - st[:-1, rk]) * SCALE   # last frame may be the loop copy
            errs.append(np.abs((wt[:-1, b] - wt[:-1, rb]) - exp).max())
        e = max(errs)
        worst = max(worst, e)
        m = skel["names"].index("n_mount")
        print(f"{name}: frames={len(tr)} dur={dur:.2f}s max bone error={e * 1000:.3f} mm  "
              f"seat y {wt[:, m, 1].min():.2f}..{wt[:, m, 1].max():.2f} z {wt[:, m, 2].min():.2f}..{wt[:, m, 2].max():.2f}")
    print("OK" if worst < 0.02 else "MISMATCH")   # spline compression: ~1 cm worst case at the tail tip


if __name__ == "__main__":
    main()
