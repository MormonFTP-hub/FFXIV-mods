"""Havok binary tagfile (version 3, as shipped in FFXIV .sklb/.pap) reader and writer.

The reader keeps everything needed to write the file back byte for byte: class
definitions in stream order, which members of each object are present, and the
integer-width hint stored with integer arrays. Objects are HkObject dicts whose
`klass` is a Klass; object references are the HkObject itself (or None).

Write order follows Havok's own writer: the root first, then a stack of pending
references where an object that is referenced again moves to the top.
"""
import struct

T_VOID, T_BYTE, T_INT, T_REAL, T_VEC4, T_VEC8, T_VEC12, T_VEC16, T_OBJECT, T_STRUCT, T_CSTRING = range(0, 11)
T_ARRAY, T_TUPLE = 0x10, 0x20
VEC_LEN = {T_VEC4: 4, T_VEC8: 8, T_VEC12: 12, T_VEC16: 16}
MAGIC = bytes.fromhex("1e0db0cacefa11d0")


class Member:
    def __init__(self, name, type_, cls=None, tuple_size=0):
        self.name, self.type, self.cls, self.tuple_size = name, type_, cls, tuple_size

    @property
    def base(self):
        return self.type & 0xF


class Klass:
    def __init__(self, name, version, parent, members):
        self.name, self.version, self.parent, self.members = name, version, parent, members

    def all_members(self):
        return (self.parent.all_members() if self.parent else []) + self.members

    def __repr__(self):
        return f"Klass({self.name})"


class HkObject(dict):
    def __init__(self, klass, values=None):
        super().__init__()
        self.klass = klass
        if values:
            self.update(values)

    def __hash__(self):
        return id(self)

    def __eq__(self, other):
        return self is other


class IntArray(list):
    """List of ints that remembers the width hint written before it (v3)."""
    def __init__(self, items=(), width=4):
        super().__init__(items)
        self.width = width


class Tagfile:
    """Parsed file: version, classes (stream order) and objects (stream order); root = objects[0]."""
    def __init__(self, version=3):
        self.version = version
        self.classes = []
        self.objects = []
        self.trailer = b""

    @property
    def root(self):
        return self.objects[0]

    def klass(self, name):
        return next(k for k in self.classes if k.name == name)


# ---------------------------------------------------------------- reading

class _Reader:
    def __init__(self, data):
        assert data[:8] == MAGIC, "not a binary tagfile"
        self.d, self.p = data, 8
        self.strings = ["", None]
        self.classes = [None]
        self.by_name = {}
        self.refs = []  # (container, key, index) to resolve
        self.version = None

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
        return list(v)

    def string(self):
        n = self.int()
        if n <= 0:
            return self.strings[-n]
        s = self.d[self.p:self.p + n].decode("latin-1")
        self.p += n
        self.strings.append(s)
        return s

    def metadata(self):
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
        return k

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
        if m.type & T_ARRAY:
            return self.array(m.base, m, self.int())
        if m.type & T_TUPLE:
            return self.array(m.base, m, m.tuple_size)
        return self.scalar(m.base, m)

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
            return _Ref(self.int())
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
            width = self.int() if self.version >= 3 else 4
            return IntArray([self.int() for _ in range(n)], width)
        if base == T_REAL:
            return self.floats(n)
        if base in VEC_LEN:
            k = VEC_LEN[base]
            f = self.floats(n * k)
            return [f[i * k:(i + 1) * k] for i in range(n)]
        if base == T_OBJECT:
            return [_Ref(self.int()) for _ in range(n)]
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
                    vals = [self.array(mem.base, mem, self.int()) for _ in range(n)]
                elif mem.type & T_TUPLE:
                    flat = self.array(mem.base, mem, n * mem.tuple_size)
                    t = mem.tuple_size
                    vals = [flat[i * t:(i + 1) * t] for i in range(n)]
                else:
                    vals = self.array(mem.base, mem, n)
                for o, v in zip(objs, vals):
                    o[mem.name] = v
            return objs
        raise ValueError("bad array type %d at %d" % (base, self.p))


class _Ref:
    def __init__(self, index):
        self.index = index


def read(data):
    r = _Reader(data)
    tf = Tagfile()
    while r.p < len(r.d):
        tag = r.int()
        if tag == 1:
            r.version = tf.version = r.int()
        elif tag == 2:
            tf.classes.append(r.metadata())
        elif tag in (3, 4):
            assert tag == 4, "only remembered objects are expected"
            tf.objects.append(r.object_data(r.classes[r.int()]))
        elif tag == 7:
            break
        else:
            raise ValueError("bad top tag %d at %d" % (tag, r.p))
    tf.trailer = r.d[r.p:]

    def resolve(v):
        if isinstance(v, _Ref):
            return tf.objects[v.index - 1] if v.index > 0 else None
        if isinstance(v, HkObject):
            for k in list(v.keys()):
                v[k] = resolve(v[k])
            return v
        if isinstance(v, IntArray):
            return v
        if isinstance(v, list):
            return [resolve(x) for x in v]
        return v

    for o in tf.objects:
        resolve(o)
    return tf


# ---------------------------------------------------------------- writing

