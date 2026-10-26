"""Reader for Havok binary tagfiles (magic CAB00D1E D011FACE), as used by FFXIV .sklb.

Only what's needed to pull hkaSkeleton bone names, parents and reference pose.
"""
import struct

T_VOID, T_BYTE, T_INT, T_REAL, T_VEC4, T_VEC8, T_VEC12, T_VEC16, T_OBJECT, T_STRUCT, T_CSTRING = range(11)
T_MASK, T_ARRAY, T_TUPLE = 0xF, 0x10, 0x20
VEC_FLOATS = {T_VEC4: 4, T_VEC8: 8, T_VEC12: 12, T_VEC16: 16}

TAG_FILE_INFO, TAG_METADATA, TAG_OBJECT, TAG_OBJECT_REMEMBER, TAG_OBJECT_BACKREF, TAG_OBJECT_NULL, TAG_FILE_END = range(1, 8)


class HkClass:
    def __init__(self, name, version, parent):
        self.name, self.version, self.parent = name, version, parent
        self.own_members = []  # (name, type, tuple_size, class_name)

    def members(self):
        base = self.parent.members() if self.parent else []
        return base + self.own_members


class HkObject(dict):
    def __init__(self, cls):
        super().__init__()
        self.cls = cls


class ObjRef:
    def __init__(self, index):
        self.index = index


class TagfileReader:
    def __init__(self, data: bytes):
        self.d = data
        self.p = 0
        self.strings = ["", None]
        self.classes = [None]
        self.remembered = [None]
        self.version = None

    def byte(self):
        b = self.d[self.p]
        self.p += 1
        return b

    def varint(self):
        b = self.byte()
        neg = b & 1
        value = (b >> 1) & 0x3F
        shift = 6
        while b & 0x80:
            b = self.byte()
            value |= (b & 0x7F) << shift
            shift += 7
        return -value if neg else value

    def string(self):
        n = self.varint()
        if n <= 0:
            return self.strings[-n]
        s = self.d[self.p:self.p + n].decode("utf-8", "replace")
        self.p += n
        self.strings.append(s)
        return s

    def floats(self, n):
        v = struct.unpack_from(f"<{n}f", self.d, self.p)
        self.p += 4 * n
        return list(v)

    def parse(self):
        magic = struct.unpack_from("<II", self.d, 0)
        assert magic == (0xCAB00D1E, 0xD011FACE), "not a Havok binary tagfile"
        self.p = 8
        root = None
        while True:
            tag = self.varint()
            if tag == TAG_FILE_INFO:
                self.version = self.varint()
                self.remembered = [None]
            elif tag == TAG_METADATA:
                self.read_metadata()
            elif tag in (TAG_OBJECT, TAG_OBJECT_REMEMBER):
                obj = self.read_object_body(tag)
                if root is None:
                    root = obj
            elif tag == TAG_FILE_END:
                break
            else:
                raise ValueError(f"unexpected top-level tag {tag} at {self.p}")
        for obj in self.remembered[1:]:
            self.resolve(obj)
        return root

    def read_metadata(self):
        name = self.string()
        version = self.varint()
        parent = self.classes[self.varint()]
        cls = HkClass(name, version, parent)
        for _ in range(self.varint()):
            mname = self.string()
            mtype = self.varint()
            tsize = self.varint() if mtype & T_TUPLE else 0
            cname = self.string() if (mtype & T_MASK) in (T_OBJECT, T_STRUCT) else None
            cls.own_members.append((mname, mtype, tsize, cname))
        self.classes.append(cls)

    def class_by_name(self, name):
        for c in self.classes[1:]:
            if c.name == name:
                return c
        raise KeyError(name)

    def read_object_ref(self):
        # Version 3 stores pointers as indices into the list of remembered
        # top-level objects (forward references allowed); 0 is null.
        return ObjRef(self.varint())

    def resolve(self, value):
        if isinstance(value, ObjRef):
            return self.remembered[value.index] if value.index else None
        if isinstance(value, list):
            return [self.resolve(v) for v in value]
        if isinstance(value, HkObject):
            for k in value:
                value[k] = self.resolve(value[k])
        return value

    def read_object_body(self, tag):
        cls = self.classes[self.varint()]
        obj = HkObject(cls)
        if tag == TAG_OBJECT_REMEMBER:
            self.remembered.append(obj)
        self.read_members_into(obj, cls)
        return obj

    def read_bitfield(self, n):
        nbytes = (n + 7) // 8
        bits = self.d[self.p:self.p + nbytes]
        self.p += nbytes
        return [(bits[i >> 3] >> (i & 7)) & 1 for i in range(n)]

    def read_members_into(self, obj, cls):
        members = cls.members()
        present = self.read_bitfield(len(members))
        for (mname, mtype, tsize, cname), here in zip(members, present):
            if here:
                obj[mname] = self.read_value(mtype, tsize, cname)

    def read_value(self, mtype, tsize, cname):
        if mtype & T_ARRAY:
            return self.read_array(mtype & ~T_ARRAY, self.varint(), cname)
        if mtype & T_TUPLE:
            return self.read_array(mtype & ~T_TUPLE, tsize, cname)
        base = mtype & T_MASK
        if base == T_BYTE:
            return self.byte()
        if base == T_INT:
            return self.varint()
        if base == T_REAL:
            return self.floats(1)[0]
        if base in VEC_FLOATS:
            return self.floats(VEC_FLOATS[base])
        if base == T_OBJECT:
            return self.read_object_ref()
        if base == T_STRUCT:
            obj = HkObject(self.class_by_name(cname))
            self.read_members_into(obj, obj.cls)
            return obj
        if base == T_CSTRING:
            return self.string()
        raise ValueError(f"unsupported member type {mtype}")

    def read_array(self, etype, count, cname):
        base = etype & T_MASK
        if base == T_BYTE:
            v = list(self.d[self.p:self.p + count])
            self.p += count
            return v
        if base == T_INT:
            if self.version >= 3:
                self.varint()  # stored element width hint
            return [self.varint() for _ in range(count)]
        if base == T_REAL:
            return self.floats(count)
        if base in VEC_FLOATS:
            n = VEC_FLOATS[base]
            flat = self.floats(n * count)
            return [flat[i * n:(i + 1) * n] for i in range(count)]
        if base == T_OBJECT:
            return [self.read_object_ref() for _ in range(count)]
        if base == T_CSTRING:
            return [self.string() for _ in range(count)]
        if base == T_STRUCT:
            cls = self.class_by_name(cname)
            items = [HkObject(cls) for _ in range(count)]
            members = cls.members()
            present = self.read_bitfield(len(members))
            for (mname, mtype, tsize, mcname), here in zip(members, present):
                if not here:
                    continue
                if mtype & (T_ARRAY | T_TUPLE) or (mtype & T_MASK) == T_STRUCT:
                    for it in items:
                        it[mname] = self.read_value(mtype, tsize, mcname)
                else:
                    col = self.read_array(mtype, count, mcname)
                    for it, v in zip(items, col):
                        it[mname] = v
            return items
        raise ValueError(f"unsupported array type {etype}")


