"""Write character.shpk materials (diffuse 'compatibility' texture mode) for Loki's textures."""
import os
import shutil
import sys
import numpy as np

sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import mtrl
import tt
from make_textures import tex_paths, EQ, WP

OUT = 'E:/FFXIV-mods/LadyLoki/out/files/'
TEMPLATE = 'chara/equipment/e6137/material/v0001/mt_c0201e6137_top_a.mtrl'

S_DIFFUSE, S_NORMAL, S_MASK, S_INDEX = 0x115306BE, 0x0C5EC1F1, 0x8A4E82B6, 0x565F8FD8
KEY_TEXTURE_MODE, MODE_COMPAT = 0xB616DC5A, 0x600EF9DF
HIDE_BACKFACES = 0x1

EQ_MAT = 'chara/equipment/e6137/material/v0001/'
# material key -> (material file names, roughness, double sided); 'trim' is the gold / acc6 / acc7 atlas
MATERIALS = {
    'suit': ([EQ_MAT + 'mt_c0201e6137_top_a.mtrl'], 0.55, True),
    'trim': ([EQ_MAT + 'mt_c0201e6137_top_b.mtrl'], 0.35, False),
    'skirt': ([EQ_MAT + 'mt_c0201e6137_dwn_a.mtrl'], 0.6, True),
    'hair': ([EQ_MAT + 'mt_c0201e6137_met_a.mtrl'], 0.6, True),
    'weapon': (['chara/weapon/w1001/obj/body/b0071/material/v0001/mt_w1001b0071_a.mtrl',
                'chara/weapon/w1001/obj/body/b0071/material/v0002/mt_w1001b0071_a.mtrl'], 0.4, False),
}


def model_name(key):
    """Material name as referenced from inside the .mdl."""
    return '/' + os.path.basename(MATERIALS[key][0][0])


def build(key, files=None, tex=None, id_tex=None, out=OUT):
    """Defaults build the Lady Loki pack; the variant pack passes its own material/texture game paths."""
    default_files, rough, double_sided = MATERIALS[key]
    files = files or default_files
    m = mtrl.Mtrl.parse(open(tt.extract(TEMPLATE), 'rb').read())
    p = tex or tex_paths(key)
    id_tex = id_tex or (WP if key == 'weapon' else EQ) + 'v01_loki_id.tex'
    m.textures = [[p['base'], 0], [p['norm'], 0], [p['mask'], 0], [id_tex, 0]]
    m.samplers = [[S_DIFFUSE, 0x000F8355, 0], [S_NORMAL, 0x000F8015, 1], [S_MASK, 0x000F8355, 2], [S_INDEX, 0x000F8355, 3]]
    m.keys = [[k, MODE_COMPAT if k == KEY_TEXTURE_MODE else v] for k, v in m.keys]
    m.flags = (m.flags & ~HIDE_BACKFACES) if double_sided else (m.flags | HIDE_BACKFACES)
    # neutral colour table: every row = vanilla row 0 with white diffuse, no metal, no tiled detail overlay
    table = np.frombuffer(m.dataset[:2048], np.float16).reshape(32, 32).astype(np.float32)
    row = table[0].copy()
    row[0:3] = 1.0          # diffuse multiplier
    row[16] = rough         # roughness
    row[18] = 0.0           # metalness off: the template's row 0 is 0.8 metal, which drew the outfit near-black (1.1.1)
    row[26] = 0.0           # tile overlay strength
    table[:] = row
    m.dataset = table.astype(np.float16).tobytes() + bytes(len(m.dataset) - 2048)
    data = m.serialize()
    for f in files:
        os.makedirs(os.path.dirname(out + f), exist_ok=True)
        open(out + f, 'wb').write(data)
    return files


if __name__ == '__main__':
    for d in {os.path.dirname(f) for files, _, _ in MATERIALS.values() for f in files}:
        shutil.rmtree(OUT + d, ignore_errors=True)          # no stale materials left to be packed
    for k in MATERIALS:
        print(k, build(k))