def _refs_of(obj):
    """Objects referenced by obj's members (not inside embedded structs' order? yes, in member order)."""
    out = []

    def walk(v):
        if isinstance(v, HkObject):
            out.append(v)
        elif isinstance(v, list) and not isinstance(v, IntArray):
            for x in v:
                walk(x)

    def walk_struct(o):
        for m in o.klass.all_members():
            if m.name not in o:
                continue
            v = o[m.name]
            if m.base == T_OBJECT:
                walk(v)
            elif m.base == T_STRUCT:
                for s in (v if isinstance(v, list) else [v]):
                    walk_struct(s)

    walk_struct(obj)
    return out


def write_order(root):
    order, pending = [], []
    seen = set()

    def visit(o):
        order.append(o)
        seen.add(id(o))
        for r in _refs_of(o):
            if id(r) in seen:
                continue
            if r in pending:
                pending.remove(r)
            pending.append(r)

    visit(root)
    while pending:
        visit(pending.pop())
    return order


class _Writer:
    def __init__(self, version):
        self.out = bytearray(MAGIC)
        self.version = version
        self.strings = {"": 0, None: 1}
        self.class_index = {}
        self.obj_index = {}

    def int(self, v):
        neg = 1 if v < 0 else 0
        v = -v if neg else v
        b = ((v & 0x3F) << 1) | neg
        v >>= 6
        if v:
            b |= 0x80
        self.out.append(b)
        while v:
            b = v & 0x7F
            v >>= 7
            if v:
                b |= 0x80
            self.out.append(b)

    def floats(self, vals):
        self.out += struct.pack("<%df" % len(vals), *vals)

    def string(self, s):
        if s in self.strings:
            self.int(-self.strings[s])
            return
        b = s.encode("latin-1")
        self.int(len(b))
        self.out += b
        self.strings[s] = len(self.strings)

    def metadata(self, k):
        self.int(2)
        self.string(k.name)
        self.int(k.version)
        self.int(self.class_index[id(k.parent)] if k.parent else 0)
        self.int(len(k.members))
        for m in k.members:
            self.string(m.name)
            self.int(m.type)
            if m.base in (T_OBJECT, T_STRUCT):
                self.string(m.cls)
            if m.type & T_TUPLE:
                self.int(m.tuple_size)
        self.class_index[id(k)] = len(self.class_index) + 1

    def bitfield(self, bits):
        nb = (len(bits) + 7) // 8
        b = bytearray(nb)
        for i, x in enumerate(bits):
            if x:
                b[i >> 3] |= 1 << (i & 7)
        self.out += b

    def object_data(self, obj):
        members = obj.klass.all_members()
        self.bitfield([m.name in obj for m in members])
        for m in members:
            if m.name in obj:
                self.value(m, obj[m.name])

    def ref(self, o):
        self.int(self.obj_index[id(o)] if o is not None else 0)

    def value(self, m, v):
        if m.type & T_ARRAY:
            self.int(len(v))
            self.array(m.base, m, v)
        elif m.type & T_TUPLE:
            assert len(v) == m.tuple_size
            self.array(m.base, m, v)
        else:
            self.scalar(m.base, m, v)

    def scalar(self, base, m, v):
        if base == T_BYTE:
            self.out.append(v)
        elif base == T_INT:
            self.int(v)
        elif base == T_REAL:
            self.floats([v])
        elif base in VEC_LEN:
            self.floats(v)
        elif base == T_OBJECT:
            self.ref(v)
        elif base == T_STRUCT:
            self.object_data(v)
        elif base == T_CSTRING:
            self.string(v)
        else:
            raise ValueError(base)

    def array(self, base, m, v):
        if base == T_BYTE:
            self.out += bytes(v)
        elif base == T_INT:
            if self.version >= 3:
                self.int(getattr(v, "width", 4))
            for x in v:
                self.int(x)
        elif base == T_REAL:
            self.floats(v)
        elif base in VEC_LEN:
            for x in v:
                self.floats(x)
        elif base == T_OBJECT:
            for x in v:
                self.ref(x)
        elif base == T_CSTRING:
            for x in v:
                self.string(x)
        elif base == T_STRUCT:
            members = self._struct_members(m.cls, v)
            present = [any(mem.name in o for o in v) for mem in members]
            self.bitfield(present)
            for mem, p in zip(members, present):
                if not p:
                    continue
                if mem.type & T_ARRAY:
                    for o in v:
                        x = o.get(mem.name, [])
                        self.int(len(x))
                        self.array(mem.base, mem, x)
                elif mem.type & T_TUPLE:
                    flat = []
                    for o in v:
                        flat += list(o[mem.name])
                    self.array(mem.base, mem, flat)
                else:
                    self.array(mem.base, mem, [o.get(mem.name, _default(mem)) for o in v])
        else:
            raise ValueError(base)

    def _struct_members(self, cls, v):
        k = v[0].klass if v else self._by_name[cls]
        return k.all_members()


def _default(m):
    return {T_BYTE: 0, T_INT: 0, T_REAL: 0.0, T_CSTRING: None, T_OBJECT: None}.get(m.base)


def write(tf, order=None):
    w = _Writer(tf.version)
    w._by_name = {k.name: k for k in tf.classes}
    w.int(1)
    w.int(tf.version)
    for k in tf.classes:
        w.metadata(k)
    order = order or write_order(tf.root)
    for i, o in enumerate(order, 1):
        w.obj_index[id(o)] = i
    for o in order:
        w.int(4)
        w.int(w.class_index[id(o.klass)])
        w.object_data(o)
    w.int(7)
    return bytes(w.out) + tf.trailer
