"""Read/write TexTools model DB files (the intermediate format ConsoleTools /wrap and /unwrap use).
Units: meters, Y-up, +Z forward. UVs use the Blender/FBX convention (v up)."""
import os
import sqlite3
import numpy as np

SCHEMA = open(r'E:\FFXIV-mods\LadyLoki\tools\fbxconv\sql\CreateDB.SQL', encoding='utf-8').read()

VCOLS = (['position_x', 'position_y', 'position_z', 'normal_x', 'normal_y', 'normal_z',
          'binormal_x', 'binormal_y', 'binormal_z', 'tangent_x', 'tangent_y', 'tangent_z',
          'color_r', 'color_g', 'color_b', 'color_a', 'color2_r', 'color2_g', 'color2_b', 'color2_a',
          'uv_1_u', 'uv_1_v', 'uv_2_u', 'uv_2_v', 'uv_3_u', 'uv_3_v'] +
         [f'bone_{i}_{k}' for i in range(1, 9) for k in ('id', 'weight')] + ['flow_u', 'flow_v'])


class Part:
    """One mesh part: arrays keyed like the vertex table, plus tris and FFXIV bone names per influence."""
    def __init__(self, pos, nrm, uv, tris, bones, weights, uv2=None, color=None, color2=None, attributes='',
                 name='', tangent=None, binormal=None, flow=None):
        self.pos = np.asarray(pos, np.float64)
        self.nrm = np.asarray(nrm, np.float64)
        self.uv = np.asarray(uv, np.float64)
        self.uv2 = np.zeros_like(self.uv) if uv2 is None else np.asarray(uv2, np.float64)
        self.tris = np.asarray(tris, np.int64)
        self.bones = bones            # (V, 8) array of bone *names* ('' for unused)
        self.weights = np.asarray(weights, np.float64)
        n = len(self.pos)
        self.color = np.ones((n, 4)) if color is None else np.asarray(color, np.float64)
        self.color2 = np.tile([0, 0, 0, 1.0], (n, 1)) if color2 is None else np.asarray(color2, np.float64)
        self.tangent = tangent
        self.binormal = binormal
        self.flow = np.zeros((n, 2)) if flow is None else np.asarray(flow, np.float64)
        self.attributes = attributes
        self.name = name


class Mesh:
    def __init__(self, material, parts, name='', type_='Standard'):
        self.material = material
        self.parts = parts
        self.name = name
        self.type = type_


def read(path):
    c = sqlite3.connect(path)
    meta = dict(c.execute('select key, value from meta').fetchall())
    mats = dict(c.execute('select material_id, name from materials').fetchall())
    skel = {r[0]: (r[1], np.array(r[2:], float).reshape(4, 4)) for r in c.execute('select * from skeleton')}
    meshes = []
    for mesh_id, model, mat_id, name, type_ in c.execute('select mesh, model, material_id, name, type from meshes order by mesh').fetchall():
        bone_names = dict(c.execute('select bone_id, name from bones where mesh=?', (mesh_id,)).fetchall())
        parts = []
        for part_id, pname, attrs in c.execute('select part, name, attributes from parts where mesh=? order by part', (mesh_id,)).fetchall():
            rows = np.array(c.execute('select ' + ','.join(VCOLS) + ' from vertices where mesh=? and part=? order by vertex_id',
                                      (mesh_id, part_id)).fetchall(), dtype=np.float64)
            if len(rows) == 0:
                continue
            idx = np.array(c.execute('select vertex_id from indices where mesh=? and part=? order by index_id',
                                     (mesh_id, part_id)).fetchall(), dtype=np.int64).reshape(-1, 3)
            col = {k: i for i, k in enumerate(VCOLS)}
            bid = rows[:, [col[f'bone_{i}_id'] for i in range(1, 9)]].astype(int)
            bw = rows[:, [col[f'bone_{i}_weight'] for i in range(1, 9)]]
            bnames = np.empty(bid.shape, dtype=object)
            for i in range(bid.shape[0]):
                for k in range(8):
                    bnames[i, k] = bone_names.get(bid[i, k], '') if bw[i, k] > 0 else ''
            p = Part(rows[:, 0:3], rows[:, 3:6], rows[:, 20:22], idx, bnames, bw, uv2=rows[:, 22:24],
                     color=rows[:, 12:16], color2=rows[:, 16:20], attributes=attrs or '', name=pname or '',
                     tangent=rows[:, 9:12], binormal=rows[:, 6:9], flow=rows[:, -2:])
            p.uv3 = rows[:, 24:26]
            parts.append(p)
        meshes.append(Mesh(mats.get(mat_id, ''), parts, name or '', type_ or 'Standard'))
    c.close()
    return {'meta': meta, 'skeleton': skel, 'meshes': meshes}


