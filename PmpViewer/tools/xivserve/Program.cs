using System.Text.Json;
using System.Text.Json.Nodes;
using Lumina;
using Lumina.Excel.Sheets;
using Penumbra.GameData.Files;
using Penumbra.GameData.Files.MaterialStructs;

// Long-running helper for the PMP viewer: reads one JSON request per stdin line, answers one JSON line on stdout.
// Game files come from Lumina (opened once), models/materials are parsed with Penumbra's own readers.
//   {"op":"extract","dir":D,"paths":[...]}  -> {"files":{path: local path | null}}
//   {"op":"exists","paths":[...]}           -> {"exists":{path: bool}} (no file data read)
//   {"op":"mdl","file":F,"out":B}            -> header JSON; LOD0 vertex/index arrays written to B (little endian)
//   {"op":"mtrl","file":F}                   -> shader, keys, constants, samplers, textures, colour table
//   {"op":"tex","file":F|"path":P,"out":B}   -> top mip as RGBA bytes in B, {"w","h","format"}
//   {"op":"items","out":J}                   -> every equippable item to J
//   {"op":"manips","json":[...]}             -> how many manipulations Penumbra's own reader accepts
// argument: the game's sqpack folder (the viewer finds it from XIVLauncher's settings)
var sqPack = args.Length > 0 ? args[0] : @"C:\Program Files (x86)\SquareEnix\FINAL FANTASY XIV - A Realm Reborn\game\sqpack";
var game = new GameData(sqPack, new LuminaOptions { PanicOnSheetChecksumMismatch = false });
var stdout = new StreamWriter(Console.OpenStandardOutput()) { AutoFlush = true };
Console.Error.WriteLine("xivserve ready");
stdout.WriteLine("{\"ready\":true}");

string? line;
while ((line = Console.ReadLine()) != null)
{
    if (line.Length == 0)
        continue;
    JsonNode result;
    try
    {
        var req = JsonNode.Parse(line)!.AsObject();
        result = req["op"]!.GetValue<string>() switch
        {
            "extract" => Extract(req),
            "exists"  => Exists(req),
            "mdl"     => Mdl(req),
            "mtrl"    => Mtrl(req),
            "tex"     => Tex(req),
            "items"   => Items(req),
            "manips"  => Manips(req),
            var op    => throw new Exception($"unknown op {op}"),
        };
    }
    catch (Exception e)
    {
        result = new JsonObject { ["error"] = e.GetType().Name + ": " + e.Message };
    }

    stdout.WriteLine(result.ToJsonString());
}

return;

JsonNode Extract(JsonObject req)
{
    var dir   = req["dir"]!.GetValue<string>();
    var files = new JsonObject();
    foreach (var n in req["paths"]!.AsArray())
    {
        var p   = n!.GetValue<string>();
        var dst = Path.Combine(dir, p.Replace('/', Path.DirectorySeparatorChar));
        if (!File.Exists(dst))
        {
            var f = game.GetFile(p);
            if (f == null)
            {
                files[p] = null;
                continue;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(dst)!);
            File.WriteAllBytes(dst + ".part", f.Data);
            File.Move(dst + ".part", dst, true);
        }

        files[p] = dst;
    }

    return new JsonObject { ["files"] = files };
}

JsonNode Exists(JsonObject req)
{
    var o = new JsonObject();
    foreach (var n in req["paths"]!.AsArray())
        o[n!.GetValue<string>()] = game.FileExists(n.GetValue<string>());
    return new JsonObject { ["exists"] = o };
}

