"""The game's own body animations (.pap) per race: idle, the /cpose standing poses, walk and run.

A .pap holds a Havok tagfile with an hkaAnimationContainer: hkaSplineCompressedAnimation per animation plus a
binding from tracks to bones of the race's base skeleton. Decoding follows the spline-compressed layout (as in
HavokLib): per block, a 4-byte mask per track (quantization, position / rotation / scale types), then per track a
position, rotation and scale that are each static values or a B-spline (u16 control-point count, u8 degree, u8
knots, quantized control points). Rotations are 40-bit (or 48-bit / uncompressed) "three component" quaternions.
"""
import math
import struct

import numpy as np

import game
import meta as M
from havok_tagfile import TagfileReader, find_objects

FILES = {
    "idle": ("bt_common/resident/idle.pap", "id0"),
    "pose1": ("bt_common/emote/pose01_loop.pap", "pose01"),
    "pose2": ("bt_common/emote/pose02_loop.pap", "pose02"),
    "pose3": ("bt_common/emote/pose03_loop.pap", "pose03"),
    "pose4": ("bt_common/emote/pose04_loop.pap", "pose04"),
    "walk": ("bt_common/resident/move_a.pap", "01f_lp"),
    "run": ("bt_common/resident/move_a.pap", "02f_lp"),
}
QUANT = {0: (4, 4), 1: (5, 1), 2: (6, 2), 3: (3, 1), 4: (2, 2), 5: (16, 4)}   # rotation type -> (size, alignment)
_cache = {}


def _align(off, a):
    return (off + a - 1) & ~(a - 1)


def _quat(buf, off, qtype):
    if qtype == 1:            # THREECOMP40: three 12-bit components, index of the dropped largest one, sign
        v = int.from_bytes(buf[off:off + 5], "little")
        c = np.array([(v >> s) & 0xFFF for s in (0, 12, 24)], float) - 2047
        q = c * 0.000345436
        shift, invert = (v >> 36) & 3, (v >> 38) & 1
    elif qtype == 2:          # THREECOMP48: three 15-bit components
        x, y, z = struct.unpack_from("<3H", buf, off)
        shift = ((y >> 14) & 2) | ((x >> 15) & 1)
        invert = (z >> 15) & 1
        q = (np.array([x & 0x7FFF, y & 0x7FFF, z & 0x7FFF], float) - 16383) * 0.000043161
    elif qtype == 5:
        return np.array(struct.unpack_from("<4f", buf, off))
    elif qtype == 0:          # POLAR32: 10-bit w, 18-bit packed polar angles of the xyz direction, sign bits
        v = struct.unpack_from("<I", buf, off)[0]
        r = ((v >> 18) & 0x3FF) / 1023
        r = 1 - r * r
        pt = float(v & 0x3FFFF)
        phi = math.floor(math.sqrt(pt))
        theta = 0.0
        if phi > 0:
            theta = (math.pi / 4) * (pt - phi * phi) / phi
            phi = (math.pi / 2) / 511 * phi
        mag = math.sqrt(max(0.0, 1 - r * r))
        out = np.array([math.sin(phi) * math.cos(theta) * mag, math.sin(phi) * math.sin(theta) * mag,
                        math.cos(phi) * mag, r])
        for i, bit in enumerate((0x10000000, 0x20000000, 0x40000000, 0x80000000)):
            if v & bit:
                out[i] = -out[i]
        return out
    else:
        raise ValueError(f"rotation quantization {qtype} not supported")
    w = math.sqrt(max(0.0, 1 - float(q @ q)))
    if invert:                         # the sign bit is the dropped (largest) component's own sign
        w = -w
    vals = list(q)
    vals.insert(shift, w)              # the dropped component goes back at its own index (x, y, z, w order)
    return np.array(vals)


def _knot_span(degree, value, n, knots):
    if value >= knots[n]:
        return n - 1
    low, high = degree, n
    mid = (low + high) // 2
    while value < knots[mid] or value >= knots[mid + 1]:
        if value < knots[mid]:
            high = mid
        else:
            low = mid
        mid = (low + high) // 2
    return mid


def _spline(span, degree, t, knots, pts):
    """De Boor evaluation of a B-spline with u8 knots (HavokLib's GetSinglePoint)."""
    n = [1.0] + [0.0] * degree
    for i in range(1, degree + 1):
        for j in range(i - 1, -1, -1):
            den = knots[span + i - j] - knots[span - j]
            a = (t - knots[span - j]) / den if den else 0.0
            tmp = n[j] * a
            n[j + 1] += n[j] - tmp
            n[j] = tmp
    return sum(pts[span - i] * n[i] for i in range(degree + 1))


class _Track:
    """One component (position, rotation or scale) of one track in one block."""

    def __init__(self, kind, default):
        self.kind, self.static, self.spline, self.default = kind, None, None, default

    def at(self, t):
        if self.spline is None:
            return self.static
        degree, knots, pts = self.spline
        n = len(pts)
        span = _knot_span(degree, t, n, knots)
        v = _spline(span, degree, t, knots, pts)
        if self.kind == "rot":
            v = v / (np.linalg.norm(v) or 1)
        return v


