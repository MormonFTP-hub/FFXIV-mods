"""Read and write FFXIV .mtrl material files."""
import struct


class Mtrl:
    def __init__(self, data: bytes):
        (self.version, file_size, data_set_size, str_size, shpk_off,
         n_tex, n_uv, n_cs, add_size) = struct.unpack_from("<IHHHHBBBB", data, 0)
        p = 16
        tex = [struct.unpack_from("<HH", data, p + 4 * i) for i in range(n_tex)]
        p += 4 * n_tex
        uv = [struct.unpack_from("<HH", data, p + 4 * i) for i in range(n_uv)]
        p += 4 * n_uv
        cs = [struct.unpack_from("<HH", data, p + 4 * i) for i in range(n_cs)]
        p += 4 * n_cs
        strings = data[p:p + str_size]
        p += str_size

        def s(off):
            return strings[off:strings.index(b"\0", off)].decode()

        self.textures = [[s(o), flags] for o, flags in tex]
        self.uv_sets = [[s(o), idx] for o, idx in uv]
        self.color_sets = [[s(o), idx] for o, idx in cs]
        self.shader_package = s(shpk_off)
        self.additional = data[p:p + add_size]
        p += add_size
        self.data_set = data[p:p + data_set_size]
        p += data_set_size
        (vals_size, n_keys, n_consts, n_samplers, self.flags1, self.flags2) = struct.unpack_from("<HHHHHH", data, p)
        p += 12
        self.keys = [list(struct.unpack_from("<II", data, p + 8 * i)) for i in range(n_keys)]
        p += 8 * n_keys
        self.constants = [list(struct.unpack_from("<IHH", data, p + 8 * i)) for i in range(n_consts)]
        p += 8 * n_consts
        self.samplers = [list(struct.unpack_from("<IIB", data, p + 12 * i)) for i in range(n_samplers)]
        p += 12 * n_samplers
        self.values = list(struct.unpack_from(f"<{vals_size // 4}f", data, p))

    def constant(self, cid):
        for c_id, off, size in self.constants:
            if c_id == cid:
                return self.values[off // 4:(off + size) // 4]
        return None

    def set_constant(self, cid, vals):
        for c_id, off, size in self.constants:
            if c_id == cid:
                assert len(vals) == size // 4
                self.values[off // 4:(off + size) // 4] = vals
                return
        raise KeyError(hex(cid))

    def to_bytes(self) -> bytes:
        strings = bytearray()
        offsets = {}

        def add(s):
            if s not in offsets:
                offsets[s] = len(strings)
                strings.extend(s.encode() + b"\0")
            return offsets[s]

        tex = [(add(t), f) for t, f in self.textures]
        uv = [(add(t), i) for t, i in self.uv_sets]
        cs = [(add(t), i) for t, i in self.color_sets]
        shpk = add(self.shader_package)
        while len(strings) % 4:
            strings.append(0)
        body = bytearray()
        for o, f in tex + uv + cs:
            body += struct.pack("<HH", o, f)
        body += strings + self.additional + self.data_set
        body += struct.pack("<HHHHHH", 4 * len(self.values), len(self.keys), len(self.constants),
                            len(self.samplers), self.flags1, self.flags2)
        for k in self.keys:
            body += struct.pack("<II", *k)
        for c in self.constants:
            body += struct.pack("<IHH", *c)
        for smp in self.samplers:
            body += struct.pack("<IIB3x", *smp)
        body += struct.pack(f"<{len(self.values)}f", *self.values)
        size = 16 + len(body)
        header = struct.pack("<IHHHHBBBB", self.version, size, len(self.data_set), len(strings), shpk,
                             len(tex), len(uv), len(cs), len(self.additional))
        return header + bytes(body)


if __name__ == "__main__":
    import sys
    m = Mtrl(open(sys.argv[1], "rb").read())
    print("shader:", m.shader_package, "flags", hex(m.flags1), hex(m.flags2))
    print("textures:", m.textures)
    print("uv sets:", m.uv_sets, "color sets:", m.color_sets)
    print("additional:", m.additional.hex(), "data set bytes:", len(m.data_set))
    print("keys:", [(hex(a), hex(b)) for a, b in m.keys])
    print("samplers:", [(hex(a), hex(b), c) for a, b, c in m.samplers])
    for cid, off, size in m.constants:
        print(f"  const {cid:#010x}: {[round(v, 4) for v in m.values[off // 4:(off + size) // 4]]}")
    assert m.to_bytes() == open(sys.argv[1], "rb").read(), "round trip mismatch"
    print("round trip OK")
