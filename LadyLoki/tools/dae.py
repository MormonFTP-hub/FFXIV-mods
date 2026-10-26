"""Minimal Collada (Blender export) reader: meshes, skins, joint hierarchy."""
import xml.etree.ElementTree as ET
import numpy as np

NS = '{http://www.collada.org/2005/11/COLLADASchema}'


def _q(tag):
    return './/' + '/'.join(NS + t for t in tag.split('/'))


def _floats(el):
    return np.array(el.text.split(), dtype=np.float64) if el is not None and el.text else np.zeros(0)


def _ints(el):
    return np.array(el.text.split(), dtype=np.int64) if el is not None and el.text else np.zeros(0, np.int64)


class Collada:
    def __init__(self, path):
        self.root = ET.parse(path).getroot()
        self.sources = {}
        for src in self.root.iter(NS + 'source'):
            fa = src.find(NS + 'float_array')
            na = src.find(NS + 'Name_array')
            acc = src.find(_q('technique_common/accessor'))
            stride = int(acc.get('stride', 1)) if acc is not None else 1
            if fa is not None:
                self.sources[src.get('id')] = _floats(fa).reshape(-1, stride)
            elif na is not None:
                self.sources[src.get('id')] = na.text.split()
        self.materials = {}
        for m in self.root.iter(NS + 'material'):
            self.materials[m.get('id')] = m.get('name')
        self.geometries = {g.get('id'): g for g in self.root.iter(NS + 'geometry')}
        self.controllers = {c.get('id'): c for c in self.root.iter(NS + 'controller')}

    def mesh(self, geom_id):
        """Returns dict: positions (V,3), and list of triangle groups with per-corner indices."""
        g = self.geometries[geom_id]
        m = g.find(NS + 'mesh')
        verts = m.find(NS + 'vertices')
        pos_src = verts.find(NS + 'input').get('source')[1:]
        positions = self.sources[pos_src]
        groups = []
        for tri in m.findall(NS + 'triangles'):
            inputs = []
            for inp in tri.findall(NS + 'input'):
                inputs.append((inp.get('semantic'), inp.get('source')[1:], int(inp.get('offset')), int(inp.get('set', 0))))
            nofs = max(i[2] for i in inputs) + 1
            p = _ints(tri.find(NS + 'p')).reshape(-1, nofs)
            groups.append({'material': tri.get('material'), 'inputs': inputs, 'p': p, 'count': int(tri.get('count'))})
        return {'name': g.get('name'), 'positions': positions, 'groups': groups}

    def skin(self, ctrl_id):
        c = self.controllers[ctrl_id]
        s = c.find(NS + 'skin')
        bsm = _floats(s.find(NS + 'bind_shape_matrix')).reshape(4, 4)
        joints = s.find(NS + 'joints')
        jsrc = ibm_src = None
        for inp in joints.findall(NS + 'input'):
            if inp.get('semantic') == 'JOINT':
                jsrc = inp.get('source')[1:]
            elif inp.get('semantic') == 'INV_BIND_MATRIX':
                ibm_src = inp.get('source')[1:]
        names = self.sources[jsrc]
        ibm = self.sources[ibm_src].reshape(-1, 4, 4)
        vw = s.find(NS + 'vertex_weights')
        wsrc = None
        jofs = wofs = 0
        for inp in vw.findall(NS + 'input'):
            if inp.get('semantic') == 'WEIGHT':
                wsrc = inp.get('source')[1:]
                wofs = int(inp.get('offset'))
            elif inp.get('semantic') == 'JOINT':
                jofs = int(inp.get('offset'))
        wvals = self.sources[wsrc].reshape(-1)
        vcount = _ints(vw.find(NS + 'vcount'))
        v = _ints(vw.find(NS + 'v')).reshape(-1, 2)
        influences = []
        k = 0
        for n in vcount:
            influences.append([(int(v[k + i, jofs]), float(wvals[v[k + i, wofs]])) for i in range(n)])
            k += n
        return {'source': s.get('source')[1:], 'bind_shape': bsm, 'joints': names, 'ibm': ibm,
                'influences': influences, 'name': c.get('name')}

    def nodes(self):
        """Flat list of scene nodes: (id, name, sid, type, parent_id, local 4x4, element)."""
        out = []
        vs = self.root.find(_q('library_visual_scenes/visual_scene'))

        def walk(el, parent):
            for n in el.findall(NS + 'node'):
                mat = n.find(NS + 'matrix')
                local = _floats(mat).reshape(4, 4) if mat is not None else np.eye(4)
                out.append({'id': n.get('id'), 'name': n.get('name'), 'sid': n.get('sid'), 'type': n.get('type'),
                            'parent': parent, 'local': local, 'el': n})
                walk(n, n.get('id'))
        walk(vs, None)
        return out
