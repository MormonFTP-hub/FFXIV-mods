using System.IO.Compression;

namespace XivRender;

public static class Png
{
    private static readonly uint[] CrcTable = Enumerable.Range(0, 256).Select(n =>
    {
        var c = (uint)n;
        for (var k = 0; k < 8; k++)
            c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
        return c;
    }).ToArray();

    private static uint Crc32(ReadOnlySpan<byte> type, ReadOnlySpan<byte> data)
    {
        var c = 0xFFFFFFFFu;
        foreach (var b in type) c = CrcTable[(c ^ b) & 0xFF] ^ (c >> 8);
        foreach (var b in data) c = CrcTable[(c ^ b) & 0xFF] ^ (c >> 8);
        return c ^ 0xFFFFFFFFu;
    }

    private static void Chunk(Stream s, string type, ReadOnlySpan<byte> data)
    {
        Span<byte> len = stackalloc byte[4];
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(len, data.Length);
        s.Write(len);
        var t = System.Text.Encoding.ASCII.GetBytes(type);
        s.Write(t);
        s.Write(data);
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(len, Crc32(t, data));
        s.Write(len);
    }

    /// <summary>RGBA8 image to PNG; alpha is dropped unless keepAlpha.</summary>
    public static byte[] Encode(byte[] rgba, int w, int h, bool keepAlpha = false, CompressionLevel level = CompressionLevel.Fastest)
    {
        var ch  = keepAlpha ? 4 : 3;
        var raw = new byte[(w * ch + 1) * h];
        for (var y = 0; y < h; y++)
        {
            var o = y * (w * ch + 1);
            raw[o] = 0;
            for (var x = 0; x < w; x++)
            for (var c = 0; c < ch; c++)
                raw[o + 1 + x * ch + c] = rgba[(y * w + x) * 4 + c];
        }

        using var ms = new MemoryStream();
        ms.Write(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        var ihdr = new byte[13];
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(ihdr, w);
        System.Buffers.Binary.BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(4), h);
        ihdr[8] = 8;
        ihdr[9] = (byte)(keepAlpha ? 6 : 2);
        Chunk(ms, "IHDR", ihdr);
        using (var zs = new MemoryStream())
        {
            using (var z = new ZLibStream(zs, level, true))
                z.Write(raw);
            Chunk(ms, "IDAT", zs.ToArray());
        }

        Chunk(ms, "IEND", ReadOnlySpan<byte>.Empty);
        return ms.ToArray();
    }
}
