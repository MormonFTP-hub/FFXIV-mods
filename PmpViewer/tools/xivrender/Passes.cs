using System.Numerics;
using System.Runtime.InteropServices;
using TerraFX.Interop.DirectX;

namespace XivRender;

public sealed unsafe partial class Renderer
{
    private static readonly Dictionary<uint, uint> SubViewMain = new()
    {
        [1] = Crc.Of("Default"),
        [2] = Crc.Of("SUB_VIEW_MAIN"),
    };

    private static readonly Dictionary<uint, uint> SubViewShadow = new()
    {
        [1] = Crc.Of("Default"),
        [2] = Crc.Of("SUB_VIEW_SHADOW_0"),
    };

    public bool FrontCcw = Environment.GetEnvironmentVariable("XIVR_LH") != "1";   // right-handed world (j_te_l at +X, faces +Z): front faces are counter-clockwise on screen
    public bool Verbose;

    private Dictionary<uint, uint> SceneKeys(DrawItem d)
    {
        var keys = new Dictionary<uint, uint>
        {
            [Crc.Of("TransformView")] = Crc.Of(d.Mesh.Skinned ? "TransformViewSkin" : "TransformViewRigid"),
        };
        // alpha clipping only matters when the material sets a threshold (alpha is never below 0)
        if (d.Mat.AlphaThreshold > 0)
            keys[Crc.Of("ApplyAlphaClip")] = Crc.Of("ApplyAlphaClipOn");
        return keys;
    }

    /// <summary>Per-draw constant buffers and resources: material, bones, instance.</summary>
    private Bindings DrawBindings(DrawItem d, GpuShader vs, GpuShader ps)
    {
        var b = new Bindings();
        foreach (var (name, (srv, smp, _)) in d.Mat.Samplers)
        {
            b.Srv[name]     = srv;
            b.Sampler[name] = smp;
        }

        if (d.Mat.Table != null)
            b.Srv["g_SamplerTable"] = (nint)d.Mat.Table;
        b.Cb["g_MaterialParameter"] = (nint)d.Mat.ParamBuffer;
        // the character's face paint (skin.shpk samples it at the mesh's second UV set, U scaled and offset by the
        // customize W terms) when the scene names one; otherwise the frame's transparent default stays
        if (d.Desc.Decal is { Length: > 0 } decal && Tex.Get(decal) is var decalSrv && decalSrv != null)
            b.Srv["g_SamplerDecal"] = (nint)decalSrv;

        // joint palette for this mesh's bone table, already in view space (TransformViewSkin)
        if (d.Mesh.Skinned)
        {
            var count = Math.Min(d.Mesh.BoneTable.Length, MaxJoints);
            var data  = new float[Math.Max(1, count) * 12];
            for (var i = 0; i < count; i++)
            {
                var bone = d.Mesh.BoneTable[i];
                var m    = (bone < d.Skin.Length ? d.Skin[bone] : Matrix4x4.Identity) * _view;
                var o    = i * 12;
                data[o]     = m.M11; data[o + 1]  = m.M12; data[o + 2]  = m.M13;
                data[o + 3] = m.M21; data[o + 4]  = m.M22; data[o + 5]  = m.M23;
                data[o + 6] = m.M31; data[o + 7]  = m.M32; data[o + 8]  = m.M33;
                data[o + 9] = m.M41; data[o + 10] = m.M42; data[o + 11] = m.M43;
            }

            var bytes = MemoryMarshal.AsBytes(data.AsSpan());
            Gpu.Update(_joints, bytes);
            Gpu.Update(_jointsPrev, bytes);
            b.Srv["g_JointMatrixArray"]     = (nint)_jointSrv;
            b.Srv["g_JointMatrixArrayPrev"] = (nint)_jointPrevSrv;
        }

        foreach (var cbl in vs.Info.Cbs.Concat(ps.Info.Cbs))
        {
            switch (cbl.Name)
            {
                case "g_InstanceParameter":
                {
                    var cb = Cbs.Ensure(cbl);
                    var env = _scene.Env;
                    cb.Set("m_MulColor", d.Desc.MulColor);
                    cb.Set("m_EnvParameter", 1, 1, 1, 1);
                    cb.Set("m_CameraLight.m_DiffuseSpecular", env.CameraLight);
                    cb.Set("m_CameraLight.m_Rim", env.CameraRim);
                    cb.Set("m_Wetness", 0, 0, 0, 0);
                    cb.Set("m_Wind", 0, 0, 0, 0);
                    cb.Set("m_PrevWind", 0, 0, 0, 0);
                    // per eye: iris UV scale x/y and pupil exponent (customize iris size; 1 = as authored)
                    var iris = _scene.Customize != null && _scene.Customize.TryGetValue("iris", out var ir) && ir.Length >= 3 ? ir : new[] { 1f, 1f, 1f };
                    cb.Set("m_IrisParam", iris[0], iris[1], iris[2], 0, iris[0], iris[1], iris[2], 0);
                    cb.Set("m_Param", 0, 0, 0, 0);
                    cb.Set("m_HeadUpVector", 0, 1, 0, 0);
                    break;
                }
                case "g_CustomizeParameter":
                    FillCustomize(Cbs.Ensure(cbl), d.Customize ?? _scene.Customize);
                    break;
                case "g_ModelParameter":
                    Cbs.Ensure(cbl).Set("m_Params", 1, 0, 0, 0);
                    break;
                case "g_DecalColor":
                    Cbs.Ensure(cbl).Set("g_DecalColor", d.Desc.DecalColor ?? new float[] { 1, 1, 1, 0 });
                    break;
                case "g_WorldViewMatrix":
                {
                    var cb = Cbs.Ensure(cbl);
                    foreach (var v in cb.Vars.Keys.ToList())
                        if (v.Contains("WorldView", StringComparison.Ordinal))
                            cb.SetMatrix(v, d.World * _view, 3);
                    break;
                }
            }
        }

        return b;
    }