def _read_vector(buf, off, qtype, flags, default):
    tr = _Track("vec", default)
    static_m, spline_m = flags & 0x7, (flags >> 4) & 0x7
    value = np.array(default, float)
    if spline_m:
        count, degree = struct.unpack_from("<HB", buf, off)
        off += 3
        knots = list(buf[off:off + count + degree + 2])
        off = _align(off + count + degree + 2, 4)
        lo, hi = {}, {}
        for a in range(3):
            if spline_m >> a & 1:
                lo[a], hi[a] = struct.unpack_from("<2f", buf, off)
                off += 8
            elif static_m >> a & 1:
                value[a] = struct.unpack_from("<f", buf, off)[0]
                off += 4
        size, maxq = (1, 255) if qtype == 0 else (2, 65535)
        pts = []
        for _ in range(count + 1):
            p = value.copy()
            for a in range(3):
                if spline_m >> a & 1:
                    q = buf[off] if size == 1 else struct.unpack_from("<H", buf, off)[0]
                    off += size
                    p[a] = lo[a] + (hi[a] - lo[a]) * q / maxq
            pts.append(p)
        off = _align(off, 4)
        tr.spline = (degree, knots, pts)
    else:
        for a in range(3):
            if static_m >> a & 1:
                value[a] = struct.unpack_from("<f", buf, off)[0]
                off += 4
        tr.static = value
    return tr, off


def _read_rotation(buf, off, qtype, flags):
    tr = _Track("rot", np.array([0, 0, 0, 1.0]))
    size, align = QUANT[qtype]
    if flags & 0xF0:
        count, degree = struct.unpack_from("<HB", buf, off)
        off += 3
        knots = list(buf[off:off + count + degree + 2])
        off = _align(off + count + degree + 2, align)
        pts = []
        for _ in range(count + 1):
            pts.append(_quat(buf, off, qtype))
            off += size
        tr.spline = (degree, knots, pts)
    elif flags & 0x0F:
        off = _align(off, align)
        tr.static = _quat(buf, off, qtype)
        off += size
    else:
        tr.static = tr.default
    return tr, _align(off, 4)


def _decode(anim):
    buf = bytes(b & 0xFF for b in anim["data"])
    tracks = anim["numberOfTransformTracks"]
    nframes, per_block = anim["numFrames"], anim["maxFramesPerBlock"]
    blocks = []
    for b, start in enumerate(anim["blockOffsets"]):
        masks = [buf[start + 4 * t:start + 4 * t + 4] for t in range(tracks)]
        off = start + anim["maskAndQuantizationSize"]
        comps = []
        for t in range(tracks):
            q, pf, rf, sf = masks[t]
            pos, off = _read_vector(buf, off, q & 3, pf, (0.0, 0.0, 0.0))
            rot, off = _read_rotation(buf, off, (q >> 2) & 0xF, rf)
            scl, off = _read_vector(buf, off, (q >> 6) & 3, sf, (1.0, 1.0, 1.0))
            comps.append((pos, rot, scl))
        blocks.append(comps)
    frames = np.zeros((nframes, tracks, 10), np.float32)
    for f in range(nframes):
        b = min(f // (per_block - 1), len(blocks) - 1)
        local = f - b * (per_block - 1)
        for t, (pos, rot, scl) in enumerate(blocks[b]):
            frames[f, t, 0:3] = pos.at(local)
            frames[f, t, 3:7] = rot.at(local)
            frames[f, t, 7:10] = scl.at(local)
    return frames


def _pap(path):
    d = open(path, "rb").read()
    n = struct.unpack_from("<h", d, 8)[0]
    info, hk, tl = struct.unpack_from("<III", d, 14)
    names = [d[info + 40 * i: info + 40 * i + 32].split(b"\0")[0].decode() for i in range(n)]
    hav = [struct.unpack_from("<H", d, info + 40 * i + 34)[0] for i in range(n)]
    root = TagfileReader(d[hk:tl]).read()
    cont = list(find_objects(root, "hkaAnimationContainer"))[0]
    return names, hav, cont


def load(race, kind):
    """{'fps', 'frames' (F, tracks, 10: translation xyz, quaternion xyzw, scale xyz), 'bones' (bone index in the
    race's base skeleton per track), 'race' (whose animation it is)}"""
    key = (race, kind)
    if key in _cache:
        return _cache[key]
    rel, want = FILES[kind]
    r = race
    path = None
    while r:
        path = game.game_file(f"chara/human/{r}/animation/a0001/{rel}")
        if path:
            break
        r = M.FALLBACK.get(r)               # Highlander men use the Midlander men's, Lalafell women the men's
    if not path:
        raise FileNotFoundError(f"no {kind} animation for {race}")
    names, hav, cont = _pap(path)
    pick = next((i for i, nm in enumerate(names) if want in nm and "_add_" not in nm), None)
    if pick is None:
        pick = next(i for i, nm in enumerate(names) if "_add_" not in nm)
    binding = cont["bindings"][hav[pick]]
    anim = binding["animation"]
    frames = _decode(anim)
    out = {"fps": 1 / anim["frameDuration"] if anim.get("frameDuration") else 30, "frames": frames,
           "bones": list(binding["transformTrackToBoneIndices"]), "race": r, "name": names[pick],
           "skeleton": f"chara/human/{r}/skeleton/base/b0001/skl_{r}b0001.sklb"}
    _cache[key] = out
    return out
