"""The game's sound files (.scd) as plain audio: each sound in the bank as Ogg Vorbis bytes (as the game stores most
of them, once the light XOR the game puts on them is taken off) or as a 16-bit PCM WAV (the MS-ADPCM sound effects).

Layout after vgmstream's sqex_scd.c: a header (0x0e: where the offset tables start), the tables (0x04: how many
sound headers, 0x0c: where their offsets are), and per sound a 0x20 header (size, channels, rate, codec, loop
points, extra-data size, aux-chunk count), its extra data (a MARK chunk first when it has aux chunks, then the
codec's own header) and the stream.
"""
import io
import struct
import wave

import numpy as np

# The v3 Ogg key (the table in the Heavensward client, as vgmstream gives it).
V3 = bytes.fromhex(
    "3A323232037E12F7B2E2A267323222323252161B3CA1547B1B97A6931A4BAAA6"
    "7A7B1B97A6F702BBAAA6BBF72A51BE03F42A51BE03F42A51BE12065627323236"
    "32B21A3BBC91D47B58FC0B552A15BC40920B5B7C0A951235B863D20B3BF0C714"
    "515C948694595CFC1B173A3F6B3732323032727A13B726607A13B72650BA13B4"
    "2A50BA13B52E40FA1395AE4038189A92B03800FA12B17E00DB96A17C08DB9A91"
    "BC08D81A86E270391F86E0787E03E764519C8F346F4E41FC0BD5AE41FC0BD5AE"
    "41FC3B70716433321232323670342B5622703A13B72660BA1B94AA403800FAB2"
    "E2A26732321232B23232323275A3267B8326F9832EFFE3167DC01E632107E301")
assert len(V3) == 256


def sounds(data):
    """Every sound in the bank: dicts with codec ('ogg' | 'wav'), channels, rate, loop (start, end in bytes or
    None) and bytes (a complete .ogg or .wav file)."""
    le = data[0x0C] == 0
    u16 = (lambda o: struct.unpack_from("<H" if le else ">H", data, o)[0])
    u32 = (lambda o: struct.unpack_from("<I" if le else ">I", data, o)[0])
    i32 = (lambda o: struct.unpack_from("<i" if le else ">i", data, o)[0])
    if data[:8] != b"SEDBSSCF":
        raise ValueError("not an SCD")
    tables = u16(0x0E)
    count, heads = u16(tables + 0x04), u32(tables + 0x0C)
    out = []
    for i in range(count):
        meta = u32(heads + i * 4)
        size, channels, rate, codec = u32(meta), u32(meta + 4), u32(meta + 8), i32(meta + 0x0C)
        loop0, loop1, extra, aux = i32(meta + 0x10), i32(meta + 0x14), u32(meta + 0x18), u32(meta + 0x1C)
        if codec == -1 or size == 0:
            continue
        ex = meta + 0x20
        start = ex + extra
        if aux and data[ex:ex + 4] == b"MARK":
            ex += u32(ex + 4)
        loop = (loop0, loop1) if loop1 > 0 else None
        if codec == 0x06:
            out.append({"codec": "ogg", "channels": channels, "rate": rate, "loop": loop, "bytes": _ogg(data, ex, size, u32)})
        elif codec == 0x0C:
            out.append({"codec": "wav", "channels": channels, "rate": rate, "loop": loop,
                        "bytes": _adpcm(data, ex, start, size, channels, rate, u16)})
        elif codec in (0x00, 0x01):
            pcm = np.frombuffer(data[start:start + size], dtype=">i2" if codec == 0 else "<i2").astype("<i2")
            out.append({"codec": "wav", "channels": channels, "rate": rate, "loop": loop, "bytes": _wav(pcm, channels, rate)})
    return out


def _ogg(data, ex, size, u32):
    version, key = data[ex], data[ex + 2]
    if version == 0:
        raise ValueError("old-style SCD Ogg")
    seek, head = u32(ex + 0x10), u32(ex + 0x14)
    start = ex + 0x20 + seek
    b = bytearray(data[start:start + head + size])
    if version == 2 and key:
        for j in range(head):
            b[j] ^= key
    elif version == 3:
        x = size & 0xFF
        b1, b2 = x & 0x7F, x & 0x3F
        a = np.frombuffer(bytes(b), dtype=np.uint8)
        t = np.frombuffer(V3, dtype=np.uint8)[(b2 + np.arange(len(a))) & 0xFF]
        b = bytearray((a ^ t ^ b1).tobytes())
    if bytes(b[:4]) != b"OggS":
        raise ValueError("Ogg didn't decode")
    return bytes(b)


def _adpcm(data, ex, start, size, channels, rate, u16):
    """MS-ADPCM (the WAVEFORMATEX in the extra data: block size at 0x0c, the coefficients from 0x16) to 16-bit PCM."""
    block = u16(ex + 0x0C)
    ncoef = u16(ex + 0x14)
    coefs = [struct.unpack_from("<hh", data, ex + 0x16 + k * 4) for k in range(ncoef)] or \
        [(256, 0), (512, -256), (0, 0), (192, 64), (240, 0), (460, -208), (392, -232)]
    adapt = [230, 230, 230, 230, 307, 409, 512, 614, 768, 614, 512, 409, 307, 230, 230, 230]
    out = [[] for _ in range(channels)]
    stream = data[start:start + size]
    for b0 in range(0, len(stream) - 7 * channels + 1, block):
        blk = stream[b0:b0 + block]
        if len(blk) < 7 * channels:
            break
        p = 0
        pred = list(blk[p:p + channels]); p += channels
        delta = list(struct.unpack_from(f"<{channels}h", blk, p)); p += 2 * channels
        s1 = list(struct.unpack_from(f"<{channels}h", blk, p)); p += 2 * channels
        s2 = list(struct.unpack_from(f"<{channels}h", blk, p)); p += 2 * channels
        for c in range(channels):
            out[c] += [s2[c], s1[c]]
        c = 0
        for byte in blk[p:]:
            for nib in (byte >> 4, byte & 0x0F):
                c1, c2 = coefs[min(pred[c], len(coefs) - 1)]
                s = (s1[c] * c1 + s2[c] * c2) // 256 + (nib - 16 if nib & 8 else nib) * delta[c]
                s = max(-32768, min(32767, s))
                out[c].append(s)
                s2[c], s1[c] = s1[c], s
                delta[c] = max(16, adapt[nib] * delta[c] // 256)
                c = (c + 1) % channels
    n = min(len(o) for o in out)
    pcm = np.stack([np.array(o[:n], dtype="<i2") for o in out], axis=1).reshape(-1)
    return _wav(pcm, channels, rate)


def _wav(pcm, channels, rate):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.astype("<i2").tobytes())
    return buf.getvalue()
