"""Minimal read-only SqPack reader for FFXIV game files.

Supports standard files (sklb, mtrl, imc, exd...), model files (mdl) and
texture files (tex) from the ffxiv/ex* repositories.
"""
import os
import struct
import zlib

CATEGORIES = {
    "common": 0x00, "bgcommon": 0x01, "bg": 0x02, "cut": 0x03, "chara": 0x04,
    "shader": 0x05, "ui": 0x06, "sound": 0x07, "vfx": 0x08, "ui_script": 0x09,
    "exd": 0x0A, "game_script": 0x0B, "music": 0x0C,
}


def jamcrc(data: bytes) -> int:
    return (~zlib.crc32(data)) & 0xFFFFFFFF


def path_hash(path: str) -> int:
    path = path.lower()
    folder, _, name = path.rpartition("/")
    return (jamcrc(folder.encode()) << 32) | jamcrc(name.encode())


class Repo:
    def __init__(self, game_dir: str):
        self.sqpack = os.path.join(game_dir, "sqpack")
        self._indexes = {}

    def _index_for(self, path: str):
        parts = path.lower().split("/")
        cat = CATEGORIES[parts[0]]
        repo = "ffxiv"
        if len(parts) > 1 and parts[1].startswith("ex") and parts[1][2:].isdigit():
            repo = parts[1]
        ex = 0 if repo == "ffxiv" else int(repo[2:])
        chunk = 0
        if cat in (0x02, 0x03) and len(parts) > 2 and parts[2].isdigit():
            chunk = int(parts[2])
        base = f"{cat:02x}{ex:02x}{chunk:02x}.win32"
        key = (repo, base)
        if key not in self._indexes:
            self._indexes[key] = self._load_index(os.path.join(self.sqpack, repo, base + ".index"))
        return os.path.join(self.sqpack, repo, base), self._indexes[key]

    @staticmethod
    def _load_index(index_path):
        with open(index_path, "rb") as f:
            raw = f.read()
        sqpack_header_size = struct.unpack_from("<I", raw, 0x0C)[0]
        data_offset, data_size = struct.unpack_from("<II", raw, sqpack_header_size + 8)
        table = {}
        for off in range(data_offset, data_offset + data_size, 16):
            h, data = struct.unpack_from("<QI", raw, off)
            table[h] = data
        return table

    def exists(self, path: str) -> bool:
        _, idx = self._index_for(path)
        return path_hash(path) in idx

    def read(self, path: str) -> bytes:
        base, idx = self._index_for(path)
        data = idx.get(path_hash(path))
        if data is None:
            raise FileNotFoundError(path)
        dat_id = (data & 0b1110) >> 1
        offset = (data & ~0xF) * 0x08
        with open(f"{base}.dat{dat_id}", "rb") as f:
            return _read_entry(f, offset)


def _read_block(f, pos):
    f.seek(pos)
    hsize, _, csize, usize = struct.unpack("<IIII", f.read(16))
    f.seek(pos + hsize)
    if csize == 32000:
        return f.read(usize)
    return zlib.decompress(f.read(csize), -15)


def _read_entry(f, offset):
    f.seek(offset)
    header_size, ftype, raw_size, _, _, num_blocks = struct.unpack("<IIIIII", f.read(24))
    if ftype == 2:
        infos = [struct.unpack("<IHH", f.read(8)) for _ in range(num_blocks)]
        out = bytearray()
        for boff, _, _ in infos:
            out += _read_block(f, offset + header_size + boff)
        return bytes(out[:raw_size])
    if ftype == 4:
        lods = [struct.unpack("<IIIII", f.read(20)) for _ in range(num_blocks)]
        total_sub = sum(l[4] for l in lods)
        sub_sizes = struct.unpack(f"<{total_sub}H", f.read(2 * total_sub))
        out = bytearray()
        f.seek(offset + header_size)
        out += f.read(lods[0][0])  # tex header + mip offsets, stored raw
        si = 0
        for coff, _, _, _, count in lods:
            pos = offset + header_size + coff
            for _ in range(count):
                out += _read_block(f, pos)
                pos += sub_sizes[si]
                si += 1
        return bytes(out[:raw_size])
    if ftype == 3:
        return _read_model(f, offset)
    raise ValueError(f"unsupported file type {ftype}")


def _read_model(f, offset):
    f.seek(offset)
    (header_size, _, _, num_blocks, _, version) = struct.unpack("<IIIIII", f.read(24))
    _uncomp = struct.unpack("<11I", f.read(44))
    _comp = struct.unpack("<11I", f.read(44))
    offs = struct.unpack("<11I", f.read(44))
    _bidx = struct.unpack("<11H", f.read(22))
    counts = struct.unpack("<11H", f.read(22))
    n_vdecl, n_mat, n_lod, idx_stream, edge = struct.unpack("<HHBBB", f.read(7))
    f.read(1)
    block_sizes = struct.unpack(f"<{num_blocks}H", f.read(2 * num_blocks))
    base = offset + header_size
    out = bytearray(0x44)
    cur = [0]

    def read_section(sec_off, count):
        pos = base + sec_off
        for _ in range(count):
            out.extend(_read_block(f, pos))
            pos += block_sizes[cur[0]]
            cur[0] += 1

    start = len(out); read_section(offs[0], counts[0]); stack_size = len(out) - start
    start = len(out); read_section(offs[1], counts[1]); runtime_size = len(out) - start
    v_off, i_off, v_size, i_size = [0] * 3, [0] * 3, [0] * 3, [0] * 3
    for i in range(3):
        if counts[2 + i]:
            pos = len(out)
            v_off[i] = pos if (i == 0 or pos != v_off[i - 1]) else 0
            read_section(offs[2 + i], counts[2 + i])
            v_size[i] = len(out) - pos
        if counts[5 + i]:
            read_section(offs[5 + i], counts[5 + i])
        if counts[8 + i]:
            pos = len(out)
            i_off[i] = pos if (i == 0 or pos != i_off[i - 1]) else 0
            read_section(offs[8 + i], counts[8 + i])
            i_size[i] = len(out) - pos
    hdr = struct.pack("<IIIHH", version, stack_size, runtime_size, n_vdecl, n_mat)
    hdr += struct.pack("<3I3I3I3I", *v_off, *i_off, *v_size, *i_size)
    hdr += struct.pack("<BBBB", n_lod, idx_stream, edge, 0)
    out[0:0x44] = hdr
    return bytes(out)


if __name__ == "__main__":
    import sys
    repo = Repo(sys.argv[1])
    for p in sys.argv[2:]:
        print(p, repo.exists(p))
