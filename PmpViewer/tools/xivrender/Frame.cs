using System.Numerics;
using System.Runtime.InteropServices;
using TerraFX.Interop.DirectX;

namespace XivRender;

public sealed unsafe partial class Renderer
{
    // ------------------------------------------------------------------ per-frame state

    private SceneDesc _scene = new();
    private Matrix4x4 _view, _proj, _viewProj, _invView, _invProj, _invViewProj;
    private float     _time;

    private static Vector3 V3(float[] a) => new(a[0], a[1], a[2]);

    public bool LeftHanded = Environment.GetEnvironmentVariable("XIVR_LH") == "1";

    private void SetupCamera(CameraDesc c, int w, int h)
    {
        _view = LeftHanded ? Matrix4x4.CreateLookAtLeftHanded(V3(c.Eye), V3(c.Target), V3(c.Up)) : Matrix4x4.CreateLookAt(V3(c.Eye), V3(c.Target), V3(c.Up));
        var f      = 1f / MathF.Tan(c.FovY * MathF.PI / 360f);
        var aspect = (float)w / h;
        // reversed-Z with an infinite far plane: depth 1 at the near plane, 0 at infinity (the lighting shaders clamp depth to 1e-6)
        _proj = new Matrix4x4(
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, 0, LeftHanded ? 1 : -1,
            0, 0, c.Near, 0);
        _viewProj = _view * _proj;
        Matrix4x4.Invert(_view, out _invView);
        Matrix4x4.Invert(_proj, out _invProj);
        Matrix4x4.Invert(_viewProj, out _invViewProj);
    }

