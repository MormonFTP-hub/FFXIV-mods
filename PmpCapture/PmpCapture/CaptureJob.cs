using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Numerics;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using FFXIVClientStructs.FFXIV.Client.Game.Character;
using FFXIVClientStructs.FFXIV.Client.Graphics.Environment;
using FFXIVClientStructs.FFXIV.Client.Graphics.Kernel;
using FFXIVClientStructs.FFXIV.Client.Graphics.Render;
using FFXIVClientStructs.FFXIV.Client.Graphics.Scene;
using FFXIVClientStructs.FFXIV.Client.System.Resource.Handle;
using FFXIVClientStructs.Havok.Animation.Rig;
using FFXIVClientStructs.Havok.Common.Base.Math.QsTransform;
using TerraFX.Interop.DirectX;
using static TerraFX.Interop.Windows.Windows;
using RenderCamera = FFXIVClientStructs.FFXIV.Client.Graphics.Render.Camera;
using SceneCameraManager = FFXIVClientStructs.FFXIV.Client.Graphics.Scene.CameraManager;
using Texture = FFXIVClientStructs.FFXIV.Client.Graphics.Kernel.Texture;

namespace PmpCapture;

/// <summary>One capture: the scene read on the game thread, render targets copied on the render thread, then saved.</summary>
public sealed unsafe class CaptureJob
{
    private readonly string folder;
    private readonly JsonObject root = new();
    private readonly JsonArray notes = new();
    private readonly List<(string Name, byte[] Data)> blobs = new();
    private readonly List<(string Name, nint Texture)> colorTables = new();

    public CaptureJob(string folder, string label)
    {
        this.folder = folder;
        root["format"]  = 1;
        root["label"]   = label;
        root["time"]    = DateTime.Now.ToString("O");
        root["notes"]   = notes;
    }

    public void Note(string s)
    {
        lock (notes)
            notes.Add(s);
    }

    // ------------------------------------------------------------------ game thread

    public void ReadScene()
    {
        root["game"]   = Game();
        root["camera"] = CameraJson();
        root["env"]    = Env();
        var (addr, which) = PickCharacter();
        var ch = (Character*)addr;
        root["subjectSource"] = which;
        if (ch == null)
        {
            Note("no character to capture");
            return;
        }

        root["character"] = CharacterJson(ch);
        root["penumbra"]  = PenumbraPaths(ch->GameObject.ObjectIndex);
    }

    /// <summary>The GPose actor when in GPose (that is what's on screen), else the player.</summary>
    private static (nint addr, string which) PickCharacter()
    {
        if (Plugin.ClientState.IsGPosing && Plugin.ObjectTable[201] is { } gpose && gpose.Address != 0)
            return (gpose.Address, "gpose actor (object 201)");
        var p = Plugin.ObjectTable.LocalPlayer;
        return p == null ? (0, "none") : (p.Address, "local player");
    }

    private static JsonObject Game()
    {
        var o = new JsonObject
        {
            ["territory"] = Plugin.ClientState.TerritoryType,
            ["map"]       = Plugin.ClientState.MapId,
            ["gpose"]     = Plugin.ClientState.IsGPosing,
        };
        var cfg = new JsonObject();
        foreach (var name in new[]
                 {
                     "CharaLight", "Gamma", "SSAO_DX11", "Glare_DX11", "GlareRepresentation_DX11", "AntiAliasing_DX11",
                     "ReflectionType_DX11", "DepthOfField_DX11", "RadialBlur_DX11", "Vignetting_DX11", "TranslucentQuality_DX11",
                     "ShadowSoftShadowType_DX11", "ShadowTextureSizeType_DX11", "ShadowCascadeCountType_DX11", "ShadowLightValidType",
                     "TextureFilterQuality_DX11", "TextureAnisotropicQuality_DX11", "GraphicsRezoScale", "GraphicsRezoUpscaleType",
                     "DynamicRezoThreshold", "ScreenWidth", "ScreenHeight", "ScreenMode",
                 })
        {
            if (Plugin.GameConfig.System.TryGet(name, out uint v))
                cfg[name] = v;
            else if (Plugin.GameConfig.System.TryGet(name, out float f))
                cfg[name] = f;
        }

        o["config"] = cfg;
        var dev = Device.Instance();
        if (dev != null)
            o["device"] = new JsonObject
            {
                ["width"] = dev->Width, ["height"] = dev->Height, ["gammaCorrection"] = dev->GammaCorrection,
                ["colorFilter"] = dev->ColorFilter, ["colorFilterRange"] = dev->ColorFilterRange,
            };
        var rtm = RenderTargetManager.Instance();
        if (rtm != null)
            o["render"] = new JsonObject
            {
                ["width"] = rtm->Resolution_Width, ["height"] = rtm->Resolution_Height,
                ["shadowMap"] = new JsonArray(rtm->ShadowMap_Width, rtm->ShadowMap_Height),
                ["nearShadowMap"] = new JsonArray(rtm->NearShadowMap_Width, rtm->NearShadowMap_Height),
                ["farShadowMap"] = new JsonArray(rtm->FarShadowMap_Width, rtm->FarShadowMap_Height),
                ["upscalerRenderScale"] = rtm->UpscalerRenderScale, ["graphicsRezoScale"] = rtm->GraphicsRezoScale,
            };
        return o;
    }

