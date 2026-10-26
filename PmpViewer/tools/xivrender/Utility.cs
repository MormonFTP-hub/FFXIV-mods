using System.Numerics;
using System.Text;
using TerraFX.Interop.DirectX;
using static TerraFX.Interop.DirectX.DirectX;

namespace XivRender;

/// <summary>
/// Engine-side helper passes that have no game shader behind them (the game builds these buffers in code):
/// the view-space position target glass reads (RenderTargetManager.ViewPosition), from the depth buffer.
/// </summary>
public sealed unsafe partial class Renderer
{
    private const string ViewPosHlsl = @"
cbuffer P : register(b0) { float4x4 InvProj; float4 Size; };
Texture2D<float> Depth : register(t0);
float4 vs(uint id : SV_VertexID) : SV_Position
{
    float2 uv = float2((id << 1) & 2, id & 2);
    return float4(uv * float2(2, -2) + float2(-1, 1), 0, 1);
}
float4 ps(float4 pos : SV_Position) : SV_Target
{
    float d = max(Depth.Load(int3(pos.xy, 0)), 0.000001);
    float2 ndc = pos.xy * Size.zw * float2(2, -2) + float2(-1, 1);
    float4 v = mul(InvProj, float4(ndc, d, 1));
    return float4(v.xyz / v.w, 1);
}";

    private ID3D11VertexShader* _vpVs;
    private ID3D11PixelShader*  _vpPs;
    private ID3D11Buffer*       _vpCb;
    private Gpu.Target?         _viewPos, _finalColor;

    private byte[] Compile(string src, string entry, string target)
    {
        var code = Encoding.ASCII.GetBytes(src);
        var e    = Encoding.ASCII.GetBytes(entry + "\0");
        var t    = Encoding.ASCII.GetBytes(target + "\0");
        ID3DBlob* blob;
        ID3DBlob* err;
        fixed (byte* pc = code)
        fixed (byte* pe = e)
        fixed (byte* pt = t)
        {
            var hr = D3DCompile(pc, (nuint)code.Length, null, null, null, (sbyte*)pe, (sbyte*)pt, 0, 0, &blob, &err);
            if (hr.FAILED)
            {
                var msg = err != null ? new string((sbyte*)err->GetBufferPointer(), 0, (int)err->GetBufferSize()) : "";
                throw new Exception($"D3DCompile {entry}: {msg}");
            }
        }

        var bytes = new Span<byte>(blob->GetBufferPointer(), (int)blob->GetBufferSize()).ToArray();
        blob->Release();
        return bytes;
    }

    /// <summary>View-space position per pixel (xyz, w = 1) from the depth buffer.</summary>
    private void ViewPositions()
    {
        if (_vpVs == null)
        {
            var vs = Compile(ViewPosHlsl, "vs", "vs_5_0");
            var ps = Compile(ViewPosHlsl, "ps", "ps_5_0");
            ID3D11VertexShader* v;
            ID3D11PixelShader*  p;
            fixed (byte* b = vs) Gpu.Check(Gpu.Device->CreateVertexShader(b, (nuint)vs.Length, null, &v), "viewpos vs");
            fixed (byte* b = ps) Gpu.Check(Gpu.Device->CreatePixelShader(b, (nuint)ps.Length, null, &p), "viewpos ps");
            _vpVs = v;
            _vpPs = p;
            _vpCb = Gpu.CreateBuffer(Array.Empty<byte>(), D3D11_BIND_FLAG.D3D11_BIND_CONSTANT_BUFFER, dynamic: true, size: 80);
        }

        if (_viewPos == null || _viewPos.Width != _w || _viewPos.Height != _h)
        {
            _viewPos?.Release();
            _viewPos = Gpu.CreateTarget(_w, _h, DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_FLOAT);
        }

        // HLSL mul(InvProj, v) uses the column-vector matrix C = transpose(_invProj); a column_major cbuffer stores C's
        // columns, which are _invProj's rows, so _invProj goes in as is, row by row
        var data = new float[20];
        var ip = _invProj;
        new[] { ip.M11, ip.M12, ip.M13, ip.M14, ip.M21, ip.M22, ip.M23, ip.M24, ip.M31, ip.M32, ip.M33, ip.M34, ip.M41, ip.M42, ip.M43, ip.M44 }.CopyTo(data, 0);
        data[16] = _w;
        data[17] = _h;
        data[18] = 1f / _w;
        data[19] = 1f / _h;
        Gpu.Update(_vpCb, System.Runtime.InteropServices.MemoryMarshal.AsBytes(data.AsSpan()));

        SetTargets(new[] { _viewPos }, null);
        SetState(Opaque, DepthState(false, false), Gpu.Raster(D3D11_CULL_MODE.D3D11_CULL_NONE, false));
        Gpu.Ctx->IASetInputLayout(null);
        Gpu.Ctx->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY.D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
        Gpu.Ctx->VSSetShader(_vpVs, null, 0);
        Gpu.Ctx->PSSetShader(_vpPs, null, 0);
        var cb = _vpCb;
        Gpu.Ctx->PSSetConstantBuffers(0, 1, &cb);
        var srv = _depth!.Srv;
        Gpu.Ctx->PSSetShaderResources(0, 1, &srv);
        Gpu.Ctx->Draw(3, 0);
        UnbindAll();
        _frame.Srv["g_SamplerViewPosition"] = (nint)_viewPos.Srv;
        _frame.Sampler["g_SamplerViewPosition"] = (nint)PointClamp;
    }

    /// <summary>The scene colour so far, for refraction (glass): RenderTargetManager's final colour copy.</summary>
    private void FinalColorCopy()
    {
        if (_finalColor == null || _finalColor.Width != _w || _finalColor.Height != _h)
        {
            _finalColor?.Release();
            _finalColor = Gpu.CreateTarget(_w, _h, _hdr!.Format);
        }

        Gpu.Ctx->CopyResource((ID3D11Resource*)_finalColor.Tex, (ID3D11Resource*)_hdr!.Tex);
        _frame.Srv["g_SamplerFinalColor"]     = (nint)_finalColor.Srv;
        _frame.Sampler["g_SamplerFinalColor"] = (nint)LinearClamp;
    }
}
