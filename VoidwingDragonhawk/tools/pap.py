"""FFXIV .pap container: header, animation info table, Havok blob and TMB timelines."""
import struct
from dataclasses import dataclass, field


@dataclass
class PapAnim:
    name: str
    kind: int        # u16 after the name (0 for body animations)
    havok_index: int
    is_face: int


@dataclass
class Pap:
    version: int
    model_id: int
    model_type: int
    variant: int
    anims: list = field(default_factory=list)
    havok: bytes = b""
    timelines: list = field(default_factory=list)  # raw TMB blobs, one per anim

    @classmethod
    def read(cls, data):
        magic, version, count, model_id, model_type, variant, info_off, havok_off, tl_off = struct.unpack_from("<4sIHHBBIII", data, 0)
        assert magic == b"pap ", magic
        p = cls(version, model_id, model_type, variant)
        for i in range(count):
            o = info_off + i * 40
            name = data[o:o + 32].split(b"\0")[0].decode()
            kind, idx, face = struct.unpack_from("<HHI", data, o + 32)
            p.anims.append(PapAnim(name, kind, idx, face))
        p.havok = data[havok_off:tl_off]
        # TMBs follow each other, each 4-byte aligned, starting with "TMLB" and its total size at +4
        o = tl_off
        while o + 8 <= len(data) and len(p.timelines) < count:
            assert data[o:o + 4] == b"TMLB", (hex(o), data[o:o + 4])
            size = struct.unpack_from("<I", data, o + 4)[0]
            p.timelines.append(data[o:o + size])
            o += size
            o = (o + 3) & ~3
        return p

    def write(self):
        info = b"".join(struct.pack("<32sHHI", a.name.encode(), a.kind, a.havok_index, a.is_face) for a in self.anims)
        head_size = 26
        info_off = head_size
        havok_off = info_off + len(info)
        tl_off = havok_off + len(self.havok)
        out = bytearray(struct.pack("<4sIHHBBIII", b"pap ", self.version, len(self.anims), self.model_id,
                                    self.model_type, self.variant, info_off, havok_off, tl_off))
        out += info + self.havok
        for t in self.timelines:
            out += t
            while len(out) % 4:
                out += b"\0"
        return bytes(out)