    private void RegisterFillers()
    {
        Cbs.Fillers["g_CameraParameter"] = cb =>
        {
            cb.SetMatrix("m_ViewMatrix", _view, 3);
            cb.SetMatrix("m_InverseViewMatrix", _invView, 3);
            cb.SetMatrix("m_ViewProjectionMatrix", _viewProj);
            cb.SetMatrix("m_InverseViewProjectionMatrix", _invViewProj);
            cb.SetMatrix("m_InverseProjectionMatrix", _invProj);
            cb.SetMatrix("m_ProjectionMatrix", _proj);
            cb.SetMatrix("m_MainViewToProjectionMatrix", _proj);
            cb.SetMatrix("m_ViewMatrixPrev", _view, 3);
            cb.SetMatrix("m_InverseViewMatrixPrev", _invView, 3);
            cb.SetMatrix("m_ViewProjectionMatrixPrev", _viewProj);
            cb.SetMatrix("m_InverseViewProjectionMatrixPrev", _invViewProj);
            cb.SetMatrix("m_ProjectionMatrixPrev", _proj);
            cb.SetMatrix("m_InverseProjectionMatrixPrev", _invProj);
            cb.SetMatrix("m_ProjToProjPrevMatrix", Matrix4x4.Identity);
            cb.SetMatrix("m_ViewToViewPrevMatrix", Matrix4x4.Identity, 3);
            cb.SetMatrix("m_MainViewToWorldMatrix", _invView, 3);
            cb.Set("m_JitterVelocity", 0, 0, 0, 0);
        };
        Cbs.Fillers["g_CommonParameter"] = cb =>
        {
            cb.Set("m_RenderTarget", 1f / _w, 1f / _h, 0, 0);
            cb.Set("m_Viewport", 2f / _w, -2f / _h, -1, 1);
            cb.Set("m_Misc", 1, 0, 0, 0);
            cb.Set("m_Misc2", 1, 0, 0, 0);
        };
        Cbs.Fillers["g_PbrParameterCommon"] = cb =>
        {
            cb.Set("m_LoopTime", _time);
            cb.Set("m_LoopTimePrev", _time);
            cb.Set("m_SubSurfaceSSAOMaskMaxRate", 1);
            cb.Set("m_MipBias", 0);
        };
        Cbs.Fillers["g_AmbientParam"] = cb =>
        {
            var env = _scene.Env;
            float[] sh = env.AmbientSh.SelectMany(x => x).ToArray();
            cb.Set("param.sh.param", sh);
            cb.Set("param.color", 1, 1, 1);
            cb.Set("param.shRecipScale", 1);
            cb.Set("param.attenuationSlope", 0);
            cb.Set("param.attenuationIntercept", 1);
            cb.Set("param.attenuationValue", 1);
            cb.Set("param.skyVisibility", 1);
            cb.Set("param.reflectionScale", env.ReflectionScale);
            cb.Set("param.reflectionOffset", 0);
            cb.Set("param.bakeLightRate", env.BakeLightRate);
            cb.Set("param.envLocationIndex", 0);
            cb.Set("skySh.param", (env.SkySh ?? env.AmbientSh).SelectMany(x => x).ToArray());
            cb.Set("skyShRecipScale", 1);
            cb.Set("envLocationIndexPrev", 0);
            cb.Set("envLocationInterpRate", 0);
            cb.Set("invAmbientScale", 1);
        };
        Cbs.Fillers["g_LightParam"] = cb =>
        {
            var env = _scene.Env;
            var dir = Vector3.Normalize(Vector3.TransformNormal(Vector3.Normalize(V3(env.LightDir)), _view));
            cb.Set("m_Position", 0, 0, 0);
            cb.Set("m_Direction", dir);
            cb.Set("m_DiffuseColor", V3(env.LightDiffuse));
            cb.Set("m_SpecularColor", V3(env.LightSpecular));
            cb.Set("m_Attenuation", 0, 0, 1, 1);
            cb.Set("m_ClipMin", -1e9f, -1e9f, -1e9f, 0);
            cb.Set("m_ClipMax", 1e9f, 1e9f, 1e9f);
            cb.Set("m_PlaneFadeScale", 0, 0);
            cb.Set("m_ShadowTexMask", 1, 0, 0, 0);
            cb.SetMatrix("m_PlaneInversMatrix", Matrix4x4.Identity, 3);
            cb.SetMatrix("m_WorldViewInversMatrix", _invView, 3);
            cb.SetMatrix("m_LightMapMatrix", Matrix4x4.Identity);
            cb.SetMatrix("m_WorldViewProjectionMatrix", _viewProj);
            cb.Set("m_LightFadeValueStatic", 0);
            cb.Set("m_LightFadeValueDynamic", 0);
        };
        Cbs.Fillers["g_CustomizeParameter"] = cb => FillCustomize(cb, _scene.Customize);
        Cbs.Fillers["g_LightDrawParam"] = cb => cb.Set("SemiTransparency", 0);
        Cbs.Fillers["g_CloudShadowMatrix"] = cb => cb.SetMatrix("g_CloudShadowMatrix", Matrix4x4.Identity);
        Cbs.Fillers["g_DirectionalShadowParameter"] = cb =>
        {
            cb.SetMatrix("m_ShadowProjectionMatrix", _shadowProjection);
            // no distance fade: the lighting pass keeps min(mask, m_ShadowMapParameter.w)
            cb.Set("m_ShadowDistance", 0, 0, 0, 0);
            cb.Set("m_ShadowMapParameter", 0, 0, 0, 1);
            cb.Set("m_CascadeShadowOverrapParam", 0, 0, 0, 0);
            cb.Set("m_NearFarParam", 0, 0, 0, 0);
        };
        // Dawntrail view-dependent shape deform and seam connection (GPU-side features): off unless provided
        Cbs.Fillers["g_ShapeDeformParam"] = cb => cb.SetUInt("g_ShapeDeformParam", 0xFFFFFFFF, 0, 0, 0);
        Cbs.Fillers["g_ConnectionVertex"] = cb => cb.SetUInt("g_ConnectionVertex", 0, 0, 0, 0);
        Cbs.Fillers["g_ShadowBiasParameter"] = cb =>
        {
            cb.Set("m_CharaShadowBias", 0.02f);
            cb.Set("m_BGShadowBias", 0.04f);
            cb.Set("m_AngleThreshold", 0.25f);
        };
        Cbs.Fillers["g_FogParameter"] = cb =>
        {
            // no fog at portrait distances; transparent materials apply fog themselves, so keep it neutral
            cb.Set("fogColor", 0, 0, 0, 0);
            cb.Set("fogIntensity", 0, 0);
            cb.Set("fogStart", 1e6f, 1e6f);
            cb.Set("depthToDistance", 1, 1);
            cb.Set("startDistance", 1e6f);
            cb.Set("fogMinOpacity", 0);
            cb.Set("fogDensity", 0);
            cb.Set("fogDensity2", 0);
        };
        Cbs.Fillers["cParam"] = cb => cb.Set("cParam", 1, 1, 0, 0, 1, 1, 0, 0);
        Cbs.Fillers["cCommonTexParam"] = cb => cb.Set("cCommonTexParam", 1, 1, 0, 0);
    }

