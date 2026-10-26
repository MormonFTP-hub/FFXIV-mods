using System.Numerics;
using System.Runtime.InteropServices;
using Lumina;
using Penumbra.GameData.Files;
using TerraFX.Interop.DirectX;

namespace XivRender;

/// <summary>
/// Draws a scene the way the game's light pre-pass renderer does, running the game's own shaders:
/// G-buffer pass, directional lighting into diffuse/specular light buffers, composite pass, tone mapping.
/// </summary>
public sealed unsafe partial class Renderer : IDisposable
{
    public readonly Gpu           Gpu;
    public readonly CbBank        Cbs = new();
    public readonly List<string>  Log = new();
    private readonly GameData     _game;

    /// <summary>Asset sets by redirection key; the primary one (first figure) also serves the frame-wide shaders.</summary>
    private readonly Dictionary<string, AssetSet> _sets = new();
    private AssetSet _primary;
    private long _use;

    public FileSource    Src     => _primary.Src;
    public TextureCache  Tex     => _primary.Tex;
    public ShaderCache   Shaders => _primary.Shaders;
    public MaterialCache Mats    => _primary.Mats;

    public Renderer(GameData game, bool debug = false)
    {
        Gpu      = new Gpu(debug);
        _game    = game;
        _primary = Set(new Dictionary<string, string>());
        InitGlobals();
    }

    private AssetSet Set(IReadOnlyDictionary<string, string> redirects)
    {
        var key = AssetSet.KeyOf(redirects);
        if (!_sets.TryGetValue(key, out var set))
        {
            _sets[key] = set = new AssetSet(Gpu, _game, redirects, key);
            // keep the most recently used few (a mod, its vanilla comparison, the previous option set)
            foreach (var old in _sets.Values.OrderByDescending(x => x.LastUsed).Skip(4).ToList())
            {
                old.Release();
                _sets.Remove(old.Key);
            }
        }

        set.LastUsed = ++_use;
        return set;
    }

    public void Note(string msg)
    {
        lock (Log)
            if (!Log.Contains(msg))
                Log.Add(msg);
    }

    // ------------------------------------------------------------------ resources shared by every frame

    private ID3D11ShaderResourceView* _white, _black, _flatNormal, _transparent, _dither, _noise, _reflection, _shaderTypes, _kernel;
    private ID3D11ShaderResourceView* _zero16, _zero4;   // empty structured buffers (seam connection / shape deform data)
    private ID3D11Buffer* _lightQuad, _postQuad, _joints, _jointsPrev;
    private ID3D11ShaderResourceView* _jointSrv, _jointPrevSrv;
    private const int MaxJoints = 1024;

    private ID3D11ShaderResourceView* Solid(byte r, byte g, byte b, byte a, int size = 4)
    {
        var px = new byte[size * size * 4];
        for (var i = 0; i < size * size; i++)
        {
            px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = a;
        }

        return Gpu.CreateTexture(DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM, size, size, 1, 1, 1, false, false, new[] { (px, size * 4, px.Length) });
    }