JsonNode Mdl(JsonObject req)
{
    var mdl  = new MdlFile(File.ReadAllBytes(req["file"]!.GetValue<string>()));
    var data = mdl.RemainingData;
    using var bin = new BinaryWriter(File.Create(req["out"]!.GetValue<string>()));
    var meshes = new JsonArray();

    float[] Read(int off, byte type) => type switch
    {
        1  => [BitConverter.ToSingle(data, off), BitConverter.ToSingle(data, off + 4)],
        2  => [BitConverter.ToSingle(data, off), BitConverter.ToSingle(data, off + 4), BitConverter.ToSingle(data, off + 8)],
        3  => [BitConverter.ToSingle(data, off), BitConverter.ToSingle(data, off + 4), BitConverter.ToSingle(data, off + 8), BitConverter.ToSingle(data, off + 12)],
        5  => [data[off], data[off + 1], data[off + 2], data[off + 3]],
        8  => [data[off] / 255f, data[off + 1] / 255f, data[off + 2] / 255f, data[off + 3] / 255f],
        13 => [(float)BitConverter.ToHalf(data, off), (float)BitConverter.ToHalf(data, off + 2)],
        14 => [(float)BitConverter.ToHalf(data, off), (float)BitConverter.ToHalf(data, off + 2), (float)BitConverter.ToHalf(data, off + 4), (float)BitConverter.ToHalf(data, off + 6)],
        // Dawntrail 8-influence skinning: eight raw bytes (weights 0..255, or bone table indices)
        17 => [data[off], data[off + 1], data[off + 2], data[off + 3], data[off + 4], data[off + 5], data[off + 6], data[off + 7]],
        _  => [],
    };

    long Pos() => bin.BaseStream.Position;

    for (var mi = mdl.Lods[0].MeshIndex; mi < mdl.Lods[0].MeshIndex + mdl.Lods[0].MeshCount; mi++)
    {
        var mesh  = mdl.Meshes[mi];
        var decl  = mdl.VertexDeclarations[mi];
        var table = mesh.BoneTableIndex != 255 && mesh.BoneTableIndex < mdl.BoneTables.Length ? mdl.BoneTables[mesh.BoneTableIndex].BoneIndex : null;
        int n = mesh.VertexCount;
        var pos = new float[n * 3]; var nrm = new float[n * 3]; var uv = new float[n * 4];
        var col = new byte[n * 4]; var bi = new ushort[n * 8]; var bw = new float[n * 8];
        bool hasUv1 = false, hasWeights = false, hasColor = false;
        var colorSum = new Dictionary<int, double[]>();   // usage index -> summed RGBA (0..1), per colour set
        Array.Fill(col, (byte)255);
        var badBone = 0;
        for (var v = 0; v < n; v++)
        {
            float[] w = [], ix = [];
            foreach (var e in decl.VertexElements)
            {
                var off = (int)mesh.VertexBufferOffset(e.Stream) + v * mesh.VertexBufferStride(e.Stream) + e.Offset;
                var val = Read(off, e.Type);
                switch (e.Usage)
                {
                    case 0: pos[v * 3] = val[0]; pos[v * 3 + 1] = val[1]; pos[v * 3 + 2] = val[2]; break;
                    case 1: w = val; hasWeights = true; break;
                    case 2: ix = val; break;
                    case 3: nrm[v * 3] = val[0]; nrm[v * 3 + 1] = val[1]; nrm[v * 3 + 2] = val[2]; break;
                    case 4 when e.UsageIndex == 0:
                        uv[v * 4] = val[0]; uv[v * 4 + 1] = val[1];
                        if (val.Length >= 4) { uv[v * 4 + 2] = val[2]; uv[v * 4 + 3] = val[3]; hasUv1 = true; }
                        break;
                    case 4: uv[v * 4 + 2] = val[0]; uv[v * 4 + 3] = val[1]; hasUv1 = true; break;
                    case 7:
                        if (!colorSum.TryGetValue(e.UsageIndex, out var cs))
                            colorSum[e.UsageIndex] = cs = new double[4];
                        for (var k = 0; k < 4 && k < val.Length; k++)
                            cs[k] += val[k];
                        if (e.UsageIndex != 0)
                            break;
                        hasColor = true;
                        for (var k = 0; k < 4; k++)
                            col[v * 4 + k] = (byte)Math.Clamp(MathF.Round(val[k] * 255), 0, 255);
                        break;
                }
            }

            // weights: UByte4N comes back 0..1, the 8-byte form as raw 0..255
            var sum = w.Sum();
            for (var k = 0; k < Math.Min(8, w.Length); k++)
            {
                var b = k < ix.Length ? (int)ix[k] : 0;
                var bone = table != null && b < table.Length ? table[b] : (ushort)0xFFFF;
                if (w[k] > 0 && (table == null || b >= table.Length || bone >= mdl.Bones.Length))
                    badBone++;
                bi[v * 8 + k] = bone;
                bw[v * 8 + k] = sum > 0 ? w[k] / sum : 0;
            }
        }

        var idxStart = (int)(mdl.IndexOffset[0] - mdl.VertexOffset[0]) + (int)mesh.StartIndex * 2;
        var idx = new uint[mesh.IndexCount];
        for (var i = 0; i < mesh.IndexCount; i++)
            idx[i] = BitConverter.ToUInt16(data, idxStart + i * 2);

        var o = new JsonObject
        {
            ["material"] = mdl.Materials[mesh.MaterialIndex], ["vertexCount"] = n, ["indexCount"] = (int)mesh.IndexCount,
            ["hasUv1"] = hasUv1, ["hasWeights"] = hasWeights, ["hasColor"] = hasColor, ["badBoneRefs"] = badBone,
            ["startIndex"] = (int)mesh.StartIndex,
            ["colorMeans"] = new JsonObject(colorSum.Select(kv => new KeyValuePair<string, JsonNode?>(kv.Key.ToString(),
                new JsonArray(kv.Value.Select(x => (JsonNode)JsonValue.Create(Math.Round(x / Math.Max(1, n), 3))!).ToArray())))),
        };
        o["pos"] = Pos(); foreach (var x in pos) bin.Write(x);
        o["nrm"] = Pos(); foreach (var x in nrm) bin.Write(x);
        o["uv"]  = Pos(); foreach (var x in uv) bin.Write(x);
        o["col"] = Pos(); bin.Write(col);
        o["bi"]  = Pos(); foreach (var x in bi) bin.Write(x);
        o["bw"]  = Pos(); foreach (var x in bw) bin.Write(x);
        o["idx"] = Pos(); foreach (var x in idx) bin.Write(x);
        var subs = new JsonArray();
        for (var s = mesh.SubMeshIndex; s < mesh.SubMeshIndex + mesh.SubMeshCount; s++)
        {
            var sm = mdl.SubMeshes[s];
            subs.Add(new JsonObject
            {
                ["start"] = (int)(sm.IndexOffset - mesh.StartIndex), ["count"] = (int)sm.IndexCount,
                ["attrs"] = new JsonArray(Enumerable.Range(0, 32).Where(b => (sm.AttributeIndexMask & (1u << b)) != 0 && b < mdl.Attributes.Length)
                    .Select(b => (JsonNode)JsonValue.Create(mdl.Attributes[b])!).ToArray()),
            });
        }

        o["submeshes"] = subs;
        meshes.Add(o);
    }

    // shape keys: per LOD0 mesh, (index-buffer slot, replacement vertex) pairs
    var shapes = new JsonArray();
    foreach (var shape in mdl.Shapes)
    {
        var parts = new JsonArray();
        var start = shape.ShapeMeshStartIndex[0];
        for (var k = 0; k < shape.ShapeMeshCount[0]; k++)
        {
            var sm = mdl.ShapeMeshes[start + k];
            var meshIdx = -1;
            for (var mi = mdl.Lods[0].MeshIndex; mi < mdl.Lods[0].MeshIndex + mdl.Lods[0].MeshCount; mi++)
                if (mdl.Meshes[mi].StartIndex == sm.MeshIndexOffset)
                    meshIdx = mi - mdl.Lods[0].MeshIndex;
            var at = Pos();
            for (var v = 0; v < sm.ShapeValueCount; v++)
            {
                var sv = mdl.ShapeValues[sm.ShapeValueOffset + v];
                bin.Write((uint)sv.BaseIndicesIndex);
                bin.Write((uint)sv.ReplacingVertexIndex);
            }

            parts.Add(new JsonObject { ["mesh"] = meshIdx, ["meshIndexOffset"] = (long)sm.MeshIndexOffset, ["count"] = (int)sm.ShapeValueCount, ["at"] = at });
        }

        shapes.Add(new JsonObject { ["name"] = shape.ShapeName, ["parts"] = parts });
    }

    return new JsonObject
    {
        ["version"] = mdl.Version, ["radius"] = mdl.Radius, ["flags1"] = (int)mdl.Flags1, ["flags2"] = (int)mdl.Flags2,
        ["lods"] = (int)mdl.LodCount,
        ["materials"] = new JsonArray(mdl.Materials.Select(x => (JsonNode)JsonValue.Create(x)!).ToArray()),
        ["attributes"] = new JsonArray(mdl.Attributes.Select(x => (JsonNode)JsonValue.Create(x)!).ToArray()),
        ["bones"] = new JsonArray(mdl.Bones.Select(x => (JsonNode)JsonValue.Create(x)!).ToArray()),
        ["bbox"] = new JsonArray(mdl.BoundingBoxes.Min.Concat(mdl.BoundingBoxes.Max).Select(x => (JsonNode)JsonValue.Create(x)!).ToArray()),
        ["meshes"] = meshes, ["shapes"] = shapes,
    };
}