    // ------------------------------------------------------------------ binding

    /// <summary>Everything a draw can bind, by the names the game shaders use.</summary>
    private sealed class Bindings
    {
        public readonly Dictionary<string, nint> Srv     = new(StringComparer.Ordinal);
        public readonly Dictionary<string, nint> Sampler = new(StringComparer.Ordinal);
        public readonly Dictionary<string, nint> Cb      = new(StringComparer.Ordinal);
    }

    private readonly Bindings _frame = new();

    private ID3D11SamplerState* PointClamp  => Gpu.Sampler(D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_CLAMP, D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_CLAMP, filter: D3D11_FILTER.D3D11_FILTER_MIN_MAG_MIP_POINT, aniso: 1);
    private ID3D11SamplerState* LinearClamp => Gpu.Sampler(D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_CLAMP, D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_CLAMP, filter: D3D11_FILTER.D3D11_FILTER_MIN_MAG_MIP_LINEAR, aniso: 1);
    private ID3D11SamplerState* LinearWrap  => Gpu.Sampler(D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_WRAP, D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_WRAP, filter: D3D11_FILTER.D3D11_FILTER_MIN_MAG_MIP_LINEAR, aniso: 1);
    private ID3D11SamplerState* AnisoWrap   => Gpu.Sampler(D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_WRAP, D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_WRAP);

    private void InitFrameBindings()
    {
        var b = _frame;
        b.Srv.Clear();
        b.Sampler.Clear();
        b.Srv["g_ShaderTypeParameter"]    = (nint)_shaderTypes;
        b.Srv["g_SamplerTileNormal"]      = Or(TileArray("chara/common/texture/tile_norm_array.tex"), _flatNormal);
        b.Srv["g_SamplerTileOrb"]         = Or(TileArray("chara/common/texture/tile_orb_array.tex"), _white);
        b.Srv["g_SamplerSphereMap"]       = Or(TileArray("chara/common/texture/sphere_d_array.tex"), _black);
        b.Srv["g_SamplerReflectionArray"] = (nint)_reflection;
        b.Srv["g_SamplerDither"]          = (nint)_dither;
        b.Srv["tPerlinNoise2D"]           = (nint)_noise;
        b.Srv["g_SamplerDecal"]           = (nint)_transparent;
        b.Srv["g_SamplerSubsurfaceKernel"] = (nint)_kernel;
        b.Srv["g_CloudShadowSampler"]     = (nint)_white;
        // Dawntrail's seam connection and view-dependent shape deform are switched off (counts 0 / index -1)
        b.Srv["g_InputConnectionVertex"]     = (nint)_zero16;
        b.Srv["g_InputConnectionVertexPrev"] = (nint)_zero16;
        b.Srv["g_ShapeDeformVertex"]         = (nint)_zero16;
        b.Srv["g_ShapeDeformIndex"]          = (nint)_zero4;
        // no fog: zero fog weight and a black sky behind it
        b.Srv["g_FogWeightLutSampler"]    = (nint)_black;
        b.Srv["g_SkySampler"]             = (nint)_black;
        b.Sampler["g_SamplerTileNormal"]  = (nint)AnisoWrap;
        b.Sampler["g_SamplerTileOrb"]     = (nint)AnisoWrap;
        b.Sampler["g_SamplerSphereMap"]   = (nint)LinearClamp;
        b.Sampler["g_SamplerReflectionArray"] = (nint)LinearClamp;
        b.Sampler["g_SamplerDither"]      = (nint)Gpu.Sampler(D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_WRAP, D3D11_TEXTURE_ADDRESS_MODE.D3D11_TEXTURE_ADDRESS_WRAP, filter: D3D11_FILTER.D3D11_FILTER_MIN_MAG_MIP_POINT, aniso: 1);
        b.Sampler["tPerlinNoise2D"]       = (nint)LinearWrap;
        b.Sampler["g_SamplerDecal"]       = (nint)LinearClamp;
        b.Sampler["g_SamplerTable"]       = (nint)PointClamp;
        b.Sampler["g_CloudShadowSampler"] = (nint)LinearWrap;
        b.Sampler["g_SamplerSubsurfaceKernel"] = (nint)LinearClamp;
    }

    private static nint Or(ID3D11ShaderResourceView* a, ID3D11ShaderResourceView* b) => a != null ? (nint)a : (nint)b;

