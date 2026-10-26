"""FFXIV .mtrl reader/writer (enough to inspect and re-target texture paths)."""
import struct


def _cstr(buf, off):
    end = buf.index(b'\0', off)
    return buf[off:end].decode('utf-8')


class Mtrl:
    @classmethod
    def parse(cls, data):
        m = cls()
        (m.version, file_size, dataset_size, strtab_size, shpk_off,
         tex_count, uvset_count, colorset_count, add_size) = struct.unpack_from('<IHHHHBBBB', data, 0)
        p = 16
        tex = [struct.unpack_from('<HH', data, p + 4 * i) for i in range(tex_count)]; p += 4 * tex_count
        uvs = [struct.unpack_from('<HH', data, p + 4 * i) for i in range(uvset_count)]; p += 4 * uvset_count
        cols = [struct.unpack_from('<HH', data, p + 4 * i) for i in range(colorset_count)]; p += 4 * colorset_count
        strtab = data[p:p + strtab_size]; p += strtab_size
        m.additional = data[p:p + add_size]; p += add_size
        m.dataset = data[p:p + dataset_size]; p += dataset_size
        m.textures = [[_cstr(strtab, o), f] for o, f in tex]
        m.uvsets = [[_cstr(strtab, o), i] for o, i in uvs]
        m.colorsets = [[_cstr(strtab, o), i] for o, i in cols]
        m.shader = _cstr(strtab, shpk_off)
        sv_size, key_count, const_count, samp_count, m.flags = struct.unpack_from('<HHHHI', data, p); p += 12
        m.keys = [list(struct.unpack_from('<II', data, p + 8 * i)) for i in range(key_count)]; p += 8 * key_count
        consts = [struct.unpack_from('<IHH', data, p + 8 * i) for i in range(const_count)]; p += 8 * const_count
        m.samplers = [list(struct.unpack_from('<IIB', data, p + 12 * i)) for i in range(samp_count)]; p += 12 * samp_count
        values = data[p:p + sv_size]
        m.constants = [[cid, list(struct.unpack_from('<%df' % (size // 4), values, off))] for cid, off, size in consts]
        m.tail = data[p + sv_size:]
        return m

    def serialize(self):
        strtab = bytearray()
        def add(s):
            off = len(strtab); strtab.extend(s.encode('utf-8') + b'\0'); return off
        tex_offs = [(add(t), f) for t, f in self.textures]
        uv_offs = [(add(n), i) for n, i in self.uvsets]
        col_offs = [(add(n), i) for n, i in self.colorsets]
        shpk_off = add(self.shader)
        while len(strtab) % 4:
            strtab.append(0)
        values = bytearray(); consts = []
        for cid, vals in self.constants:
            consts.append((cid, len(values), 4 * len(vals)))
            values.extend(struct.pack('<%df' % len(vals), *vals))
        body = bytearray()
        for o, f in tex_offs: body += struct.pack('<HH', o, f)
        for o, i in uv_offs: body += struct.pack('<HH', o, i)
        for o, i in col_offs: body += struct.pack('<HH', o, i)
        body += strtab + self.additional + self.dataset
        body += struct.pack('<HHHHI', len(values), len(self.keys), len(consts), len(self.samplers), self.flags)
        for k in self.keys: body += struct.pack('<II', *k)
        for c in consts: body += struct.pack('<IHH', *c)
        for s in self.samplers: body += struct.pack('<IIB3x', *s)
        body += values
        size = 16 + len(body)
        head = struct.pack('<IHHHHBBBB', self.version, size & 0xFFFF, len(self.dataset), len(strtab), shpk_off,
                           len(tex_offs), len(uv_offs), len(col_offs), len(self.additional))
        return bytes(head + body)

    def dump(self):
        print('shader', self.shader, 'flags 0x%x' % self.flags, 'additional', self.additional.hex(), 'dataset', len(self.dataset))
        for t in self.textures: print('  tex', t)
        print('  uvsets', self.uvsets, 'colorsets', self.colorsets)
        for k in self.keys: print('  key 0x%08X = 0x%08X' % tuple(k))
        for s in self.samplers: print('  sampler 0x%08X flags 0x%08X tex %d' % tuple(s))
        for c in self.constants: print('  const 0x%08X' % c[0], [round(v, 4) for v in c[1]])
