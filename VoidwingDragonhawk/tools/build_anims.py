"""WoW dragonhawk animations -> the chocobo's resident .pap files (mount, demihuman, idle).

Each vanilla animation slot that has a WoW counterpart (MAP) gets a new
hkaInterleavedUncompressedAnimation sampled at 30 fps: tracks for every dh_ bone plus
n_mount / n_mount_second, which follow the M2 "MountMain" attachment so the rider
rides the dragonhawk's back. Slots without a counterpart keep their vanilla animation.
Timelines are rebuilt with only the play-animation command (no chocobo sounds).
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import havok_spline  # noqa: E402
import havok_tag  # noqa: E402
import tmb  # noqa: E402
from havok_tag import HkObject, IntArray  # noqa: E402
from pap import Pap, PapAnim  # noqa: E402
from wowsrc import (FPS, ROOT, SCALE, Source, fk, qconj, qmul, qrot,  # noqa: E402
                    to_xiv_quat, to_xiv_scale, to_xiv_vec)

GAME = ROOT / "work/game/chara/demihuman/d0001/animation/a0001/bt_common/resident"
OUT = ROOT / "work/mod/chara/demihuman/d0001/animation/a0001/bt_common/resident"
M2 = ROOT / "source/wow/creature/dragonhawk2voidmount/dragonhawk2voidmount.m2"

# chocobo slot -> WoW animation (name prefix as wow.export wrote it)
MAP = {
    "cbnm_id0": "Stand (ID 0 variation 0)",
    "cbnm_01f_lp0": "Walk (ID 4 variation 0)",
    "cbnm_01b_lp0": "Walkbackwards (ID 13 variation 0)",
    "cbnm_01l_lp0": "ShuffleLeft (ID 11 variation 0)",
    "cbnm_01r_lp0": "ShuffleRight (ID 12 variation 0)",
    "cbnm_02f_lp0": "Run (ID 5 variation 0)",
    "cbnm_02l_lp0": "Run (ID 5 variation 0)",
    "cbnm_02r_lp0": "Run (ID 5 variation 0)",
    "cbnm_jump_1": "JumpStart (ID 37 variation 0)",
    "cbnm_jump_2": "Jump (ID 38 variation 0)",
    "cbnm_jump_3": "JumpEnd (ID 39 variation 0)",
    "cbnm_fmt_id0": "MountFlightIdle (ID 548 variation 0)",
    "cbnm_fmt_01f_lp0": "MountFlightWalk (ID 560 variation 0)",
    "cbnm_fmt_01b_lp0": "MountFlightWalkBackwards (ID 562 variation 0)",
    "cbnm_fmt_01l_lp0": "FlyShuffleLeft (ID 240 variation 0)",
    "cbnm_fmt_01r_lp0": "FlyShuffleRight (ID 241 variation 0)",
    "cbnm_fmt_02f_lp0": "MountFlightRun (ID 556 variation 0)",
    "cbnm_fmt_02l_lp0": "MountFlightLeft (ID 552 variation 0)",
    "cbnm_fmt_02r_lp0": "MountFlightRight (ID 554 variation 0)",
    "cbnm_fmt_glide_lp": "AdvFlyForwardGlide (ID 1532 variation 0)",
    "cbnm_fmt_takeoff": "MountFlightStart (ID 564 variation 0)",
    "cbnm_fmt_up": "AdvFlyFlapUp (ID 1702 variation 0)",
    "cbnm_swu_id0": "SwimIdle (ID 41 variation 0)",
    "cbnm_swu_01f_lp0": "Swim (ID 42 variation 0)",
    "cbnm_swu_01b_lp0": "SwimBackwards (ID 45 variation 0)",
    "cbnm_swu_01l_lp0": "SwimLeft (ID 43 variation 0)",
    "cbnm_swu_01r_lp0": "SwimRight (ID 44 variation 0)",
    "cbnm_swu_02f_lp0": "Swim (ID 42 variation 0)",
    "cbnm_swu_02l_lp0": "SwimLeft (ID 43 variation 0)",
    "cbnm_swu_02r_lp0": "SwimRight (ID 44 variation 0)",
    "cbnm_swu_glide_lp": "Swim (ID 42 variation 0)",
    "cbnm_swu_dive1": "Swim (ID 42 variation 0)",
    "cbnm_swu_dive2": "Swim (ID 42 variation 0)",
    "cbnm_swu_rise1": "Swim (ID 42 variation 0)",
    "cbnm_swu_rise2": "Swim (ID 42 variation 0)",
    "cbnm_swu_up": "Swim (ID 42 variation 0)",
    "cbnm_swu_down": "Swim (ID 42 variation 0)",
    "cbbm_mgc_thm_2lp": "ChannelCastOmni (ID 125 variation 0)",
    "cbbm_mgc_thm_3": "SpellCastOmni (ID 54 variation 0)",
}
ONE_SHOT = {"cbnm_jump_1", "cbnm_jump_3", "cbnm_fmt_takeoff", "cbbm_mgc_thm_3", "cbnm_swu_dive1", "cbnm_swu_rise1"}
# WoW clips float the body at very different heights over the model origin (standing
# 3.4 m, flying 0.9 m). Every clip is re-levelled so the seat averages this height and
# forward offset over n_root, with any start-to-end drift removed, so take-offs and
# landings don't jump. The long tail hangs ~2.95 m below the seat, so this keeps it
# just off the ground, like WoW's own hover.
SEAT_HEIGHT = 3.0
SEAT_FORWARD = 0.15
PAPS = ["mount.pap", "demihuman.pap", "idle.pap"]


def mount_attachment():
    """(bone, position) of M2 attachment 0 (MountMain), glTF space."""
    d = M2.read_bytes()
    o = 0
    while d[o:o + 4] != b"MD21":
        o += 8 + struct.unpack_from("<I", d, o + 4)[0]
    m = d[o + 8:]
    n, ofs = struct.unpack_from("<II", m, 0xF0)
    for i in range(n):
        a = ofs + i * 40
        aid, bone = struct.unpack_from("<IH", m, a)
        if aid == 0:
            x, y, z = struct.unpack_from("<3f", m, a + 8)
            return bone, np.array([x, z, -y])   # WoW Z-up -> glTF Y-up
    raise ValueError("no MountMain attachment")


class Converter:
    def __init__(self):
        self.src = Source()
        self.skel = json.loads((ROOT / "work/skeleton.json").read_text())
        names = self.skel["names"]
        self.index = {n: i for i, n in enumerate(names)}
        self.dh = [(self.index[n], k) for n, k in self.skel["source_joint"].items()]
        self.dh.sort()
        self.seat_bone, self.seat_pos = mount_attachment()
        # world reference pose of the chocobo bones, for n_mount's parent
        pose = np.array(self.skel["pose"])
        par = self.skel["parents"]
        t, r, s = pose[None, :, 0:3], pose[None, :, 4:8], pose[None, :, 8:11]
        self.ref_wt, self.ref_wr, self.ref_ws = [x[0] for x in fk(par, t, r, s)]
        self.mount = self.index["n_mount"]
        self.mount2 = self.index["n_mount_second"]
        self.mount_parent = par[self.mount]

    def tracks(self):
        return [self.mount, self.mount2] + [b for b, _ in self.dh]

    def sample(self, wow_name, loop):
        src = self.src
        ai = src.anim_index(wow_name)
        dur = src.duration(ai)
        frames = max(1, round(dur * FPS))
        times = np.linspace(0, dur, frames + 1)
        at, ar, as_ = src.sample(ai, times)
        lt = src.pivot_rel[None] + at                      # joint local, glTF space
        # world of every source joint (for the seat attachment)
        wt, wr, ws = fk(src.parent, lt, ar, as_)
        k = self.seat_bone
        seat = wt[:, k] + qrot(wr[:, k], ws[:, k] * (self.seat_pos - src.pivot[k]))
        seat_x = to_xiv_vec(seat) * SCALE
        seat_rot = to_xiv_quat(wr[:, k])                    # rest rotation of M2 bones is identity
        ramp = (seat_x[-1] - seat_x[0])[None] * np.linspace(0, 1, len(seat_x))[:, None]
        level = np.array([0, SEAT_HEIGHT, SEAT_FORWARD]) - (seat_x - ramp).mean(0)
        offset = level[None] - ramp
        offset[:, 0] = 0
        seat_x = seat_x + offset
        out = []
        for name in ("n_mount", "n_mount_second"):
            i = self.index[name]
            p = self.mount_parent
            ref_rot = self.ref_wr[i]
            back = 0.0 if name == "n_mount" else -0.45
            want_t = seat_x + qrot(seat_rot, np.array([0, 0, back]))
            want_r = qmul(seat_rot, np.broadcast_to(ref_rot, seat_rot.shape))
            inv = qconj(self.ref_wr[p])
            loc_t = qrot(np.broadcast_to(inv, want_r.shape), want_t - self.ref_wt[p]) / self.ref_ws[p]
            loc_r = qmul(np.broadcast_to(inv, want_r.shape), want_r)
            out.append((loc_t, loc_r, np.ones_like(loc_t)))
        for b, k in self.dh:
            t = to_xiv_vec(lt[:, k]) * SCALE
            if self.skel["parents"][b] == 0:                 # dragonhawk roots hang off n_root
                t = t + offset
            out.append((t, to_xiv_quat(ar[:, k]), to_xiv_scale(as_[:, k])))
        T = np.stack([o[0] for o in out], 1)
        R = np.stack([o[1] for o in out], 1)
        S = np.stack([o[2] for o in out], 1)
        # keep quaternions in one hemisphere frame to frame
        for f in range(1, len(R)):
            flip = np.sum(R[f] * R[f - 1], -1) < 0
            R[f][flip] *= -1
        if loop:
            T[-1], R[-1], S[-1] = T[0], R[0], S[0]
        return frames, T, R, S


def spline_animation(klass, T, R, S):
    """Spline-compressed animation object with the same members vanilla writes. Resident packs must
    stay small: uncompressed animations made mount.pap 29 MB and the game never showed the mount."""
    # 2e-7 keeps the long tail / wing chains within ~1 cm of the WoW pose (median < 1 mm)
    enc = havok_spline.encode(T, R, S, FPS, rot_tol=2e-7, pos_tol=1e-4)
    frames = enc["numFrames"] - 1
    return HkObject(klass, {
        "type": 3, "duration": frames / FPS, "numberOfTransformTracks": T.shape[1],
        **{k: enc[k] for k in ("numFrames", "numBlocks", "maxFramesPerBlock", "maskAndQuantizationSize",
                               "blockDuration", "blockInverseDuration", "frameDuration")},
        "blockOffsets": IntArray(enc["blockOffsets"], 4), "floatBlockOffsets": IntArray(enc["floatBlockOffsets"], 4),
        "data": enc["data"]})


def build_pap(conv, name):
    vanilla = Pap.read((GAME / name).read_bytes())
    tf = havok_tag.read(vanilla.havok)
    cont = next(o for o in tf.objects if o.klass.name == "hkaAnimationContainer")
    sk = tf.klass("hkaSplineCompressedAnimation")
    bk = tf.klass("hkaAnimationBinding")
    tracks = conv.tracks()
    anims, binds, entries, tls = [], [], [], []
    for i, e in enumerate(vanilla.anims):
        old_anim = cont["animations"][e.havok_index]
        old_bind = cont["bindings"][e.havok_index]
        if e.name in MAP:
            frames, T, R, S = conv.sample(MAP[e.name], e.name not in ONE_SHOT)
            a = spline_animation(sk, T, R, S)
            b = HkObject(bk, {"originalSkeletonName": old_bind.get("originalSkeletonName", "n_root"), "animation": a,
                              "transformTrackToBoneIndices": IntArray(tracks, 4)})
            tl = tmb.build(e.name, frames)
        else:
            a, b, tl = old_anim, old_bind, vanilla.timelines[i]
        entries.append(PapAnim(e.name, e.kind, len(anims), e.is_face))
        anims.append(a)
        binds.append(b)
        tls.append(tl)
    cont["animations"] = anims
    cont["bindings"] = binds
    havok = havok_tag.write(tf)
    havok += b"\0" * (-len(havok) % 4)
    p = Pap(vanilla.version, vanilla.model_id, vanilla.model_type, vanilla.variant, entries, havok, tls)
    data = p.write()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_bytes(data)
    # read back
    p2 = Pap.read(data)
    tf2 = havok_tag.read(p2.havok)
    c2 = next(o for o in tf2.objects if o.klass.name == "hkaAnimationContainer")
    assert [a.name for a in p2.anims] == [a.name for a in vanilla.anims]
    for e, a, b in zip(p2.anims, c2["animations"], c2["bindings"]):
        assert b["animation"] is a
    new = sum(1 for e in vanilla.anims if e.name in MAP)
    print(f"{name}: {new}/{len(vanilla.anims)} animations replaced, {len(data) / 1e6:.1f} MB")


def main():
    conv = Converter()
    print("seat bone", conv.seat_bone, "pos", conv.seat_pos.round(3), "tracks", len(conv.tracks()))
    for name in PAPS:
        build_pap(conv, name)


if __name__ == "__main__":
    main()
