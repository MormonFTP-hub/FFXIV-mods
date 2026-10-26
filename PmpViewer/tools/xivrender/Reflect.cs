using TerraFX.Interop.DirectX;
using TerraFX.Interop.Windows;
using static TerraFX.Interop.DirectX.DirectX;
using static TerraFX.Interop.Windows.Windows;

namespace XivRender;

/// <summary>
/// What a game shader expects, read from the reflection data that the game's DXBC blobs still carry:
/// constant buffer layouts with member names, resource slots and the input signature.
/// </summary>
public sealed class ShaderInfo
{
    public sealed record Var(string Path, int Offset, int Size, int Rows, int Columns, int Elements);

    public sealed class Cb
    {
        public string Name = "";
        public int    Slot;
        public int    Size;
        public readonly Dictionary<string, Var> Vars = new(StringComparer.Ordinal);
    }

    public sealed record Res(string Name, int Slot, D3D_SHADER_INPUT_TYPE Type, D3D_SRV_DIMENSION Dim, int Stride);

    public sealed record Input(string Semantic, int Index, int Register, D3D_REGISTER_COMPONENT_TYPE Type, int Mask, D3D_NAME SystemValue);

    public readonly List<Cb>    Cbs      = new();
    public readonly List<Res>   Textures = new();   // name without the ".T" suffix the compiler adds
    public readonly List<Res>   Samplers = new();   // name without ".S"
    public readonly List<Input> Inputs   = new();
    public readonly List<Input> Outputs  = new();
    public int Stage;   // D3D11_SHVER_*: 0 pixel, 1 vertex, 5 compute

    public Res? Texture(string name) => Textures.FirstOrDefault(t => t.Name == name);

    public static unsafe ShaderInfo Read(ReadOnlySpan<byte> dxbc)
    {
        var info = new ShaderInfo();
        ID3D11ShaderReflection* refl;
        fixed (byte* p = dxbc)
            Gpu.Check(D3DReflect(p, (nuint)dxbc.Length, __uuidof<ID3D11ShaderReflection>(), (void**)&refl), "D3DReflect");
        try
        {
            D3D11_SHADER_DESC desc;
            refl->GetDesc(&desc);
            info.Stage = (int)(desc.Version >> 16);
            for (uint i = 0; i < desc.BoundResources; i++)
            {
                D3D11_SHADER_INPUT_BIND_DESC b;
                refl->GetResourceBindingDesc(i, &b);
                var name = new string(b.Name);
                switch (b.Type)
                {
                    case D3D_SHADER_INPUT_TYPE.D3D_SIT_CBUFFER:
                        break;
                    case D3D_SHADER_INPUT_TYPE.D3D_SIT_SAMPLER:
                        info.Samplers.Add(new Res(Strip(name, ".S"), (int)b.BindPoint, b.Type, b.Dimension, 0));
                        break;
                    default:
                        info.Textures.Add(new Res(Strip(name, ".T"), (int)b.BindPoint, b.Type, b.Dimension, (int)b.NumSamples));
                        break;
                }
            }

            for (uint i = 0; i < desc.ConstantBuffers; i++)
            {
                var cb = refl->GetConstantBufferByIndex(i);
                D3D11_SHADER_BUFFER_DESC cd;
                cb->GetDesc(&cd);
                if (cd.Type != D3D_CBUFFER_TYPE.D3D_CT_CBUFFER)
                    continue;
                var c = new Cb { Name = new string(cd.Name), Size = (int)cd.Size };
                D3D11_SHADER_INPUT_BIND_DESC bd;
                fixed (char* _ = c.Name)
                {
                    var bytes = System.Text.Encoding.ASCII.GetBytes(c.Name + "\0");
                    fixed (byte* nb = bytes)
                        if (refl->GetResourceBindingDescByName((sbyte*)nb, &bd).SUCCEEDED)
                            c.Slot = (int)bd.BindPoint;
                }

                for (uint v = 0; v < cd.Variables; v++)
                {
                    var var = cb->GetVariableByIndex(v);
                    D3D11_SHADER_VARIABLE_DESC vd;
                    var->GetDesc(&vd);
                    var vname = new string(vd.Name);
                    Flatten(c, vname, (int)vd.StartOffset, var->GetType(), true);
                }

                info.Cbs.Add(c);
            }

            for (uint i = 0; i < desc.InputParameters; i++)
            {
                D3D11_SIGNATURE_PARAMETER_DESC s;
                refl->GetInputParameterDesc(i, &s);
                info.Inputs.Add(new Input(new string(s.SemanticName), (int)s.SemanticIndex, (int)s.Register, s.ComponentType, s.Mask, s.SystemValueType));
            }

            for (uint i = 0; i < desc.OutputParameters; i++)
            {
                D3D11_SIGNATURE_PARAMETER_DESC s;
                refl->GetOutputParameterDesc(i, &s);
                info.Outputs.Add(new Input(new string(s.SemanticName), (int)s.SemanticIndex, (int)s.Register, s.ComponentType, s.Mask, s.SystemValueType));
            }
        }
        finally
        {
            refl->Release();
        }

        return info;
    }

    private static string Strip(string name, string suffix)
        => name.EndsWith(suffix, StringComparison.Ordinal) ? name[..^suffix.Length] : name;

    private static unsafe void Flatten(Cb cb, string path, int offset, ID3D11ShaderReflectionType* type, bool root)
    {
        D3D11_SHADER_TYPE_DESC td;
        type->GetDesc(&td);
        var size = (int)(td.Rows * td.Columns * 4);
        if (td.Elements > 1)
            size = (int)(16 * (td.Elements - 1) + td.Rows * td.Columns * 4);
        cb.Vars[path] = new Var(path, offset, size, (int)td.Rows, (int)td.Columns, (int)td.Elements);
        if (td.Class != D3D_SHADER_VARIABLE_CLASS.D3D_SVC_STRUCT)
            return;
        for (uint m = 0; m < td.Members; m++)
        {
            var mt = type->GetMemberTypeByIndex(m);
            var mname = new string(type->GetMemberTypeName(m));
            D3D11_SHADER_TYPE_DESC md;
            mt->GetDesc(&md);
            // members are addressed without the cbuffer's own variable name: "m_ViewMatrix", "param.sh.param"
            var child = root ? mname : path + "." + mname;
            Flatten(cb, child, offset + (int)md.Offset, mt, false);
        }
    }

    public Cb? FindCb(string name) => Cbs.FirstOrDefault(c => c.Name == name);

    public override string ToString()
    {
        var sb = new System.Text.StringBuilder();
        foreach (var c in Cbs)
        {
            sb.AppendLine($"cb{c.Slot} {c.Name} ({c.Size} bytes)");
            foreach (var v in c.Vars.Values.OrderBy(v => v.Offset))
                sb.AppendLine($"    +{v.Offset,4} {v.Path} [{v.Rows}x{v.Columns}{(v.Elements > 0 ? $" x{v.Elements}" : "")}]");
        }

        foreach (var t in Textures) sb.AppendLine($"t{t.Slot} {t.Name} {t.Type} {t.Dim}");
        foreach (var s in Samplers) sb.AppendLine($"s{s.Slot} {s.Name}");
        foreach (var i in Inputs)   sb.AppendLine($"in {i.Semantic}{i.Index} v{i.Register} {i.Type} mask {i.Mask:X}");
        foreach (var o in Outputs)  sb.AppendLine($"out {o.Semantic}{o.Index} o{o.Register}");
        return sb.ToString();
    }
}
