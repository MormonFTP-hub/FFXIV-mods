using Lumina;
using Penumbra.GameData.Files;
using Penumbra.GameData.Files.MaterialStructs;
using MtrlFile = Penumbra.GameData.Files.MtrlFile;
using TerraFX.Interop.DirectX;

namespace XivRender;

/// <summary>
/// Where game paths come from: the scene's redirections (mod files, swaps, collection files) first, then the game's own data.
/// This is the same order Penumbra resolves in game, already decided by the viewer's resolver.
/// </summary>
public sealed class FileSource
{
    public readonly GameData Game;
    public readonly Dictionary<string, string> Redirects = new(StringComparer.OrdinalIgnoreCase);
    public readonly List<string> Missing = new();

    public FileSource(GameData game) => Game = game;

    public string? LocalPath(string gamePath) => Redirects.TryGetValue(gamePath, out var p) ? p : null;

    public byte[]? Read(string gamePath)
    {
        if (Redirects.TryGetValue(gamePath, out var local))
        {
            if (File.Exists(local))
                return File.ReadAllBytes(local);
            // a redirection may also point at another game path (file swap)
            gamePath = local;
        }

        var f = Game.GetFile(gamePath);
        if (f == null)
        {
            lock (Missing)
                Missing.Add(gamePath);
            return null;
        }

        return f.Data;
    }

    public XivTex? ReadTex(string gamePath)
    {
        if (Redirects.TryGetValue(gamePath, out var local))
        {
            if (File.Exists(local))
                return XivTex.Parse(File.ReadAllBytes(local));
            gamePath = local;
        }

        var raw = ReadGameTexture(gamePath);
        if (raw == null)
        {
            lock (Missing)
                Missing.Add(gamePath);
            return null;
        }

        return XivTex.Parse(raw);
    }

    /// <summary>
    /// A texture file straight from the game's .dat, block by block. Lumina's own reader steps through the block-size
    /// table with signed 16-bit reads and fails on the large array textures (tile_norm_array.tex and friends).
    /// </summary>
    public byte[]? ReadGameTexture(string gamePath)
    {
        var parsed = GameData.ParseFilePath(gamePath);
        if (parsed == null || !Game.Repositories.TryGetValue(parsed.Repository, out var repo))
            return null;
        foreach (var cat in repo.Categories.Values.SelectMany(c => c))
        {
            if (!cat.TryGetFileDatOffset(parsed, out var datId, out var offset))
                continue;
            var dat = cat.GetDat(datId);
            using var fs = new FileStream(dat.File.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var br = new BinaryReader(fs);
            fs.Position = offset;
            var headerSize = br.ReadUInt32();
            var type       = br.ReadUInt32();
            var rawSize    = br.ReadUInt32();
            br.ReadUInt32();
            br.ReadUInt32();
            var lodCount = br.ReadUInt32();
            if (type != 4)
                return Game.GetFile(gamePath)?.Data;
            var lods = new (uint compOffset, uint compSize, uint decompSize, uint blockOffset, uint blockCount)[lodCount];
            for (var i = 0; i < lodCount; i++)
                lods[i] = (br.ReadUInt32(), br.ReadUInt32(), br.ReadUInt32(), br.ReadUInt32(), br.ReadUInt32());
            var totalBlocks = lods.Length == 0 ? 0 : lods.Max(l => l.blockOffset + l.blockCount);
            var sizes = new ushort[totalBlocks];
            for (var i = 0; i < totalBlocks; i++)
                sizes[i] = br.ReadUInt16();

            using var outMs = new MemoryStream((int)rawSize);
            var dataStart = offset + headerSize;
            if (lods.Length > 0 && lods[0].compOffset > 0)
            {
                fs.Position = dataStart;
                outMs.Write(br.ReadBytes((int)lods[0].compOffset));
            }

            foreach (var lod in lods)
            {
                if (lod.compSize == 0)
                    continue;
                long pos = dataStart + lod.compOffset;
                for (var j = 0; j < lod.blockCount; j++)
                {
                    ReadBlock(fs, br, pos, outMs);
                    pos += sizes[lod.blockOffset + j];
                }
            }

            return outMs.ToArray();
        }

        return null;
    }

    private static void ReadBlock(FileStream fs, BinaryReader br, long pos, MemoryStream outMs)
    {
        fs.Position = pos;
        var hdrSize = br.ReadUInt32();
        br.ReadUInt32();
        var compressed   = br.ReadUInt32();
        var decompressed = br.ReadUInt32();
        fs.Position = pos + hdrSize;
        if (compressed == 32000)
        {
            outMs.Write(br.ReadBytes((int)decompressed));
            return;
        }

        var comp = br.ReadBytes((int)compressed);
        using var ds = new System.IO.Compression.DeflateStream(new MemoryStream(comp), System.IO.Compression.CompressionMode.Decompress);
        var buf  = new byte[decompressed];
        var read = 0;
        while (read < buf.Length)
        {
            var n = ds.Read(buf, read, buf.Length - read);
            if (n <= 0) break;
            read += n;
        }

        outMs.Write(buf, 0, read);
    }
}

/// <summary>Game .tex files uploaded in their own block-compressed format, with every mip, slice and cube face.</summary>
public sealed unsafe class TextureCache
{
    private readonly Gpu _gpu;
    private readonly FileSource _src;
    private readonly Dictionary<string, nint> _cache = new(StringComparer.OrdinalIgnoreCase);

