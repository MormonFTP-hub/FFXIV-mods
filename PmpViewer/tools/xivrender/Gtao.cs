using System.Numerics;
using TerraFX.Interop.DirectX;

namespace XivRender;

/// <summary>
/// The game's ambient occlusion: XeGTAO (Intel's GTAO) as compiled into shader/sm5/compute/gtao*.shcd, run with the
/// game's own compute shaders. cConstant0 (6 x float4), as the shaders read it:
///   [0] effect radius, radius multiplier (the game ramps the radius from 0.25 m at 0.5 m to this at 2.5 m), falloff range, denoise blur beta
///   [1] depth unpack mul, depth unpack add (view z = mul / (add - depth)), sample distribution power, thin occluder compensation
///   [2] viewport size, 1 / viewport size
///   [3] NDC-to-view mul (xy), add (zw)  (view xy = (mul * uv + add) * view z)
///   [4] noise index, final value power, NDC-to-view mul x pixel size
/// Values are XeGTAO's defaults; the game's TAA pass is replaced by averaging several noise indices for stills.
/// </summary>
public sealed unsafe partial class Renderer
{
    private ID3D11Texture2D* _aoDepth, _aoTerm, _aoEdges, _aoOut, _hilbert;
    private ID3D11ShaderResourceView* _aoDepthSrv, _aoTermSrv, _aoEdgesSrv, _aoOutSrv, _hilbertSrv;
    private readonly nint[] _aoDepthUav = new nint[5];
    private ID3D11UnorderedAccessView* _aoTermUav, _aoEdgesUav, _aoOutUav;
    private int _aoW, _aoH;

    public float AoRadius = 0.5f, AoRadiusMultiplier = 1.457f, AoFalloff = 0.615f, AoPower = 2.2f, AoDistribution = 2f, AoThin = 0f, AoBeta = 1.2f;

    private ID3D11Texture2D* Tex2D(int w, int h, DXGI_FORMAT f, int mips, bool uav)
    {
        var desc = new D3D11_TEXTURE2D_DESC
        {
            Width = (uint)w, Height = (uint)h, MipLevels = (uint)mips, ArraySize = 1, Format = f, SampleDesc = new DXGI_SAMPLE_DESC(1, 0),
            Usage = D3D11_USAGE.D3D11_USAGE_DEFAULT,
            BindFlags = (uint)D3D11_BIND_FLAG.D3D11_BIND_SHADER_RESOURCE | (uav ? (uint)D3D11_BIND_FLAG.D3D11_BIND_UNORDERED_ACCESS : 0),
        };
        ID3D11Texture2D* t;
        Gpu.Check(Gpu.Device->CreateTexture2D(&desc, null, &t), "CreateTexture2D(gtao)");
        return t;
    }

    private ID3D11UnorderedAccessView* Uav(ID3D11Texture2D* t, DXGI_FORMAT f, int mip)
    {
        var d = new D3D11_UNORDERED_ACCESS_VIEW_DESC { Format = f, ViewDimension = D3D11_UAV_DIMENSION.D3D11_UAV_DIMENSION_TEXTURE2D };
        d.Texture2D.MipSlice = (uint)mip;
        ID3D11UnorderedAccessView* u;
        Gpu.Check(Gpu.Device->CreateUnorderedAccessView((ID3D11Resource*)t, &d, &u), "CreateUAV(gtao)");
        return u;
    }

    private ID3D11ShaderResourceView* Srv(ID3D11Texture2D* t)
    {
        ID3D11ShaderResourceView* s;
        Gpu.Check(Gpu.Device->CreateShaderResourceView((ID3D11Resource*)t, null, &s), "CreateSRV(gtao)");
        return s;
    }

