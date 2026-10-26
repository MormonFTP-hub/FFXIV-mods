"""Summarize a glb: nodes/meshes/materials/images/skins/extensions."""
import json
import struct
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / 'source' / 'cdn'


def load(h):
    b = next(SRC.glob(h + '*.glb')).read_bytes()
    jl = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + jl])
    return j, b[20 + jl + 8:]


if __name__ == '__main__':
    j, _ = load(sys.argv[1])
    print('keys', list(j), 'ext', j.get('extensionsUsed'), j.get('extensionsRequired'))
    print('asset', j.get('asset'))
    print('scenes', len(j.get('scenes', [])), 'nodes', len(j.get('nodes', [])), 'meshes', len(j.get('meshes', [])),
          'skins', len(j.get('skins', [])), 'mats', len(j.get('materials', [])), 'imgs', len(j.get('images', [])),
          'anims', len(j.get('animations', [])))
    for i, m in enumerate(j.get('meshes', [])):
        prims = m['primitives']
        vc = sum(j['accessors'][p['attributes']['POSITION']]['count'] for p in prims)
        print('mesh', i, m.get('name'), 'prims', len(prims), 'verts', vc, 'mats', [p.get('material') for p in prims],
              'attrs', sorted(prims[0]['attributes']), 'targets', len(prims[0].get('targets', [])), m.get('extras', '')
              )
    for i, m in enumerate(j.get('materials', [])):
        print('mat', i, json.dumps(m)[:600])
    for i, im in enumerate(j.get('images', [])):
        print('img', i, json.dumps(im)[:300])
    for i, t in enumerate(j.get('textures', [])[:5]):
        print('tex', i, json.dumps(t))
    for i, n in enumerate(j['nodes']):
        if 'mesh' in n or 'skin' in n:
            print('node', i, n.get('name'), 'mesh', n.get('mesh'), 'skin', n.get('skin'), json.dumps(n.get('extras', ''))[:200])
    for i, s in enumerate(j.get('skins', [])):
        print('skin', i, s.get('name'), len(s['joints']), 'root', s.get('skeleton'))
    print('extras', json.dumps(j.get('extras', ''))[:3000])