    private int DrawGeometry(string pass, IEnumerable<DrawItem> items, ID3D11DepthStencilState* depth, ID3D11BlendState* blend,
        Dictionary<uint, uint> subView, int depthBias = 0, float slopeBias = 0)
    {
        var drawn = 0;
        foreach (var d in items)
        {
            var shaders = d.Mat.Shpk.Pass(pass, null, SceneKeys(d), d.Mat.MaterialKeys, subView);
            if (shaders == null)
            {
                if (Verbose)
                    Console.Error.WriteLine($"{pass}: no node/pass for {d.Mat.Path} ({d.Mat.Shpk.Name}) subview {(subView == SubViewMain ? "main" : "shadow")}");
                if (subView == SubViewMain && d.Mat.Shpk.File.Passes.Contains(Crc.Of(pass)))
                    Note($"{d.Mat.Path}: {d.Mat.Shpk.Name} has no {pass} for these keys; mesh {d.Mesh.Index} of {d.Model.Path} skipped in that pass");
                continue;
            }

            if (Verbose)
                Console.Error.WriteLine($"{pass}: {d.Model.Path} mesh {d.Mesh.Index} ({d.Mesh.VertexCount} verts, {d.Subs.Count} subs, {d.Subs.Sum(s => s.Count) / 3} tris) {d.Mat.Path} -> {shaders.Value.vs.Label}/{shaders.Value.ps.Label}");
            var (vs, ps) = shaders.Value;
            var layout = d.Model.Layout(Gpu, d.Mesh, vs);
            var b      = DrawBindings(d, vs, ps);
            Gpu.Ctx->IASetInputLayout(layout);
            Gpu.Ctx->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY.D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
            d.Model.BindStreams(Gpu, d.Mesh);
            Gpu.Ctx->VSSetShader(vs.Vs, null, 0);
            Gpu.Ctx->PSSetShader(ps.Ps, null, 0);
            Bind(vs, b);
            Bind(ps, b);
            var cull = d.Mat.HideBackfaces ? D3D11_CULL_MODE.D3D11_CULL_BACK : D3D11_CULL_MODE.D3D11_CULL_NONE;
            var bl = blend;
            var dp = depth;
            if (pass.StartsWith("PASS_G_", StringComparison.Ordinal) && IsDecal(ps))
            {
                bl = DecalBlend(ps, d.Mat.Shpk.Name);
                dp = DepthState(true, false);
            }

            SetState(bl, dp, Gpu.Raster(cull, FrontCcw, depthBias, slopeBias));
            foreach (var sub in d.Subs)
                Gpu.Ctx->DrawIndexedInstanced((uint)sub.Count, 1, (uint)sub.Start, 0, 0);
            drawn++;
        }

        return drawn;
    }

    /// <summary>A G-pass shader that doesn't write G-buffer 0 (charactertattoo writes only the albedo target): a decal.</summary>
    private static bool IsDecal(GpuShader ps)
        => ps.Info.Outputs.Count > 0 && !ps.Info.Outputs.Any(o => o.Semantic.Equals("SV_Target", StringComparison.OrdinalIgnoreCase) && o.Index == 0);