    private JsonObject? CameraJson()
    {
        var cm = SceneCameraManager.Instance();
        if (cm == null)
            return null;
        var cam = cm->CurrentCamera;
        if (cam == null)
            return null;
        var o = new JsonObject
        {
            ["position"] = V3(cam->Position), ["lookAt"] = V3(cam->LookAtVector), ["sceneView"] = M(cam->ViewMatrix),
        };
        var rc = cam->RenderCamera;
        if (rc != null)
            o["render"] = RenderCameraJson(rc);
        return o;
    }

    private static JsonObject RenderCameraJson(RenderCamera* rc) => new()
    {
        ["view"] = M(rc->ViewMatrix), ["projection"] = M(rc->ProjectionMatrix), ["projection2"] = M(rc->ProjectionMatrix2),
        ["origin"] = V3(rc->Origin), ["fov"] = rc->FoV, ["fov2"] = rc->FoV_2, ["aspect"] = rc->AspectRatio,
        ["near"] = rc->NearPlane, ["far"] = rc->FarPlane, ["orthoHeight"] = rc->OrthoHeight, ["isOrtho"] = rc->IsOrtho,
        ["standardZ"] = rc->StandardZ, ["finiteFarPlane"] = rc->FiniteFarPlane,
    };

    private JsonObject? Env()
    {
        var em = EnvManager.Instance();
        if (em == null)
            return null;
        var o = new JsonObject
        {
            ["dayTimeSeconds"] = em->DayTimeSeconds, ["activeWeather"] = em->ActiveWeather,
            ["transitionProgress"] = em->TransitionProgress, ["transitionTime"] = em->TransitionTime,
            // the whole EnvState as floats: most of its fields have no names yet
            ["state"] = Floats(&em->EnvState, sizeof(EnvState)),
            ["colorFilter"] = ColorFilter(em->EnvState.ColorFilter),
            ["shadowCamera"] = RenderCameraJson(&em->ShadowCamera.Camera),
        };
        if (em->EnvScene != null && em->EnvScene->ConstantBuffer != null)
            o["sceneCBuffer"] = CBuffer(em->EnvScene->ConstantBuffer);
        return o;
    }

    private static JsonObject ColorFilter(EnvColorFilterParameters c) => new()
    {
        ["curve"] = V4(c.Curve), ["hue"] = c.Hue, ["saturation"] = c.Saturation, ["brightness"] = c.Brightness,
        ["contrast"] = c.Contrast, ["tint"] = V3(c.TintColor), ["tintStrength"] = c.TintStrength, ["sepia"] = c.Sepia,
        ["monochrome"] = c.Monochrome, ["invert"] = c.Invert, ["darkSaturation"] = c.DarkSaturation,
        ["darkTint"] = V3(c.DarkTintColor), ["darkThreshold"] = c.DarkThreshold, ["darkRange"] = c.DarkRange,
        ["darkTintStrength"] = c.DarkTintStrength, ["strength"] = c.Strength,
    };