    /// <summary>Tile and sphere textures are arrays; a plain 2D replacement from a mod is viewed as a one-slice array.</summary>
    private ID3D11ShaderResourceView* TileArray(string path)
    {
        var tiles = _primary.TileArrays;
        if (tiles.TryGetValue(path, out var v))
            return (ID3D11ShaderResourceView*)v;
        var srv = Tex.Get(path);
        if (srv != null && Tex.Infos.TryGetValue(path, out var info) && info.Slices == 1)
            srv = Gpu.ArrayViewOf(srv);
        tiles[path] = (nint)srv;
        return srv;
    }

    private readonly HashSet<string> _missingBinds = new();

    private void Bind(GpuShader sh, Bindings? draw)
    {
        var info = sh.Info;
        var isVs = sh.Vs != null;
        foreach (var cbl in info.Cbs)
        {
            ID3D11Buffer* buf;
            if (draw != null && draw.Cb.TryGetValue(cbl.Name, out var dcb))
            {
                buf = (ID3D11Buffer*)dcb;
            }
            else
            {
                var cb = Cbs.Ensure(cbl);
                buf = cb.Upload(Gpu);
            }

            if (isVs) Gpu.Ctx->VSSetConstantBuffers((uint)cbl.Slot, 1, &buf);
            else Gpu.Ctx->PSSetConstantBuffers((uint)cbl.Slot, 1, &buf);
        }

        foreach (var t in info.Textures)
        {
            nint srv = 0;
            if (draw == null || !draw.Srv.TryGetValue(t.Name, out srv))
                _frame.Srv.TryGetValue(t.Name, out srv);
            if (srv == 0)
            {
                if (_missingBinds.Add($"{sh.Label}:{t.Name}"))
                    Note($"{sh.Label} reads {t.Name}; nothing bound (dummy used)");
                srv = (nint)(t.Dim switch
                {
                    D3D_SRV_DIMENSION.D3D11_SRV_DIMENSION_TEXTURECUBEARRAY => _reflection,
                    D3D_SRV_DIMENSION.D3D11_SRV_DIMENSION_TEXTURE2DARRAY   => (ID3D11ShaderResourceView*)_frame.Srv["g_SamplerTileOrb"],
                    _                                                      => _white,
                });
            }

            var p = (ID3D11ShaderResourceView*)srv;
            if (isVs) Gpu.Ctx->VSSetShaderResources((uint)t.Slot, 1, &p);
            else Gpu.Ctx->PSSetShaderResources((uint)t.Slot, 1, &p);
        }

        foreach (var s in info.Samplers)
        {
            nint smp = 0;
            if (draw == null || !draw.Sampler.TryGetValue(s.Name, out smp))
                _frame.Sampler.TryGetValue(s.Name, out smp);
            if (smp == 0)
                smp = (nint)(s.Name.StartsWith("g_Sampler", StringComparison.Ordinal) && s.Name is not ("g_SamplerGBuffer" or "g_SamplerDepth") ? AnisoWrap : PointClamp);
            var p = (ID3D11SamplerState*)smp;
            if (isVs) Gpu.Ctx->VSSetSamplers((uint)s.Slot, 1, &p);
            else Gpu.Ctx->PSSetSamplers((uint)s.Slot, 1, &p);
        }
    }

    private void UnbindAll()
    {
        var nulls = stackalloc ID3D11ShaderResourceView*[32];
        for (var i = 0; i < 32; i++) nulls[i] = null;
        Gpu.Ctx->PSSetShaderResources(0, 32, nulls);
        Gpu.Ctx->VSSetShaderResources(0, 32, nulls);
        Gpu.Ctx->OMSetRenderTargets(0, null, null);
    }

    private void SetTargets(Gpu.Target?[] rts, Gpu.Target? depth)
    {
        var views = stackalloc ID3D11RenderTargetView*[8];
        for (var i = 0; i < rts.Length; i++)
            views[i] = rts[i] != null ? rts[i]!.Rtv : null;
        Gpu.Ctx->OMSetRenderTargets((uint)rts.Length, views, depth != null ? depth.Dsv : null);
        var vp = new D3D11_VIEWPORT { Width = rts.Length > 0 && rts[0] != null ? rts[0]!.Width : _w, Height = rts.Length > 0 && rts[0] != null ? rts[0]!.Height : _h, MaxDepth = 1 };
        Gpu.Ctx->RSSetViewports(1, &vp);
    }

