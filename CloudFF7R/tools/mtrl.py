"""Read/write FFXIV .mtrl material files (Dawntrail layout)."""
import struct


class Mtrl:
    def __init__(self):
        self.version = 0x01030000
        self.textures = []  # [(path, flags)]
        self.uv_sets = []  # [(name, index, unk)]
        self.color_sets = []  # [(name, index, unk)]
        self.shader = ""
        self.additional = b""
        self.color_table = b""
        self.shader_keys = []  # [(category, value)]
        self.constants = []  # [(id, offset, size)]
        self.samplers = []  # [(sampler_id, flags, texture_index)]
        self.shader_values = b""
        self.flags = 0  # shader package flags (backfaces / transparency)
        self.unk2 = 0

    @staticmethod
    def parse(data):
        m = Mtrl()
        (m.version, file_size, data_set_size, string_size, shader_off,
         ntex, nuv, ncs, add_size) = struct.unpack_from("<IHHHHBBBB", data, 0)
        p = 16
        tex = [struct.unpack_from("<HH", data, p + 4 * i) for i in range(ntex)]
        p += 4 * ntex
        uvs = [struct.unpack_from("<HBB", data, p + 4 * i) for i in range(nuv)]
        p += 4 * nuv
        css = [struct.unpack_from("<HBB", data, p + 4 * i) for i in range(ncs)]
        p += 4 * ncs
        strings = data[p:p + string_size]
        p += string_size

        def s(off):
            return strings[off:strings.index(b"\0", off)].decode()

        m.textures = [(s(o), f) for o, f in tex]
        m.uv_sets = [(s(o), i, u) for o, i, u in uvs]
        m.color_sets = [(s(o), i, u) for o, i, u in css]
        m.shader = s(shader_off)
        m.additional = data[p:p + add_size]
        p += add_size
        m.color_table = data[p:p + data_set_size]
        p += data_set_size
        (sv_size, nkeys, nconst, nsamp, m.flags, m.unk2) = struct.unpack_from("<HHHHHH", data, p)
        p += 12
        # Flags is stored as a 32-bit value spanning the last two fields.
        m.shader_keys = [struct.unpack_from("<II", data, p + 8 * i) for i in range(nkeys)]
        p += 8 * nkeys
        m.constants = [struct.unpack_from("<IHH", data, p + 8 * i) for i in range(nconst)]
        p += 8 * nconst
        m.samplers = [struct.unpack_from("<IIB3x", data, p + 12 * i) for i in range(nsamp)]
        p += 12 * nsamp
        m.shader_values = data[p:p + sv_size]
        p += sv_size
        m.trailing = data[p:]
        return m

    def build(self):
        strings = bytearray()
        offs = {}

        def add(sv):
            if sv not in offs:
                offs[sv] = len(strings)
                strings.extend(sv.encode() + b"\0")
            return offs[sv]

        tex = [(add(t), f) for t, f in self.textures]
        uvs = [(add(n), i, u) for n, i, u in self.uv_sets]
        css = [(add(n), i, u) for n, i, u in self.color_sets]
        shader_off = add(self.shader)
        while len(strings) % 4:
            strings.append(0)
        body = bytearray()
        for o, f in tex:
            body += struct.pack("<HH", o, f)
        for o, i, u in uvs:
            body += struct.pack("<HBB", o, i, u)
        for o, i, u in css:
            body += struct.pack("<HBB", o, i, u)
        body += strings
        body += self.additional
        body += self.color_table
        body += struct.pack("<HHHHHH", len(self.shader_values), len(self.shader_keys), len(self.constants),
                            len(self.samplers), self.flags, self.unk2)
        for k in self.shader_keys:
            body += struct.pack("<II", *k)
        for c in self.constants:
            body += struct.pack("<IHH", *c)
        for sid, fl, ti in self.samplers:
            body += struct.pack("<IIB3x", sid, fl, ti)
        body += self.shader_values
        header = struct.pack("<IHHHHBBBB", self.version, 16 + len(body), len(self.color_table), len(strings),
                             shader_off, len(tex), len(uvs), len(css), len(self.additional))
        return header + bytes(body)

    def constant(self, cid):
        for i, o, s in self.constants:
            if i == cid:
                return struct.unpack_from(f"<{s // 4}f", self.shader_values, o)
        return None

    def set_constant(self, cid, values):
        for i, o, s in self.constants:
            if i == cid:
                buf = bytearray(self.shader_values)
                struct.pack_into(f"<{s // 4}f", buf, o, *values)
                self.shader_values = bytes(buf)
                return
        off = len(self.shader_values)
        self.shader_values += struct.pack(f"<{len(values)}f", *values)
        self.constants.append((cid, off, 4 * len(values)))

    def describe(self):
        out = [f"shader={self.shader} flags=0x{self.flags:04x} unk2=0x{self.unk2:04x} colortable={len(self.color_table)}B additional={self.additional.hex()}"]
        for t in self.textures:
            out.append(f"  tex {t[0]} flags=0x{t[1]:04x}")
        for u in self.uv_sets:
            out.append(f"  uvset {u}")
        for c in self.color_sets:
            out.append(f"  colorset {c}")
        for k in self.shader_keys:
            out.append(f"  key 0x{k[0]:08X} = 0x{k[1]:08X}")
        for c in self.constants:
            out.append(f"  const 0x{c[0]:08X} = {[round(v, 4) for v in self.constant(c[0])]}")
        for s in self.samplers:
            out.append(f"  sampler 0x{s[0]:08X} flags=0x{s[1]:08X} tex={s[2]}")
        return "\n".join(out)