    private void EnsureGtao()
    {
        if (_aoW == _w && _aoH == _h)
            return;
        if (_aoDepth != null)
        {
            foreach (var u in _aoDepthUav) ((ID3D11UnorderedAccessView*)u)->Release();
            _aoTermUav->Release(); _aoEdgesUav->Release(); _aoOutUav->Release();
            _aoDepthSrv->Release(); _aoTermSrv->Release(); _aoEdgesSrv->Release(); _aoOutSrv->Release();
            _aoDepth->Release(); _aoTerm->Release(); _aoEdges->Release(); _aoOut->Release();
        }

        _aoW = _w;
        _aoH = _h;
        _aoDepth = Tex2D(_w, _h, DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT, 5, true);
        for (var m = 0; m < 5; m++)
            _aoDepthUav[m] = (nint)Uav(_aoDepth, DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT, m);
        _aoDepthSrv = Srv(_aoDepth);
        _aoTerm  = Tex2D(_w, _h, DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT, 1, true);
        _aoEdges = Tex2D(_w, _h, DXGI_FORMAT.DXGI_FORMAT_R8_UNORM, 1, true);
        _aoOut   = Tex2D(_w, _h, DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT, 1, true);
        _aoTermUav  = Uav(_aoTerm, DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT, 0);
        _aoEdgesUav = Uav(_aoEdges, DXGI_FORMAT.DXGI_FORMAT_R8_UNORM, 0);
        _aoOutUav   = Uav(_aoOut, DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT, 0);
        _aoTermSrv  = Srv(_aoTerm);
        _aoEdgesSrv = Srv(_aoEdges);
        _aoOutSrv   = Srv(_aoOut);

        if (_hilbert == null)
        {
            // XeGTAO's 64x64 Hilbert curve index, read back as R16_UNORM * 65536
            var data = new ushort[64 * 64];
            for (var y = 0; y < 64; y++)
            for (var x = 0; x < 64; x++)
                data[y * 64 + x] = (ushort)HilbertIndex((uint)x, (uint)y);
            var bytes = System.Runtime.InteropServices.MemoryMarshal.AsBytes(data.AsSpan()).ToArray();
            _hilbertSrv = Gpu.CreateTexture(DXGI_FORMAT.DXGI_FORMAT_R16_UNORM, 64, 64, 1, 1, 1, false, false, new[] { (bytes, 128, bytes.Length) });
            _hilbert    = (ID3D11Texture2D*)1;
        }
    }

    private static uint HilbertIndex(uint posX, uint posY)
    {
        uint index = 0;
        for (uint curLevel = 64 / 2; curLevel > 0; curLevel /= 2)
        {
            var regionX = (posX & curLevel) > 0 ? 1u : 0u;
            var regionY = (posY & curLevel) > 0 ? 1u : 0u;
            index += curLevel * curLevel * ((3 * regionX) ^ regionY);
            if (regionY == 0)
            {
                if (regionX == 1)
                {
                    posX = 63 - posX;
                    posY = 63 - posY;
                }

                (posX, posY) = (posY, posX);
            }
        }

        return index;
    }

    private void SetGtaoConstants(GpuShader sh, int noise)
    {
        foreach (var cbl in sh.Info.Cbs)
        {
            if (cbl.Name != "cConstant0")
                continue;
            var near = _scene.Camera.Near;
            var tanY = 1f / _proj.M22;
            var tanX = 1f / _proj.M11;
            var mul  = new Vector2(2 * tanX, -2 * tanY);
            var add  = new Vector2(-tanX, tanY);
            Cbs.Ensure(cbl).Set("cConstant0",
                AoRadius, AoRadiusMultiplier, AoFalloff, AoBeta,
                -near, 0, AoDistribution, AoThin,
                _w, _h, 1f / _w, 1f / _h,
                mul.X, mul.Y, add.X, add.Y,
                noise, AoPower, mul.X / _w, mul.Y / _h,
                tanX, tanY, 0, 0);
        }
    }

