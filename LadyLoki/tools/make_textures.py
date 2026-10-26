"""Build FFXIV textures (base / norm / mask / id) for each Loki material.

A model may use at most 4 materials (Penumbra's MdlMaterialMaximum; no vanilla gear model has more), and the legs
carry the skin, the underwear, the skirt and all three trim sets. So the trim sets share one material: its textures
are a 2x2 atlas of them (ATLASES, top row first, each tile at the set's own resolution, the last tile empty) and
build_models.py moves each piece's UVs into its set's tile (tile_of)."""
import os
import pickle
import shutil
import sys
import numpy as np
from PIL import Image

sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import bake
import texfile

SRC = 'E:/FFXIV-mods/LadyLoki/source/'
WORK = 'E:/FFXIV-mods/LadyLoki/work/'
OUT = 'E:/FFXIV-mods/LadyLoki/out/files/'
EQ = 'chara/equipment/e6137/texture/'
WP = 'chara/weapon/w1001/obj/body/b0071/texture/'

# texture set -> (Loki texture set, tint, tint amount)
SETS = {
    'suit': ('T_1016504_Equip_03', (0.8, 0.8, 0.8), 0.0),
    'skirt': ('T_1016504_Equip_01', (0.342, 0.65, 0.639), 0.5),
    'gold': ('T_1016504_Equip_02', (1, 1, 1), 0.0),
    'acc6': ('T_1016504_Equip_06', (1, 1, 1), 0.0),
    'acc7': ('T_1016504_Equip_07', (1, 1, 1), 0.0),
    'weapon': ('T_WP_1016504_Weapon_02', (1, 1, 1), 0.0),
}
# material key -> its texture sets as rows of tiles (top row first, None = empty tile)
ATLASES = {
    'trim': [['gold', 'acc6'], ['acc7', None]],
}
EMPTY = {'base': (128, 128, 128, 255), 'norm': (128, 128, 255, 255), 'mask': (0, 255, 255, 255)}
# Colour lift (1.1.0, Neon's 1.2.0 lift; the user on Neon: "YES EVERY MOD SHOULD BE THIS KIIND OF SHADING. this like
# color intensity is what im looking for"): texture set -> (luminance gamma, saturation) on the base RGB; alpha
# untouched. The body skin is the user's Bibo+ (skin.shpk), not ours, so it isn't lifted.
LIFT = {k: (1.4, 1.2) for k in ('suit', 'skirt', 'gold', 'acc6', 'acc7', 'weapon', 'hair')}
LUMA = np.array([0.2126, 0.7152, 0.0722])


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def lift(rgb, gamma, sat):
    """Brighter colours: luminance (sRGB-encoded) to the power 1/gamma with the hue kept, then saturation x sat."""
    lin = to_linear(rgb.astype(np.float64) / 255)
    y = lin @ LUMA
    lin *= (to_linear(to_srgb(y) ** (1 / gamma)) / np.maximum(y, 1e-6))[..., None]
    y = lin @ LUMA
    lin = np.maximum(y[..., None] + (lin - y[..., None]) * sat, 0)
    peak = np.maximum(lin.max(-1, keepdims=True), 1.0)         # a channel past white scales the pixel, keeping hue
    return (to_srgb(lin / peak) * 255 + 0.5).astype(np.uint8)


def tile_of(texset):
    """(material key, column, row, columns, rows) of a texture set; a set outside every atlas is its own material."""
    for mat, grid in ATLASES.items():
        for r, row in enumerate(grid):
            if texset in row:
                return mat, row.index(texset), r, len(row), len(grid)
    return texset, 0, 0, 1, 1


def load(name, mode='RGBA'):
    return np.array(Image.open(SRC + name + '.png').convert(mode))


def tex_paths(key):
    base = WP + 'v01_w1001b0071_loki' if key == 'weapon' else EQ + f'v01_c0201e6137_loki_{key}'
    return {k: f'{base}_{k}.tex' for k in ('base', 'norm', 'mask')}


def save(arr, gamepath):
    png = WORK + 'tex_png/' + os.path.basename(gamepath).replace('.tex', '.png')
    os.makedirs(os.path.dirname(png), exist_ok=True)
    Image.fromarray(arr).save(png)
    dst = OUT + gamepath
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    texfile.png_to_tex_bc7(png, dst, WORK + 'tex_dds')


