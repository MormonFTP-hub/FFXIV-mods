using Lumina;

namespace XivRender;

/// <summary>
/// Everything loaded through one set of redirections (one figure: the mod over the collection, or vanilla): its file
/// source and the textures, shader packages, materials and models read through it. Figures with the same redirections
/// share a set; sets that haven't been used for a while are released.
/// </summary>
public sealed unsafe class AssetSet
{
    public readonly string        Key;
    public readonly FileSource    Src;
    public readonly TextureCache  Tex;
    public readonly ShaderCache   Shaders;
    public readonly MaterialCache Mats;
    public readonly Dictionary<string, GpuModel?> Models = new(StringComparer.OrdinalIgnoreCase);
    public readonly Dictionary<string, nint>      TileArrays = new();
    public long LastUsed;

    private readonly Gpu _gpu;

    public AssetSet(Gpu gpu, GameData game, IReadOnlyDictionary<string, string> redirects, string key)
    {
        _gpu    = gpu;
        Key     = key;
        Src     = new FileSource(game);
        foreach (var (k, v) in redirects)
            Src.Redirects[k] = v;
        Tex     = new TextureCache(gpu, Src);
        Shaders = new ShaderCache(gpu, Src);
        Mats    = new MaterialCache(gpu, Src, Tex, Shaders);
    }

    public static string KeyOf(IReadOnlyDictionary<string, string> redirects)
        => string.Join("\n", redirects.OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase).Select(x => x.Key + "=" + x.Value));

    public GpuModel? Model(string path, Action<string> note)
    {
        if (Models.TryGetValue(path, out var m))
            return m;
        var bytes = Src.Read(path);
        m = null;
        if (bytes != null)
        {
            try
            {
                m = GpuModel.Load(_gpu, path, bytes);
            }
            catch (Exception e)
            {
                note($"model {path}: {e.Message}");
            }
        }
        else
        {
            note($"model {path} not found");
        }

        return Models[path] = m;
    }

    public void Release()
    {
        foreach (var m in Models.Values)
            m?.Release();
        Models.Clear();
        Mats.Clear();
        Tex.Clear();
        TileArrays.Clear();
    }
}
