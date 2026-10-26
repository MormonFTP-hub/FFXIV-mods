"""Assemble TexTools DBs for every slot (+ the BLM staff) and wrap them into FFXIV .mdl files."""
import os
import pickle
import shutil
import sys
import numpy as np

sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import ffskel
import retarget
import tt
import ttdb
import build_outfit as bo
from make_materials import model_name
from make_textures import tile_of

WORK = 'E:/FFXIV-mods/LadyLoki/work/'
OUT = 'E:/FFXIV-mods/LadyLoki/out/files/'
DBDIR = WORK + 'db/'
EQ_MAT = 'chara/equipment/e6137/material/v0001/'
UNDIES_SRC = 'E:/cum/Bibo+/common/10/mt_c0201e0000_dwn_bot.mtrl'
UNDIES_NAME = 'mt_c0201e6137_dwn_bot.mtrl'

SCEPTER_SCALE = 0.0095          # Loki cm -> m, slightly shrunk for FFXIV proportions
SCEPTER_GRIP = 'Scepter_hand_ik'


def skeleton_for(bones):
    F = ffskel.load()
    out = {}
    for b in bones:
        while b and b not in out:
            out[b] = (F[b]['parent_name'], F[b]['local'])
            b = F[b]['parent_name']
    return out


def compact(part, tris):
    used = np.unique(tris)
    remap = -np.ones(len(part.pos), np.int64); remap[used] = np.arange(len(used))
    p = ttdb.Part(part.pos[used], part.nrm[used], part.uv[used], remap[tris], part.bones[used], part.weights[used],
                  uv2=part.uv2[used], color=part.color[used], color2=part.color2[used],
                  attributes=part.attributes, name=part.name)
    p.uv3 = part.uv3[used]
    return p


def loki_part(pieces):
    """Merge fitted Loki pieces (same material) into one DB part."""
    pos, nrm, uv, tris, bones, weights = [], [], [], [], [], []
    off = 0
    for x in pieces:
        pos.append(x['pos']); nrm.append(x['nrm']); uv.append(x['uv'])
        tris.append(x['tris'] + off); bones.append(x['bones']); weights.append(x['weights'])
        off += len(x['pos'])
    n = off
    p = ttdb.Part(np.concatenate(pos), np.concatenate(nrm), np.concatenate(uv), np.concatenate(tris),
                  np.concatenate(bones), np.concatenate(weights), uv2=np.full((n, 2), -1.0))
    p.uv3 = np.tile([0.0, 1.0], (n, 1))
    return p


def bibo_meshes(fitd, slot):
    """Bibo body meshes for a slot, with the skin hidden under the swimsuit removed."""
    entries = fitd['bibo'].get(slot, [])
    d = ttdb.read(bo.BIBO[slot])
    meshes = []; k = 0
    for m in d['meshes']:
        parts = []
        for p in m.parts:
            e = entries[k]; k += 1
            tris = p.tris[e['keep']]
            if len(tris):
                parts.append(compact(p, tris))
        if not parts:
            continue
        name = m.material
        if name == 'mt_c0201e0279_dwn_bot':
            name = UNDIES_NAME[:-5]
        meshes.append(ttdb.Mesh('/' + name + '.mtrl', parts))
    return meshes


def bun_ornament(x):
    return not x['hair'] and x['pos'].mean(0)[2] < -0.025


def to_atlas(x):
    """A fitted piece on its texture set's material, its UVs (v up) moved into the set's tile of that material's atlas."""
    mat, c, r, nc, nr = tile_of(x['material'])
    if nc * nr == 1:
        return x
    uv = x['uv']
    assert uv.min() > -1e-3 and uv.max() < 1 + 1e-3, (x['group'], uv.min(0), uv.max(0))   # no wrapping inside a tile
    y = dict(x)
    y['material'] = mat
    y['uv'] = np.c_[(uv[:, 0] + c) / nc, (uv[:, 1] + (nr - 1 - r)) / nr]
    return y