    private void InitGlobals()
    {
        _white       = Solid(255, 255, 255, 255);
        _black       = Solid(0, 0, 0, 255);
        _flatNormal  = Solid(128, 128, 255, 255);
        _transparent = Solid(0, 0, 0, 0);
        _kernel      = Solid(255, 255, 255, 255, 64);

        // 16x16 ordered dither and value noise (the game's own textures are engine resources)
        var dither = new byte[16 * 16 * 4];
        int[] bayer4 = { 0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5 };
        for (var y = 0; y < 16; y++)
        for (var x = 0; x < 16; x++)
        {
            var v = (byte)(bayer4[(y % 4) * 4 + x % 4] * 16 + 8);
            dither[(y * 16 + x) * 4] = dither[(y * 16 + x) * 4 + 1] = dither[(y * 16 + x) * 4 + 2] = dither[(y * 16 + x) * 4 + 3] = v;
        }

        _dither = Gpu.CreateTexture(DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM, 16, 16, 1, 1, 1, false, false, new[] { (dither, 64, dither.Length) });
        var rng   = new Random(1234);
        var noise = new byte[256 * 256 * 4];
        rng.NextBytes(noise);
        _noise = Gpu.CreateTexture(DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM, 256, 256, 1, 1, 1, false, false, new[] { (noise, 1024, noise.Length) });

        // fullscreen quads: lighting shaders take clip-space positions, post effects (CopyVS) take 0..1 position + uv
        float[] lq = { -1, -1, 0, 1, -1, 1, 0, 1, 1, -1, 0, 1, 1, 1, 0, 1 };
        float[] pq = { 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0 };
        _lightQuad = Gpu.CreateBuffer(MemoryMarshal.AsBytes(lq.AsSpan()), D3D11_BIND_FLAG.D3D11_BIND_VERTEX_BUFFER);
        _postQuad  = Gpu.CreateBuffer(MemoryMarshal.AsBytes(pq.AsSpan()), D3D11_BIND_FLAG.D3D11_BIND_VERTEX_BUFFER);

        _joints       = Gpu.CreateBuffer(Array.Empty<byte>(), D3D11_BIND_FLAG.D3D11_BIND_SHADER_RESOURCE, dynamic: true, structStride: 48, size: MaxJoints * 48);
        _jointsPrev   = Gpu.CreateBuffer(Array.Empty<byte>(), D3D11_BIND_FLAG.D3D11_BIND_SHADER_RESOURCE, dynamic: true, structStride: 48, size: MaxJoints * 48);
        _jointSrv     = Gpu.StructuredSrv(_joints, MaxJoints);
        _jointPrevSrv = Gpu.StructuredSrv(_jointsPrev, MaxJoints);

        _zero16 = Gpu.StructuredSrv(Gpu.CreateBuffer(new byte[16 * 4], D3D11_BIND_FLAG.D3D11_BIND_SHADER_RESOURCE, structStride: 16), 4);
        _zero4  = Gpu.StructuredSrv(Gpu.CreateBuffer(new byte[16], D3D11_BIND_FLAG.D3D11_BIND_SHADER_RESOURCE, structStride: 4), 4);
        BuildShaderTypeTable();
        SetReflection(new Vector3(0.35f, 0.37f, 0.42f), new Vector3(0.35f, 0.37f, 0.42f));
        RegisterFillers();
    }

    public readonly List<string> ShaderTypeNotes = new();

    /// <summary>
    /// g_ShaderTypeParameter: the game's common/chara/bg shader parameter tables (.spm), 32 entries each.
    /// Character materials index entry 32 + the colour table row's shader id, so the chara table is the second block.
    /// </summary>
    private void BuildShaderTypeTable()
    {
        var data = new byte[96 * 128];
        var tables = new[] { "common/graphics/common_shader_param.spm", "common/graphics/chara_shader_param.spm", "common/graphics/bg_shader_param.spm" };
        for (var t = 0; t < 3; t++)
        {
            var bytes = Src.Read(tables[t]);
            if (bytes == null)
                continue;
            var spm = new SpmFile(bytes);
            foreach (var row in spm.Rows)
            {
                if (row.Item2 >= 32)
                    continue;
                var at = (t * 32 + (int)row.Item2) * 128;
                float F(SpmFile.Column c)
                {
                    var i = spm.Columns.FindIndex(x => x.Item1 == c);
                    if (i < 0) return 0;
                    return spm.Columns[i].Item2 == SpmFile.Type.UInt ? row.Item4[i].UInt : row.Item4[i].Float;
                }

                uint Lighting()
                {
                    var i = spm.Columns.FindIndex(x => x.Item1 == SpmFile.Column.LightingType);
                    if (i < 0) return 0;
                    return row.Item4[i].Named switch
                    {
                        SpmFile.NamedValue.Hair   => 1u,
                        SpmFile.NamedValue.Legacy => 2u,
                        SpmFile.NamedValue.Half   => 3u,
                        _                         => 0u,
                    };
                }

                var s = data.AsSpan(at, 128);
                var deg = MathF.PI / 180;
                BitConverter.TryWriteBytes(s[0..], Lighting());
                BitConverter.TryWriteBytes(s[4..], (uint)F(SpmFile.Column.SubSurfaceProfileId));
                BitConverter.TryWriteBytes(s[8..], F(SpmFile.Column.SubSurfaceWidth));
                BitConverter.TryWriteBytes(s[12..], F(SpmFile.Column.BackScatterPower));
                BitConverter.TryWriteBytes(s[16..], F(SpmFile.Column.SheenRate));
                BitConverter.TryWriteBytes(s[20..], F(SpmFile.Column.SheenTintRate));
                BitConverter.TryWriteBytes(s[24..], F(SpmFile.Column.SheenAperture));
                BitConverter.TryWriteBytes(s[28..], F(SpmFile.Column.UseSubSurfaceRate));
                BitConverter.TryWriteBytes(s[32..], F(SpmFile.Column.HairScatterColorShift));
                BitConverter.TryWriteBytes(s[36..], F(SpmFile.Column.HairSpecularPrimaryShift) * deg);
                BitConverter.TryWriteBytes(s[40..], F(SpmFile.Column.HairSpecularBackScatterShift) * deg);
                BitConverter.TryWriteBytes(s[44..], F(SpmFile.Column.HairSpecularSecondaryShift) * deg);
                BitConverter.TryWriteBytes(s[48..], F(SpmFile.Column.FurLength));
                BitConverter.TryWriteBytes(s[52..], F(SpmFile.Column.HairBackScatterRoughnessOffsetRate));
                BitConverter.TryWriteBytes(s[56..], F(SpmFile.Column.HairSecondaryRoughnessOffsetRate));
                BitConverter.TryWriteBytes(s[60..], F(SpmFile.Column.SubSurfacePower));
            }
        }

        var buf = Gpu.CreateBuffer(data, D3D11_BIND_FLAG.D3D11_BIND_SHADER_RESOURCE, structStride: 128);
        _shaderTypes = Gpu.StructuredSrv(buf, 96);
    }

