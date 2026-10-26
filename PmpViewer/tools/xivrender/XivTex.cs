using TerraFX.Interop.DirectX;

namespace XivRender;

/// <summary>
/// A game .tex file: 80-byte header, then every mip at its surface offset, each mip holding all array slices / cube faces /
/// volume slices back to back. Rare 16-bit and luminance formats are expanded to BGRA8, everything else stays as stored.
/// </summary>
public sealed class XivTex
{
    public uint   Attributes;
    public uint   Format;
    public int    Width, Height, Depth, Mips, Slices;
    public bool   Cube, Volume, Array;
    public DXGI_FORMAT Dxgi;
    public byte[] Data = System.Array.Empty<byte>();
    public uint[] Surface = new uint[13];
    private bool  _expand;   // stored format is expanded to BGRA8 on read

    public static XivTex Parse(byte[] b)
    {
        var t = new XivTex
        {
            Attributes = BitConverter.ToUInt32(b, 0),
            Format     = BitConverter.ToUInt32(b, 4),
            Width      = BitConverter.ToUInt16(b, 8),
            Height     = BitConverter.ToUInt16(b, 10),
            Depth      = Math.Max((ushort)1, BitConverter.ToUInt16(b, 12)),
            Mips       = Math.Max(1, b[14] & 0x7F),
            Data       = b,
        };
        var arraySize = b[15];
        for (var i = 0; i < 13; i++)
            t.Surface[i] = BitConverter.ToUInt32(b, 28 + i * 4);
        t.Cube   = (t.Attributes & 0x2000000) != 0;
        t.Volume = (t.Attributes & 0x1000000) != 0;
        t.Array  = (t.Attributes & 0x10000000) != 0;
        t.Slices = t.Cube ? 6 * Math.Max(1, (int)arraySize) : t.Array ? Math.Max(Math.Max(1, (int)arraySize), t.Depth) : 1;
        if (t.Array || t.Cube)
            t.Depth = 1;
        if (!t.Volume)
            t.Depth = t.Array || t.Cube ? 1 : t.Depth;

        (t.Dxgi, t._expand) = t.Format switch
        {
            0x1130 => (DXGI_FORMAT.DXGI_FORMAT_B8G8R8A8_UNORM, true),   // L8
            0x1131 => (DXGI_FORMAT.DXGI_FORMAT_A8_UNORM, false),
            0x1440 => (DXGI_FORMAT.DXGI_FORMAT_B8G8R8A8_UNORM, true),   // B4G4R4A4
            0x1441 => (DXGI_FORMAT.DXGI_FORMAT_B8G8R8A8_UNORM, true),   // B5G5R5A1
            0x1450 => (DXGI_FORMAT.DXGI_FORMAT_B8G8R8A8_UNORM, false),
            0x1451 => (DXGI_FORMAT.DXGI_FORMAT_B8G8R8X8_UNORM, false),
            0x2150 => (DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT, false),
            0x2250 => (DXGI_FORMAT.DXGI_FORMAT_R16G16_FLOAT, false),
            0x2260 => (DXGI_FORMAT.DXGI_FORMAT_R32G32_FLOAT, false),
            0x2460 => (DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT, false),
            0x2470 => (DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_FLOAT, false),
            0x3420 => (DXGI_FORMAT.DXGI_FORMAT_BC1_UNORM, false),
            0x3430 => (DXGI_FORMAT.DXGI_FORMAT_BC2_UNORM, false),
            0x3431 => (DXGI_FORMAT.DXGI_FORMAT_BC3_UNORM, false),
            0x6120 => (DXGI_FORMAT.DXGI_FORMAT_BC4_UNORM, false),
            0x6230 => (DXGI_FORMAT.DXGI_FORMAT_BC5_UNORM, false),
            0x6330 => (DXGI_FORMAT.DXGI_FORMAT_BC6H_SF16, false),
            0x6432 => (DXGI_FORMAT.DXGI_FORMAT_BC7_UNORM, false),
            _      => throw new NotSupportedException($"texture format 0x{t.Format:X4}"),
        };

        // a file may carry fewer mips than its header says (Penumbra and TexTools trim the smallest ones)
        while (t.Mips > 1 && t.MipOffset(t.Mips - 1) + (long)t.StoredSurfaceSize(t.Mips - 1) * t.Slices > b.Length)
            t.Mips--;
        return t;
    }

    public bool Compressed => (Format & 0xF000) is 0x3000 or 0x6000;
    private int StoredBits => 1 << (int)((Format >> 4) & 0xF);

    public (int w, int h) MipSize(int m) => (Math.Max(1, Width >> m), Math.Max(1, Height >> m));

    private int StoredSurfaceSize(int m)
    {
        var (w, h) = MipSize(m);
        if (Compressed)
            return Math.Max(1, (w + 3) / 4) * Math.Max(1, (h + 3) / 4) * (StoredBits == 4 ? 8 : 16);
        return w * h * StoredBits / 8;
    }

    /// <summary>Bytes of one slice of mip m as uploaded (after any expansion).</summary>
    public int SurfaceSize(int m)
    {
        var (w, h) = MipSize(m);
        return _expand ? w * h * 4 : StoredSurfaceSize(m);
    }

    private long MipOffset(int m)
    {
        if (m < 13 && Surface[m] != 0)
            return Surface[m];
        long o = 80;
        for (var i = 0; i < m; i++)
            o += (long)StoredSurfaceSize(i) * Slices * (Volume ? Math.Max(1, Depth >> i) : 1);
        return o;
    }

    public byte[] Slice(int mip, int slice, int count = 1)
    {
        var size = StoredSurfaceSize(mip);
        var off  = MipOffset(mip) + (long)size * slice;
        var len  = (int)Math.Min((long)size * count, Math.Max(0, Data.Length - off));
        var raw  = new byte[size * count];
        if (len > 0)
            Buffer.BlockCopy(Data, (int)off, raw, 0, len);
        return _expand ? Expand(raw) : raw;
    }

    private byte[] Expand(byte[] raw)
    {
        switch (Format)
        {
            case 0x1130:
            {
                var o = new byte[raw.Length * 4];
                for (var i = 0; i < raw.Length; i++)
                {
                    o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = raw[i];
                    o[i * 4 + 3] = 255;
                }

                return o;
            }
            case 0x1440:
            {
                var o = new byte[raw.Length * 2];
                for (var i = 0; i < raw.Length / 2; i++)
                {
                    var v = BitConverter.ToUInt16(raw, i * 2);
                    o[i * 4]     = (byte)((v & 0xF) * 17);
                    o[i * 4 + 1] = (byte)(((v >> 4) & 0xF) * 17);
                    o[i * 4 + 2] = (byte)(((v >> 8) & 0xF) * 17);
                    o[i * 4 + 3] = (byte)(((v >> 12) & 0xF) * 17);
                }

                return o;
            }
            default:
            {
                var o = new byte[raw.Length * 2];
                for (var i = 0; i < raw.Length / 2; i++)
                {
                    var v = BitConverter.ToUInt16(raw, i * 2);
                    o[i * 4]     = (byte)((v & 0x1F) * 255 / 31);
                    o[i * 4 + 1] = (byte)(((v >> 5) & 0x1F) * 255 / 31);
                    o[i * 4 + 2] = (byte)(((v >> 10) & 0x1F) * 255 / 31);
                    o[i * 4 + 3] = (byte)((v >> 15) * 255);
                }

                return o;
            }
        }
    }
}
