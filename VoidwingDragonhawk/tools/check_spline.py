"""Check havok_spline against game data and against itself.

1. Decode every vanilla chocobo mount animation: rotations must be unit quaternions and
   bone translations must match the skeleton's reference pose (bones don't stretch).
2. Re-encode those decoded animations with our encoder and decode again: must match.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import havok_spline as hs  # noqa: E402
import havok_tag  # noqa: E402
from dump_havok import havok_of  # noqa: E402
from pap import Pap  # noqa: E402
from wowsrc import ROOT  # noqa: E402

GAME = ROOT / "work/game/chara/demihuman/d0001"


def vanilla():
    sk = havok_tag.read(havok_of(GAME / "skeleton/base/b0001/skl_d0001b0001.sklb"))
    skel = next(o for o in sk.objects if o.klass.name == "hkaSkeleton")
    ref = np.array(skel["referencePose"])
    p = Pap.read((GAME / "animation/a0001/bt_common/resident/mount.pap").read_bytes())
    cont = next(o for o in havok_tag.read(p.havok).objects if o.klass.name == "hkaAnimationContainer")
    return ref, p, cont


def main():
    ref, p, cont = vanilla()
    worst_len = worst_rot = 0
    stretch = []
    for e in p.anims:
        b = cont["bindings"][e.havok_index]
        a = b["animation"]
        dec = hs.decode(a)
        bones = list(b["transformTrackToBoneIndices"])
        qn = np.abs(np.linalg.norm(dec[..., 3:7], axis=-1) - 1).max()
        worst_rot = max(worst_rot, qn)
        # translation length per track vs the reference pose (skip root-ish bones that move)
        lt = np.linalg.norm(dec[..., 0:3], axis=-1)
        lr = np.linalg.norm(ref[bones, 0:3], axis=-1)
        rel = np.abs(lt - lr[None])
        stretch.append(np.median(rel))
        worst_len = max(worst_len, np.percentile(rel, 90))
        # round trip through our encoder
        enc = hs.encode(dec[..., 0:3], dec[..., 3:7], dec[..., 7:10])
        re = hs.decode({**enc, "numberOfTransformTracks": len(bones)})
        dq = np.abs(np.abs(np.sum(re[..., 3:7] * dec[..., 3:7], -1)) - 1).max()
        dt = np.abs(re[..., 0:3] - dec[..., 0:3]).max()
        print(f"{e.name:20s} frames={a['numFrames']:3d} tracks={len(bones)} |q|-1 max {qn:.1e}  "
              f"bone length dev median {np.median(rel) * 1000:.2f} mm  | re-encode: {len(a['data'])} -> {len(enc['data'])} bytes, "
              f"rot err {dq:.1e}, pos err {dt * 1000:.2f} mm")
    print(f"worst |q|-1 {worst_rot:.1e}, worst 90th pct bone length deviation {worst_len * 1000:.1f} mm")


if __name__ == "__main__":
    main()