def read_sklb_skeleton(sklb: bytes):
    """Returns (names, parents, ref_pose) for the main hkaSkeleton in an FFXIV .sklb.
    ref_pose entries are (translation xyz, rotation xyzw quat, scale xyz)."""
    hk_off = struct.unpack_from("<I", sklb, 0x0C)[0] if sklb[4:8] in (b"0031", b"0032", b"0033") else struct.unpack_from("<H", sklb, 0x0A)[0]
    r = TagfileReader(sklb[hk_off:])
    root = r.parse()
    skel = None
    for nv in root["namedVariants"]:
        var = nv.get("variant")
        if var is not None and var.cls.name == "hkaAnimationContainer":
            skel = var["skeletons"][0]
            break
    names = [b["name"] for b in skel["bones"]]
    parents = skel["parentIndices"]
    pose = []
    for t in skel["referencePose"]:
        pose.append((t[0:3], t[4:8], t[8:11]))
    return names, parents, pose


if __name__ == "__main__":
    import sys
    data = open(sys.argv[1], "rb").read()
    names, parents, pose = read_sklb_skeleton(data)
    print(len(names), "bones")
    for i, (n, p, t) in enumerate(zip(names, parents, pose)):
        print(i, n, "parent", p, "t", [round(x, 4) for x in t[0]], "q", [round(x, 4) for x in t[1]])
