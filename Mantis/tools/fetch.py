"""Download the psylocke.gg viewer assets for one skin (content-addressed CDN objects).

usage: python -I tools/fetch.py <hash> [<hash> ...]
Saves each object to source/cdn/<hash>.<ext> and, for msgpack scene files, follows every
64-hex hash they mention so the whole skin (meshes, textures, skeleton) comes down.
"""
import re
import sys
import time
import urllib.request
from pathlib import Path

import msgpack

CDN = 'https://cdn.psylocke.gg/marvel-rivals/objects/{0}/{1}'
OUT = Path(__file__).resolve().parent.parent / 'source' / 'cdn'
EXT = {'application/x-yggscene': 'ygg', 'model/gltf-binary': 'glb', 'image/ktx2': 'ktx2',
       'application/json': 'json', 'application/octet-stream': 'bin'}
HEX = re.compile(rb'[0-9a-f]{64}')


def hashes_in(obj, found):
    if isinstance(obj, dict):
        for k, v in obj.items():
            hashes_in(k, found); hashes_in(v, found)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            hashes_in(v, found)
    elif isinstance(obj, str) and re.fullmatch(r'[0-9a-f]{64}', obj):
        found.add(obj)
    elif isinstance(obj, bytes):
        found.update(m.decode() for m in HEX.findall(obj))


def get(h):
    have = list(OUT.glob(h + '.*'))
    if have:
        return have[0]
    req = urllib.request.Request(CDN.format(h[:2], h), headers={
        'User-Agent': 'Mozilla/5.0', 'Referer': 'https://psylocke.gg/', 'Origin': 'https://psylocke.gg'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read(); ctype = r.headers.get('content-type', '').split(';')[0]
            break
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                raise RuntimeError(h)
            print('retry', h, e); time.sleep(2)
        except Exception as e:
            print('retry', h, e); time.sleep(2)
    else:
        raise RuntimeError(h)
    p = OUT / f'{h}.{EXT.get(ctype, "bin")}'
    p.write_bytes(data)
    return p


def main(roots):
    OUT.mkdir(parents=True, exist_ok=True)
    todo, seen = list(roots), set()
    while todo:
        h = todo.pop()
        if h in seen:
            continue
        seen.add(h)
        try:
            p = get(h)
        except RuntimeError:
            print('missing', h)   # 64-hex strings inside binary data that aren't CDN objects
            continue
        found = set()
        if p.suffix == '.ygg':
            hashes_in(msgpack.unpackb(p.read_bytes(), raw=False, strict_map_key=False), found)
        elif p.suffix in ('.json', '.glb'):
            found.update(m.decode() for m in HEX.findall(p.read_bytes()[:200000]))
        todo.extend(found - seen)
        print(f'{len(seen):4d} {p.name} {p.stat().st_size}')


if __name__ == '__main__':
    main(sys.argv[1:])