    public TextureCache(Gpu gpu, FileSource src)
    {
        _gpu = gpu;
        _src = src;
    }

    public sealed record Info(string Path, int Width, int Height, int Mips, int Slices, string Format, bool Cube);
    public readonly Dictionary<string, Info> Infos = new(StringComparer.OrdinalIgnoreCase);

    public ID3D11ShaderResourceView* Get(string gamePath)
    {
        lock (_cache)
        {
            if (_cache.TryGetValue(gamePath, out var s))
                return (ID3D11ShaderResourceView*)s;
        }

        ID3D11ShaderResourceView* srv = null;
        try
        {
            var tex = _src.ReadTex(gamePath);
            if (tex != null)
                srv = Upload(gamePath, tex);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine($"texture {gamePath}: {e.Message}");
        }

        lock (_cache)
            _cache[gamePath] = (nint)srv;
        return srv;
    }

    public void Clear()
    {
        lock (_cache)
        {
            foreach (var s in _cache.Values)
                if (s != 0)
                    ((ID3D11ShaderResourceView*)s)->Release();
            _cache.Clear();
            Infos.Clear();
        }
    }

    private ID3D11ShaderResourceView* Upload(string path, XivTex tex)
    {
        var subs = new List<(byte[] data, int rowPitch, int slicePitch)>();
        if (tex.Volume)
        {
            for (var m = 0; m < tex.Mips; m++)
            {
                var (w, h) = tex.MipSize(m);
                var d      = Math.Max(1, tex.Depth >> m);
                var size   = tex.SurfaceSize(m);
                subs.Add((tex.Slice(m, 0, d), RowPitch(tex.Dxgi, w), size));
            }
        }
        else
        {
            // D3D11 subresource order: all mips of slice 0, then slice 1 ...
            for (var s = 0; s < tex.Slices; s++)
            for (var m = 0; m < tex.Mips; m++)
            {
                var (w, _) = tex.MipSize(m);
                subs.Add((tex.Slice(m, s), RowPitch(tex.Dxgi, w), tex.SurfaceSize(m)));
            }
        }

        Infos[path] = new Info(path, tex.Width, tex.Height, tex.Mips, tex.Slices, $"0x{tex.Format:X4}", tex.Cube);
        return _gpu.CreateTexture(tex.Dxgi, tex.Width, tex.Height, tex.Depth, tex.Mips, tex.Slices, tex.Cube, tex.Volume, subs);
    }

