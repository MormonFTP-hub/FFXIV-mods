"""Read and write FFXIV .tex textures (numpy; run inside Blender's Python).

Images are float32 arrays shaped (h, w, 4) in RGBA order, 0..1, top row first.
"""
import struct

import numpy as np

FMT_BGRA8 = 0x1450
FMT_BC1 = 0x3420
FMT_BC3 = 0x3431
FMT_BC5 = 0x6230
FMT_BC7 = 0x6432
HEADER_SIZE = 80


def _rgb565(c):
    r = ((c >> 11) & 31) / 31.0
    g = ((c >> 5) & 63) / 63.0
    b = (c & 31) / 31.0
    return np.stack([r, g, b], -1)


def _bc_alpha(block):  # block: (n, 8) uint8 -> (n, 16) floats (BC3 alpha / BC4 / BC5 channel)
    a0 = block[:, 0].astype(np.float32)
    a1 = block[:, 1].astype(np.float32)
    bits = np.zeros(len(block), dtype=np.uint64)
    for i in range(6):
        bits |= block[:, 2 + i].astype(np.uint64) << np.uint64(8 * i)
    idx = np.stack([(bits >> np.uint64(3 * k)) & np.uint64(7) for k in range(16)], -1).astype(np.int64)
    pal = np.zeros((len(block), 8), np.float32)
    pal[:, 0], pal[:, 1] = a0, a1
    big = a0 > a1
    for k in range(1, 7):
        pal[:, 1 + k] = np.where(big, ((7 - k) * a0 + k * a1) / 7.0, pal[:, 1 + k])
    for k in range(1, 5):
        pal[:, 1 + k] = np.where(~big, ((5 - k) * a0 + k * a1) / 5.0, pal[:, 1 + k])
    pal[:, 6] = np.where(~big, 0.0, pal[:, 6])
    pal[:, 7] = np.where(~big, 255.0, pal[:, 7])
    return np.take_along_axis(pal, idx, 1) / 255.0


def _bc1_color(block, punch_through=True):  # (n, 8) -> (n, 16, 4)
    c0 = block[:, 0].astype(np.uint32) | (block[:, 1].astype(np.uint32) << 8)
    c1 = block[:, 2].astype(np.uint32) | (block[:, 3].astype(np.uint32) << 8)
    bits = block[:, 4].astype(np.uint32) | (block[:, 5].astype(np.uint32) << 8) | \
        (block[:, 6].astype(np.uint32) << 16) | (block[:, 7].astype(np.uint32) << 24)
    p0, p1 = _rgb565(c0), _rgb565(c1)
    four = (c0 > c1) | (not punch_through)
    p2 = np.where(four[:, None], (2 * p0 + p1) / 3, (p0 + p1) / 2)
    p3 = np.where(four[:, None], (p0 + 2 * p1) / 3, 0)
    pal = np.stack([p0, p1, p2, p3], 1)
    alpha = np.ones((len(block), 4), np.float32)
    alpha[:, 3] = np.where(four, 1.0, 0.0)
    pal = np.concatenate([pal, alpha[:, :, None]], -1)
    idx = np.stack([(bits >> (2 * k)) & 3 for k in range(16)], -1).astype(np.int64)
    return np.take_along_axis(pal, idx[:, :, None].repeat(4, -1), 1)


