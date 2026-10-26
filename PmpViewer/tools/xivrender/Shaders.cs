using Penumbra.GameData.Files;
using Penumbra.GameData.Files.ShaderStructs;
using TerraFX.Interop.DirectX;

namespace XivRender;

public static class Crc
{
    private static readonly Dictionary<string, uint> Cache = new();

    /// <summary>The CRC the game uses for shader key, value, pass and resource names.</summary>
    public static uint Of(string name)
    {
        lock (Cache)
        {
            if (!Cache.TryGetValue(name, out var v))
                Cache[name] = v = new Name(name).Crc32;
            return v;
        }
    }

    public static string NameOf(uint id) => Names.KnownNames.TryGetValue(id, out var n) ? n.Value : $"0x{id:X8}";
}

public sealed unsafe class GpuShader
{
    public byte[]                Blob = Array.Empty<byte>();
    public ShaderInfo            Info = null!;
    public ID3D11VertexShader*   Vs;
    public ID3D11PixelShader*    Ps;
    public ID3D11ComputeShader*  Cs;
    public string                Label = "";
}

/// <summary>One .shpk: its nodes (selected by system/scene/material/sub-view keys) and the D3D shaders behind each pass.</summary>
public sealed unsafe class GameShaderPackage
{
    public string   Name = "";
    public string   Path = "";
    public bool     FromMod;
    public ShpkFile File = null!;

    private readonly Gpu _gpu;
    private readonly Dictionary<int, GpuShader> _vs = new();
    private readonly Dictionary<int, GpuShader> _ps = new();

    public GameShaderPackage(Gpu gpu) => _gpu = gpu;

    public GpuShader Vertex(int i)
    {
        if (_vs.TryGetValue(i, out var s))
            return s;
        var blob = File.VertexShaders[i].Blob;
        s = new GpuShader { Blob = blob, Info = ShaderInfo.Read(blob), Label = $"{Name} vs{i}" };
        ID3D11VertexShader* vs;
        fixed (byte* p = blob)
            Gpu.Check(_gpu.Device->CreateVertexShader(p, (nuint)blob.Length, null, &vs), $"CreateVertexShader {s.Label}");
        s.Vs = vs;
        return _vs[i] = s;
    }

    public GpuShader Pixel(int i)
    {
        if (_ps.TryGetValue(i, out var s))
            return s;
        var blob = File.PixelShaders[i].Blob;
        s = new GpuShader { Blob = blob, Info = ShaderInfo.Read(blob), Label = $"{Name} ps{i}" };
        ID3D11PixelShader* ps;
        fixed (byte* p = blob)
            Gpu.Check(_gpu.Device->CreatePixelShader(p, (nuint)blob.Length, null, &ps), $"CreatePixelShader {s.Label}");
        s.Ps = ps;
        return _ps[i] = s;
    }

    private static uint[] Values(ShpkFile.Key[] keys, IReadOnlyDictionary<uint, uint>? set)
    {
        var v = new uint[keys.Length];
        for (var i = 0; i < keys.Length; i++)
            v[i] = set != null && set.TryGetValue(keys[i].Id, out var x) ? x : keys[i].DefaultValue;
        return v;
    }

    public uint Selector(IReadOnlyDictionary<uint, uint>? sys, IReadOnlyDictionary<uint, uint>? scene, IReadOnlyDictionary<uint, uint>? material,
        IReadOnlyDictionary<uint, uint>? subView)
        => ShpkFile.BuildSelector(Values(File.SystemKeys, sys), Values(File.SceneKeys, scene), Values(File.MaterialKeys, material),
            Values(File.SubViewKeys, subView));

    /// <summary>The (vertex, pixel) shader pair of a pass for the given keys, or null when the package has no such node/pass.</summary>
    public (GpuShader vs, GpuShader ps)? Pass(string pass, IReadOnlyDictionary<uint, uint>? sys, IReadOnlyDictionary<uint, uint>? scene,
        IReadOnlyDictionary<uint, uint>? material, IReadOnlyDictionary<uint, uint>? subView)
    {
        var node = File.GetNodeBySelector(Selector(sys, scene, material, subView));
        if (node == null)
            return null;
        var id = Crc.Of(pass);
        foreach (var p in node.Value.Passes)
            if (p.Id == id)
            {
                if (p.VertexShader >= File.VertexShaders.Length || p.PixelShader >= File.PixelShaders.Length)
                    return null;
                return (Vertex((int)p.VertexShader), Pixel((int)p.PixelShader));
            }

        return null;
    }

    public bool HasSceneKey(string key) => File.SceneKeys.Any(k => k.Id == Crc.Of(key));
}

/// <summary>Loads .shpk packages (mods may replace them) and single-shader .shcd files.</summary>
public sealed unsafe class ShaderCache
{
    private readonly Gpu _gpu;
    private readonly FileSource _src;
    private readonly Dictionary<string, GameShaderPackage?> _packages = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, GpuShader?> _codes = new(StringComparer.OrdinalIgnoreCase);

    public ShaderCache(Gpu gpu, FileSource src)
    {
        _gpu = gpu;
        _src = src;
    }

    public GameShaderPackage? Package(string name)
    {
        if (_packages.TryGetValue(name, out var p))
            return p;
        var path  = $"shader/sm5/shpk/{name}";
        var bytes = _src.Read(path);
        p = bytes == null ? null : new GameShaderPackage(_gpu)
        {
            Name = name, Path = path, FromMod = _src.LocalPath(path) != null, File = new ShpkFile(bytes, false),
        };
        return _packages[name] = p;
    }

    public GpuShader? Code(string path)
    {
        if (_codes.TryGetValue(path, out var s))
            return s;
        var bytes = _src.Read(path);
        s = null;
        if (bytes != null)
        {
            for (var i = 0; i + 28 < bytes.Length; i++)
            {
                if (bytes[i] != 'D' || bytes[i + 1] != 'X' || bytes[i + 2] != 'B' || bytes[i + 3] != 'C')
                    continue;
                var size = BitConverter.ToInt32(bytes, i + 24);
                var blob = bytes.AsSpan(i, size).ToArray();
                s = new GpuShader { Blob = blob, Info = ShaderInfo.Read(blob), Label = path };
                fixed (byte* b = blob)
                {
                    switch (s.Info.Stage)
                    {
                        case 0:
                            ID3D11PixelShader* ps;
                            Gpu.Check(_gpu.Device->CreatePixelShader(b, (nuint)blob.Length, null, &ps), path);
                            s.Ps = ps;
                            break;
                        case 1:
                            ID3D11VertexShader* vs;
                            Gpu.Check(_gpu.Device->CreateVertexShader(b, (nuint)blob.Length, null, &vs), path);
                            s.Vs = vs;
                            break;
                        case 5:
                            ID3D11ComputeShader* cs;
                            Gpu.Check(_gpu.Device->CreateComputeShader(b, (nuint)blob.Length, null, &cs), path);
                            s.Cs = cs;
                            break;
                    }
                }

                break;
            }
        }

        return _codes[path] = s;
    }
}