    private JsonObject? CharacterJson(Character* ch)
    {
        var draw = ch->GameObject.DrawObject;
        var o = new JsonObject
        {
            ["name"] = ch->GameObject.NameString, ["objectIndex"] = ch->GameObject.ObjectIndex,
            ["drawCustomize"] = Bytes(&ch->DrawData.CustomizeData, sizeof(CustomizeData)),
        };
        if (draw == null)
        {
            Note("the character has no draw object");
            return o;
        }

        o["drawObject"] = new JsonObject
        {
            ["position"] = V3(draw->Object.Position), ["rotation"] = Q(draw->Object.Rotation), ["scale"] = V3(draw->Object.Scale),
        };
        var cb = (CharacterBase*)draw;
        var type = cb->GetModelType();
        o["modelType"] = type.ToString();
        o["globalScale"] = *(float*)((byte*)cb + 0x2A0);    // GlobalScale (not public in this ClientStructs)
        o["modelScale"]  = *(float*)((byte*)cb + 0x2A4);    // ModelScale
        o["tint"]        = V4(cb->Tint);
        o["wetness"]     = new JsonArray(cb->WeatherWetness, cb->SwimmingWetness, cb->WetnessDepth, cb->ForcedWetness);
        if (cb->CharacterDataCBuffer != null)
            o["characterDataCBuffer"] = CBuffer(cb->CharacterDataCBuffer);

        if (type == CharacterBase.ModelType.Human)
        {
            var h = (Human*)cb;
            o["customize"] = Bytes(&h->Customize, sizeof(CustomizeData));
            var slots = new JsonArray();
            var eq = (ulong*)&h->Head;
            for (var i = 0; i < 10; i++)
                slots.Add(eq[i]);       // set id | variant << 16 | stain 1 << 24 | stain 2 << 32
            o["equipment"] = slots;
            var gl = (ulong*)&h->Glasses0;
            o["glasses"] = new JsonArray(gl[0], gl[1]);
            o["ids"] = new JsonObject
            {
                ["raceSex"] = h->RaceSexId, ["hair"] = h->HairId, ["face"] = h->FaceId, ["tailEar"] = h->TailEarId, ["fur"] = h->FurId,
            };
            if (h->CustomizeParameterCBuffer != null)
                o["customizeParameter"] = CBuffer(h->CustomizeParameterCBuffer);
            if (h->DecalColorCBuffer != null)
                o["decalColor"] = CBuffer(h->DecalColorCBuffer);
            o["decal"] = ResourceName((ResourceHandle*)h->Decal);
            o["legacyBodyDecal"] = ResourceName((ResourceHandle*)h->LegacyBodyDecal);
        }

        o["models"]   = Models(cb);
        o["skeleton"] = SkeletonJson(cb->Skeleton);
        return o;
    }

    private JsonArray Models(CharacterBase* cb)
    {
        var arr = new JsonArray();
        for (var i = 0; i < cb->SlotCount; i++)
        {
            var m = cb->Models[i];
            if (m == null)
                continue;
            var mo = new JsonObject
            {
                ["slot"] = i, ["slotIndex"] = m->SlotIndex,
                ["file"] = ResourceName((ResourceHandle*)m->ModelResourceHandle),
                ["attributeMask"] = m->EnabledAttributeIndexMask, ["shapeMask"] = m->EnabledShapeKeyIndexMask,
                ["boneCount"] = m->BoneCount,
            };
            var mats = new JsonArray();
            for (var j = 0; j < m->MaterialCount; j++)
            {
                var mat = m->Materials[j];
                if (mat == null)
                {
                    mats.Add(null);
                    continue;
                }

                var mrh = mat->MaterialResourceHandle;
                var mj = new JsonObject
                {
                    ["file"] = ResourceName((ResourceHandle*)mrh), ["shaderFlags"] = mat->ShaderFlags,
                };
                if (mrh != null)
                {
                    mj["shader"] = ResourceName((ResourceHandle*)mrh->ShaderPackageResourceHandle);
                    var texs = new JsonArray();
                    for (var k = 0; k < mrh->TextureCount; k++)
                        texs.Add(ResourceName((ResourceHandle*)mrh->Textures[k].TextureResourceHandle));
                    mj["textures"] = texs;
                }

                if (mat->MaterialParameterCBuffer != null)
                    mj["materialParameter"] = CBuffer(mat->MaterialParameterCBuffer);
                // the colour table the game uploaded for this material (dyed), copied from the GPU at draw time
                var table = cb->ColorTableTextures != null ? cb->ColorTableTextures[i * CharacterBase.MaterialsPerSlot + j] : null;
                if (table != null && j < CharacterBase.MaterialsPerSlot)
                {
                    var tn = $"colortable_{i}_{j}";
                    colorTables.Add((tn, (nint)table));
                    mj["colorTable"] = tn;
                }

                mats.Add(mj);
            }

            mo["materials"] = mats;
            arr.Add(mo);
        }

        return arr;
    }

