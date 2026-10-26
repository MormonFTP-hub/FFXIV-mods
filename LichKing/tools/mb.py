"""Minimal Maya binary (.mb, IFF FOR8) reader."""
import struct, sys
from collections import Counter

GROUPS = {b'FOR8', b'LIS8', b'CAT8', b'PROP', b'FOR4', b'LIS4', b'CAT4'}


class Chunk:
    __slots__ = ('tag', 'type', 'off', 'size', 'children', 'data_off')

    def __init__(self, tag, off, size, data_off):
        self.tag, self.off, self.size, self.data_off = tag, off, size, data_off
        self.type, self.children = None, None

    def __repr__(self):
        return f'<{self.tag.decode()} {self.type.decode() if self.type else ""} @{self.off} {self.size}>'


def parse(buf, start, end):
    # data chunks are padded to 8 bytes from their data start; a group's size is exact
    out = []
    p = start
    while p + 16 <= end:
        tag = buf[p:p + 4]
        size = struct.unpack_from('>Q', buf, p + 8)[0]
        d = p + 16
        c = Chunk(tag, p, size, d)
        if tag in GROUPS:
            c.type = buf[d:d + 4]
            c.children = parse(buf, d + 4, d + size)
            p = d + size
        else:
            p = d + ((size + 7) & ~7)
        out.append(c)
    return out


def load(path):
    buf = open(path, 'rb').read()
    root = parse(buf, 0, len(buf))
    return buf, root


def cstr(buf, p):
    e = buf.index(b'\0', p)
    return buf[p:e].decode('latin1'), e + 1


if __name__ == '__main__':
    buf, root = load(sys.argv[1])
    top = root[0].children
    types = Counter()
    tags = Counter()
    for c in top:
        if c.children is not None:
            types[(c.tag, c.type)] += 1
            for k in c.children:
                tags[k.tag] += 1
        else:
            tags[('top', c.tag)] += 1
    for k, v in types.most_common():
        print(k[0].decode(), k[1].decode('latin1'), v)
    print('---')
    for k, v in tags.most_common(80):
        print(k, v)


def crea(buf, node):
    """(flags, name, parent) from a node form's CREA chunk."""
    for k in node.children:
        if k.tag == b'CREA':
            p = k.data_off
            flags = buf[p]
            name, p = cstr(buf, p + 1)
            parent = None
            if flags & 4:
                parent, p = cstr(buf, p)
            return flags, name, parent
    return None


def nodes(buf, root):
    """{name: (type, form)} for every node in the scene."""
    out = {}
    for n in root[0].children:
        if n.children is None:
            continue
        cr = crea(buf, n)
        if cr:
            out[cr[1]] = (n.type, n)
    return out


def connections(buf, root):
    """[(src_plug, dst_plug)] from the CONN group."""
    out = []
    for n in root[0].children:
        if n.children is None or n.type != b'CONS':
            continue
        for g in n.children:
            for k in g.children or []:
                p = k.data_off + 1
                a, p = cstr(buf, p)
                b, p = cstr(buf, p)
                out.append((a, b))
    return out


def attrs(buf, node):
    """[(tag, attr_name, flag, payload_bytes)] for a node form's attribute chunks."""
    out = []
    for k in node.children:
        if k.tag == b'CREA' or k.children is not None:
            continue
        p = k.data_off
        e = buf.index(b'\0', p)
        name = buf[p:e].decode('latin1')
        out.append((k.tag, name, buf[e + 1], buf[e + 2:k.data_off + k.size]))
    return out
