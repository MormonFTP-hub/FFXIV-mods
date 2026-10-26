"""Minimal reader for Havok binary tagfiles (the format inside FFXIV .sklb files).

Only what we need: walk the object graph and pull hkaSkeleton bone names,
parent indices and reference pose.
"""
import struct

T_BYTE, T_INT, T_REAL, T_VEC4, T_VEC8, T_VEC12, T_VEC16, T_OBJECT, T_STRUCT, T_CSTRING = range(1, 11)
T_ARRAY, T_TUPLE = 0x10, 0x20
VEC_LEN = {T_VEC4: 4, T_VEC8: 8, T_VEC12: 12, T_VEC16: 16}


class Member:
    def __init__(self, name, type_, cls, tuple_size):
        self.name, self.type, self.cls, self.tuple_size = name, type_, cls, tuple_size


class Klass:
    def __init__(self, name, version, parent, members):
        self.name, self.version, self.parent, self.members = name, version, parent, members

    def all_members(self):
        return (self.parent.all_members() if self.parent else []) + self.members


class HkObject(dict):
    def __init__(self, klass):
        super().__init__()
        self.klass = klass


class TagfileReader:
    def __init__(self, data):
        assert data[:8] == bytes.fromhex("1e0db0cacefa11d0"), "not a binary tagfile"
        self.d, self.p = data, 8
        self.strings = ["", None]
        self.classes = [None]
        self.objects = [None]
        self.by_name = {}
        self.version = None

    # primitives
    def byte(self):
        b = self.d[self.p]
        self.p += 1
        return b

    def int(self):
        b = self.byte()
        neg = b & 1
        v = (b >> 1) & 0x3F
        shift = 6
        while b & 0x80:
            b = self.byte()
            v |= (b & 0x7F) << shift
            shift += 7
        return -v if neg else v

    def floats(self, n):
        v = struct.unpack_from("<%df" % n, self.d, self.p)
        self.p += 4 * n
        return v

    def string(self):
        n = self.int()
        if n <= 0:
            return self.strings[-n]
        s = self.d[self.p:self.p + n].decode("latin-1")
        self.p += n
        self.strings.append(s)
        return s

    # structure
    def read_metadata(self):
        name = self.string()
        version = self.int()
        parent = self.classes[self.int()]
        members = []
        for _ in range(self.int()):
            mname = self.string()
            mtype = self.int()
            cls = self.string() if (mtype & 0xF) in (T_OBJECT, T_STRUCT) else None
            tsize = self.int() if mtype & T_TUPLE else 0
            members.append(Member(mname, mtype, cls, tsize))
        k = Klass(name, version, parent, members)
        self.classes.append(k)
        self.by_name[name] = k

    def bitfield(self, n):
        nb = (n + 7) // 8
        bits = self.d[self.p:self.p + nb]
        self.p += nb
        return [(bits[i >> 3] >> (i & 7)) & 1 for i in range(n)]

    def object_data(self, klass):
        obj = HkObject(klass)
        members = klass.all_members()
        for m, present in zip(members, self.bitfield(len(members))):
            if present:
                obj[m.name] = self.value(m)
        return obj

    def value(self, m):
        base = m.type & 0xF
        if m.type & T_ARRAY:
            return self.array(base, m, self.int())
        if m.type & T_TUPLE:
            return self.array(base, m, m.tuple_size)
        return self.scalar(base, m)

    def scalar(self, base, m):
        if base == T_BYTE:
            return self.byte()
        if base == T_INT:
            return self.int()
        if base == T_REAL:
            return self.floats(1)[0]
        if base in VEC_LEN:
            return self.floats(VEC_LEN[base])
        if base == T_OBJECT:
            return self.object()
        if base == T_STRUCT:
            return self.object_data(self.by_name[m.cls])
        if base == T_CSTRING:
            return self.string()
        raise ValueError("bad type %d at %d" % (base, self.p))

    def array(self, base, m, n):
        if base == T_BYTE:
            v = list(self.d[self.p:self.p + n])
            self.p += n
            return v
        if base == T_INT:
            if self.version >= 3:
                self.int()  # stored integer width hint
            return [self.int() for _ in range(n)]
        if base == T_REAL:
            return list(self.floats(n))
        if base in VEC_LEN:
            k = VEC_LEN[base]
            f = self.floats(n * k)
            return [f[i * k:(i + 1) * k] for i in range(n)]
        if base == T_OBJECT:
            return [self.object() for _ in range(n)]
        if base == T_CSTRING:
            return [self.string() for _ in range(n)]
        if base == T_STRUCT:
            klass = self.by_name[m.cls]
            objs = [HkObject(klass) for _ in range(n)]
            members = klass.all_members()
            for mem, present in zip(members, self.bitfield(len(members))):
                if not present:
                    continue
                if mem.type & T_ARRAY:
                    vals = [self.array(mem.type & 0xF, mem, self.int()) for _ in range(n)]
                elif mem.type & T_TUPLE:
                    vals = self.array_tuple(mem, n)
                else:
                    vals = self.array(mem.type & 0xF, mem, n)
                for o, v in zip(objs, vals):
                    o[mem.name] = v
            return objs
        raise ValueError("bad array type %d at %d" % (base, self.p))

    def array_tuple(self, mem, n):
        flat = self.array(mem.type & 0xF, mem, n * mem.tuple_size)
        t = mem.tuple_size
        return [flat[i * t:(i + 1) * t] for i in range(n)]

    def object(self):
        # Object-typed members hold an index into the list of remembered objects;
        # the objects themselves are written as top-level records. Resolved in read().
        return ObjRef(self.int())

    def read(self):
        while self.p < len(self.d):
            tag = self.int()
            if tag == 1:
                self.version = self.int()
            elif tag == 2:
                self.read_metadata()
            elif tag in (3, 4):
                klass = self.classes[self.int()]
                self.objects.append(self.object_data(klass))
            elif tag == 7:
                break
            else:
                raise ValueError("bad top tag %d at %d" % (tag, self.p))
        for o in self.objects[1:]:
            self._resolve(o)
        return self.objects[1]

    def _resolve(self, v):
        if isinstance(v, ObjRef):
            return self.objects[v.index] if v.index > 0 else None
        if isinstance(v, HkObject):
            for k in list(v.keys()):
                v[k] = self._resolve(v[k])
            return v
        if isinstance(v, list):
            return [self._resolve(x) for x in v]
        return v


