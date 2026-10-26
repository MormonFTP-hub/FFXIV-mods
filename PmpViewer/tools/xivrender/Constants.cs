using System.Numerics;
using System.Runtime.InteropServices;
using TerraFX.Interop.DirectX;

namespace XivRender;

/// <summary>
/// One constant buffer by name. The layout comes from the game shaders' own reflection data, so values are written by
/// member name ("m_ViewMatrix", "param.sh.param") and land wherever that shader expects them.
/// </summary>
public sealed unsafe class CbData
{
    public string Name = "";
    public byte[] Data = new byte[16];
    public readonly Dictionary<string, ShaderInfo.Var> Vars = new(StringComparer.Ordinal);
    public ID3D11Buffer* Buffer;
    public int  BufferSize;
    public bool Dirty = true;

    public void Merge(ShaderInfo.Cb layout)
    {
        foreach (var v in layout.Vars)
            Vars.TryAdd(v.Key, v.Value);
        if (layout.Size > Data.Length)
        {
            var d = new byte[(layout.Size + 15) & ~15];
            Data.CopyTo(d, 0);
            Data  = d;
            Dirty = true;
        }
    }

    public bool Has(string path) => Vars.ContainsKey(path);

    public void Set(string path, params float[] values) => Set(path, values.AsSpan());

    public void Set(string path, ReadOnlySpan<float> values)
    {
        if (!Vars.TryGetValue(path, out var v))
            return;
        var bytes = MemoryMarshal.AsBytes(values);
        var n     = Math.Min(bytes.Length, Data.Length - v.Offset);
        bytes[..n].CopyTo(Data.AsSpan(v.Offset));
        Dirty = true;
    }

    public void SetUInt(string path, params uint[] values)
    {
        if (!Vars.TryGetValue(path, out var v))
            return;
        MemoryMarshal.AsBytes(values.AsSpan()).CopyTo(Data.AsSpan(v.Offset));
        Dirty = true;
    }

    public void Set(string path, Vector4 v) => Set(path, v.X, v.Y, v.Z, v.W);
    public void Set(string path, Vector3 v) => Set(path, v.X, v.Y, v.Z);

    /// <summary>Writes a System.Numerics (row-vector) matrix where HLSL expects a row_major float4x4 / float3x4 used as M * v.</summary>
    public void SetMatrix(string path, Matrix4x4 m, int rows = 4)
    {
        var t = Matrix4x4.Transpose(m);
        Span<float> f = stackalloc float[16]
        {
            t.M11, t.M12, t.M13, t.M14,
            t.M21, t.M22, t.M23, t.M24,
            t.M31, t.M32, t.M33, t.M34,
            t.M41, t.M42, t.M43, t.M44,
        };
        Set(path, f[..(rows * 4)]);
    }

    public void SetBytes(ReadOnlySpan<byte> bytes)
    {
        bytes[..Math.Min(bytes.Length, Data.Length)].CopyTo(Data);
        Dirty = true;
    }

    public ID3D11Buffer* Upload(Gpu gpu)
    {
        if (Buffer == null || BufferSize < Data.Length)
        {
            if (Buffer != null)
                Buffer->Release();
            Buffer     = gpu.CreateBuffer(Array.Empty<byte>(), D3D11_BIND_FLAG.D3D11_BIND_CONSTANT_BUFFER, dynamic: true, size: Data.Length);
            BufferSize = Data.Length;
            Dirty      = true;
        }

        if (Dirty)
        {
            gpu.Update(Buffer, Data);
            Dirty = false;
        }

        return Buffer;
    }
}

public sealed class CbBank
{
    private readonly Dictionary<string, CbData> _cbs = new(StringComparer.Ordinal);

    /// <summary>Fillers run whenever a buffer is first seen and at every frame start; per-draw values are set after Ensure.</summary>
    public readonly Dictionary<string, Action<CbData>> Fillers = new(StringComparer.Ordinal);

    public CbData Ensure(ShaderInfo.Cb layout)
    {
        if (!_cbs.TryGetValue(layout.Name, out var cb))
        {
            _cbs[layout.Name] = cb = new CbData { Name = layout.Name };
            cb.Merge(layout);
            if (Fillers.TryGetValue(layout.Name, out var f))
                f(cb);
            return cb;
        }

        var before = cb.Vars.Count;
        cb.Merge(layout);
        if (cb.Vars.Count != before && Fillers.TryGetValue(layout.Name, out var f2))
            f2(cb);
        return cb;
    }

    public CbData? Get(string name) => _cbs.GetValueOrDefault(name);

    public void Refill()
    {
        foreach (var (name, cb) in _cbs)
            if (Fillers.TryGetValue(name, out var f))
                f(cb);
    }
}