    public static int RowPitch(DXGI_FORMAT f, int width)
    {
        var blocks = Math.Max(1, (width + 3) / 4);
        return f switch
        {
            DXGI_FORMAT.DXGI_FORMAT_BC1_UNORM or DXGI_FORMAT.DXGI_FORMAT_BC4_UNORM                                                     => blocks * 8,
            DXGI_FORMAT.DXGI_FORMAT_BC2_UNORM or DXGI_FORMAT.DXGI_FORMAT_BC3_UNORM or DXGI_FORMAT.DXGI_FORMAT_BC5_UNORM
                or DXGI_FORMAT.DXGI_FORMAT_BC6H_SF16 or DXGI_FORMAT.DXGI_FORMAT_BC6H_UF16 or DXGI_FORMAT.DXGI_FORMAT_BC7_UNORM => blocks * 16,
            DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT => width * 8,
            DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_FLOAT => width * 16,
            DXGI_FORMAT.DXGI_FORMAT_R32G32_FLOAT       => width * 8,
            DXGI_FORMAT.DXGI_FORMAT_R8_UNORM or DXGI_FORMAT.DXGI_FORMAT_A8_UNORM => width,
            DXGI_FORMAT.DXGI_FORMAT_R16_FLOAT or DXGI_FORMAT.DXGI_FORMAT_R8G8_UNORM => width * 2,
            _ => width * 4,
        };
    }
}

/// <summary>A material as the game binds it: shader package, material keys, the g_MaterialParameter buffer, samplers and the colour table texture.</summary>
public sealed unsafe class GpuMaterial
{
    public string               Path = "";
    public MtrlFile             File = null!;
    public GameShaderPackage    Shpk = null!;
    public uint                 Flags;
    public bool                 HideBackfaces => (Flags & 0x1) != 0;
    public bool                 Transparent   => (Flags & 0x10) != 0;
    public Dictionary<uint, uint> MaterialKeys = new();
    public byte[]               Params = Array.Empty<byte>();
    public ID3D11Buffer*        ParamBuffer;
    public ID3D11ShaderResourceView* Table;
    public float                AlphaThreshold;
    /// <summary>Package whose G pass only writes the albedo target (charactertattoo): blended onto what's below.</summary>
    public bool                 Decal => Shpk.Name.Equals("charactertattoo.shpk", StringComparison.OrdinalIgnoreCase)
                                      || Shpk.Name.Equals("characterocclusion.shpk", StringComparison.OrdinalIgnoreCase);
    public readonly Dictionary<string, (nint srv, nint sampler, string path)> Samplers = new(StringComparer.Ordinal);
    public readonly List<string> Notes = new();
}

public sealed unsafe class MaterialCache
{
    private readonly Gpu _gpu;
    private readonly FileSource _src;
    private readonly TextureCache _tex;
    private readonly ShaderCache _shaders;
    private readonly Dictionary<string, GpuMaterial?> _cache = new(StringComparer.OrdinalIgnoreCase);

    public MaterialCache(Gpu gpu, FileSource src, TextureCache tex, ShaderCache shaders)
    {
        _gpu = gpu;
        _src = src;
        _tex = tex;
        _shaders = shaders;
    }

    public void Clear()
    {
        _stm       = null;
        _stmLegacy = null;
        foreach (var m in _cache.Values)
        {
            if (m == null) continue;
            if (m.ParamBuffer != null) m.ParamBuffer->Release();
            if (m.Table != null) m.Table->Release();
        }

        _cache.Clear();
    }

    private StmFile<Penumbra.GameData.Files.StainMapStructs.DyePack>?       _stm;
    private StmFile<Penumbra.GameData.Files.StainMapStructs.LegacyDyePack>? _stmLegacy;

    /// <summary>A material as loaded for a model; stains (dye 1, dye 2) rewrite its colour table the way the game dyes gear.</summary>
    public GpuMaterial? Get(string gamePath, IReadOnlyList<int>? stains = null)
    {
        var dyed = stains != null && stains.Any(x => x > 0);
        var key  = dyed ? gamePath + "|" + string.Join(",", stains!) : gamePath;
        if (_cache.TryGetValue(key, out var m))
            return m;
        try
        {
            m = Load(gamePath, dyed ? stains : null);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine($"material {gamePath}: {e}");
            m = null;
        }

        _cache[key] = m;
        return m;
    }