class ObjRef:
    def __init__(self, index):
        self.index = index

    def __repr__(self):
        return "ObjRef(%d)" % self.index


def find_objects(obj, class_name, out=None, seen=None):
    out = [] if out is None else out
    seen = set() if seen is None else seen
    if isinstance(obj, HkObject):
        if id(obj) in seen:
            return out
        seen.add(id(obj))
        if obj.klass.name == class_name:
            out.append(obj)
        for v in obj.values():
            find_objects(v, class_name, out, seen)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            find_objects(v, class_name, out, seen)
    return out


def find_skeletons(obj, out=None, seen=None):
    out = [] if out is None else out
    seen = set() if seen is None else seen
    if isinstance(obj, HkObject):
        if id(obj) in seen:
            return out
        seen.add(id(obj))
        if obj.klass.name == "hkaSkeleton":
            out.append(obj)
        for v in obj.values():
            find_skeletons(v, out, seen)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            find_skeletons(v, out, seen)
    return out


def read_sklb(path):
    """Return list of (name, parent_index, translation(3), rotation quat xyzw, scale(3))."""
    d = open(path, "rb").read()
    assert d[:4] == b"blks"
    havok_off = struct.unpack_from("<I", d, 0xC)[0]
    root = TagfileReader(d[havok_off:]).read()
    # The file's own skeleton is the one in the animation container; other skeletons
    # in the file (parent races) are only referenced by skeleton mappers.
    containers = [o for o in find_objects(root, "hkaAnimationContainer")]
    sk = containers[0]["skeletons"][0] if containers else find_skeletons(root)[0]
    names = [b["name"] for b in sk["bones"]]
    parents = sk["parentIndices"]
    pose = sk["referencePose"]  # each is 12 floats: t(4) r(4) s(4)
    bones = []
    for i, n in enumerate(names):
        p = pose[i]
        bones.append((n, parents[i], tuple(p[0:3]), tuple(p[4:8]), tuple(p[8:11])))
    return bones


if __name__ == "__main__":
    import sys
    for b in read_sklb(sys.argv[1]):
        print(b)