    private Vector3 _reflSky, _reflGround;

    /// <summary>Reflection probe stand-in in the game's encoding (sqrt colour, alpha = weight): the sky colour above the
    /// horizon and the ground colour below it. Metal shows little but this, so sunlit ground makes gold bright.</summary>
    public void SetReflection(Vector3 sky, Vector3 ground)
    {
        if (_reflection != null && sky == _reflSky && ground == _reflGround)
            return;
        if (_reflection != null)
            _reflection->Release();
        (_reflSky, _reflGround) = (sky, ground);
        const int size = 16;
        var subs = new List<(byte[], int, int)>();
        for (var f = 0; f < 12; f++)
        {
            var px = new byte[size * size * 8];
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                float u = (x + 0.5f) / size * 2 - 1, v = (y + 0.5f) / size * 2 - 1;
                var d = (f % 6) switch     // D3D cube face order +X -X +Y -Y +Z -Z
                {
                    0 => new Vector3(1, -v, -u), 1 => new Vector3(-1, -v, u), 2 => new Vector3(u, 1, v),
                    3 => new Vector3(u, -1, -v), 4 => new Vector3(u, -v, 1), _ => new Vector3(-u, -v, -1),
                };
                var t = Math.Clamp((Vector3.Normalize(d).Y + 0.1f) / 0.2f, 0, 1);    // a soft horizon
                var c = Vector3.Lerp(ground, sky, t * t * (3 - 2 * t));
                var h = new Half[] { (Half)MathF.Sqrt(c.X), (Half)MathF.Sqrt(c.Y), (Half)MathF.Sqrt(c.Z), (Half)1 };
                MemoryMarshal.AsBytes(h.AsSpan()).CopyTo(px.AsSpan((y * size + x) * 8));
            }

            subs.Add((px, size * 8, px.Length));
        }

        _reflection = Gpu.CreateTexture(DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT, size, size, 1, 1, 12, true, false, subs);
    }

    // ------------------------------------------------------------------ targets

    private int _w, _h;
    private readonly Gpu.Target?[] _gbuf = new Gpu.Target?[5];
    private Gpu.Target? _depth, _lightDiffuse, _lightSpecular, _hdr, _toneLut, _final, _shadowMask, _occlusion, _adaptedLum, _post;

    private void EnsureTargets(int w, int h)
    {
        if (w == _w && h == _h && _final != null)
            return;
        foreach (var t in _gbuf) t?.Release();
        foreach (var t in new[] { _depth, _lightDiffuse, _lightSpecular, _hdr, _final, _shadowMask, _occlusion, _post })
            t?.Release();
        _w = w;
        _h = h;
        // G-buffer layout follows what the G pass writes: 0 normal + shader type, 1 lighting params, 2 sqrt albedo, 3 velocity, 4 geometric normal
        _gbuf[0] = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM);
        _gbuf[1] = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM);
        _gbuf[2] = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM);
        _gbuf[3] = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT);
        _gbuf[4] = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM);
        _depth         = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_D24_UNORM_S8_UINT);
        _lightDiffuse  = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT);
        _lightSpecular = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT);
        _hdr           = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT);
        _post          = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT);
        _final         = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM);
        _shadowMask    = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM);
        _occlusion     = Gpu.CreateTarget(w, h, DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM);
        _toneLut     ??= Gpu.CreateTarget(256, 1, DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT);
        _adaptedLum  ??= Gpu.CreateTarget(1, 1, DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT);
    }

    public void Dispose()
    {
        foreach (var set in _sets.Values)
            set.Release();
        Gpu.Dispose();
    }
}