    private GpuMaterial? Load(string path, IReadOnlyList<int>? stains)
    {
        var bytes = _src.Read(path);
        if (bytes == null)
            return null;
        var mtrl = new MtrlFile(bytes);
        if (stains != null && mtrl.DyeTable != null)
        {
            // Penumbra's own dye code: the dye table picks which rows take which stain's template colours
            var ids = stains.Take(2).Select(x => (Penumbra.GameData.Structs.StainId)(byte)Math.Clamp(x, 0, 255)).ToArray();
            if (mtrl.Table is ColorTable)
            {
                _stm ??= _src.Read(StmFile<Penumbra.GameData.Files.StainMapStructs.DyePack>.GudPath) is { } sb
                    ? new StmFile<Penumbra.GameData.Files.StainMapStructs.DyePack>(sb) : null;
                if (_stm != null)
                    mtrl.ApplyDye(_stm, ids);
            }
            else if (mtrl.Table is LegacyColorTable)
            {
                _stmLegacy ??= _src.Read(StmFile<Penumbra.GameData.Files.StainMapStructs.LegacyDyePack>.LegacyPath) is { } sb
                    ? new StmFile<Penumbra.GameData.Files.StainMapStructs.LegacyDyePack>(sb) : null;
                if (_stmLegacy != null)
                    mtrl.ApplyDye(_stmLegacy, ids);
            }
        }
        var shpk = _shaders.Package(mtrl.ShaderPackage.Name);
        if (shpk == null)
            return null;
        var mat = new GpuMaterial { Path = path, File = mtrl, Shpk = shpk, Flags = mtrl.ShaderPackage.Flags };

        foreach (var k in mtrl.ShaderPackage.ShaderKeys)
            mat.MaterialKeys[k.Key] = k.Value;

        // g_MaterialParameter: the package's defaults, overwritten by every constant the material sets
        var size = (int)Math.Max(shpk.File.MaterialParamsSize, 16);
        var buf  = new byte[(size + 15) & ~15];
        if (shpk.File.MaterialParamsDefaults is { } defaults)
            defaults.AsSpan(0, Math.Min(defaults.Length, buf.Length)).CopyTo(buf);
        foreach (var c in mtrl.ShaderPackage.Constants)
        {
            var param = shpk.File.GetMaterialParamById(c.Id);
            if (param == null)
            {
                mat.Notes.Add($"constant 0x{c.Id:X8} is not a parameter of {mtrl.ShaderPackage.Name}");
                continue;
            }

            var p   = param.Value;
            var len = Math.Min(c.ByteSize, p.ByteSize);
            if (c.ByteOffset + len > mtrl.ShaderPackage.ShaderValues.Length || p.ByteOffset + len > buf.Length)
                continue;
            mtrl.ShaderPackage.ShaderValues.AsSpan(c.ByteOffset, len).CopyTo(buf.AsSpan(p.ByteOffset));
        }

        mat.Params      = buf;
        if (shpk.File.GetMaterialParamById(Crc.Of("g_AlphaThreshold")) is { } at && at.ByteOffset + 4 <= buf.Length)
            mat.AlphaThreshold = BitConverter.ToSingle(buf, at.ByteOffset);
        mat.ParamBuffer = _gpu.CreateBuffer(buf, D3D11_BIND_FLAG.D3D11_BIND_CONSTANT_BUFFER);

        // colour table: uploaded as the raw half-float rows (Dawntrail 8x32, legacy 4x16)
        if (mtrl.Table is { } table)
        {
            var raw = table.AsBytes().ToArray();
            var w   = table.Width;
            var h   = table.Height;
            mat.Table = _gpu.CreateTexture(DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT, w, h, 1, 1, 1, false, false,
                new[] { (raw, w * 8, w * h * 8) });
        }

        // samplers: id -> the package's resource name, texture from the material's texture list
        foreach (var s in mtrl.ShaderPackage.Samplers)
        {
            var res = shpk.File.GetSamplerById(s.SamplerId) ?? shpk.File.GetTextureById(s.SamplerId);
            if (res == null)
            {
                mat.Notes.Add($"sampler 0x{s.SamplerId:X8} unknown to {mtrl.ShaderPackage.Name}");
                continue;
            }

            var texPath = s.TextureIndex < mtrl.Textures.Length ? mtrl.Textures[s.TextureIndex].Path : "";
            if (s.TextureIndex < mtrl.Textures.Length && mtrl.Textures[s.TextureIndex].DX11)
                texPath = Dx11Path(texPath);
            ID3D11ShaderResourceView* srv = null;
            if (texPath.Length > 0)
                srv = _tex.Get(texPath);
            if (srv == null)
            {
                mat.Notes.Add($"{res.Value.Name}: texture {texPath} missing, dummy used");
                srv = _tex.Get(MtrlFile.DummyTexturePath);
            }

            mat.Samplers[res.Value.Name] = ((nint)srv, (nint)SamplerFromFlags(s.Flags), texPath);
        }

        return mat;
    }

    /// <summary>DX11 textures in old materials live next to the named file with a "--" prefix.</summary>
    private static string Dx11Path(string path)
    {
        var slash = path.LastIndexOf('/');
        return slash < 0 ? "--" + path : path[..(slash + 1)] + "--" + path[(slash + 1)..];
    }

    public ID3D11SamplerState* SamplerFromFlags(uint flags)
    {
        var f = new SamplerFlags(flags);
        static D3D11_TEXTURE_ADDRESS_MODE Mode(SamplerFlags.TextureAddressMode m) => m switch
        {
            SamplerFlags.TextureAddressMode.Wrap   => D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_WRAP,
            SamplerFlags.TextureAddressMode.Mirror => D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_MIRROR,
            SamplerFlags.TextureAddressMode.Clamp  => D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_CLAMP,
            _                                      => D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_BORDER,
        };
        return _gpu.Sampler(Mode(f.UAddressMode), Mode(f.VAddressMode), f.LodBias, f.MinLod);
    }
}
