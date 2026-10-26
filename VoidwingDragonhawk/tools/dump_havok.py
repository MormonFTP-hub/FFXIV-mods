"""Print the class table and object graph of a Havok tagfile inside a .pap or .sklb."""
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from havok_tagfile import HkObject, TagfileReader  # noqa: E402
from pap import Pap  # noqa: E402


def havok_of(path):
    d = Path(path).read_bytes()
    if d[:4] == b"pap ":
        return Pap.read(d).havok
    if d[:4] == b"blks":
        return d[struct.unpack_from("<I", d, 0xC)[0]:]
    return d


def short(v, depth=0, maxlist=6):
    if isinstance(v, HkObject):
        if depth > 3:
            return f"<{v.klass.name}>"
        inner = ", ".join(f"{k}={short(x, depth + 1)}" for k, x in v.items())
        return f"{v.klass.name}{{{inner}}}"
    if isinstance(v, (list, tuple)):
        if len(v) > maxlist:
            return f"[{len(v)} items: {', '.join(short(x, depth + 1) for x in v[:3])}, ...]"
        return "[" + ", ".join(short(x, depth + 1) for x in v) + "]"
    if isinstance(v, float):
        return f"{v:.4g}"
    return repr(v)


def main():
    r = TagfileReader(havok_of(sys.argv[1]))
    root = r.read()
    print("tagfile version", r.version)
    for k in r.classes[1:]:
        print(f"class {k.name} v{k.version} parent={k.parent.name if k.parent else None}")
        for m in k.members:
            print(f"    {m.name}: type=0x{m.type:x} cls={m.cls} tuple={m.tuple_size}")
    print("objects:", len(r.objects) - 1)
    for i, o in enumerate(r.objects[1:12], 1):
        print(i, short(o))


if __name__ == "__main__":
    main()
