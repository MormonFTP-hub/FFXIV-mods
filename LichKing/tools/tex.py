"""FFXIV .tex header reader and a DDS -> .tex wrapper (2D textures with mips)."""
import struct
import sys

FORMATS = {0x1450: "B8G8R8A8", 0x3420: "BC1", 0x3430: "BC2", 0x3431: "BC3", 0x6120: "BC4", 0x6230: "BC5", 0x6432: "BC7", 0x1130: "L8", 0x1131: "A8"}
DXGI_TO_TEX = {98: 0x6432, 99: 0x6432, 83: 0x6230, 77: 0x3431, 78: 0x3431, 71: 0x3420, 72: 0x3420, 87: 0x1450, 80: 0x6120}
FOURCC_TO_TEX = {b"DXT1": 0x3420, b"DXT5": 0x3431, b"ATI2": 0x6230, b"BC5U": 0x6230, b"ATI1": 0x6120, b"BC4U": 0x6120}


def read_header(path):
    d = open(path, "rb").read(80)
    attr, fmt, w, h, depth, mips, arr = struct.unpack_from("<IIHHHBB", d, 0)
    lods = struct.unpack_from("<3I", d, 16)
    offs = struct.unpack_from("<13I", d, 28)
    return dict(attr=hex(attr), fmt=FORMATS.get(fmt, hex(fmt)), w=w, h=h, depth=depth, mips=mips, arr=arr, lods=lods, offs=offs)


def mip_size(fmt, w, h):
    if fmt in (0x3420, 0x6120):
        return max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * 8
    if fmt in (0x3430, 0x3431, 0x6230, 0x6432):
        return max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * 16
    if fmt == 0x1450:
        return w * h * 4
    return w * h


def dds_to_tex(dds_path, tex_path):
    d = open(dds_path, "rb").read()
    assert d[:4] == b"DDS "
    h, w = struct.unpack_from("<II", d, 12)
    mips = max(1, struct.unpack_from("<I", d, 28)[0])
    fourcc = d[84:88]
    off = 128
    if fourcc == b"DX10":
        fmt = DXGI_TO_TEX[struct.unpack_from("<I", d, 128)[0]]
        off = 148
    else:
        fmt = FOURCC_TO_TEX[fourcc]
    data = d[off:]
    sizes, ww, hh = [], w, h
    for _ in range(mips):
        sizes.append(mip_size(fmt, ww, hh))
        ww, hh = max(1, ww // 2), max(1, hh // 2)
    mips = min(mips, 13)
    sizes = sizes[:mips]
    assert sum(sizes) <= len(data), "DDS shorter than expected"
    offsets, o = [], 80
    for s in sizes:
        offsets.append(o)
        o += s
    offsets += [0] * (13 - len(offsets))
    lods = (0, min(1, mips - 1), min(2, mips - 1))
    header = struct.pack("<IIHHHBB", 0x00800000, fmt, w, h, 1, mips, 0) + struct.pack("<3I", *lods) + struct.pack("<13I", *offsets)
    open(tex_path, "wb").write(header + data[:sum(sizes)])


def bgra_tex(rgba, tex_path):
    """Write an uncompressed B8G8R8A8 .tex with a full box-filtered mip chain (rgba: HxWx4 uint8 numpy)."""
    import numpy as np

    levels = [rgba]
    while levels[-1].shape[0] > 1 and levels[-1].shape[1] > 1 and len(levels) < 13:
        a = levels[-1].astype(np.float32)
        a = (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) / 4
        levels.append(np.round(a).astype(np.uint8))
    h, w = rgba.shape[:2]
    blobs = [lv[..., [2, 1, 0, 3]].tobytes() for lv in levels]
    offsets, o = [], 80
    for b in blobs:
        offsets.append(o)
        o += len(b)
    offsets += [0] * (13 - len(offsets))
    n = len(blobs)
    header = struct.pack("<IIHHHBB", 0x00800000, 0x1450, w, h, 1, n, 0) + struct.pack("<3I", 0, min(1, n - 1), min(2, n - 1)) + struct.pack("<13I", *offsets)
    open(tex_path, "wb").write(header + b"".join(blobs))


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(p.split("\\")[-1], read_header(p))
