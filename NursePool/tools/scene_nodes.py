"""List the nodes of a psylocke.gg scene: id, parent, model ref, attach socket, tags."""
import json
import sys
from pathlib import Path

import msgpack

SRC = Path(__file__).resolve().parent.parent / 'source' / 'cdn'

p = next(SRC.glob(sys.argv[1] + '*.ygg'))
d = msgpack.unpackb(p.read_bytes(), raw=False, strict_map_key=False)
for n in d['nodes']:
    m = n.get('model') or {}
    ref = m.get('ref')
    f = next(SRC.glob(ref + '.*'), None) if isinstance(ref, str) else None
    print(n['id'], '| parent', n.get('parentId'), '| hidden', n.get('hidden'), '| tags', n.get('tags'),
          '| attach', json.dumps(n.get('attach')), '| model', ref, f and f.stat().st_size)
print([k for k in d if k != 'nodes'])
for k, v in d.items():
    if k not in ('nodes', 'tracks'):
        print(k, json.dumps(v, default=str)[:1500])
