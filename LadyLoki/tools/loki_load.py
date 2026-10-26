"""Load Lady Loki's Collada export into per-material vertex/index groups (source units: cm, Z-up, -Y forward)."""
import pickle
import numpy as np

WORK = r'E:\FFXIV-mods\LadyLoki\work'
MAIN = 'SK_1016_1016504-mesh'
EXTRA0 = 'SK_1016_1016504_001-mesh'   # UV channel 2 (scepter texture uses it)
EXTRA1 = 'SK_1016_1016504_002-mesh'   # UV channel 3 (hair_01 texture uses it)


def load():
    raw = pickle.load(open(WORK + r'\mesh_raw.pkl', 'rb'))
    sources = pickle.load(open(WORK + r'\sources.pkl', 'rb'))
    joints = raw[MAIN][2]['joints']
    ibm = raw[MAIN][2]['ibm']

    def corner_uvs(geom, group_index):
        _, groups, _ = raw[geom]
        mat, p, inputs = groups[group_index]
        uvsrc = [i for i in inputs if i[0] == 'TEXCOORD'][0]
        return sources[uvsrc[1]][p[:, uvsrc[2]]][:, :2]

    pos, groups, skin = raw[MAIN]
    infl = skin['influences']
    W = np.zeros((len(pos), 8)); J = np.zeros((len(pos), 8), np.int64)
    for v, lst in enumerate(infl):
        lst = sorted(lst, key=lambda x: -x[1])[:8]
        s = sum(w for _, w in lst) or 1.0
        for k, (j, w) in enumerate(lst):
            J[v, k] = j; W[v, k] = w / s

    out = []
    for gi, (mat, p, inputs) in enumerate(groups):
        name = mat.replace('-material', '')
        nrm_in = [i for i in inputs if i[0] == 'NORMAL'][0]
        cpos = p[:, 0]
        cnrm = sources[nrm_in[1]][p[:, nrm_in[2]]]
        cuv = corner_uvs(MAIN, gi)
        # alternate UV channels for materials whose texture uses them
        if name.startswith('MI_WP_'):
            gidx = [k for k, g in enumerate(raw[EXTRA0][1]) if g[0] == mat][0]
            cuv2 = corner_uvs(EXTRA0, gidx)
        elif name == 'MI_1016504_Hair_01':
            gidx = [k for k, g in enumerate(raw[EXTRA1][1]) if g[0] == mat][0]
            cuv2 = corner_uvs(EXTRA1, gidx)
        else:
            cuv2 = cuv
        key = np.concatenate([cpos[:, None].astype(np.float64), np.round(cnrm, 4), np.round(cuv, 5), np.round(cuv2, 5)], 1)
        uniq, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.reshape(-1)
        vp = uniq[:, 0].astype(np.int64)
        out.append({
            'name': name, 'index': gi,
            'src_vidx': vp,
            'pos': pos[vp].copy(),
            'nrm': uniq[:, 1:4],
            'uv': uniq[:, 4:6],
            'uv2': uniq[:, 6:8],
            'J': J[vp].copy(), 'W': W[vp].copy(),
            'tris': inv.reshape(-1, 3),
        })
    return out, joints, ibm