def _unblock(px, w, h):  # (nblocks, 16, c) -> (h, w, c)
    bw, bh = max(1, (w + 3) // 4), max(1, (h + 3) // 4)
    c = px.shape[-1]
    img = px.reshape(bh, bw, 4, 4, c).transpose(0, 2, 1, 3, 4).reshape(bh * 4, bw * 4, c)
    return img[:h, :w]


def read_tex(data: bytes):
    """Decodes the top mip level. Returns (format, rgba float array)."""
    _, fmt, w, h = struct.unpack_from("<IIHH", data, 0)
    off = struct.unpack_from("<I", data, 28)[0]
    body = np.frombuffer(data, np.uint8, offset=off)
    nb = max(1, (w + 3) // 4) * max(1, (h + 3) // 4)
    if fmt == FMT_BGRA8:
        px = body[:w * h * 4].reshape(h, w, 4).astype(np.float32) / 255.0
        return fmt, px[:, :, [2, 1, 0, 3]]
    if fmt == FMT_BC1:
        return fmt, _unblock(_bc1_color(body[:nb * 8].reshape(nb, 8)), w, h)
    if fmt == FMT_BC3:
        b = body[:nb * 16].reshape(nb, 16)
        col = _bc1_color(b[:, 8:], punch_through=False)
        col[:, :, 3] = _bc_alpha(b[:, :8])
        return fmt, _unblock(col, w, h)
    if fmt == FMT_BC5:
        b = body[:nb * 16].reshape(nb, 16)
        r, g = _bc_alpha(b[:, :8]), _bc_alpha(b[:, 8:])
        px = np.stack([r, g, np.zeros_like(r), np.ones_like(r)], -1)
        return fmt, _unblock(px, w, h)
    raise NotImplementedError(f"tex format {fmt:#x}")


def _mip_chain(img):
    levels = [img]
    while levels[-1].shape[0] > 4 and levels[-1].shape[1] > 4:
        a = levels[-1]
        h, w = a.shape[0] // 2 * 2, a.shape[1] // 2 * 2
        a = a[:h, :w]
        levels.append((a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) / 4)
    return levels


def _blocks(img):  # (h, w, c) -> (nblocks, 16, c); h, w multiples of 4
    h, w, c = img.shape
    return img.reshape(h // 4, 4, w // 4, 4, c).transpose(0, 2, 1, 3, 4).reshape(-1, 16, c)


def _to565(rgb):
    q = np.clip(np.rint(rgb * [31, 63, 31]), 0, [31, 63, 31]).astype(np.uint32)
    return (q[..., 0] << 11) | (q[..., 1] << 5) | q[..., 2]


def _encode_bc1_color(px):
    """px: (n, 16, 3) floats -> (n, 8) uint8 BC1 blocks (4-colour mode, principal-axis fit)."""
    mean = px.mean(1, keepdims=True)
    d = px - mean
    cov = np.einsum("nki,nkj->nij", d, d)
    axis = np.ones((len(px), 3), np.float32) / np.sqrt(3)
    for _ in range(4):
        axis = np.einsum("nij,nj->ni", cov, axis)
        axis /= np.linalg.norm(axis, axis=1, keepdims=True) + 1e-12
    t = np.einsum("nki,ni->nk", d, axis)
    lo = mean[:, 0] + axis * t.min(1, keepdims=True)
    hi = mean[:, 0] + axis * t.max(1, keepdims=True)
    c0, c1 = _to565(np.clip(hi, 0, 1)), _to565(np.clip(lo, 0, 1))
    swap = c0 < c1
    c0, c1 = np.where(swap, c1, c0), np.where(swap, c0, c1)
    p0, p1 = _rgb565(c0), _rgb565(c1)
    pal = np.stack([p0, p1, (2 * p0 + p1) / 3, (p0 + 2 * p1) / 3], 1)  # (n, 4, 3)
    dist = ((px[:, :, None, :] - pal[:, None, :, :]) ** 2).sum(-1)
    idx = dist.argmin(-1).astype(np.uint32)
    idx = np.where((c0 == c1)[:, None], 0, idx)
    bits = np.zeros(len(px), np.uint32)
    for k in range(16):
        bits |= idx[:, k] << (2 * k)
    out = np.zeros((len(px), 8), np.uint8)
    out[:, 0], out[:, 1] = c0 & 255, c0 >> 8
    out[:, 2], out[:, 3] = c1 & 255, c1 >> 8
    for k in range(4):
        out[:, 4 + k] = (bits >> (8 * k)) & 255
    return out


def _encode_bc_alpha(a):
    """a: (n, 16) floats -> (n, 8) uint8 BC3 alpha / BC4 blocks (8-value mode)."""
    a0 = np.clip(np.rint(a.max(1) * 255), 0, 255)
    a1 = np.clip(np.rint(a.min(1) * 255), 0, 255)
    same = a0 == a1
    a0 = np.where(same & (a0 < 255), a0 + 1, a0)
    a1 = np.where(same & (a0 >= 255) & (a1 == a0), a0 - 1, a1)
    pal = np.stack([a0, a1] + [((7 - k) * a0 + k * a1) / 7 for k in range(1, 7)], 1) / 255.0
    idx = np.abs(a[:, :, None] - pal[:, None, :]).argmin(-1).astype(np.uint64)
    bits = np.zeros(len(a), np.uint64)
    for k in range(16):
        bits |= idx[:, k] << np.uint64(3 * k)
    out = np.zeros((len(a), 8), np.uint8)
    out[:, 0], out[:, 1] = a0, a1
    for k in range(6):
        out[:, 2 + k] = ((bits >> np.uint64(8 * k)) & np.uint64(255)).astype(np.uint8)
    return out


def _pad4(img):
    h, w = img.shape[:2]
    ph, pw = (-h) % 4, (-w) % 4
    if ph or pw:
        img = np.pad(img, ((0, ph), (0, pw), (0, 0)), mode="edge")
    return img


def write_tex(img, fmt=FMT_BC1) -> bytes:
    """Encodes an RGBA float image (top row first) as BC1, BC3 or B8G8R8A8 with a full mip chain."""
    img = np.clip(np.asarray(img, np.float32), 0, 1)
    h, w = img.shape[:2]
    levels = _mip_chain(img)
    if fmt != FMT_BGRA8:
        levels = [lv for lv in levels if min(lv.shape[:2]) >= 4]
    levels = levels[:13]
    payload = bytearray()
    offsets = []
    for lv in levels:
        offsets.append(HEADER_SIZE + len(payload))
        if fmt == FMT_BGRA8:
            payload += (lv[:, :, [2, 1, 0, 3]] * 255 + 0.5).astype(np.uint8).tobytes()
            continue
        b = _blocks(_pad4(lv))
        if fmt == FMT_BC1:
            payload += _encode_bc1_color(b[:, :, :3]).tobytes()
        elif fmt == FMT_BC3:
            payload += np.concatenate([_encode_bc_alpha(b[:, :, 3]), _encode_bc1_color(b[:, :, :3])], 1).tobytes()
        else:
            raise NotImplementedError(hex(fmt))
    surf = offsets + [0] * (13 - len(offsets))
    lods = [0, min(1, len(levels) - 1), min(2, len(levels) - 1)]
    header = struct.pack("<IIHHHBB", 0x00800000, fmt, w, h, 1, len(levels), 0)
    header += struct.pack("<3I", *lods) + struct.pack("<13I", *surf)
    assert len(header) == HEADER_SIZE
    return header + bytes(payload)
