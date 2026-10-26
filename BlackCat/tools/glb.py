"""Minimal GLB reader for the psylocke.gg exports (SharpGLTF + EXT_meshopt_compression + KHR_texture_basisu)."""
import json
import struct
from pathlib import Path

import numpy as np

import xdec

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
NORM = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}


class Glb:
    def __init__(self, path):
        b = Path(path).read_bytes()
        assert b[:4] == b'glTF'
        jl = struct.unpack_from('<I', b, 12)[0]
        self.g = json.loads(b[20:20 + jl])
        o = 20 + jl
        self.bin = b''
        if o < len(b):
            bl = struct.unpack_from('<I', b, o)[0]
            self.bin = b[o + 8:o + 8 + bl]
        self._views = {}

    def view(self, i):
        if i in self._views:
            return self._views[i]
        bv = self.g['bufferViews'][i]
        ext = bv.get('extensions', {}).get('EXT_meshopt_compression')
        if ext:
            assert ext['buffer'] == 0 or self.g['buffers'][ext['buffer']].get('uri') is None
            src = self.bin[ext.get('byteOffset', 0):ext.get('byteOffset', 0) + ext['byteLength']]
            data = xdec.meshopt(src, ext['count'], ext['byteStride'], ext['mode'], ext.get('filter', 'NONE'))
            stride = ext['byteStride']
        else:
            off = bv.get('byteOffset', 0)
            data = self.bin[off:off + bv['byteLength']]
            stride = bv.get('byteStride', 0)
        self._views[i] = (data, stride)
        return data, stride

    def accessor(self, i, normalize=True):
        a = self.g['accessors'][i]
        dt = np.dtype(CT[a['componentType']])
        n, cnt = NC[a['type']], a['count']
        if 'bufferView' in a:
            data, stride = self.view(a['bufferView'])
            off = a.get('byteOffset', 0)
            es = dt.itemsize * n
            if stride and stride != es:
                raw = np.frombuffer(data, np.uint8)[off:off + stride * (cnt - 1) + es]
                raw = np.lib.stride_tricks.as_strided(raw, (cnt, es), (stride, 1))
                arr = np.ascontiguousarray(raw).view(dt).reshape(cnt, n)
            else:
                arr = np.frombuffer(data, dt, cnt * n, off).reshape(cnt, n)
        else:
            arr = np.zeros((cnt, n), dt)
        if a.get('normalized') and normalize and a['componentType'] in NORM:
            arr = np.maximum(arr.astype(np.float32) / NORM[a['componentType']], -1.0)
        else:
            arr = arr.copy()
        sp = a.get('sparse')
        if sp:
            idx_a = sp['indices']; val_a = sp['values']
            d, _ = self.view(idx_a['bufferView'])
            idx = np.frombuffer(d, CT[idx_a['componentType']], sp['count'], idx_a.get('byteOffset', 0))
            d, _ = self.view(val_a['bufferView'])
            vals = np.frombuffer(d, dt, sp['count'] * n, val_a.get('byteOffset', 0)).reshape(-1, n)
            if a.get('normalized') and normalize and a['componentType'] in NORM:
                vals = np.maximum(vals.astype(np.float32) / NORM[a['componentType']], -1.0)
            arr = arr.astype(vals.dtype) if arr.dtype != vals.dtype else arr
            arr[idx.astype(np.int64)] = vals
        return arr

    def node_matrices(self):
        """Local and world 4x4 matrices for every node (column-vector convention: world = parent @ local)."""
        nodes = self.g['nodes']
        parent = [-1] * len(nodes)
        for i, nd in enumerate(nodes):
            for c in nd.get('children', []):
                parent[c] = i
        local = []
        for nd in nodes:
            if 'matrix' in nd:
                m = np.array(nd['matrix'], np.float64).reshape(4, 4).T
            else:
                t = np.array(nd.get('translation', [0, 0, 0]), np.float64)
                x, y, z, w = nd.get('rotation', [0, 0, 0, 1])
                s = np.array(nd.get('scale', [1, 1, 1]), np.float64)
                r = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                              [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                              [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
                m = np.eye(4); m[:3, :3] = r * s; m[:3, 3] = t
            local.append(m)
        world = [None] * len(nodes)

        def wm(i):
            if world[i] is None:
                world[i] = local[i] if parent[i] < 0 else wm(parent[i]) @ local[i]
            return world[i]
        for i in range(len(nodes)):
            wm(i)
        return parent, local, world
