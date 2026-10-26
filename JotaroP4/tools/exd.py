"""Minimal Excel (EXH/EXD) sheet reader on top of sqpack.Repo."""
import struct

LANG_SUFFIX = {0: "", 1: "_ja", 2: "_en", 3: "_de", 4: "_fr"}


class Sheet:
    def __init__(self, repo, name, lang=2):
        self.repo, self.name = repo, name.lower()
        h = repo.read(f"exd/{self.name}.exh")
        (self.row_size, ncols, npages, nlangs) = struct.unpack_from(">HHHH", h, 6)
        self.variant = h[0x11]
        self.columns = [struct.unpack_from(">HH", h, 0x20 + 4 * i) for i in range(ncols)]
        po = 0x20 + 4 * ncols
        self.pages = [struct.unpack_from(">II", h, po + 8 * i) for i in range(npages)]
        lo = po + 8 * npages
        langs = [h[lo + 2 * i] for i in range(nlangs)]
        self.suffix = LANG_SUFFIX[lang if lang in langs else langs[0]]

    def rows(self):
        """Yields (row_id, subrow_id, [column values])."""
        for start, _ in self.pages:
            d = self.repo.read(f"exd/{self.name}_{start}{self.suffix}.exd")
            index_size = struct.unpack_from(">I", d, 8)[0]
            for i in range(index_size // 8):
                row_id, off = struct.unpack_from(">II", d, 0x20 + 8 * i)
                _, count = struct.unpack_from(">IH", d, off)
                base = off + 6
                if self.variant == 2:
                    for s in range(count):
                        sub_off = base + s * (2 + self.row_size)
                        sub_id = struct.unpack_from(">H", d, sub_off)[0]
                        yield row_id, sub_id, self._decode(d, sub_off + 2, base + count * (2 + self.row_size))
                else:
                    yield row_id, 0, self._decode(d, base, base + self.row_size)

    def _decode(self, d, row, strings):
        out = []
        for ctype, coff in self.columns:
            p = row + coff
            if ctype == 0x0:
                so = strings + struct.unpack_from(">I", d, p)[0]
                end = d.index(b"\0", so)
                out.append(d[so:end].decode("utf-8", "replace"))
            elif ctype == 0x1:
                out.append(bool(d[p]))
            elif ctype in (0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x9, 0xA, 0xB):
                fmt = {0x2: ">b", 0x3: ">B", 0x4: ">h", 0x5: ">H", 0x6: ">i", 0x7: ">I", 0x9: ">f", 0xA: ">q", 0xB: ">Q"}[ctype]
                out.append(struct.unpack_from(fmt, d, p)[0])
            elif 0x19 <= ctype <= 0x20:
                out.append(bool(d[p] & (1 << (ctype - 0x19))))
            else:
                out.append(None)
        return out
