"""Print the structure of a psylocke.gg scene file (msgpack), shortening long arrays."""
import sys
from pathlib import Path

import msgpack

SRC = Path(__file__).resolve().parent.parent / 'source' / 'cdn'


def show(o, ind=0, depth=8, key=''):
    pad = '  ' * ind
    if depth == 0:
        print(pad + key + '...'); return
    if isinstance(o, dict):
        print(pad + key + '{')
        for k, v in o.items():
            show(v, ind + 1, depth - 1, f'{k}: ')
        print(pad + '}')
    elif isinstance(o, list):
        if len(o) > 6 and all(not isinstance(x, (dict, list)) for x in o):
            print(pad + key + f'[{len(o)} x] {o[:6]}...')
        else:
            print(pad + key + f'[ ({len(o)})')
            for x in o[:int(sys.argv[3]) if len(sys.argv) > 3 else 40]:
                show(x, ind + 1, depth - 1)
            print(pad + ']')
    elif isinstance(o, bytes):
        print(pad + key + f'<bytes {len(o)}>')
    else:
        print(pad + key + repr(o)[:160])


if __name__ == '__main__':
    p = next(SRC.glob(sys.argv[1] + '*.ygg'))
    show(msgpack.unpackb(p.read_bytes(), raw=False, strict_map_key=False), depth=int(sys.argv[2]) if len(sys.argv) > 2 else 8)