    private void Clear(Gpu.Target t, float r, float g, float b, float a)
    {
        var c = stackalloc float[4] { r, g, b, a };
        Gpu.Ctx->ClearRenderTargetView(t.Rtv, c);
    }

    // ------------------------------------------------------------------ states

    private ID3D11DepthStencilState* DepthState(bool test, bool write, D3D11_COMPARISON_FUNC func = D3D11_COMPARISON_FUNC.D3D11_COMPARISON_GREATER_EQUAL)
        => Gpu.Depth($"{test}{write}{func}", () => new D3D11_DEPTH_STENCIL_DESC
        {
            DepthEnable = test, DepthWriteMask = write ? D3D11_DEPTH_WRITE_MASK.D3D11_DEPTH_WRITE_MASK_ALL : D3D11_DEPTH_WRITE_MASK.D3D11_DEPTH_WRITE_MASK_ZERO,
            DepthFunc = func,
        });

    private ID3D11BlendState* Opaque => Gpu.Blend("opaque", () =>
    {
        var d = new D3D11_BLEND_DESC();
        for (var i = 0; i < 8; i++)
            d.RenderTarget[i].RenderTargetWriteMask = (byte)D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_ALL;
        return d;
    });

    private ID3D11BlendState* Additive => Gpu.Blend("add", () =>
    {
        var d = new D3D11_BLEND_DESC { IndependentBlendEnable = false };
        d.RenderTarget[0] = new D3D11_RENDER_TARGET_BLEND_DESC
        {
            BlendEnable = true, SrcBlend = D3D11_BLEND.D3D11_BLEND_ONE, DestBlend = D3D11_BLEND.D3D11_BLEND_ONE, BlendOp = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD,
            SrcBlendAlpha = D3D11_BLEND.D3D11_BLEND_ONE, DestBlendAlpha = D3D11_BLEND.D3D11_BLEND_ONE, BlendOpAlpha = D3D11_BLEND_OP.D3D11_BLEND_OP_ADD,
            RenderTargetWriteMask = (byte)D3D11_COLOR_WRITE_ENABLE.D3D11_COLOR_WRITE_ENABLE_ALL,
        };
        return d;
    });

    private void SetState(ID3D11BlendState* blend, ID3D11DepthStencilState* depth, ID3D11RasterizerState* raster)
    {
        Gpu.Ctx->OMSetBlendState(blend, null, 0xFFFFFFFF);
        Gpu.Ctx->OMSetDepthStencilState(depth, 0);
        Gpu.Ctx->RSSetState(raster);
    }

    // ------------------------------------------------------------------ scene loading

    private sealed class DrawItem
    {
        public GpuModel          Model = null!;
        public GpuModel.Mesh     Mesh  = null!;
        public GpuMaterial       Mat   = null!;
        public ModelDesc         Desc  = null!;
        public List<GpuModel.Sub> Subs = new();
        public Matrix4x4[]       Skin  = Array.Empty<Matrix4x4>();
        public Matrix4x4         World = Matrix4x4.Identity;
        public Vector3           Center;
        public Dictionary<string, float[]>? Customize;
    }

    private readonly List<DrawItem> _draws = new();

    private void LoadScene(SceneDesc scene)
    {
        // each figure reads its files through its own redirections (the mod's figure, a vanilla one beside it)
        var figures = scene.Figures is { Count: > 0 } fs
            ? fs
            : new List<FigureDesc> { new() { Redirects = scene.Redirects, Customize = scene.Customize, Models = scene.Models } };
        _draws.Clear();
        for (var fi = 0; fi < figures.Count; fi++)
        {
            var set = Set(figures[fi].Redirects);
            if (fi == 0)
                _primary = set;
            LoadFigure(set, figures[fi]);
        }
    }

