"""Write FFXIV .tex files: wrap a BC7 DDS, or make a small solid-colour B8G8R8A8 texture.

usage:
  python tex_tools.py dds <in.dds> <out.tex>
  python tex_tools.py solid <out.tex> <size> <r> <g> <b> <a>
"""
import os
import struct
import sys

ATTR_2D = 0x00800000
FMT_BC7 = 0x6432
FMT_B8G8R8A8 = 0x1450
DXGI_BC7_UNORM = 98


def write_tex(path, fmt, width, height, mips):
    offsets, pos = [], 80
    for m in mips:
        offsets.append(pos)
        pos += len(m)
    count = len(mips)
    lods = [min(i, count - 1) for i in range(3)]
    header = struct.pack('<IIHHHBB3I13I', ATTR_2D, fmt, width, height, 1, count, 0, *lods,
                         *(offsets + [0] * (13 - count)))
    assert len(header) == 80
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(header)
        for m in mips:
            f.write(m)


def dds_to_tex(src, dst):
    data = open(src, 'rb').read()
    assert data[:4] == b'DDS ', 'not a DDS file'
    height, width = struct.unpack_from('<II', data, 12)
    mip_count = max(1, struct.unpack_from('<I', data, 28)[0])
    four_cc = data[84:88]
    assert four_cc == b'DX10', f'expected a DX10 DDS, got {four_cc}'
    dxgi = struct.unpack_from('<I', data, 128)[0]
    assert dxgi == DXGI_BC7_UNORM, f'expected BC7_UNORM, got DXGI format {dxgi}'
    pos, mips, w, h = 148, [], width, height
    for _ in range(min(mip_count, 13)):
        size = max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * 16
        mips.append(data[pos:pos + size])
        pos += size
        w, h = max(1, w // 2), max(1, h // 2)
    assert all(len(m) for m in mips) and pos <= len(data), 'truncated DDS'
    write_tex(dst, FMT_BC7, width, height, mips)
    print(f'wrote {dst}: {width}x{height} BC7, {len(mips)} mips')


def solid_tex(dst, size, r, g, b, a):
    mips, s = [], size
    while s >= 1:
        mips.append(bytes((b, g, r, a)) * (s * s))
        s //= 2
    write_tex(dst, FMT_B8G8R8A8, size, size, mips)
    print(f'wrote {dst}: {size}x{size} B8G8R8A8 rgba=({r},{g},{b},{a}), {len(mips)} mips')


if __name__ == '__main__':
    if sys.argv[1] == 'dds':
        dds_to_tex(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'solid':
        solid_tex(sys.argv[2], *(int(v) for v in sys.argv[3:8]))
