using System.Numerics;
using Penumbra.GameData.Files;
using TerraFX.Interop.DirectX;
using Lumina.Data.Parsing;

namespace XivRender;

/// <summary>An .mdl on the GPU the way the game draws it: the LOD0 vertex streams as they are in the file, one index buffer, per-mesh bone tables.</summary>
public sealed unsafe class GpuModel
{
    public sealed class Sub
    {
        public int    Start, Count;      // absolute index-buffer range
        public uint   AttributeMask;
        public string[] Attributes = Array.Empty<string>();
    }

    public sealed class Mesh
    {
        public int      Index;           // within LOD0
        public int      Material;
        public int      VertexCount;
        public int      StartIndex, IndexCount;
        public uint[]   StreamOffset = new uint[3];
        public uint[]   StreamStride = new uint[3];
        public MdlStructs.VertexDeclarationStruct Decl;
        public ushort[] BoneTable = Array.Empty<ushort>();
        public bool     Skinned;
        public readonly List<Sub> Subs = new();
        public readonly Dictionary<string, nint> Layouts = new();
    }

    public string        Path = "";
    public MdlFile       File = null!;
    public ID3D11Buffer* Vb;
    public ID3D11Buffer* Ib;
    public ushort[]      BaseIndices = Array.Empty<ushort>();
    public readonly List<Mesh> Meshes = new();
    public string[]      Bones => File.Bones;
    public HashSet<string> EnabledShapes = new();
    private string       _shapeKey = "";

    private static ID3D11Buffer* _zeros;   // stands in for vertex inputs a mesh doesn't have

    public static GpuModel Load(Gpu gpu, string path, byte[] bytes)
    {
        var mdl = new MdlFile(bytes);
        var m   = new GpuModel { Path = path, File = mdl };
        var data = mdl.RemainingData;
        var lod  = mdl.Lods[0];
        var vbSize = (int)mdl.VertexBufferSize[0];
        var ibOff  = (int)(mdl.IndexOffset[0] - mdl.VertexOffset[0]);
        var ibSize = (int)mdl.IndexBufferSize[0];
        m.Vb = gpu.CreateBuffer(data.AsSpan(0, Math.Min(vbSize, data.Length)), D3D11_BIND_FLAG.D3D11_BIND_VERTEX_BUFFER);
        m.BaseIndices = new ushort[ibSize / 2];
        Buffer.BlockCopy(data, ibOff, m.BaseIndices, 0, Math.Min(ibSize, data.Length - ibOff));
        m.Ib = gpu.CreateBuffer(System.Runtime.InteropServices.MemoryMarshal.AsBytes(m.BaseIndices.AsSpan()),
            D3D11_BIND_FLAG.D3D11_BIND_INDEX_BUFFER, dynamic: true);

        for (var mi = lod.MeshIndex; mi < lod.MeshIndex + lod.MeshCount; mi++)
        {
            var s    = mdl.Meshes[mi];
            var mesh = new Mesh
            {
                Index = mi - lod.MeshIndex, Material = s.MaterialIndex, VertexCount = s.VertexCount,
                StartIndex = (int)s.StartIndex, IndexCount = (int)s.IndexCount, Decl = mdl.VertexDeclarations[mi],
            };
            for (var st = 0; st < 3; st++)
            {
                mesh.StreamOffset[st] = s.VertexBufferOffset(st);
                mesh.StreamStride[st] = s.VertexBufferStride(st);
            }

            if (s.BoneTableIndex != 255 && s.BoneTableIndex < mdl.BoneTables.Length)
            {
                var bt = mdl.BoneTables[s.BoneTableIndex];
                mesh.BoneTable = bt.BoneIndex.Take((int)bt.BoneCount).ToArray();
            }

            mesh.Skinned = mesh.Decl.VertexElements.Any(e => e.Usage == 1) && mesh.BoneTable.Length > 0;
            for (var si = s.SubMeshIndex; si < s.SubMeshIndex + s.SubMeshCount; si++)
            {
                var sm = mdl.SubMeshes[si];
                mesh.Subs.Add(new Sub
                {
                    Start = (int)sm.IndexOffset, Count = (int)sm.IndexCount, AttributeMask = sm.AttributeIndexMask,
                    Attributes = Enumerable.Range(0, 32).Where(b => (sm.AttributeIndexMask & (1u << b)) != 0 && b < mdl.Attributes.Length)
                        .Select(b => mdl.Attributes[b]).ToArray(),
                });
            }

            if (mesh.Subs.Count == 0)
                mesh.Subs.Add(new Sub { Start = mesh.StartIndex, Count = mesh.IndexCount });
            m.Meshes.Add(mesh);
        }

        if (_zeros == null)
            _zeros = gpu.CreateBuffer(new byte[64], D3D11_BIND_FLAG.D3D11_BIND_VERTEX_BUFFER);
        return m;
    }

