using System.Text.Json;
using System.Text.Json.Serialization;

namespace XivRender;

/// <summary>What to draw. The PMP viewer's resolver fills this in: every model, its materials and the files the mod redirects.</summary>
public sealed class SceneDesc
{
    public int Width  { get; set; } = 1024;
    public int Height { get; set; } = 1024;
    public CameraDesc Camera { get; set; } = new();
    public EnvDesc Env { get; set; } = new();
    public Dictionary<string, string> Redirects { get; set; } = new();
    public List<ModelDesc> Models { get; set; } = new();
    /// <summary>Character colours as the palette gives them (0..1 RGB): skin, hair, highlight, eye, eyeLeft, lip (RGBA, A = opacity), option; muscle (0..1).</summary>
    public Dictionary<string, float[]>? Customize { get; set; }
    /// <summary>Several figures with their own redirections (the mod, and vanilla beside it); empty = the fields above.</summary>
    public List<FigureDesc>? Figures { get; set; }
    /// <summary>"final", or a debug view: gbuffer0..4, lightdiffuse, lightspecular, depth, hdr.</summary>
    public string Output { get; set; } = "final";
    /// <summary>World-space box the sun's shadow map covers (min xyz, max xyz); default: the models' boxes.</summary>
    public float[]? ShadowBounds { get; set; }
    public string? OutFile { get; set; }

    public static SceneDesc Parse(string json) => JsonSerializer.Deserialize<SceneDesc>(json, Options)!;

    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true, ReadCommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };
}

public sealed class FigureDesc
{
    public Dictionary<string, string> Redirects { get; set; } = new();
    public Dictionary<string, float[]>? Customize { get; set; }
    public List<ModelDesc> Models { get; set; } = new();
}

public sealed class CameraDesc
{
    public float[] Eye    { get; set; } = { 0, 1.2f, 3 };
    public float[] Target { get; set; } = { 0, 1, 0 };
    public float[] Up     { get; set; } = { 0, 1, 0 };
    public float   FovY   { get; set; } = 30;      // degrees
    public float   Near   { get; set; } = 0.1f;
}

public sealed class EnvDesc
{
    /// <summary>World-space direction from the scene towards the sun/moon.</summary>
    public float[] LightDir      { get; set; } = { 0.4f, 0.7f, 0.6f };
    public float[] LightDiffuse  { get; set; } = { 1.2f, 1.15f, 1.1f };
    public float[] LightSpecular { get; set; } = { 1.2f, 1.15f, 1.1f };
    /// <summary>L1 spherical harmonics per colour channel: x, y, z, constant (as g_AmbientParam stores them).</summary>
    public float[][] AmbientSh   { get; set; } = { new[] { 0f, 0.1f, 0f, 0.35f }, new[] { 0f, 0.1f, 0f, 0.36f }, new[] { 0f, 0.12f, 0f, 0.4f } };
    public float[][]? SkySh      { get; set; }
    /// <summary>Reflection probe colour above the horizon (sky), and below it (ground; null = the same).</summary>
    public float[] Reflection    { get; set; } = { 0.35f, 0.37f, 0.42f };
    public float[]? ReflectionGround { get; set; }
    public float   ReflectionScale { get; set; } = 1;
    public float   BakeLightRate { get; set; } = 0;
    public float[] CameraLight   { get; set; } = { 0, 0, 0, 0 };    // m_CameraLight.m_DiffuseSpecular
    /// <summary>Colour of cameralighting.shpk's light at the camera (off when black).</summary>
    public float[]? CameraLightColor { get; set; }
    public float[] CameraRim     { get; set; } = { 0, 0, 0, 0 };    // m_CameraLight.m_Rim
    public float[] Background    { get; set; } = { 0.18f, 0.19f, 0.21f };
    /// <summary>Adapted luminance the tone curve uses (the game's auto exposure; ~1 for a balanced scene).</summary>
    public float   Exposure      { get; set; } = 1;
    /// <summary>Tone curve white point (luminance mapped to 1).</summary>
    public float   WhitePoint    { get; set; } = 8;
    public bool    ToneMap       { get; set; } = true;
    public bool    Shadows       { get; set; } = true;
    /// <summary>Ambient occlusion with the game's GTAO compute shaders; samples &gt; 1 averages noise patterns (the game's TAA).</summary>
    public bool    Ao            { get; set; } = true;
    public int     AoSamples     { get; set; } = 1;
    public float   Time          { get; set; } = 0;
}

public sealed class ModelDesc
{
    public string Id { get; set; } = "";
    public string Mdl { get; set; } = "";
    /// <summary>Full game path of each material slot of the model, in the model's own material order (null = not loaded).</summary>
    public List<string?> Materials { get; set; } = new();
    /// <summary>Skinning matrix per model bone (model's bone-name order): 16 floats, column-major (three.js Matrix4.elements).</summary>
    public List<float[]?>? Bones { get; set; }
    /// <summary>Model-to-world for rigid models, 16 floats column-major.</summary>
    public float[]? World { get; set; }
    public List<string> HiddenAttributes { get; set; } = new();
    public List<string> Shapes { get; set; } = new();
    public float[] MulColor { get; set; } = { 1, 1, 1, 1 };
    public float[]? DecalColor { get; set; }
    public string? Decal { get; set; }
    public Dictionary<string, float[]>? Customize { get; set; }
    public List<int>? Stains { get; set; }
}
