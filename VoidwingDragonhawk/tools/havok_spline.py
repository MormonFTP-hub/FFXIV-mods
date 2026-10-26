"""hkaSplineCompressedAnimation: decoder (a port of HavokLib's hka_spline_decompressor) and encoder.

Data layout of one block (all tracks):
    TransformMask per track (4 bytes: quantisation, position, rotation, scale flags), pad 4
    per track:
      position  dynamic: u16 numItems, u8 degree, knots[numItems+degree+2], pad 4,
                         per component min/max (dynamic) or value (static) floats,
                         control points (u8 or u16 per dynamic component), pad 4
                static:  one float per static component
      rotation  dynamic: u16 numItems, u8 degree, knots, pad (2 for 48-bit, 4 for 32-bit),
                         numItems+1 quantised quaternions
                static:  one quantised quaternion
                pad 4
      scale     as position (identity default 1)
Knots are frame numbers inside the block (u8), so a block holds at most 256 frames.

The encoder writes degree-1 splines (linear between kept keyframes): frames are
dropped greedily while the linear fit stays within tolerance, positions/scales as
16-bit, rotations as 48-bit "three component" quaternions.
"""
import math
import struct

import numpy as np

# quantisation types as HavokLib numbers them
QT_8, QT_16, QT_32, QT_40, QT_48 = 0, 1, 2, 3, 4
FRAMES_PER_BLOCK = 256


# ------------------------------------------------------------------ decoding

def _pad(o, a=4):
    return (o + a - 1) & ~(a - 1)


def read_quat(qt, d, o):
    if qt == QT_48:
        x, y, z = struct.unpack_from("<3H", d, o)
        shift = ((y >> 14) & 2) | ((x >> 15) & 1)
        neg = (z >> 15) != 0
        f = 0.000043161
        v = [((c & 0x7FFF) - 0x3FFF) * f for c in (x, y, z)]
        w = math.sqrt(max(0.0, 1 - v[0] ** 2 - v[1] ** 2 - v[2] ** 2))
        if neg:
            w = -w
        q = v[:shift] + [w] + v[shift:]
        return q, o + 6
    if qt == QT_40:
        c = int.from_bytes(d[o:o + 5], "little")
        mask = (1 << 12) - 1
        f = 0.000345436
        v = [(((c >> (12 * i)) & mask) - (mask >> 1)) * f for i in range(3)]
        shift = (c >> 36) & 3
        w = math.sqrt(max(0.0, 1 - sum(x * x for x in v)))
        if (c >> 38) & 1:
            w = -w
        return v[:shift] + [w] + v[shift:], o + 5
    if qt == QT_32:
        c = struct.unpack_from("<I", d, o)[0]
        r = ((c >> 18) & 0x3FF) / 1023.0
        r = 1 - r * r
        pt = float(c & 0x3FFFF)
        phi = math.floor(math.sqrt(pt))
        theta = 0.0
        if phi > 0:
            theta = (math.pi / 4) * (pt - phi * phi) / phi
            phi = (math.pi / 2 / 511) * phi
        mag = math.sqrt(max(0.0, 1 - r * r))
        q = [math.sin(phi) * math.cos(theta) * mag, math.sin(phi) * math.sin(theta) * mag, math.cos(phi) * mag, r]
        for i, bit in enumerate((0x10000000, 0x20000000, 0x40000000, 0x80000000)):
            if c & bit:
                q[i] = -q[i]
        return q, o + 4
    if qt == 7:   # uncompressed
        return list(struct.unpack_from("<4f", d, o)), o + 16
    raise ValueError(f"rotation quantisation {qt}")


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


def _point(span, degree, frame, knots, cps):
    N = [1.0] + [0.0] * degree
    for i in range(1, degree + 1):
        for j in range(i - 1, -1, -1):
            a = (frame - knots[span - j]) / (knots[span + i - j] - knots[span - j])
            tmp = N[j] * a
            N[j + 1] += N[j] - tmp
            N[j] = tmp
    out = np.zeros(np.shape(cps[0]))
    for i in range(degree + 1):
        out = out + np.asarray(cps[span - i]) * N[i]
    return out


class _VecTrack:
    def __init__(self, comps, knots=None, degree=0):
        self.comps, self.knots, self.degree = comps, knots, degree   # comps: 3 lists of values

    def value(self, frame):
        out = []
        span = None
        for c in self.comps:
            if len(c) == 1:
                out.append(c[0])
            else:
                if span is None:
                    span = _knot_span(self.degree, frame, len(c), self.knots)
                out.append(float(_point(span, self.degree, frame, self.knots, [[x] for x in c])[0]))
        return out


class _QuatTrack:
    def __init__(self, cps, knots=None, degree=0):
        self.cps, self.knots, self.degree = cps, knots, degree

    def value(self, frame):
        if self.knots is None:
            return self.cps[0]
        span = _knot_span(self.degree, frame, len(self.cps), self.knots)
        q = _point(span, self.degree, frame, self.knots, self.cps)
        return list(q / np.linalg.norm(q))