    /// <summary>
    /// How a decal package combines with the G-buffer below it. charactertattoo alpha-blends the albedo (alpha = coverage);
    /// characterocclusion writes a darkening factor (1 = untouched) that multiplies the albedo and G-buffer 1's red channel.
    /// </summary>
    private ID3D11BlendState* DecalBlend(GpuShader ps, string package)
    {
        var mask = 0;
        foreach (var o in ps.Info.Outputs)
            if (o.Semantic.Equals("SV_Target", StringComparison.OrdinalIgnoreCase))
                mask |= 1 << o.Index;
        var multiply = package.Equals("characterocclusion.shpk", StringComparison.OrdinalIgnoreCase);
        return Gpu.Blend($"decal{mask}{multiply}", () =>
        {
            var d = new D3D11_BLEND_DESC { IndependentBlendEnable = true };
            for (var i = 0; i < 8; i++)
            {
                if ((mask & (1 << i)) == 0)
                {
                    d.RenderTarget[i] = new D3D11_RENDER_TARGET_BLEND_DESC { RenderTargetWriteMask = 0 };
                    continue;
                }

                d.RenderTarget[i] = multiply
                    ? new D3D11_RENDER_TARGET_BLEND_DESC
                    {
                        BlendEnable = true, SrcBlend = D3D11_BLEND.D3D11_BLEND_ZERO, DestBlend = D3D11_BLEND.D3D11_BLEND_SRC_COLOR,
                        BlendOp = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD, SrcBlendAlpha = D3D11_BLEND.D3D11_BLEND_ZERO, DestBlendAlpha = D3D11_BLEND.D3D11_BLEND_ONE,
                        BlendOpAlpha = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD,
                        RenderTargetWriteMask = (byte)(i == 1 ? D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_RED
                            : D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_RED | D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_GREEN | D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_BLUE),
                    }
                    : new D3D11_RENDER_TARGET_BLEND_DESC
                    {
                        BlendEnable = true, SrcBlend = D3D11_BLEND.D3D11_BLEND_SRC_ALPHA, DestBlend = D3D11_BLEND.D3D11_BLEND_INV_SRC_ALPHA,
                        BlendOp = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD, SrcBlendAlpha = D3D11_BLEND.D3D11_BLEND_ZERO, DestBlendAlpha = D3D11_BLEND.D3D11_BLEND_ONE,
                        BlendOpAlpha = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD, RenderTargetWriteMask = (byte)D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_ALL,
                    };
            }

            return d;
        });
    }

