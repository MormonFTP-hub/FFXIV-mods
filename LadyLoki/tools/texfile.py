"""PNG -> DDS (texconv) -> FFXIV .tex."""
import os
import struct
import subprocess
import numpy as np
from PIL import Image

TEXCONV = r'E:\FFXIV-mods\LadyLoki\tools\tt\converters\texconv.exe'
FMT = {'BC7': 0x6432, 'BGRA': 0x1450}


def _dds_payload(path):
    d = open(path, 'rb').read()
    assert d[:4] == b'DDS '
    h, w = struct.unpack_from('<II', d, 12)
    mips = max(1, struct.unpack_from('<I', d, 28)[0])
    fourcc = d[84:88]
    off = 128 + (20 if fourcc == b'DX10' else 0)
    return w, h, mips, d[off:]


def _bc_sizes(w, h, mips, block=16):
    out = []
    for _ in range(mips):
        out.append(max(1, (w + 3) // 4) * max(1, (h + 3) // 4) * block)
        w = max(1, w // 2); h = max(1, h // 2)
    return out


def write_tex(path, fmt, w, h, mip_data):
    """mip_data: list of bytes per mip level (largest first)."""
    offs = []; o = 80
    for m in mip_data:
        offs.append(o); o += len(m)
    head = struct.pack('<IIHHHBB', 0x00800000, FMT[fmt], w, h, 1, len(mip_data), 1)
    head += struct.pack('<3I', 0, min(1, len(mip_data) - 1), min(2, len(mip_data) - 1))
    head += struct.pack('<13I', *(offs + [0] * (13 - len(offs))))
    assert len(head) == 80
    with open(path, 'wb') as f:
        f.write(head)
        for m in mip_data:
            f.write(m)


def png_to_tex_bc7(png, tex, workdir):
    os.makedirs(workdir, exist_ok=True)
    # -sepalpha: mips filter alpha on its own, so colour doesn't bleed by opacity (the hair base alpha is its strand mask)
    r = subprocess.run([TEXCONV, '-nologo', '-y', '-f', 'BC7_UNORM', '-m', '0', '-sepalpha', '-o', workdir, png],
                       capture_output=True, text=True)
    dds = os.path.join(workdir, os.path.splitext(os.path.basename(png))[0] + '.dds')
    if r.returncode != 0 or not os.path.exists(dds):
        raise RuntimeError(r.stdout + r.stderr)
    w, h, mips, payload = _dds_payload(dds)
    sizes = _bc_sizes(w, h, mips)
    assert sum(sizes) == len(payload), (sum(sizes), len(payload))
    chunks = []; o = 0
    for s in sizes:
        chunks.append(payload[o:o + s]); o += s
    write_tex(tex, 'BC7', w, h, chunks[:13])


def array_to_tex_bgra(arr, tex):
    """Small uncompressed texture with a box-filtered mip chain."""
    a = np.asarray(arr, np.uint8)
    h, w = a.shape[:2]
    mips = []
    cur = a.astype(np.float32)
    while True:
        mips.append(cur.round().astype(np.uint8)[..., [2, 1, 0, 3]].tobytes())
        if cur.shape[0] == 1 and cur.shape[1] == 1:
            break
        hh, ww = max(1, cur.shape[0] // 2), max(1, cur.shape[1] // 2)
        cur = np.array(Image.fromarray(cur.round().astype(np.uint8)).resize((ww, hh), Image.BOX), np.float32)
    write_tex(tex, 'BGRA', w, h, mips[:13])