def _read_vec(d, o, qt, flags, default):
    st = lambda i: flags & (1 << i)          # noqa: E731
    dyn = lambda i: flags & (1 << (i + 4))   # noqa: E731
    if any(dyn(i) and not st(i) for i in range(3)):
        n, deg = struct.unpack_from("<HB", d, o)
        o += 3
        knots = list(d[o:o + n + deg + 2])
        o = _pad(o + n + deg + 2)
        ext, comps = {}, []
        for i in range(3):
            if st(i):
                comps.append([struct.unpack_from("<f", d, o)[0]])
                o += 4
            elif dyn(i):
                ext[i] = struct.unpack_from("<2f", d, o)
                o += 8
                comps.append([0.0] * (n + 1))
            else:
                comps.append([default])
        for t in range(n + 1):
            for i in range(3):
                if i in ext:
                    if qt == QT_8:
                        v = d[o] / 255.0
                        o += 1
                    else:
                        v = struct.unpack_from("<H", d, o)[0] / 65535.0
                        o += 2
                    lo, hi = ext[i]
                    comps[i][t] = lo + (hi - lo) * v
        return _VecTrack(comps, knots, deg), _pad(o)
    comps = []
    for i in range(3):
        if st(i):
            comps.append([struct.unpack_from("<f", d, o)[0]])
            o += 4
        else:
            comps.append([default])
    return _VecTrack(comps), o


def decode_block(d, o, ntracks, nfloats=0):
    masks = [d[o + 4 * i:o + 4 * i + 4] for i in range(ntracks)]
    o = _pad(o + 4 * ntracks + nfloats)
    tracks = []
    for q, pf, rf, sf in masks:
        pos, o = _read_vec(d, o, q & 3, pf, 0.0)
        rq = ((q >> 2) & 0xF) + 2
        if rf & 0xF0:
            n, deg = struct.unpack_from("<HB", d, o)
            o += 3
            knots = list(d[o:o + n + deg + 2])
            o += n + deg + 2
            if rq in (QT_48, 6):
                o = _pad(o, 2)
            elif rq in (QT_32, 7):
                o = _pad(o)
            cps = []
            for _ in range(n + 1):
                qv, o = read_quat(rq, d, o)
                cps.append(qv)
            rot = _QuatTrack(cps, knots, deg)
        elif rf & 0x0F:
            qv, o = read_quat(rq, d, o)
            rot = _QuatTrack([qv])
        else:
            rot = _QuatTrack([[0.0, 0.0, 0.0, 1.0]])
        o = _pad(o)
        scl, o = _read_vec(d, o, (q >> 6) & 3, sf, 1.0)
        tracks.append((pos, rot, scl))
    return tracks, o