    /// <summary>Shape keys work like the game's: the index buffer entries a shape lists point at the shape's replacement vertices.</summary>
    public void ApplyShapes(Gpu gpu, IEnumerable<string> enabled)
    {
        var set = new HashSet<string>(enabled);
        var key = string.Join("|", set.OrderBy(x => x));
        if (key == _shapeKey)
            return;
        _shapeKey     = key;
        EnabledShapes = set;
        var idx = (ushort[])BaseIndices.Clone();
        foreach (var shape in File.Shapes)
        {
            if (!set.Contains(shape.ShapeName))
                continue;
            var start = shape.ShapeMeshStartIndex[0];
            for (var k = 0; k < shape.ShapeMeshCount[0]; k++)
            {
                var sm = File.ShapeMeshes[start + k];
                for (var v = 0; v < sm.ShapeValueCount; v++)
                {
                    var sv = File.ShapeValues[sm.ShapeValueOffset + v];
                    var at = (int)sm.MeshIndexOffset + sv.BaseIndicesIndex;
                    if (at < idx.Length)
                        idx[at] = sv.ReplacingVertexIndex;
                }
            }
        }

        gpu.Update(Ib, System.Runtime.InteropServices.MemoryMarshal.AsBytes(idx.AsSpan()));
    }

    // FFXIV vertex usage -> HLSL semantic
    private static string Semantic(byte usage) => usage switch
    {
        0 => "POSITION",
        1 => "BLENDWEIGHT",
        2 => "BLENDINDICES",
        3 => "NORMAL",
        4 => "TEXCOORD",
        5 => "TANGENT",
        6 => "BINORMAL",
        7 => "COLOR",
        _ => "UNKNOWN" + usage,
    };

    private static DXGI_FORMAT Format(byte type, byte usage)
    {
        var integer = usage is 1 or 2;   // the Dawntrail vertex shaders read weights and indices as integers
        return type switch
        {
            0  => DXGI_FORMAT.DXGI_FORMAT_R32_FLOAT,
            1  => DXGI_FORMAT.DXGI_FORMAT_R32G32_FLOAT,
            2  => DXGI_FORMAT.DXGI_FORMAT_R32G32B32_FLOAT,
            3  => DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_FLOAT,
            5  => DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UINT,
            6  => DXGI_FORMAT.DXGI_FORMAT_R16G16_SINT,
            7  => DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_SINT,
            8  => integer ? DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UINT : DXGI_FORMAT.DXGI_FORMAT_R8G8B8A8_UNORM,
            9  => DXGI_FORMAT.DXGI_FORMAT_R16G16_SNORM,
            10 => DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_SNORM,
            13 => DXGI_FORMAT.DXGI_FORMAT_R16G16_FLOAT,
            14 => DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_FLOAT,
            16 => DXGI_FORMAT.DXGI_FORMAT_R16G16_UINT,
            17 => DXGI_FORMAT.DXGI_FORMAT_R16G16B16A16_UINT,
            _  => DXGI_FORMAT.DXGI_FORMAT_UNKNOWN,
        };
    }

    public readonly List<string> Notes = new();