def write(path, meshes, skeleton, root_name, meta_extra=None):
    """meshes: list of Mesh. skeleton: {name: (parent, 4x4 matrix as stored by TexTools)}."""
    if os.path.exists(path):
        os.remove(path)
    c = sqlite3.connect(path)
    c.executescript(SCHEMA)
    meta = {'unit': 'meter', 'application': 'ffxiv_tt', 'version': '3.1.0.2', 'up': 'y', 'front': 'z',
            'handedness': 'r', 'for_3ds_max': '0', 'root_name': root_name}
    meta.update(meta_extra or {})
    c.executemany('insert into meta values (?,?)', list(meta.items()))
    c.execute('insert into models values (0, ?)', (root_name,))
    mat_ids = {}
    for m in meshes:
        mat_ids.setdefault(m.material, len(mat_ids))
    for name, mid in mat_ids.items():
        c.execute('insert into materials (material_id, name) values (?,?)', (mid, name))
    for name, (parent, mat) in skeleton.items():
        c.execute('insert into skeleton values (' + ','.join('?' * 18) + ')', [name, parent] + list(np.asarray(mat).reshape(-1)))
    for mi, m in enumerate(meshes):
        c.execute('insert into meshes values (?,?,?,?,?)', (mi, 0, mat_ids[m.material], m.name or f'Group {mi}', m.type))
        names = []
        for p in m.parts:
            for b in np.unique(p.bones[p.weights > 0]):
                if b and b not in names:
                    names.append(b)
        bidx = {b: i for i, b in enumerate(names)}
        c.executemany('insert into bones values (?,?,?)', [(mi, i, b) for b, i in bidx.items()])
        for pi, p in enumerate(m.parts):
            c.execute('insert into parts values (?,?,?,?)', (mi, pi, p.name or f'Part {pi}', p.attributes))
            n = len(p.pos)
            tan = p.tangent if p.tangent is not None else np.zeros((n, 3))
            bin_ = p.binormal if p.binormal is not None else np.zeros((n, 3))
            uv3 = getattr(p, 'uv3', None)
            uv3 = np.tile([0, 1.0], (n, 1)) if uv3 is None else uv3
            rows = []
            for i in range(n):
                bw = []
                for k in range(8):
                    w = float(p.weights[i, k]); b = p.bones[i, k]
                    if w > 0 and b:
                        bw += [bidx[b], w]
                    else:
                        bw += [0, 0.0]
                rows.append([mi, pi, i] + list(p.pos[i]) + list(p.nrm[i]) + list(bin_[i]) + list(tan[i]) +
                            list(p.color[i]) + list(p.color2[i]) + list(p.uv[i]) + list(p.uv2[i]) + list(uv3[i]) +
                            bw + list(p.flow[i]))
            c.executemany('insert into vertices (mesh, part, vertex_id,' + ','.join(VCOLS) + ') values (' +
                          ','.join('?' * (3 + len(VCOLS))) + ')', rows)
            c.executemany('insert into indices values (?,?,?,?)',
                          [(mi, pi, k, int(v)) for k, v in enumerate(p.tris.reshape(-1))])
    c.commit()
    c.close()
