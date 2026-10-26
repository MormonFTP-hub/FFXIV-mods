using TerraFX.Interop.DirectX;
using static TerraFX.Interop.DirectX.DirectX;

namespace XivRender;

public static unsafe class Disasm
{
    /// <summary>D3D's own disassembly of a DXBC blob (works for compute shaders too).</summary>
    public static string Of(byte[] blob)
    {
        ID3DBlob* text;
        fixed (byte* p = blob)
            Gpu.Check(D3DDisassemble(p, (nuint)blob.Length, 0, null, &text), "D3DDisassemble");
        var s = new string((sbyte*)text->GetBufferPointer(), 0, (int)text->GetBufferSize());
        text->Release();
        return s;
    }
}