    private void LoadFigure(AssetSet set, FigureDesc fig)
    {
        foreach (var md in fig.Models)
        {
            var model = set.Model(md.Mdl, Note);
            if (model == null)
                continue;
            model.ApplyShapes(Gpu, md.Shapes);
            var hidden = new HashSet<string>(md.HiddenAttributes);
            var skin   = new Matrix4x4[model.Bones.Length];
            for (var i = 0; i < skin.Length; i++)
            {
                var f = md.Bones != null && i < md.Bones.Count ? md.Bones[i] : null;
                skin[i] = f is { Length: 16 }
                    ? new Matrix4x4(f[0], f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], f[9], f[10], f[11], f[12], f[13], f[14], f[15])
                    : Matrix4x4.Identity;
            }

            var world = md.World is { Length: 16 } w
                ? new Matrix4x4(w[0], w[1], w[2], w[3], w[4], w[5], w[6], w[7], w[8], w[9], w[10], w[11], w[12], w[13], w[14], w[15])
                : Matrix4x4.Identity;
            var bb     = model.File.BoundingBoxes;
            var center = new Vector3((bb.Min[0] + bb.Max[0]) / 2, (bb.Min[1] + bb.Max[1]) / 2, (bb.Min[2] + bb.Max[2]) / 2);
            foreach (var mesh in model.Meshes)
            {
                var path = mesh.Material < md.Materials.Count ? md.Materials[mesh.Material] : null;
                if (path == null)
                    continue;
                var mat = set.Mats.Get(path, md.Stains);
                if (mat == null)
                {
                    Note($"material {path} could not be loaded; {md.Mdl} mesh {mesh.Index} is not drawn (as in game)");
                    continue;
                }

                foreach (var n in mat.Notes)
                    Note($"{path}: {n}");
                var item = new DrawItem { Model = model, Mesh = mesh, Mat = mat, Desc = md, Skin = skin, World = world, Customize = fig.Customize };
                // sort point for blending: the model's box centre, moved by its first bone (or its world matrix)
                item.Center = mesh.Skinned && mesh.BoneTable.Length > 0 && mesh.BoneTable[0] < skin.Length
                    ? Vector3.Transform(center, skin[mesh.BoneTable[0]])
                    : Vector3.Transform(center, world);
                foreach (var sub in mesh.Subs)
                    if (!sub.Attributes.Any(hidden.Contains))
                        item.Subs.Add(sub);
                if (item.Subs.Count > 0)
                    _draws.Add(item);
            }

            foreach (var n in model.Notes)
                Note($"{md.Mdl}: {n}");
        }
    }

    /// <summary>g_CustomizeParameter for one figure's colours.</summary>
    private static void FillCustomize(CbData cb, Dictionary<string, float[]>? customize)
    {
        // the game uploads every customize colour squared (FFXIVClientStructs Shader/CustomizeParameter)
        var c = customize ?? new();
        float[] Col(string k, float[] def) => c.TryGetValue(k, out var v) && v.Length >= 3 ? v : def;
        float Sq(float x) => x * x;
        var skin  = Col("skin", new[] { 238 / 255f, 195 / 255f, 166 / 255f });
        var hair  = Col("hair", new[] { 90 / 255f, 58 / 255f, 34 / 255f });
        var high  = Col("highlight", hair);
        var eye   = Col("eye", new[] { 90 / 255f, 128 / 255f, 166 / 255f });
        var eyeL  = Col("eyeLeft", eye);
        var lip   = Col("lip", new[] { 0f, 0f, 0f, 0f });
        var opt   = Col("option", new[] { 1f, 1f, 1f });
        var muscle = c.TryGetValue("muscle", out var mu) && mu.Length > 0 ? mu[0] : 1f;
        float W(string k, float def) => c.TryGetValue(k, out var v) && v.Length > 0 ? v[0] : def;
        cb.Set("m_SkinColor", Sq(skin[0]), Sq(skin[1]), Sq(skin[2]), muscle);
        cb.Set("m_LipColor", Sq(lip[0]), Sq(lip[1]), Sq(lip[2]), lip.Length > 3 ? lip[3] : 0);
        // charactertattoo reads the face paint U as m_MainColor.w * u + m_MeshColor.w (1, 0 unless flipped);
        // the iris shader takes a ring/odd-eye term from m_LeftColor.w / m_RightColor.w (0 = plain irises, as in game)
        cb.Set("m_MainColor", Sq(hair[0]), Sq(hair[1]), Sq(hair[2]), W("paintScale", 1));
        cb.Set("m_MeshColor", Sq(high[0]), Sq(high[1]), Sq(high[2]), W("paintOffset", 0));
        cb.Set("m_LeftColor", Sq(eyeL[0]), Sq(eyeL[1]), Sq(eyeL[2]), W("leftW", 0));
        cb.Set("m_RightColor", Sq(eye[0]), Sq(eye[1]), Sq(eye[2]), W("rightW", 0));
        cb.Set("m_OptionColor0", Sq(opt[0]), Sq(opt[1]), Sq(opt[2]));
    }
}