    private JsonObject? SkeletonJson(Skeleton* sk)
    {
        if (sk == null)
            return null;
        var o = new JsonObject
        {
            ["position"] = V3(sk->Transform.Position), ["rotation"] = Q(sk->Transform.Rotation), ["scale"] = V3(sk->Transform.Scale),
        };
        var parts = new JsonArray();
        for (var p = 0; p < sk->PartialSkeletonCount; p++)
        {
            var ps   = &sk->PartialSkeletons[p];
            var po   = new JsonObject
            {
                ["file"] = ResourceName((ResourceHandle*)ps->SkeletonResourceHandle),
                ["connectedParentBone"] = ps->ConnectedParentBoneIndex, ["connectedBone"] = ps->ConnectedBoneIndex,
            };
            var pose = ps->GetHavokPose(0);
            if (pose == null || pose->Skeleton == null)
            {
                parts.Add(po);
                continue;
            }

            var hs    = pose->Skeleton;
            var n     = hs->Bones.Length;
            var names = new JsonArray();
            var par   = new JsonArray();
            for (var b = 0; b < n; b++)
            {
                names.Add(hs->Bones[b].Name.String);
                par.Add(hs->ParentIndices[b]);
            }

            po["bones"]   = names;
            po["parents"] = par;
            po["reference"] = Qs(hs->ReferencePose.Data, hs->ReferencePose.Length);   // local bind pose
            po["local"]     = Qs(pose->LocalPose.Data, pose->LocalPose.Length);
            var model = pose->GetSyncedPoseModelSpace();                              // posed, model space
            if (model != null)
                po["model"] = Qs(model->Data, model->Length);
            parts.Add(po);
        }

        o["partials"] = parts;
        return o;
    }

    private JsonObject? PenumbraPaths(ushort objectIndex)
    {
        try
        {
            var all = new Penumbra.Api.IpcSubscribers.GetGameObjectResourcePaths(Plugin.PluginInterface).Invoke(objectIndex);
            if (all.Length == 0 || all[0] == null)
                return null;
            var o = new JsonObject();
            foreach (var (actual, gamePaths) in all[0]!)
                o[actual] = new JsonArray(gamePaths.Select(g => (JsonNode)JsonValue.Create(g)!).ToArray());
            return o;
        }
        catch (Exception e)
        {
            Note("Penumbra resource paths: " + e.Message);
            return null;
        }
    }

    // ------------------------------------------------------------------ render thread

    /// <summary>Copies the frame's render targets (and the dyed colour tables) to the CPU.</summary>
    public void ReadTargets(nint deviceHandle)
    {
        var dev = (ID3D11Device*)deviceHandle;
        ID3D11DeviceContext* ctx;
        dev->GetImmediateContext(&ctx);
        var list = new JsonArray();
        try
        {
            var rtm = RenderTargetManager.Instance();
            if (rtm != null)
            {
                for (var i = 0; i < 5; i++)
                    Grab(dev, ctx, list, $"gbuffer{i}", rtm->GBuffers[i]);
                for (var i = 0; i < 5; i++)
                    Grab(dev, ctx, list, $"semigbuffer{i}", rtm->SemitransparentGBuffers[i]);
                Grab(dev, ctx, list, "shadowmask", At(rtm, 0x50));
                Grab(dev, ctx, list, "lightdiffuse", At(rtm, 0x58));
                Grab(dev, ctx, list, "lightspecular", At(rtm, 0x60));
                Grab(dev, ctx, list, "semishadowmask", At(rtm, 0xC8));
                Grab(dev, ctx, list, "semilightdiffuse", At(rtm, 0xD0));
                Grab(dev, ctx, list, "semilightspecular", At(rtm, 0xD8));
                Grab(dev, ctx, list, "depth", rtm->DepthStencil);
                Grab(dev, ctx, list, "viewposition", rtm->ViewPosition);
                Grab(dev, ctx, list, "velocity", rtm->Velocity);
                Grab(dev, ctx, list, "toneadjustsource", rtm->ToneAdjustSource);
                Grab(dev, ctx, list, "backbuffer", rtm->SwapChainBackBuffer);
            }

            foreach (var (name, tex) in colorTables)
                Grab(dev, ctx, list, name, (Texture*)tex);
        }
        finally
        {
            ctx->Release();
        }

        root["targets"] = list;
    }