JsonNode Mtrl(JsonObject req)
{
    var mtrl = new MtrlFile(File.ReadAllBytes(req["file"]!.GetValue<string>()));
    var sp   = mtrl.ShaderPackage;
    var o = new JsonObject
    {
        ["shader"] = sp.Name, ["flags"] = sp.Flags, ["dawntrail"] = mtrl.IsDawntrail,
        ["textures"] = new JsonArray(mtrl.Textures.Select(t => (JsonNode)new JsonObject { ["path"] = t.Path, ["flags"] = t.Flags, ["dx11"] = t.DX11 }).ToArray()),
        ["samplers"] = new JsonArray(sp.Samplers.Select(s => (JsonNode)new JsonObject
            { ["id"] = s.SamplerId, ["tex"] = (int)s.TextureIndex, ["flags"] = s.Flags }).ToArray()),
        ["keys"] = new JsonArray(sp.ShaderKeys.Select(k => (JsonNode)new JsonObject { ["cat"] = k.Key, ["val"] = k.Value }).ToArray()),
    };
    var consts = new JsonArray();
    foreach (var c in sp.Constants)
    {
        var vals = new JsonArray();
        for (var b = 0; b + 4 <= c.ByteSize && c.ByteOffset + b + 4 <= sp.ShaderValues.Length; b += 4)
            vals.Add(BitConverter.ToSingle(sp.ShaderValues, c.ByteOffset + b));
        consts.Add(new JsonObject { ["id"] = c.Id, ["values"] = vals });
    }

    o["constants"] = consts;
    static JsonArray C(Penumbra.GameData.Structs.HalfColor c) => [(float)c.Red, (float)c.Green, (float)c.Blue];
    var rows = new JsonArray();
    switch (mtrl.Table)
    {
        case ColorTable t:
            o["table"] = "dawntrail";
            for (var r = 0; r < ColorTable.NumRows; r++)
            {
                var row = t[r];
                rows.Add(new JsonObject
                {
                    ["diffuse"] = C(row.DiffuseColor), ["specular"] = C(row.SpecularColor), ["emissive"] = C(row.EmissiveColor),
                    ["roughness"] = (float)row.Roughness, ["metalness"] = (float)row.Metalness, ["sheen"] = (float)row.SheenRate,
                    ["anisotropy"] = (float)row.Anisotropy, ["shader"] = row.ShaderId, ["tile"] = row.TileIndex, ["tileAlpha"] = (float)row.TileAlpha,
                    ["sphereMask"] = (float)row.SphereMapMask, ["sphere"] = row.SphereMapIndex, ["scalar3"] = (float)row.Scalar3,
                });
            }

            break;
        case LegacyColorTable t:
            o["table"] = "legacy";
            for (var r = 0; r < LegacyColorTable.NumRows; r++)
            {
                var row = t[r];
                rows.Add(new JsonObject
                {
                    ["diffuse"] = C(row.DiffuseColor), ["specular"] = C(row.SpecularColor), ["emissive"] = C(row.EmissiveColor),
                    ["shininess"] = (float)row.Shininess, ["specularMask"] = (float)row.SpecularMask, ["tile"] = row.TileIndex,
                });
            }

            break;
        default:
            o["table"] = null;
            break;
    }

    o["rows"] = rows;
    o["hasDyeTable"] = mtrl.DyeTable != null;
    return o;
}