    /// <summary>Input layout for this mesh against a vertex shader's input signature; inputs the mesh lacks read zeros.</summary>
    public ID3D11InputLayout* Layout(Gpu gpu, Mesh mesh, GpuShader vs)
    {
        if (mesh.Layouts.TryGetValue(vs.Label, out var l))
            return (ID3D11InputLayout*)l;
        var names = new List<nint>();
        var elems = new List<D3D11_INPUT_ELEMENT_DESC>();
        try
        {
            foreach (var input in vs.Info.Inputs)
            {
                if (input.SystemValue != D3D_NAME.D3D_NAME_UNDEFINED)
                    continue;
                var name = System.Runtime.InteropServices.Marshal.StringToHGlobalAnsi(input.Semantic);
                names.Add(name);
                var found = false;
                foreach (var e in mesh.Decl.VertexElements)
                {
                    if (e.Stream == 255 || Semantic(e.Usage) != input.Semantic || e.UsageIndex != input.Index)
                        continue;
                    elems.Add(new D3D11_INPUT_ELEMENT_DESC
                    {
                        SemanticName = (sbyte*)name, SemanticIndex = (uint)input.Index, Format = Format(e.Type, e.Usage),
                        InputSlot = e.Stream, AlignedByteOffset = e.Offset, InputSlotClass = D3D11_INPUT_CLASSIFICATION.D3D11_INPUT_PER_VERTEX_DATA,
                    });
                    found = true;
                    break;
                }

                if (found)
                    continue;

                Notes.Add($"mesh {mesh.Index}: no {input.Semantic}{input.Index} in the vertex data; {vs.Label} reads zeros");
                elems.Add(new D3D11_INPUT_ELEMENT_DESC
                {
                    SemanticName = (sbyte*)name, SemanticIndex = (uint)input.Index,
                    Format = input.Type switch
                    {
                        D3D_REGISTER_COMPONENT_TYPE.D3D_REGISTER_COMPONENT_SINT32 => DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_SINT,
                        D3D_REGISTER_COMPONENT_TYPE.D3D_REGISTER_COMPONENT_UINT32 => DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_UINT,
                        _ => DXGI_FORMAT.DXGI_FORMAT_R32G32B32A32_FLOAT,
                    },
                    InputSlot = 3, AlignedByteOffset = 0, InputSlotClass = D3D11_INPUT_CLASSIFICATION.D3D11_INPUT_PER_INSTANCE_DATA,
                    InstanceDataStepRate = 1,
                });
            }

            var arr = elems.ToArray();
            ID3D11InputLayout* layout;
            fixed (D3D11_INPUT_ELEMENT_DESC* pe = arr)
            fixed (byte* pb = vs.Blob)
                Gpu.Check(gpu.Device->CreateInputLayout(pe, (uint)arr.Length, pb, (nuint)vs.Blob.Length, &layout), $"CreateInputLayout {Path} mesh {mesh.Index}");
            mesh.Layouts[vs.Label] = (nint)layout;
            return layout;
        }
        finally
        {
            foreach (var n in names)
                System.Runtime.InteropServices.Marshal.FreeHGlobal(n);
        }
    }

    public void BindStreams(Gpu gpu, Mesh mesh)
    {
        var bufs    = stackalloc ID3D11Buffer*[4] { Vb, Vb, Vb, _zeros };
        var strides = stackalloc uint[4] { mesh.StreamStride[0], mesh.StreamStride[1], mesh.StreamStride[2], 0 };
        var offsets = stackalloc uint[4] { mesh.StreamOffset[0], mesh.StreamOffset[1], mesh.StreamOffset[2], 0 };
        gpu.Ctx->IASetVertexBuffers(0, 4, bufs, strides, offsets);
        gpu.Ctx->IASetIndexBuffer(Ib, DXGI_FORMAT.DXGI_FORMAT_R16_UINT, 0);
    }

    public void Release()
    {
        foreach (var mesh in Meshes)
            foreach (var l in mesh.Layouts.Values)
                ((ID3D11InputLayout*)l)->Release();
        if (Vb != null) Vb->Release();
        if (Ib != null) Ib->Release();
    }
}
