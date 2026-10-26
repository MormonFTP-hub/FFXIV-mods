"""Minimal FFXIV .mtrl reader/writer (Dawntrail layout, version 0x01030000)."""
import struct
import sys


class Mtrl:
    @classmethod
    def read(cls, path):
        d = open(path, "rb").read()
        m = cls()
        (m.version, file_size, ds_size, st_size, shpk_off, tex_n, uv_n, cs_n, add_size) = struct.unpack_from("<IHHHHBBBB", d, 0)
        o = 16
        tex = [struct.unpack_from("<HH", d, o + i * 4) for i in range(tex_n)]
        o += tex_n * 4
        uvs = [struct.unpack_from("<HH", d, o + i * 4) for i in range(uv_n)]
        o += uv_n * 4
        css = [struct.unpack_from("<HH", d, o + i * 4) for i in range(cs_n)]
        o += cs_n * 4
        strings = d[o:o + st_size]
        o += st_size

        def s(off):
            return strings[off:strings.index(b"\0", off)].decode()

        m.textures = [[s(off), flags] for off, flags in tex]
        m.uv_sets = [[s(off), idx] for off, idx in uvs]
        m.color_sets = [[s(off), idx] for off, idx in css]
        m.shader = s(shpk_off)
        m.additional = d[o:o + add_size]
        o += add_size
        m.colorset = d[o:o + ds_size]
        o += ds_size
        val_size, key_n, const_n, samp_n, m.flags1, m.flags2 = struct.unpack_from("<HHHHHH", d, o)
        o += 12
        m.keys = [list(struct.unpack_from("<II", d, o + i * 8)) for i in range(key_n)]
        o += key_n * 8
        m.constants = [list(struct.unpack_from("<IHH", d, o + i * 8)) for i in range(const_n)]
        o += const_n * 8
        m.samplers = [list(struct.unpack_from("<IIB3x", d, o + i * 12)) for i in range(samp_n)]
        o += samp_n * 12
        m.values = d[o:o + val_size]
        o += val_size
        m.tail = d[o:]
        return m

    def write(self, path):
        strings = bytearray()

        def add(t):
            off = len(strings)
            strings.extend(t.encode() + b"\0")
            return off

        tex = [(add(t), f) for t, f in self.textures]
        uvs = [(add(t), i) for t, i in self.uv_sets]
        css = [(add(t), i) for t, i in self.color_sets]
        shpk = add(self.shader)
        while len(strings) % 4:
            strings.append(0)
        body = bytearray()
        for off, f in tex:
            body += struct.pack("<HH", off, f)
        for off, i in uvs:
            body += struct.pack("<HH", off, i)
        for off, i in css:
            body += struct.pack("<HH", off, i)
        body += strings + self.additional + self.colorset
        body += struct.pack("<HHHHHH", len(self.values), len(self.keys), len(self.constants), len(self.samplers), self.flags1, self.flags2)
        for k in self.keys:
            body += struct.pack("<II", *k)
        for c in self.constants:
            body += struct.pack("<IHH", *c)
        for smp in self.samplers:
            body += struct.pack("<IIB3x", *smp)
        body += self.values + self.tail
        size = 16 + len(body)
        head = struct.pack("<IHHHHBBBB", self.version, size & 0xFFFF, len(self.colorset), len(strings), shpk,
                           len(self.textures), len(self.uv_sets), len(self.color_sets), len(self.additional))
        open(path, "wb").write(head + body)

    def set_constant(self, cid, values):
        """Set a shader constant, adding it (values appended to the value list) when the material lacks it."""
        data = struct.pack(f"<{len(values)}f", *values)
        for c in self.constants:
            if c[0] == cid:
                assert c[2] == len(data), (hex(cid), c[2], len(data))
                self.values = self.values[:c[1]] + data + self.values[c[1] + c[2]:]
                return
        self.constants.append([cid, len(self.values), len(data)])
        self.values += data

    def dump(self):
        print("shader:", self.shader, "flags", hex(self.flags1), hex(self.flags2))
        for t in self.textures:
            print("  tex", t[0], hex(t[1]))
        print("  uv", self.uv_sets, "cs", self.color_sets, "additional", self.additional.hex(), "colorset bytes", len(self.colorset))
        print("  keys", [(hex(a), hex(b)) for a, b in self.keys])
        vals = struct.unpack(f"<{len(self.values) // 4}f", self.values)
        for cid, off, sz in self.constants:
            print("  const", hex(cid), [round(v, 4) for v in vals[off // 4:(off + sz) // 4]])
        for sid, fl, ti in self.samplers:
            print("  sampler", hex(sid), hex(fl), "tex", ti)
        print("  tail", len(self.tail))


if __name__ == "__main__":
    Mtrl.read(sys.argv[1]).dump()