JsonNode Tex(JsonObject req)
{
    var tex = req["file"] is { } f
        ? game.GetFileFromDisk<Lumina.Data.Files.TexFile>(f.GetValue<string>())
        : game.GetFile<Lumina.Data.Files.TexFile>(req["path"]!.GetValue<string>()) ?? throw new FileNotFoundException(req["path"]!.GetValue<string>());
    var img  = tex.ImageData; // BGRA
    var w    = tex.Header.Width;
    var h    = tex.Header.Height;
    var rgba = new byte[w * h * 4];
    for (var i = 0; i < w * h; i++)
    {
        rgba[i * 4]     = img[i * 4 + 2];
        rgba[i * 4 + 1] = img[i * 4 + 1];
        rgba[i * 4 + 2] = img[i * 4];
        rgba[i * 4 + 3] = img[i * 4 + 3];
    }

    File.WriteAllBytes(req["out"]!.GetValue<string>(), rgba);
    return new JsonObject { ["w"] = (int)w, ["h"] = (int)h, ["format"] = tex.Header.Format.ToString(), ["mips"] = (int)tex.Header.MipCount };
}

JsonNode Items(JsonObject req)
{
    var rows = game.GetExcelSheet<Item>()!.Where(i => i.EquipSlotCategory.RowId != 0 && !i.Name.IsEmpty)
        .Select(i => new { id = i.RowId, name = i.Name.ToString(), slot = i.EquipSlotCategory.RowId, model = i.ModelMain, sub = i.ModelSub, icon = (int)i.Icon })
        .ToList();
    File.WriteAllText(req["out"]!.GetValue<string>(), JsonSerializer.Serialize(rows));
    return new JsonObject { ["count"] = rows.Count };
}

JsonNode Manips(JsonObject req)
{
    var arr  = Newtonsoft.Json.Linq.JArray.Parse(req["json"]!.ToJsonString());
    var dict = arr.ToObject<Penumbra.Meta.Manipulations.MetaDictionary>() ?? new();
    return new JsonObject { ["inJson"] = arr.Count, ["loaded"] = dict.Count };
}