MAX_MATERIALS = 4      # Penumbra's MdlMaterialMaximum


def slot_meshes(fitd, slot, with_hair=False):
    pieces = fitd['slots'][slot]
    if slot == 'met':
        pieces = [x for x in pieces if with_hair or (not x['hair'] and not bun_ornament(x))]
    by_mat = {}
    for x in map(to_atlas, pieces):
        by_mat.setdefault(x['material'], []).append(x)
    meshes = [] if slot == 'met' else bibo_meshes(fitd, slot)
    for mat in sorted(by_mat):
        meshes.append(ttdb.Mesh(model_name(mat), [loki_part(by_mat[mat])]))
    mats = list(dict.fromkeys(m.material for m in meshes))
    assert len(mats) <= MAX_MATERIALS, (slot, mats)
    return meshes


def weapon_meshes():
    groups, joints, _ = pickle.load(open(WORK + 'loki_groups.pkl', 'rb'))
    g = [g for g in groups if g['name'].endswith('Weapon_01')][0]
    J, _ = retarget.loki_joints()
    grip = J[SCEPTER_GRIP] / 0.01        # back to Loki cm, converted axes
    conv = retarget.CONV / 0.01
    P = (conv @ g['pos'].T).T
    P = (P - grip) * SCEPTER_SCALE
    N = (conv @ g['nrm'].T).T
    n = len(P)
    bones = np.empty((n, 8), object); bones[:] = ''; bones[:, 0] = 'n_hara'
    weights = np.zeros((n, 8)); weights[:, 0] = 1
    p = ttdb.Part(P, N, g['uv2'], g['tris'], bones, weights, uv2=np.full((n, 2), -1.0))
    p.uv3 = np.tile([0.0, 1.0], (n, 1))
    print('scepter extent (m):', P.min(0).round(3), P.max(0).round(3))
    return [ttdb.Mesh(model_name('weapon'), [p])]


def wrap(meshes, name, ffpath):
    os.makedirs(DBDIR, exist_ok=True)
    bones = set()
    for m in meshes:
        for p in m.parts:
            bones.update(b for b in np.unique(p.bones[p.weights > 0]) if b)
    if 'n_hara' in bones and len(bones) == 1:
        skel = {'n_hara': ('n_root', np.eye(4)), 'n_root': (None, np.eye(4))}
    else:
        skel = skeleton_for(sorted(bones))
    db = DBDIR + name + '.db'
    ttdb.write(db, meshes, skel, os.path.splitext(os.path.basename(ffpath))[0])
    dst = OUT + ('models/' + name + '/' if name.startswith('met') else '') + ffpath
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    out = tt.wrap(os.path.normpath(db), os.path.normpath(dst), ffpath, '/mats', '/attributes', '/autoscale')
    nv = sum(len(p.pos) for m in meshes for p in m.parts)
    print(f'{name}: {len(meshes)} meshes, {nv} verts, {len(bones)} bones ->', os.path.getsize(dst), 'bytes')
    return dst


def main():
    fitd = pickle.load(open(WORK + 'outfit_fit.pkl', 'rb'))
    eq = 'chara/equipment/e6137/model/c0201e6137_{}.mdl'
    for slot in ('top', 'dwn', 'glv', 'sho'):
        wrap(slot_meshes(fitd, slot), slot, eq.format(slot))
    wrap(slot_meshes(fitd, 'met', with_hair=False), 'met_headpiece', eq.format('met'))
    wrap(slot_meshes(fitd, 'met', with_hair=True), 'met_hair', eq.format('met'))
    wrap(weapon_meshes(), 'weapon', 'chara/weapon/w1001/obj/body/b0071/model/w1001b0071.mdl')
    os.makedirs(OUT + EQ_MAT, exist_ok=True)
    shutil.copyfile(UNDIES_SRC, OUT + EQ_MAT + UNDIES_NAME)


if __name__ == '__main__':
    main()