def decode(anim):
    """hkaSplineCompressedAnimation object (dict) -> array (frames, tracks, 10): t xyz, r xyzw, s xyz."""
    d = bytes(anim["data"])
    nt = anim["numberOfTransformTracks"]
    nf = anim["numFrames"]
    per_block = anim["maxFramesPerBlock"]
    blocks = [decode_block(d, off, nt, anim.get("numberOfFloatTracks", 0))[0] for off in anim["blockOffsets"]]
    out = np.zeros((nf, nt, 10))
    for f in range(nf):
        b = min(f // (per_block - 1), len(blocks) - 1)
        local = f - b * (per_block - 1)
        for t, (p, r, s) in enumerate(blocks[b]):
            out[f, t, 0:3] = p.value(local)
            out[f, t, 3:7] = r.value(local)
            out[f, t, 7:10] = s.value(local)
    return out


# ------------------------------------------------------------------ encoding

def write_quat48(q):
    q = np.asarray(q, float)
    q = q / np.linalg.norm(q)
    k = int(np.argmax(np.abs(q)))
    rest = [q[i] for i in range(4) if i != k]
    f = 0.000043161
    c = [int(np.clip(round(v / f) + 0x3FFF, 0, 0x7FFF)) for v in rest]
    c[0] |= (k & 1) << 15
    c[1] |= ((k >> 1) & 1) << 15
    c[2] |= (1 if q[k] < 0 else 0) << 15
    return struct.pack("<3H", *c)


def _keyframes(values, tol, rot=False):
    """Frames to keep so linear interpolation between them stays within tol (greedy, always keeps ends)."""
    n = len(values)
    if n <= 2:
        return list(range(n))
    keep = [0]
    a = 0
    while a < n - 1:
        b = a + 1
        while b + 1 < n:
            c = b + 1
            ts = (np.arange(a + 1, c) - a) / (c - a)
            lerp = values[a][None] * (1 - ts[:, None]) + values[c][None] * ts[:, None]
            if rot:
                lerp /= np.linalg.norm(lerp, axis=1, keepdims=True)
                err = np.max(1 - np.abs(np.sum(lerp * values[a + 1:c], 1)))
            else:
                err = np.max(np.abs(lerp - values[a + 1:c]))
            if err > tol:
                break
            b = c
        keep.append(b)
        a = b
    return keep


def _knots(keep):
    return bytes([keep[0]] + keep + [keep[-1]])   # degree 1, clamped


def _vec_track(vals, default, tol):
    """vals (F,3) -> (flags, bytes)."""
    flags = 0
    static, dyn = [], []
    for i in range(3):
        v = vals[:, i]
        if np.ptp(v) <= tol * 0.5:
            if abs(v.mean() - default) > 1e-6:
                flags |= 1 << i
                static.append((i, float(v.mean())))
        else:
            flags |= 1 << (i + 4)
            dyn.append(i)
    out = bytearray()
    if not dyn:
        for _, v in static:
            out += struct.pack("<f", v)
        return flags, bytes(out)
    keep = _keyframes(vals[:, dyn], tol)
    out += struct.pack("<HB", len(keep) - 1, 1) + _knots(keep)
    while len(out) % 4:
        out.append(0)
    ext = {}
    for i in range(3):
        if i in dyn:
            lo, hi = float(vals[:, i].min()), float(vals[:, i].max())
            ext[i] = (lo, hi)
            out += struct.pack("<2f", lo, hi)
        elif flags & (1 << i):
            out += struct.pack("<f", next(v for j, v in static if j == i))
    for f in keep:
        for i in dyn:
            lo, hi = ext[i]
            q = 0 if hi == lo else round((vals[f, i] - lo) / (hi - lo) * 65535)
            out += struct.pack("<H", int(np.clip(q, 0, 65535)))
    while len(out) % 4:
        out.append(0)
    return flags, bytes(out)


def encode_block(T, R, S, pos_tol=2e-4, rot_tol=2e-6, scale_tol=2e-4):
    """T (F,N,3), R (F,N,4 xyzw), S (F,N,3) for one block (F <= 256) -> bytes."""
    F, N = T.shape[:2]
    assert F <= FRAMES_PER_BLOCK
    masks, body = bytearray(), bytearray()
    for t in range(N):
        pf, pos = _vec_track(T[:, t], 0.0, pos_tol)
        r = R[:, t] / np.linalg.norm(R[:, t], axis=1, keepdims=True)
        r = r * np.where(r[:, 3:4] < 0, -1, 1) if np.all(np.abs(r[:, 3]) > 0.1) else r
        for f in range(1, F):                              # one hemisphere, frame to frame
            if np.dot(r[f], r[f - 1]) < 0:
                r[f] = -r[f]
        rot = bytearray()
        spread = np.max(1 - np.abs(r @ r[0]))
        if spread <= rot_tol:
            if np.max(np.abs(r[0] - [0, 0, 0, 1])) > 1e-5 and np.max(np.abs(r[0] + [0, 0, 0, 1])) > 1e-5:
                rf = 0x0F
                rot += write_quat48(r.mean(0))
            else:
                rf = 0
        else:
            rf = 0xF0
            keep = _keyframes(r, rot_tol, rot=True)
            hdr = struct.pack("<HB", len(keep) - 1, 1) + _knots(keep)
            rot += hdr
            # 48-bit quaternions are 2-aligned relative to the block start
            if (len(body) + len(pos) + len(rot)) % 2:
                rot.append(0)
            for f in keep:
                rot += write_quat48(r[f])
        sf, scl = _vec_track(S[:, t], 1.0, scale_tol)
        masks += bytes([0x49, pf, rf, sf])          # 16-bit pos, 48-bit rot, 16-bit scale
        body += pos
        body += rot
        while len(body) % 4:
            body.append(0)
        body += scl
    head = bytes(masks)
    pad = (-len(head)) % 4
    assert pad == 0
    return head + bytes(body)


def encode(T, R, S, fps=30, **tol):
    """Whole animation -> dict of hkaSplineCompressedAnimation members (minus type/duration/tracks)."""
    F = len(T)
    data = bytearray()
    offsets = []
    start = 0
    while True:
        end = min(start + FRAMES_PER_BLOCK, F)
        offsets.append(len(data))
        data += encode_block(T[start:end], R[start:end], S[start:end], **tol)
        while len(data) % 4:
            data.append(0)
        if end >= F:
            break
        start = end - 1                                # blocks share their edge frame
    float_off = len(data)
    while len(data) % 16:
        data.append(0)
    block_dur = (FRAMES_PER_BLOCK - 1) / fps
    return {"numFrames": F, "numBlocks": len(offsets), "maxFramesPerBlock": FRAMES_PER_BLOCK,
            "maskAndQuantizationSize": 4 * T.shape[1], "blockDuration": block_dur,
            "blockInverseDuration": 1 / block_dur, "frameDuration": 1 / fps,
            "blockOffsets": offsets, "floatBlockOffsets": [float_off], "data": list(data)}
