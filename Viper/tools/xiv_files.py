"""Writers for FFXIV .tex textures and Penumbra .pmp modpacks."""
import json
import os
import struct
import zipfile

import numpy as np

TEX_2D = 0x00800000
FMT_B8G8R8A8 = 0x1450


def write_tex(path, rgba):
    """Write an uncompressed B8G8R8A8 .tex with a full mip chain.

    rgba: (H, W, 4) uint8 array; H and W must be powers of two.
    """
    img = np.asarray(rgba, np.uint8)
    h, w = img.shape[:2]
    mips = []
    level = img.astype(np.float32)
    while True:
        mips.append(level.round().clip(0, 255).astype(np.uint8))
        if level.shape[0] == 1 and level.shape[1] == 1:
            break
        # 2x2 box filter; a dimension that is already 1 stays 1
        hh, ww = max(level.shape[0] // 2, 1), max(level.shape[1] // 2, 1)
        level = level.reshape(hh, level.shape[0] // hh, ww, level.shape[1] // ww, 4).mean(axis=(1, 3))
        if len(mips) == 13:
            break
    offsets, off = [], 80
    for m in mips:
        offsets.append(off)
        off += m.shape[0] * m.shape[1] * 4
    header = struct.pack("<IIHHHBB", TEX_2D, FMT_B8G8R8A8, w, h, 1, len(mips), 0)
    header += struct.pack("<3I", *[min(i, len(mips) - 1) for i in range(3)])
    header += struct.pack("<13I", *(offsets + [0] * (13 - len(offsets))))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(header)
        for m in mips:
            f.write(m[..., [2, 1, 0, 3]].tobytes())  # RGBA -> BGRA


def write_pmp(path, meta, default_mod, groups, files):
    """Write a Penumbra modpack (FileVersion 3 layout).

    meta:        dict for meta.json (Name, Author, Description, Version, ...)
    default_mod: dict with Files / FileSwaps / Manipulations always applied
    groups:      list of group dicts (Name, Type, Options, ...)
    files:       dict of {path inside the pack: local source file}
    """
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("meta.json", json.dumps({"FileVersion": 3, **meta}, indent=2))
        z.writestr("default_mod.json", json.dumps({"Name": "", "Priority": 0, "Files": {}, "FileSwaps": {},
                                                    "Manipulations": [], **default_mod}, indent=2))
        for i, g in enumerate(groups, 1):
            safe = "".join(c if c.isalnum() else "_" for c in g["Name"].lower())
            z.writestr(f"group_{i:03d}_{safe}.json", json.dumps({"Version": 0, "Description": "", "Image": "", "Page": 0,
                                                                 "Priority": 0, "DefaultSettings": 0, **g}, indent=2))
        for inner, src in files.items():
            z.write(src, inner)