    /// <summary>A Texture* field of RenderTargetManager by offset (some aren't public in this ClientStructs).</summary>
    private static Texture* At(RenderTargetManager* rtm, int offset) => *(Texture**)((byte*)rtm + offset);

    private void Grab(ID3D11Device* dev, ID3D11DeviceContext* ctx, JsonArray list, string name, Texture* t)
    {
        if (t == null || t->D3D11Texture2D == null)
            return;
        try
        {
            var src = (ID3D11Texture2D*)t->D3D11Texture2D;
            D3D11_TEXTURE2D_DESC d;
            src->GetDesc(&d);
            var entry = new JsonObject
            {
                ["name"] = name, ["width"] = d.Width, ["height"] = d.Height, ["format"] = (int)d.Format,
                ["formatName"] = d.Format.ToString(), ["samples"] = d.SampleDesc.Count, ["mips"] = d.MipLevels, ["array"] = d.ArraySize,
            };
            if (d.SampleDesc.Count > 1)
            {
                entry["skipped"] = "multisampled";
                list.Add(entry);
                return;
            }

            var sd = d;
            sd.MipLevels      = 1;
            sd.ArraySize      = 1;
            sd.Usage          = D3D11_USAGE.D3D11_USAGE_STAGING;
            sd.BindFlags      = 0;
            sd.CPUAccessFlags = (uint)D3D11_CPU_ACCESS_FLAG.D3D11_CPU_ACCESS_READ;
            sd.MiscFlags      = 0;
            ID3D11Texture2D* staging;
            if (dev->CreateTexture2D(&sd, null, &staging).FAILED)
            {
                entry["skipped"] = "staging texture not created";
                list.Add(entry);
                return;
            }

            try
            {
                ctx->CopySubresourceRegion((ID3D11Resource*)staging, 0, 0, 0, 0, (ID3D11Resource*)src, 0, null);
                D3D11_MAPPED_SUBRESOURCE map;
                if (ctx->Map((ID3D11Resource*)staging, 0, D3D11_MAP.D3D11_MAP_READ, 0, &map).FAILED)
                {
                    entry["skipped"] = "map failed";
                    list.Add(entry);
                    return;
                }

                try
                {
                    var bpp = BytesPerPixel(d.Format);
                    var row = bpp > 0 ? (int)d.Width * bpp : (int)map.RowPitch;
                    var data = new byte[row * (int)d.Height];
                    for (var y = 0; y < d.Height; y++)
                        new ReadOnlySpan<byte>((byte*)map.pData + y * map.RowPitch, row).CopyTo(data.AsSpan(y * row));
                    entry["rowBytes"] = row;
                    entry["file"] = name + ".bin.gz";
                    blobs.Add((name + ".bin.gz", data));
                }
                finally
                {
                    ctx->Unmap((ID3D11Resource*)staging, 0);
                }
            }
            finally
            {
                staging->Release();
            }

            list.Add(entry);
        }
        catch (Exception e)
        {
            Note($"{name}: {e.Message}");
        }
    }