    private void Fullscreen(GpuShader vs, GpuShader ps, Bindings? b, bool lightQuad)
    {
        var layout = QuadLayout(vs);
        Gpu.Ctx->IASetInputLayout(layout);
        Gpu.Ctx->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY.D3D11_PRIMITIVE_TOPOLOGY_TRIANGLESTRIP);
        var buf    = lightQuad ? _lightQuad : _postQuad;
        uint stride = 16, offset = 0;
        Gpu.Ctx->IASetVertexBuffers(0, 1, &buf, &stride, &offset);
        Gpu.Ctx->VSSetShader(vs.Vs, null, 0);
        Gpu.Ctx->PSSetShader(ps.Ps, null, 0);
        Bind(vs, b);
        Bind(ps, b);
        Gpu.Ctx->Draw(4, 0);
    }

    private readonly Dictionary<string, nint> _quadLayouts = new();

    private ID3D11InputLayout* QuadLayout(GpuShader vs)
    {
        if (_quadLayouts.TryGetValue(vs.Label, out var l))
            return (ID3D11InputLayout*)l;
        var name = Marshal.StringToHGlobalAnsi("POSITION");
        try
        {
            var e = new D3D11_INPUT_ELEMENT_DESC
            {
                SemanticName = (sbyte*)name, Format = DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_FLOAT,
                InputSlotClass = D3D11_INPUT_CLASSIFICATION.D3D11_INPUT_PER_VERTEX_DATA,
            };
            ID3D11InputLayout* layout;
            fixed (byte* pb = vs.Blob)
                Gpu.Check(Gpu.Device->CreateInputLayout(&e, 1, pb, (nuint)vs.Blob.Length, &layout), $"quad layout {vs.Label}");
            _quadLayouts[vs.Label] = (nint)layout;
            return layout;
        }
        finally
        {
            Marshal.FreeHGlobal(name);
        }
    }

    private GpuShader Code(string path) => Shaders.Code(path) ?? throw new Exception($"missing {path}");

    // ------------------------------------------------------------------ camera switching (main view / shadow view)

    private void UseCamera(Matrix4x4 view, Matrix4x4 proj)
    {
        _view     = view;
        _proj     = proj;
        _viewProj = view * proj;
        Matrix4x4.Invert(_view, out _invView);
        Matrix4x4.Invert(_proj, out _invProj);
        Matrix4x4.Invert(_viewProj, out _invViewProj);
        if (Cbs.Get("g_CameraParameter") is { } cam)
            Cbs.Fillers["g_CameraParameter"](cam);
    }

    // ------------------------------------------------------------------ shadows

    private Matrix4x4 _lightView, _lightProj;
    private const int ShadowSize = 4096;

    /// <summary>World-space bounds of everything drawn, from each bone's bind-space box moved by its skinning matrix.</summary>
    private (Vector3 min, Vector3 max) SceneBounds()
    {
        var min = new Vector3(float.MaxValue);
        var max = new Vector3(float.MinValue);
        void Add(Vector3 p)
        {
            if (!float.IsFinite(p.X) || !float.IsFinite(p.Y) || !float.IsFinite(p.Z) || p.Length() > 1000)
                return;
            min = Vector3.Min(min, p);
            max = Vector3.Max(max, p);
        }

        if (_scene.ShadowBounds is { Length: 6 } sb)
            return (new Vector3(sb[0], sb[1], sb[2]), new Vector3(sb[3], sb[4], sb[5]));
        // each model's own box (bind space, which bone boxes don't always keep sane), moved by its root bone / world
        foreach (var d in _draws)
        {
            var bb = d.Model.File.BoundingBoxes;
            var lo = new Vector3(bb.Min[0], bb.Min[1], bb.Min[2]);
            var hi = new Vector3(bb.Max[0], bb.Max[1], bb.Max[2]);
            if (!(hi - lo).X.Equals(float.NaN) && (hi - lo).Length() is > 0 and < 20)
            {
                var m = d.Mesh.Skinned && d.Mesh.BoneTable.Length > 0 && d.Mesh.BoneTable[0] < d.Skin.Length ? d.Skin[d.Mesh.BoneTable[0]] : d.World;
                if (!d.Mesh.Skinned)
                    m = d.World;
                for (var c = 0; c < 8; c++)
                    Add(Vector3.Transform(new Vector3((c & 1) != 0 ? hi.X : lo.X, (c & 2) != 0 ? hi.Y : lo.Y, (c & 4) != 0 ? hi.Z : lo.Z), m));
            }
        }

        if (min.X > max.X)
            return (new Vector3(-1, 0, -1), new Vector3(1, 2, 1));
        return (min, max);
    }

    private void ShadowMap(Matrix4x4 mainView, Matrix4x4 mainProj)
    {
        var (min, max) = SceneBounds();
        var center = (min + max) / 2;
        var radius = Math.Max(0.25f, (max - min).Length() / 2) + 0.3f;
        var l      = Vector3.Normalize(V3(_scene.Env.LightDir));
        var up     = MathF.Abs(l.Y) > 0.99f ? Vector3.UnitZ : Vector3.UnitY;
        _lightView = Matrix4x4.CreateLookAt(center + l * (radius + 1), center, up);
        _lightProj = Matrix4x4.CreateOrthographic(radius * 2, radius * 2, 0.5f, radius * 2 + 1.5f);

        _shadowMap ??= Gpu.CreateTarget(ShadowSize, ShadowSize, DXGI_FORMAT.DXGI_FORMAT_D32_FLOAT);
        Gpu.Ctx->ClearDepthStencilView(_shadowMap.Dsv, (uint)D3D11_CLEAR_FLAG.D3D11_CLEAR_DEPTH, 1, 0);
        Gpu.Ctx->OMSetRenderTargets(0, null, _shadowMap.Dsv);
        var vp = new D3D11_VIEWPORT { Width = ShadowSize, Height = ShadowSize, MaxDepth = 1 };
        Gpu.Ctx->RSSetViewports(1, &vp);
        if (Environment.GetEnvironmentVariable("XIVR_SHADOW_MAINCAM") == "1")
        {
            _lightView = mainView;
            _lightProj = Matrix4x4.CreatePerspectiveFieldOfView(0.5f, 1, 0.1f, 10);
        }

        UseCamera(_lightView, _lightProj);
        if (Verbose)
            Console.Error.WriteLine($"shadow: center {center} radius {radius} light {l}");
        // models flagged ShadowDisabled (mdl flags1 bit 0, as Lumina/TexTools name it) cast no sun shadow
        DrawGeometry("PASS_Z_OPAQUE", _draws.Where(d => OpaquePass(d) && ((byte)d.Model.File.Flags1 & 0x01) == 0),
            DepthState(true, true, D3D11_COMPARISON_FUNC.D3D11_COMPARISON_LESS_EQUAL), Opaque, SubViewShadow, 20, 2f);
        UseCamera(mainView, mainProj);
    }

    /// <summary>Screen-space shadow mask with the game's directionalshadow.shpk (main or semi-transparent G-buffer).</summary>
    private void ShadowMask(Gpu.Target target, bool semi)
    {
        Clear(target, 1, 1, 1, 1);
        var ds = Shaders.Package("directionalshadow.shpk");
        if (ds == null || !_scene.Env.Shadows)
            return;
        // view space -> shadow map texture space (u, v, depth)
        var toUv = new Matrix4x4(0.5f, 0, 0, 0, 0, -0.5f, 0, 0, 0, 0, 1, 0, 0.5f, 0.5f, 0, 1);
        _shadowProjection = _invView * _lightView * _lightProj * toUv;
        if (Cbs.Get("g_DirectionalShadowParameter") is { } dsp)
            Cbs.Fillers["g_DirectionalShadowParameter"](dsp);
        var keys = new Dictionary<uint, uint>
        {
            [Crc.Of("ShadowSoftShadowType")]   = Crc.Of("ShadowSoftShadowType_3x3"),
            [Crc.Of("TransformProj")]          = Crc.Of("TransformProjPlaneNear"),
            [Crc.Of("ShadowDistanceFadeType")] = Crc.Of("ShadowDistanceFadeType_Disable"),
        };
        var p = ds.Pass(semi ? "PASS_LIGHTING_SEMITRANSPARENCY" : "PASS_LIGHTING_OPAQUE", null, keys, null, SubViewMain);
        if (p == null)
        {
            Note("directionalshadow.shpk: no node for the chosen keys");
            return;
        }

        var b = new Bindings();
        b.Srv["g_SamplerShadow"]     = (nint)_shadowMap!.Srv;
        b.Sampler["g_SamplerShadow"] = (nint)Gpu.Sampler(D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_BORDER, D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_BORDER,
            filter: D3D11_FILTER.D3D11_FILTER_COMPARISON_MIN_MAG_LINEAR_MIP_POINT, aniso: 1, cmp: D3D11_COMPARISON_FUNC.D3D11_COMPARISON_LESS_EQUAL);
        SetTargets(new[] { target }, null);
        SetState(Opaque, DepthState(false, false), Gpu.Raster(D3D11_CULL_MODE.D3D11_CULL_NONE, false));
        SetSemi(semi);
        Fullscreen(p.Value.vs, p.Value.ps, b, true);
    }

    private Matrix4x4 _shadowProjection = Matrix4x4.Identity;

    private void SetSemi(bool semi)
    {
        foreach (var name in new[] { "g_LightDrawParam" })
            if (Cbs.Get(name) is { } cb)
                cb.Set("SemiTransparency", semi ? 1 : 0);
        _semi = semi;
    }

    private bool _semi;

    // ------------------------------------------------------------------ pass membership

    /// <summary>Opaque passes: every material, except transparent ones without an alpha-test threshold (those only blend).</summary>
    private static bool OpaquePass(DrawItem d) => !d.Mat.Transparent || d.Mat.AlphaThreshold > 0 || d.Mat.Decal;

    private static bool SemiPass(DrawItem d) => d.Mat.Transparent && !d.Mat.Decal;

    // ------------------------------------------------------------------ the frame

    public sealed class FrameResult
    {
        public int      Width, Height;
        public byte[]   Rgba = Array.Empty<byte>();
        public int      Draws;
        public double   Ms;
        public List<string> Log = new();
    }

    private Gpu.Target? _shadowMap;
    private readonly Gpu.Target?[] _sgbuf = new Gpu.Target?[5];
    private Gpu.Target? _sdepth, _slightDiffuse, _slightSpecular, _sshadowMask;

    private void EnsureSemiTargets()
    {
        if (_sdepth != null && _sdepth.Width == _w && _sdepth.Height == _h)
            return;
        foreach (var t in _sgbuf) t?.Release();
        foreach (var t in new[] { _sdepth, _slightDiffuse, _slightSpecular, _sshadowMask }) t?.Release();
        for (var i = 0; i < 5; i++)
            _sgbuf[i] = Gpu.CreateTarget(_w, _h, _gbuf[i]!.Format);
        _sdepth         = Gpu.CreateTarget(_w, _h, DXGI_FORMAT.DXGI_FORMAT_D24_UNORM_S8_UINT);
        _slightDiffuse  = Gpu.CreateTarget(_w, _h, DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT);
        _slightSpecular = Gpu.CreateTarget(_w, _h, DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT);
        _sshadowMask    = Gpu.CreateTarget(_w, _h, DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM);
    }

    private void BindGBuffer(Gpu.Target?[] g, Gpu.Target depth, Gpu.Target shadow)
    {
        _frame.Srv["g_SamplerDepth"]      = (nint)depth.Srv;
        _frame.Srv["g_SamplerGBuffer"]    = (nint)g[0]!.Srv;
        _frame.Srv["g_SamplerGBuffer1"]   = (nint)g[1]!.Srv;
        _frame.Srv["g_SamplerGBuffer2"]   = (nint)g[2]!.Srv;
        _frame.Srv["g_SamplerGBuffer3"]   = (nint)g[3]!.Srv;
        _frame.Srv["g_SamplerGBuffer4"]   = (nint)g[4]!.Srv;
        _frame.Srv["g_SamplerShadowMask"] = (nint)shadow.Srv;
    }

    private void DirectionalLight(Gpu.Target diffuse, Gpu.Target specular, bool semi)
    {
        Clear(diffuse, 0, 0, 0, 0);
        Clear(specular, 0, 0, 0, 0);
        SetTargets(new[] { diffuse, specular }, null);
        SetState(Additive, DepthState(false, false), Gpu.Raster(D3D11_CULL_MODE.D3D11_CULL_NONE, false));
        var dl = Shaders.Package("directionallighting.shpk");
        if (dl == null)
            return;
        var keys = new Dictionary<uint, uint>
        {
            [Crc.Of("GetDirectionalLight")]   = Crc.Of(_scene.Env.Shadows ? "GetDirectionalLight_Shadow" : "GetDirectionalLight_Enable"),
            [Crc.Of("GetFakeSpecular")]       = Crc.Of("GetFakeSpecular_Disable"),
            [Crc.Of("GetUnderWaterLighting")] = Crc.Of("GetUnderWaterLighting_Disable"),
        };
        var p = dl.Pass(semi ? "PASS_LIGHTING_SEMITRANSPARENCY" : "PASS_LIGHTING_OPAQUE", null, keys, null, SubViewMain);
        if (p == null)
        {
            Note("directionallighting.shpk: no node for the chosen keys");
            return;
        }

        SetSemi(semi);
        Fullscreen(p.Value.vs, p.Value.ps, null, true);
        CameraLight(semi);
    }

    /// <summary>
    /// cameralighting.shpk: a light at the camera (aimed 0.2 m above the eye line) added to the light buffers, scaled by
    /// ambient occlusion; m_Attenuation.xy are its diffuse / specular strengths for scenery, .zw for characters.
    /// </summary>
    private void CameraLight(bool semi)
    {
        var env = _scene.Env;
        if (env.CameraLightColor is not { Length: >= 3 } col || col.Take(3).All(x => x <= 0))
            return;
        var cl = Shaders.Package("cameralighting.shpk");
        var p  = cl?.Pass(semi ? "PASS_LIGHTING_SEMITRANSPARENCY" : "PASS_LIGHTING_OPAQUE", null, null, null, SubViewMain);
        if (p == null)
            return;
        var lp = Cbs.Get("g_LightParam");
        lp?.Set("m_DiffuseColor", col[0], col[1], col[2]);
        lp?.Set("m_SpecularColor", col[0], col[1], col[2]);
        lp?.Set("m_Attenuation", 1, 1, 1, 1);
        Fullscreen(p.Value.vs, p.Value.ps, null, true);
        if (lp != null)
            Cbs.Fillers["g_LightParam"](lp);
    }

    public FrameResult Render(SceneDesc scene)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        _scene = scene;
        _time  = scene.Env.Time;
        SetReflection(V3(scene.Env.Reflection), V3(scene.Env.ReflectionGround ?? scene.Env.Reflection));
        EnsureTargets(scene.Width, scene.Height);
        LoadScene(scene);
        SetupCamera(scene.Camera, scene.Width, scene.Height);
        InitFrameBindings();
        Cbs.Refill();
        var ctx      = Gpu.Ctx;
        var mainView = _view;
        var mainProj = _proj;
        foreach (var n in new[] { "g_SamplerDepth", "g_SamplerGBuffer", "g_SamplerGBuffer1", "g_SamplerGBuffer2", "g_SamplerGBuffer3", "g_SamplerGBuffer4",
                     "g_SamplerShadowMask", "g_SamplerOcclusion", "g_SamplerLightDiffuse", "g_SamplerLightSpecular" })
            _frame.Sampler[n] = (nint)PointClamp;

        // ---- shadow map from the sun/moon
        UnbindAll();
        if (scene.Env.Shadows)
            ShadowMap(mainView, mainProj);

        // ---- G-buffer (opaque)
        UnbindAll();
        foreach (var g in _gbuf)
            Clear(g!, 0, 0, 0, 0);
        ctx->ClearDepthStencilView(_depth!.Dsv, (uint)(D3D11_CLEAR_FLAG.D3D11_CLEAR_DEPTH | D3D11_CLEAR_FLAG.D3D11_CLEAR_STENCIL), 0, 0);
        SetTargets(_gbuf, _depth);
        // decals (tattoos, face paint) blend onto the albedo of what is already there, so they go last
        var draws = DrawGeometry("PASS_G_OPAQUE", _draws.Where(OpaquePass).OrderBy(d => d.Mat.Decal ? 1 : 0), DepthState(true, true), Opaque, SubViewMain);

        // ---- shadow mask and lighting into the diffuse / specular light buffers
        UnbindAll();
        Clear(_occlusion!, 1, 1, 1, 1);
        if (scene.Env.Ao)
            AmbientOcclusion(Math.Max(1, scene.Env.AoSamples));
        _frame.Srv["g_SamplerOcclusion"] = (nint)_occlusion!.Srv;
        BindGBuffer(_gbuf, _depth, _shadowMask!);
        ShadowMask(_shadowMask!, false);
        UnbindAll();
        DirectionalLight(_lightDiffuse!, _lightSpecular!, false);

        // ---- composite: materials read the light buffers and write the (sqrt-encoded) scene colour
        UnbindAll();
        _frame.Srv["g_SamplerLightDiffuse"]  = (nint)_lightDiffuse!.Srv;
        _frame.Srv["g_SamplerLightSpecular"] = (nint)_lightSpecular!.Srv;
        var bg = scene.Env.Background;
        Clear(_hdr!, bg[0], bg[1], bg[2], 0);
        SetTargets(new[] { _hdr }, _depth);
        SetSemi(false);
        DrawGeometry("PASS_COMPOSITE_OPAQUE", _draws.Where(OpaquePass), DepthState(true, false, D3D11_COMPARISON_FUNC.D3D11_COMPARISON_EQUAL), Opaque, SubViewMain);

        // ---- semi-transparency: nearest transparent layer into its own G-buffer, lit, then blended back to front
        var semiDraws = _draws.Where(SemiPass).ToList();
        if (semiDraws.Count > 0)
        {
            // glass refracts what is behind it: the scene colour so far and the view-space positions
            UnbindAll();
            ViewPositions();
            FinalColorCopy();
            EnsureSemiTargets();
            UnbindAll();
            ctx->CopyResource((ID3D11Resource*)_sdepth!.Tex, (ID3D11Resource*)_depth.Tex);
            foreach (var g in _sgbuf)
                Clear(g!, 0, 0, 0, 0);
            SetTargets(_sgbuf, _sdepth);
            DrawGeometry("PASS_G_SEMITRANSPARENCY", semiDraws, DepthState(true, true), Opaque, SubViewMain);

            UnbindAll();
            BindGBuffer(_sgbuf, _sdepth, _sshadowMask!);
            ShadowMask(_sshadowMask!, true);
            UnbindAll();
            DirectionalLight(_slightDiffuse!, _slightSpecular!, true);

            UnbindAll();
            _frame.Srv["g_SamplerLightDiffuse"]  = (nint)_slightDiffuse!.Srv;
            _frame.Srv["g_SamplerLightSpecular"] = (nint)_slightSpecular!.Srv;
            _frame.Srv["g_SamplerGBuffer1"]      = (nint)_sgbuf[1]!.Srv;
            _frame.Srv["g_SamplerGBuffer2"]      = (nint)_sgbuf[2]!.Srv;
            SetTargets(new[] { _hdr }, _depth);
            SetSemi(true);
            var eye    = Vector3.Transform(Vector3.Zero, _invView);
            var sorted = semiDraws.OrderByDescending(d => Vector3.DistanceSquared(eye, d.Center)).ToList();
            DrawGeometry("PASS_COMPOSITE_SEMITRANSPARENCY", sorted, DepthState(true, false), AlphaBlend, SubViewMain);
            SetSemi(false);
        }

        // ---- tone mapping (game shaders): LUT from the adapted luminance, then applied to the scene
        UnbindAll();
        var copyVs = Code("shader/sm5/shcd/CopyVS.shcd");
        var expo = scene.Env.Exposure;
        Clear(_adaptedLum!, expo, expo, expo, expo);
        SetState(Opaque, DepthState(false, false), Gpu.Raster(D3D11_CULL_MODE.D3D11_CULL_NONE, false));
        var lut = Code("shader/sm5/posteffect/ToneMapLut.shcd");
        var tmb = new Bindings();
        tmb.Srv["sAdaptedLum"]     = (nint)_adaptedLum!.Srv;
        tmb.Sampler["sAdaptedLum"] = (nint)PointClamp;
        SetTone(lut);
        SetTargets(new[] { _toneLut }, null);
        Fullscreen(copyVs, lut, tmb, false);

        UnbindAll();
        var tm = Code("shader/sm5/posteffect/ToneMapping.shcd");
        var tb = new Bindings();
        tb.Srv["sInput"]       = (nint)_hdr.Srv;
        tb.Sampler["sInput"]   = (nint)PointClamp;
        tb.Srv["sToneMap"]     = (nint)_toneLut!.Srv;
        tb.Sampler["sToneMap"] = (nint)LinearClamp;
        SetTone(tm);
        SetTargets(new[] { _final }, null);
        Fullscreen(copyVs, tm, tb, false);

        // ---- debug views replace the final image
        if (scene.Output != "final")
        {
            UnbindAll();
            var src = scene.Output switch
            {
                "gbuffer0" => _gbuf[0], "gbuffer1" => _gbuf[1], "gbuffer2" => _gbuf[2], "gbuffer3" => _gbuf[3], "gbuffer4" => _gbuf[4],
                "lightdiffuse" => _lightDiffuse, "lightspecular" => _lightSpecular, "hdr" => _hdr, "shadowmask" => _shadowMask, "ao" => _occlusion,
                "semigbuffer0" => _sgbuf[0], "semigbuffer1" => _sgbuf[1], "semigbuffer2" => _sgbuf[2], "semilightdiffuse" => _slightDiffuse,
                "semilightspecular" => _slightSpecular, "semishadowmask" => _sshadowMask, "shadowmap" => _shadowMap, _ => null,
            };
            if (src != null)
            {
                var def = Code("shader/sm5/posteffect/Default.shcd");
                var db  = new Bindings();
                db.Srv["sInput"]     = (nint)src.Srv;
                db.Sampler["sInput"] = (nint)PointClamp;
                SetTargets(new[] { _final }, null);
                Fullscreen(copyVs, def, db, false);
            }
        }

        UnbindAll();
        var raw = Gpu.ReadBack(_final!, out var pitch);
        var rgba = new byte[_w * _h * 4];
        for (var y = 0; y < _h; y++)
            Buffer.BlockCopy(raw, y * pitch, rgba, y * _w * 4, _w * 4);
        List<string> log;
        lock (Log)
            log = Log.ToList();
        return new FrameResult { Width = _w, Height = _h, Rgba = rgba, Draws = draws, Ms = sw.Elapsed.TotalMilliseconds, Log = log };
    }

    /// <summary>GTAO into the occlusion target; several noise indices are averaged (the game's TAA does that over frames).</summary>
    private void AmbientOcclusion(int samples)
    {
        var copyVs = Code("shader/sm5/shcd/CopyVS.shcd");
        var def    = Code("shader/sm5/posteffect/Default.shcd");
        for (var i = 0; i < samples; i++)
        {
            UnbindAll();
            var ao = Gtao(_frameIndex * samples + i);
            if (ao == null)
            {
                Note("GTAO compute shaders not available; no ambient occlusion");
                return;
            }

            var b = new Bindings();
            b.Srv["sInput"]     = (nint)ao;
            b.Sampler["sInput"] = (nint)PointClamp;
            SetTargets(new[] { _occlusion }, null);
            var factor = stackalloc float[4];
            for (var k = 0; k < 4; k++) factor[k] = 1f / (i + 1);
            Gpu.Ctx->OMSetBlendState(Average, factor, 0xFFFFFFFF);
            Gpu.Ctx->OMSetDepthStencilState(DepthState(false, false), 0);
            Gpu.Ctx->RSSetState(Gpu.Raster(D3D11_CULL_MODE.D3D11_CULL_NONE, false));
            Fullscreen(copyVs, def, b, false);
        }

        _frameIndex++;
        UnbindAll();
    }

    private int _frameIndex;

    private ID3D11BlendState* Average => Gpu.Blend("average", () =>
    {
        var d = new D3D11_BLEND_DESC();
        d.RenderTarget[0] = new D3D11_RENDER_TARGET_BLEND_DESC
        {
            BlendEnable = true, SrcBlend = D3D11_BLEND.D3D11_BLEND_BLEND_FACTOR, DestBlend = D3D11_BLEND.D3D11_BLEND_INV_BLEND_FACTOR,
            BlendOp = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD, SrcBlendAlpha = D3D11_BLEND.D3D11_BLEND_BLEND_FACTOR, DestBlendAlpha = D3D11_BLEND.D3D11_BLEND_INV_BLEND_FACTOR,
            BlendOpAlpha = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD, RenderTargetWriteMask = (byte)D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_ALL,
        };
        return d;
    });

    private ID3D11BlendState* AlphaBlend => Gpu.Blend("alpha", () =>
    {
        var d = new D3D11_BLEND_DESC();
        d.RenderTarget[0] = new D3D11_RENDER_TARGET_BLEND_DESC
        {
            BlendEnable = true, SrcBlend = D3D11_BLEND.D3D11_BLEND_SRC_ALPHA, DestBlend = D3D11_BLEND.D3D11_BLEND_INV_SRC_ALPHA,
            BlendOp = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD, SrcBlendAlpha = D3D11_BLEND.D3D11_BLEND_ONE, DestBlendAlpha = D3D11_BLEND.D3D11_BLEND_INV_SRC_ALPHA,
            BlendOpAlpha = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD, RenderTargetWriteMask = (byte)D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_ALL,
        };
        return d;
    });

    /// <summary>
    /// cToneMapParam, shared by ToneMapLut (builds a 1D LUT) and ToneMapping (applies it to luminance):
    ///   LUT(u): x = [1].z * u - [1].w (luminance of this entry), f = 1 - (1 - k x)^(e / k), out = 1 + A (lerp(e, f / x, B) - 1)
    ///   apply:  u = lerp([1].x, [1].y, saturate(L * k)), colour *= LUT(u)
    /// with k = [0].z = 1 / white point and e the adapted luminance (exposure; the game adapts it to the whole screen).
    /// </summary>
    private void SetTone(GpuShader sh)
    {
        var env = _scene.Env;
        foreach (var cbl in sh.Info.Cbs)
        {
            if (cbl.Name != "cToneMapParam")
                continue;
            var cb = Cbs.Ensure(cbl);
            if (!env.ToneMap)
            {
                cb.Set("cToneMapParam", 0, 0, 1, 0, 0, 1, 1, 0);
                continue;
            }

            var white = Math.Max(env.WhitePoint, 0.5f);
            var k     = 1 / white;
            const float n = 256;
            var z = white * n / (n - 1);       // LUT texel centres cover luminance 0 .. white exactly
            var w = z * 0.5f / n;
            cb.Set("cToneMapParam", 1, 1, k, 0, 0.5f / n, 1 - 0.5f / n, z, w);
        }
    }
}
