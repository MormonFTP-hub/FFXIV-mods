"""Fixes for an already-built file tree whose pipeline isn't re-run: the second pack, out_midlander (Isle Vacationer's
+ Ebony Staff). It was last built at 1.0.0, before the trim atlas (its materials still point at per-set gold / acc6 /
acc7 textures), and build_variant.py would rebuild its models too; these change nothing else.

    python -P -E tools/lift_built_tex.py lift  [files root]   1.1.0 colour lift: decode each colour (_base) .tex, lift
                                                              its RGB with make_textures.lift (LIFT per texture set),
                                                              re-encode BC7 through texconv -sepalpha; alpha kept
    python -P -E tools/lift_built_tex.py metal [files root]   1.1.1 metal off: metalness 0 in every colour-table row
                                                              of the outfit and staff materials (make_materials.py's
                                                              row[18]); the Bibo+ underwear material is left alone
    (files root defaults to out_midlander/files/)
then  python -P -E -c "import sys; sys.path.insert(0, 'tools'); import build_variant as b, make_pmp; make_pmp.main(b.CFG)"

Each mode is meant to run once on the 1.0.0 tree (lift is not idempotent). make_textures.py / make_materials.py do
both for the Lady Loki pack, and build_variant.py copies those, so a full variant rebuild needs no extra step.
"""
import os
import re
import struct
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import mtrl  # noqa: E402
import texfile  # noqa: E402
from make_textures import LIFT, lift  # noqa: E402

WORK = 'E:/FFXIV-mods/LadyLoki/work/lift/'
BC7 = 0x6432
METALNESS = 18                       # colour-table row field (make_materials.py)
# game file name -> texture set (the variant pack keeps 1.0.0's per-set gold / acc6 / acc7 textures)
NAME = re.compile(r'_loki(?:_(\w+?))?_base\.tex$')


def read_bc7(path):
    d = open(path, 'rb').read()
    fmt, w, h = struct.unpack_from('<IHH', d, 4)
    assert fmt == BC7, (path, hex(fmt))
    off = struct.unpack_from('<I', d, 28)[0]
    return np.asarray(Image.frombytes('RGBA', (w, h), d[off:], 'bcn', 7)).copy()


def lift_textures(root):
    done = []
    for folder, _, files in os.walk(root):
        for f in files:
            m = NAME.search(f)
            if not m:
                continue
            key = m.group(1) or 'weapon'          # the weapon's base has no set name: v01_w1001b0012_loki_base.tex
            if key not in LIFT:
                print('skip', f)
                continue
            path = os.path.join(folder, f)
            rgba = read_bc7(path)
            rgba[..., :3] = lift(rgba[..., :3], *LIFT[key])
            png = os.path.join(WORK, 'tex_png', f.replace('.tex', '.png'))
            os.makedirs(os.path.dirname(png), exist_ok=True)
            Image.fromarray(rgba).save(png)
            texfile.png_to_tex_bc7(png, path, os.path.join(WORK, 'tex_dds'))
            done.append(key)
            print('lifted', key, path)
    return done


def metal_off(root):
    done = []
    for folder, _, files in os.walk(root):
        for f in files:
            if not f.endswith('.mtrl') or f.endswith('_dwn_bot.mtrl'):     # dwn_bot: Bibo+'s own underwear material
                continue
            path = os.path.join(folder, f)
            m = mtrl.Mtrl.parse(open(path, 'rb').read())
            table = np.frombuffer(m.dataset[:2048], np.float16).reshape(32, 32).astype(np.float32)
            was = sorted(set(table[:, METALNESS].round(3).tolist()))
            table[:, METALNESS] = 0.0
            m.dataset = table.astype(np.float16).tobytes() + m.dataset[2048:]
            open(path, 'wb').write(m.serialize())
            done.append(f)
            print('metal off', path, 'was', was)
    return done


if __name__ == '__main__':
    mode = sys.argv[1]
    root = sys.argv[2] if len(sys.argv) > 2 else 'E:/FFXIV-mods/LadyLoki/out_midlander/files/'
    {'lift': lift_textures, 'metal': metal_off}[mode](root)