    private static int BytesPerPixel(DXGI_FORMAT f) => f switch
    {
        DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_TYPELESS or DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_FLOAT
            or DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_UINT => 16,
        DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_TYPELESS or DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT
            or DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_UNORM or DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_UINT
            or DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_SNORM or DXGI_FORMAT.DXGI_FORMAT_R32G32_TYPELESS
            or DXGI_FORMAT.DXGI_FORMAT_R32G32_FLOAT or DXGI_FORMAT.DXGI_FORMAT_R32G8X24_TYPELESS
            or DXGI_FORMAT.DXGI_FORMAT_D32_FLOAT_S8X24_UINT => 8,
        DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_TYPELESS or DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM
            or DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM_SRGB or DXGI_FORMAT.DXGI_FORMAT_B8G8R8A8_TYPELESS
            or DXGI_FORMAT.DXGI_FORMAT_B8G8R8A8_UNORM or DXGI_FORMAT.DXGI_FORMAT_B8G8R8A8_UNORM_SRGB
            or DXGI_FORMAT.DXGI_FORMAT_B8G8R8X8_UNORM or DXGI_FORMAT.DXGI_FORMAT_R10G10B10A2_TYPELESS
            or DXGI_FORMAT.DXGI_FORMAT_R10G10B10A2_UNORM or DXGI_FORMAT.DXGI_FORMAT_R11G11B10_FLOAT
            or DXGI_FORMAT.DXGI_FORMAT_R16G16_TYPELESS or DXGI_FORMAT.DXGI_FORMAT_R16G16_FLOAT
            or DXGI_FORMAT.DXGI_FORMAT_R16G16_UNORM or DXGI_FORMAT.DXGI_FORMAT_R32_TYPELESS
            or DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT or DXGI_FORMAT.DXGI_FORMAT_D32_FLOAT
            or DXGI_FORMAT.DXGI_FORMAT_R24G8_TYPELESS or DXGI_FORMAT.DXGI_FORMAT_D24_UNORM_S8_UINT
            or DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UINT or DXGI_FORMAT.DXGI_FORMAT_R32_UINT => 4,
        DXGI_FORMAT.DXGI_FORMAT_R16_TYPELESS or DXGI_FORMAT.DXGI_FORMAT_R16_FLOAT or DXGI_FORMAT.DXGI_FORMAT_R16_UNORM
            or DXGI_FORMAT.DXGI_FORMAT_R8G8_TYPELESS or DXGI_FORMAT.DXGI_FORMAT_R8G8_UNORM => 2,
        DXGI_FORMAT.DXGI_FORMAT_R8_TYPELESS or DXGI_FORMAT.DXGI_FORMAT_R8_UNORM or DXGI_FORMAT.DXGI_FORMAT_A8_UNORM => 1,
        _ => 0,
    };

    // ------------------------------------------------------------------ saving

    public void SaveInBackground(Action<string> done, Action<Exception> failed)
    {
        Task.Run(() =>
        {
            try
            {
                Directory.CreateDirectory(folder);
                foreach (var (name, data) in blobs)
                {
                    using var fs = File.Create(Path.Combine(folder, name));
                    using var gz = new GZipStream(fs, CompressionLevel.Fastest);
                    gz.Write(data);
                }

                File.WriteAllText(Path.Combine(folder, "capture.json"), root.ToJsonString(new JsonSerializerOptions { WriteIndented = true }));
                done(folder);
            }
            catch (Exception e)
            {
                failed(e);
            }
        });
    }

    // ------------------------------------------------------------------ helpers

    private static string? ResourceName(ResourceHandle* h)
    {
        if (h == null)
            return null;
        try
        {
            return h->FileName.ToString();
        }
        catch
        {
            return null;
        }
    }

    private static JsonObject? CBuffer(ConstantBuffer* cb)
    {
        if (cb == null)
            return null;
        var o = new JsonObject { ["byteSize"] = cb->ByteSize, ["flags"] = cb->Flags };
        if (cb->UnsafeSourcePointer != null && cb->ByteSize > 0 && cb->ByteSize <= 65536)
            o["floats"] = Floats(cb->UnsafeSourcePointer, cb->ByteSize);
        return o;
    }

    private static JsonArray Floats(void* p, int bytes)
    {
        var a = new JsonArray();
        var f = (float*)p;
        for (var i = 0; i < bytes / 4; i++)
            a.Add(float.IsFinite(f[i]) ? f[i] : (JsonNode?)JsonValue.Create(BitConverter.SingleToUInt32Bits(f[i]).ToString("X8")));
        return a;
    }

    private static string Bytes(void* p, int n) => Convert.ToHexString(new ReadOnlySpan<byte>(p, n));

    private static JsonArray Qs(hkQsTransformf* t, int n)
    {
        var a = new JsonArray();
        for (var i = 0; i < n; i++)
            a.Add(new JsonArray(t[i].Translation.X, t[i].Translation.Y, t[i].Translation.Z,
                t[i].Rotation.X, t[i].Rotation.Y, t[i].Rotation.Z, t[i].Rotation.W,
                t[i].Scale.X, t[i].Scale.Y, t[i].Scale.Z));
        return a;
    }

    private static JsonArray V3(Vector3 v) => new(v.X, v.Y, v.Z);
    private static JsonArray V4(Vector4 v) => new(v.X, v.Y, v.Z, v.W);
    private static JsonArray Q(Quaternion q) => new(q.X, q.Y, q.Z, q.W);

    private static JsonArray M(Matrix4x4 m) => new(m.M11, m.M12, m.M13, m.M14, m.M21, m.M22, m.M23, m.M24,
        m.M31, m.M32, m.M33, m.M34, m.M41, m.M42, m.M43, m.M44);
}