    private void Dispatch(GpuShader cs, Bindings b, ID3D11UnorderedAccessView*[] uavs, int uavStart, int gx, int gy)
    {
        Gpu.Ctx->CSSetShader(cs.Cs, null, 0);
        foreach (var cbl in cs.Info.Cbs)
        {
            var buf = Cbs.Ensure(cbl).Upload(Gpu);
            Gpu.Ctx->CSSetConstantBuffers((uint)cbl.Slot, 1, &buf);
        }

        foreach (var t in cs.Info.Textures)
        {
            if (t.Type is D3D_SHADER_INPUT_TYPE.D3D_SIT_UAV_RWTYPED)
                continue;
            b.Srv.TryGetValue(t.Name, out var srv);
            if (srv == 0) _frame.Srv.TryGetValue(t.Name, out srv);
            var p = (ID3D11ShaderResourceView*)srv;
            Gpu.Ctx->CSSetShaderResources((uint)t.Slot, 1, &p);
        }

        foreach (var s in cs.Info.Samplers)
        {
            var p = PointClamp;
            Gpu.Ctx->CSSetSamplers((uint)s.Slot, 1, &p);
        }

        fixed (ID3D11UnorderedAccessView** pu = uavs)
            Gpu.Ctx->CSSetUnorderedAccessViews((uint)uavStart, (uint)uavs.Length, pu, null);
        Gpu.Ctx->Dispatch((uint)gx, (uint)gy, 1);
        var nullUav = stackalloc ID3D11UnorderedAccessView*[8];
        for (var i = 0; i < 8; i++) nullUav[i] = null;
        Gpu.Ctx->CSSetUnorderedAccessViews(0, 8, nullUav, null);
        var nullSrv = stackalloc ID3D11ShaderResourceView*[8];
        for (var i = 0; i < 8; i++) nullSrv[i] = null;
        Gpu.Ctx->CSSetShaderResources(0, 8, nullSrv);
    }

    /// <summary>Runs prefilter, main pass and denoise; returns the occlusion SRV (1 = unoccluded), or null when unavailable.</summary>
    private ID3D11ShaderResourceView* Gtao(int noise)
    {
        var pre = Shaders.Code("shader/sm5/compute/gtaoprefilterdepth.shcd");
        var main = Shaders.Code("shader/sm5/compute/gtaomainpass.shcd");
        var den = Shaders.Code("shader/sm5/compute/gtaodenoise.shcd");
        if (pre?.Cs == null || main?.Cs == null || den?.Cs == null)
            return null;
        EnsureGtao();
        foreach (var s in new[] { pre, main, den })
            SetGtaoConstants(s, noise);

        var b = new Bindings();
        b.Srv["g_SamplerDepth"] = (nint)_depth!.Srv;
        Dispatch(pre, b, new[] { (ID3D11UnorderedAccessView*)_aoDepthUav[0], (ID3D11UnorderedAccessView*)_aoDepthUav[1],
            (ID3D11UnorderedAccessView*)_aoDepthUav[2], (ID3D11UnorderedAccessView*)_aoDepthUav[3], (ID3D11UnorderedAccessView*)_aoDepthUav[4] },
            0, (_w + 15) / 16, (_h + 15) / 16);

        b = new Bindings();
        b.Srv["g_PrefilterDepth"] = (nint)_aoDepthSrv;
        b.Srv["g_srcHilbertLUT"]  = (nint)_hilbertSrv;
        b.Srv["g_srcNormalmap"]   = (nint)_gbuf[0]!.Srv;
        Dispatch(main, b, new[] { _aoTermUav, _aoEdgesUav }, 5, (_w + 7) / 8, (_h + 7) / 8);

        b = new Bindings();
        b.Srv["g_SourceAOTerm"] = (nint)_aoTermSrv;
        b.Srv["g_SourceEdges"]  = (nint)_aoEdgesSrv;
        Dispatch(den, b, new[] { _aoOutUav }, 5, (_w + 15) / 16, (_h + 7) / 8);
        return _aoOutSrv;
    }
}