def norm_tex(n_rgba, opacity=None):
    out = n_rgba.copy()
    out[..., 2] = 255 if opacity is None else opacity
    out[..., 3] = 255
    return out


def mask_tex(spec, rough, ao):
    return np.stack([spec, rough, ao, np.full_like(spec, 255)], -1).astype(np.uint8)


def standard_maps(key):
    """{'base', 'norm', 'mask'} RGBA arrays of one texture set."""
    prefix, tint, amount = SETS[key]
    d = load(prefix + '_D').astype(np.float32)
    t = 1.0 + (np.array(tint, np.float32) - 1.0) * amount
    d[..., :3] *= t
    d[..., 3] = 255
    s = load(prefix + '_S')[..., 0]
    r = load(prefix + '_ORM_g', 'L')
    o = load(prefix + '_ORM_r', 'L')
    if s.shape != r.shape:
        s = np.array(Image.fromarray(s).resize(r.shape[::-1], Image.BILINEAR))
    base = np.clip(d, 0, 255).astype(np.uint8)
    if key in LIFT:
        base[..., :3] = lift(base[..., :3], *LIFT[key])
    return {'base': base, 'norm': norm_tex(load(prefix + '_N')), 'mask': mask_tex(s, r, o)}


def build_standard(key):
    p = tex_paths(key)
    for kind, arr in standard_maps(key).items():
        save(arr, p[kind])


def build_atlas(mat):
    """Tile the material's texture sets into one base / norm / mask (a tile per set, same grid in all three)."""
    grid = ATLASES[mat]
    maps = {t: standard_maps(t) for row in grid for t in row if t}
    p = tex_paths(mat)
    for kind in ('base', 'norm', 'mask'):
        h, w = next(iter(maps.values()))[kind].shape[:2]
        assert all(m[kind].shape[:2] == (h, w) for m in maps.values()), (mat, kind)
        empty = np.empty((h, w, 4), np.uint8); empty[:] = EMPTY[kind]
        save(np.vstack([np.hstack([maps[t][kind] if t else empty for t in row]) for row in grid]), p[kind])


def build_hair():
    groups, _, _ = pickle.load(open(WORK + 'loki_groups.pkl', 'rb'))
    g = [g for g in groups if g['name'].endswith('Hair_01')][0]
    d = load('T_1016504_Hair_D')
    baked, filled = bake.rebake(d, g['uv2'], g['uv'], g['tris'], 2048)
    m = load('T_1016504_Hair_M', 'L')
    baked[~filled, :3] = (205, 205, 212)
    baked[..., 3] = m
    # silver-white hair: the strand mask carries most of the detail, lift it into the colour a little
    rgb = baked[..., :3].astype(np.float32) * (0.85 + 0.15 * m[..., None] / 255.0)
    baked[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    if 'hair' in LIFT:
        baked[..., :3] = lift(baked[..., :3], *LIFT['hair'])
    p = tex_paths('hair')
    save(baked, p['base'])
    n = load('T_1016504_Hair_N')
    mm = np.array(Image.fromarray(m).resize(n.shape[:2][::-1], Image.BILINEAR))
    save(norm_tex(n, mm), p['norm'])
    h, w = n.shape[:2]
    save(mask_tex(np.full((h, w), 90, np.uint8), np.full((h, w), 150, np.uint8), np.full((h, w), 255, np.uint8)), p['mask'])


def build_id():
    ident = np.zeros((8, 8, 4), np.uint8); ident[..., 3] = 255
    for folder in (EQ, WP):
        dst = OUT + folder + 'v01_loki_id.tex'
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        texfile.array_to_tex_bgra(ident, dst)


def materials():
    """Material keys with their own textures: every atlas, every set outside an atlas, and the hair."""
    return list(dict.fromkeys(tile_of(k)[0] for k in SETS)) + ['hair']


if __name__ == '__main__':
    for folder in (EQ, WP):
        shutil.rmtree(OUT + folder, ignore_errors=True)     # no stale per-set textures left to be packed
    build_id()
    for k in materials():
        print('textures', k)
        if k in ATLASES:
            build_atlas(k)
        elif k == 'hair':
            build_hair()
        else:
            build_standard(k)
