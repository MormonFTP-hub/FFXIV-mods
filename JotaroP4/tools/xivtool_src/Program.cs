using Lumina;
using Lumina.Excel.Sheets;
using Penumbra.GameData.Files;
using Penumbra.Import.Models;
using Penumbra.Import.Models.Import;
using SharpGLTF.Schema2;

// Small command-line helper around Lumina (game file access) and Penumbra's own
// file/model code, so models can be built outside the game.
const string SqPack = @"C:\Program Files (x86)\SquareEnix\FINAL FANTASY XIV - A Realm Reborn\game\sqpack";

GameData OpenGame() => new(SqPack, new LuminaOptions { PanicOnSheetChecksumMismatch = false });

static string C(Penumbra.GameData.Structs.HalfColor c) => $"({(float)c.Red:0.###},{(float)c.Green:0.###},{(float)c.Blue:0.###})";

switch (args.ElementAtOrDefault(0))
{
    case "extract":
    {
        // extract <outDir> <gamePath>...
        var data   = OpenGame();
        var outDir = args[1];
        foreach (var p in args.Skip(2))
        {
            var f = data.GetFile(p);
            if (f == null)
            {
                Console.WriteLine($"MISSING {p}");
                continue;
            }

            var dst = Path.Combine(outDir, p.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(dst)!);
            File.WriteAllBytes(dst, f.Data);
            Console.WriteLine($"OK {p} ({f.Data.Length} bytes)");
        }

        break;
    }
    case "exists":
    {
        // exists <gamePath>...
        var data = OpenGame();
        foreach (var p in args.Skip(1))
            Console.WriteLine($"{(data.FileExists(p) ? "YES" : "no ")} {p}");
        break;
    }
    case "mdlinfo":
    {
        var mdl = new MdlFile(File.ReadAllBytes(args[1]));
        Console.WriteLine($"version={mdl.Version} lods={mdl.LodCount} radius={mdl.Radius} flags1={mdl.Flags1} flags2={mdl.Flags2}");
        Console.WriteLine("materials: " + string.Join(", ", mdl.Materials));
        Console.WriteLine("attributes: " + string.Join(", ", mdl.Attributes));
        Console.WriteLine("bones: " + string.Join(", ", mdl.Bones));
        Console.WriteLine("shapes: " + string.Join(", ", mdl.Shapes.Select(s => s.ShapeName)));
        Console.WriteLine($"bbox min={string.Join(",", mdl.BoundingBoxes.Min)} max={string.Join(",", mdl.BoundingBoxes.Max)}");
        for (var i = 0; i < mdl.Meshes.Length; i++)
        {
            var m = mdl.Meshes[i];
            Console.WriteLine($"mesh {i}: verts={m.VertexCount} indices={m.IndexCount} mat={m.MaterialIndex} submesh={m.SubMeshIndex}+{m.SubMeshCount} bonetable={m.BoneTableIndex}");
            foreach (var e in mdl.VertexDeclarations[i].VertexElements)
                Console.WriteLine($"    elem stream={e.Stream} off={e.Offset} type={e.Type} usage={e.Usage}");
            for (var s = m.SubMeshIndex; s < m.SubMeshIndex + m.SubMeshCount; s++)
            {
                var sm    = mdl.SubMeshes[s];
                var attrs = Enumerable.Range(0, 32).Where(b => (sm.AttributeIndexMask & (1u << b)) != 0).Select(b => mdl.Attributes[b]);
                Console.WriteLine($"    submesh {s}: idx={sm.IndexOffset}+{sm.IndexCount} attrs=[{string.Join(",", attrs)}]");
            }
        }

        for (var l = 0; l < mdl.LodCount; l++)
            Console.WriteLine($"lod {l}: meshes {mdl.Lods[l].MeshIndex}+{mdl.Lods[l].MeshCount}");
        break;
    }
    case "mtrlinfo":
    {
        var mtrl = new MtrlFile(File.ReadAllBytes(args[1]));
        Console.WriteLine($"shader={mtrl.ShaderPackage.Name} flags=0x{mtrl.ShaderPackage.Flags:X} dawntrail={mtrl.IsDawntrail} table={mtrl.Table?.GetType().Name} dye={mtrl.DyeTable?.GetType().Name}");
        foreach (var t in mtrl.Textures)
            Console.WriteLine($"  tex {t.Path} flags=0x{t.Flags:X}");
        foreach (var s in mtrl.ShaderPackage.Samplers)
            Console.WriteLine($"  sampler id=0x{s.SamplerId:X8} tex={s.TextureIndex} flags=0x{s.Flags:X}");
        foreach (var k in mtrl.ShaderPackage.ShaderKeys)
            Console.WriteLine($"  key 0x{k.Key:X8} = 0x{k.Value:X8}");
        foreach (var c in mtrl.ShaderPackage.Constants)
        {
            var vals = mtrl.GetConstantValue<float>(c).ToArray();
            Console.WriteLine($"  const 0x{c.Id:X8} = [{string.Join(", ", vals)}]");
        }

        Console.WriteLine("  uvsets: " + string.Join(", ", mtrl.UvSets.Select(u => u.Name)) + " colorsets: " + string.Join(", ", mtrl.ColorSets.Select(u => u.Name)));
        if (mtrl.Table is Penumbra.GameData.Files.MaterialStructs.ColorTable table)
            for (var r = 0; r < Penumbra.GameData.Files.MaterialStructs.ColorTable.NumRows; r++)
            {
                var row = table[r];
                Console.WriteLine($"  row {r,2}: diffuse={C(row.DiffuseColor)} spec={C(row.SpecularColor)} emis={C(row.EmissiveColor)} rough={row.Roughness} metal={row.Metalness} shader={row.ShaderId} tile={row.TileIndex}");
            }
        if (mtrl.DyeTable is Penumbra.GameData.Files.MaterialStructs.ColorDyeTable dyes)
            for (var r = 0; r < Penumbra.GameData.Files.MaterialStructs.ColorDyeTable.NumRows; r++)
            {
                var d = dyes[r];
                Console.WriteLine($"  dye {r,2}: template={d.Template} channel={d.Channel} diffuse={d.DiffuseColor} spec={d.SpecularColor} emis={d.EmissiveColor}");
            }

        break;
    }
    case "mkmtrl":
    {
        // mkmtrl <template.mtrl> <out.mtrl> <texture game path>...
        // Copies a vanilla material, points it at new textures and makes every colour
        // table row plain white so the diffuse texture shows through unchanged.
        var mtrl = new MtrlFile(File.ReadAllBytes(args[1]));
        var texPaths = args.Skip(3).ToArray();
        if (texPaths.Length != mtrl.Textures.Length)
            throw new Exception($"template has {mtrl.Textures.Length} textures, got {texPaths.Length}");
        for (var i = 0; i < texPaths.Length; i++)
            mtrl.Textures[i].Path = texPaths[i];
        if (mtrl.Table is Penumbra.GameData.Files.MaterialStructs.ColorTable table)
            for (var r = 0; r < Penumbra.GameData.Files.MaterialStructs.ColorTable.NumRows; r++)
            {
                ref var row = ref table[r];
                row = Penumbra.GameData.Files.MaterialStructs.ColorTableRow.LegacyDefault;
                row.DiffuseColor  = new Penumbra.GameData.Structs.HalfColor((Half)1, (Half)1, (Half)1);
                row.SpecularColor = new Penumbra.GameData.Structs.HalfColor((Half)0.15, (Half)0.15, (Half)0.15);
                row.EmissiveColor = new Penumbra.GameData.Structs.HalfColor((Half)0, (Half)0, (Half)0);
            }

        mtrl.DyeTable = null!;
        File.WriteAllBytes(args[2], mtrl.Write());
        Console.WriteLine($"wrote {args[2]}");
        break;
    }
    case "items":
    {
        // items <name substring>  -> item rows with their equipment model ids
        var data  = OpenGame();
        var sheet = data.GetExcelSheet<Item>()!;
        var q     = args[1].ToLowerInvariant();
        foreach (var it in sheet.Where(i => i.Name.ToString().ToLowerInvariant().Contains(q)))
        {
            var model = it.ModelMain;
            Console.WriteLine($"{it.RowId,6} {it.Name,-40} slot={it.EquipSlotCategory.RowId} set=e{model & 0xFFFF:D4} variant={(model >> 16) & 0xFFFF} level={it.LevelEquip}");
        }

        break;
    }
    case "mdldump":
    {
        // mdldump <file.mdl> <out.json>  -- LOD0 positions, skin weights and triangles per mesh
        var bytes = File.ReadAllBytes(args[1]);
        var mdl   = new MdlFile(bytes);
        var data  = mdl.RemainingData;
        var meshes = new List<object>();
        for (var mi = mdl.Lods[0].MeshIndex; mi < mdl.Lods[0].MeshIndex + mdl.Lods[0].MeshCount; mi++)
        {
            var mesh = mdl.Meshes[mi];
            var decl = mdl.VertexDeclarations[mi];
            var pos  = new List<float[]>();
            var bones = new List<string[]>();
            var weights = new List<float[]>();
            var colors = new List<byte[]>();
            var table = mesh.BoneTableIndex != 255 ? mdl.BoneTables[mesh.BoneTableIndex].BoneIndex : null;
            for (var v = 0; v < mesh.VertexCount; v++)
            {
                float[] p = [0, 0, 0];
                byte[] bi = [0, 0, 0, 0];
                float[] bw = [0, 0, 0, 0];
                byte[] col = [0, 0, 0, 0];
                foreach (var e in decl.VertexElements)
                {
                    var off = (int)(mdl.VertexOffset[0] - mdl.VertexOffset[0]) + (int)(e.Stream switch { 0 => mesh.VertexBufferOffset1, 1 => mesh.VertexBufferOffset2, _ => mesh.VertexBufferOffset3 })
                      + v * (e.Stream switch { 0 => mesh.VertexBufferStride1, 1 => mesh.VertexBufferStride2, _ => mesh.VertexBufferStride3 }) + e.Offset;
                    switch ((e.Usage, e.Type))
                    {
                        case (0, 2): p = [BitConverter.ToSingle(data, off), BitConverter.ToSingle(data, off + 4), BitConverter.ToSingle(data, off + 8)]; break;
                        case (0, 14): p = [(float)BitConverter.ToHalf(data, off), (float)BitConverter.ToHalf(data, off + 2), (float)BitConverter.ToHalf(data, off + 4)]; break;
                        case (1, 8): bw = [data[off] / 255f, data[off + 1] / 255f, data[off + 2] / 255f, data[off + 3] / 255f]; break;
                        case (2, 5): bi = [data[off], data[off + 1], data[off + 2], data[off + 3]]; break;
                        case (7, 8): col = [data[off], data[off + 1], data[off + 2], data[off + 3]]; break;
                    }
                }

                pos.Add(p);
                colors.Add(col);
                weights.Add(bw);
                bones.Add(bi.Select(b => table != null ? mdl.Bones[table[b]] : "").ToArray());
            }

            var idx = new List<int>();
            for (var i = 0; i < mesh.IndexCount; i++)
                idx.Add(BitConverter.ToUInt16(data, (int)(mdl.IndexOffset[0] - mdl.VertexOffset[0]) + (int)(mesh.StartIndex + i) * 2));
            var baseVert = 0;
            meshes.Add(new { material = mdl.Materials[mesh.MaterialIndex], positions = pos, colors = colors.Select(c => c.Select(x => (int)x).ToArray()), bones, weights, indices = idx.Select(i => i - baseVert) });
        }

        File.WriteAllText(args[2], System.Text.Json.JsonSerializer.Serialize(new { meshes }));
        Console.WriteLine($"dumped {meshes.Count} meshes; vertexOffset={mdl.VertexOffset[0]} indexOffset={mdl.IndexOffset[0]} remaining={data.Length}");
        break;
    }
    case "texinfo":
    {
        // texinfo <file.tex>  -- parse with Lumina and decode the top mip, as the game would
        var data = OpenGame();
        var tex  = data.GetFileFromDisk<Lumina.Data.Files.TexFile>(args[1]);
        var img  = tex.ImageData;
        Console.WriteLine($"format={tex.Header.Format} {tex.Header.Width}x{tex.Header.Height} mips={tex.Header.MipCount} decoded={img.Length} bytes, first pixel BGRA={img[0]},{img[1]},{img[2]},{img[3]}");
        break;
    }
    case "allitems":
    {
        // allitems <out.json>  -> every equippable item: id, name, slot category, model set/variant, dye count
        var data  = OpenGame();
        var sheet = data.GetExcelSheet<Item>()!;
        var rows = sheet.Where(i => i.EquipSlotCategory.RowId != 0 && !i.Name.IsEmpty)
            .Select(i => new { id = i.RowId, name = i.Name.ToString(), slot = i.EquipSlotCategory.RowId, model = i.ModelMain, sub = i.ModelSub,
                               dyes = i.DyeCount, level = i.LevelEquip, job = i.ClassJobCategory.RowId })
            .ToList();
        File.WriteAllText(args[1], System.Text.Json.JsonSerializer.Serialize(rows));
        Console.WriteLine($"wrote {rows.Count} items");
        break;
    }
    case "mdlexport":
    {
        // mdlexport <file.mdl> <out.json>  -- LOD0 per mesh: positions, normals, uvs, colours, bone names/weights,
        // triangles, material name and the attributes of each triangle's submesh
        var mdl  = new MdlFile(File.ReadAllBytes(args[1]));
        var data = mdl.RemainingData;
        var meshes = new List<object>();
        for (var mi = mdl.Lods[0].MeshIndex; mi < mdl.Lods[0].MeshIndex + mdl.Lods[0].MeshCount; mi++)
        {
            var mesh  = mdl.Meshes[mi];
            var decl  = mdl.VertexDeclarations[mi];
            var table = mesh.BoneTableIndex != 255 ? mdl.BoneTables[mesh.BoneTableIndex].BoneIndex : null;
            var pos = new List<float[]>(); var nrm = new List<float[]>(); var uv = new List<float[]>();
            var col = new List<int[]>(); var bones = new List<string[]>(); var weights = new List<float[]>();
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
            for (var v = 0; v < mesh.VertexCount; v++)
            {
                float[] p = [0, 0, 0], n = [0, 0, 0], t = [0, 0], w = [0, 0, 0, 0], bi = [0, 0, 0, 0], c = [255, 255, 255, 255];
                foreach (var e in decl.VertexElements)
                {
                    var off = (int)(e.Stream switch { 0 => mesh.VertexBufferOffset1, 1 => mesh.VertexBufferOffset2, _ => mesh.VertexBufferOffset3 })
                      + v * (e.Stream switch { 0 => mesh.VertexBufferStride1, 1 => mesh.VertexBufferStride2, _ => mesh.VertexBufferStride3 }) + e.Offset;
                    var val = Read(off, e.Type);
                    switch (e.Usage)
                    {
                        case 0: p = val[..3]; break;
                        case 1: w = val; break;
                        case 2: bi = val; break;
                        case 3: n = val[..3]; break;
                        case 4: t = val[..2]; break;
                        case 7: c = val.Select(x => x * 255).ToArray(); break;
                    }
                }

                pos.Add(p); nrm.Add(n); uv.Add(t); weights.Add(w);
                col.Add(c.Select(x => (int)MathF.Round(x)).ToArray());
                bones.Add(bi.Select(b => table != null ? mdl.Bones[table[(int)b]] : "").ToArray());
            }

            var idx = new List<int>();
            for (var i = 0; i < mesh.IndexCount; i++)
                idx.Add(BitConverter.ToUInt16(data, (int)(mdl.IndexOffset[0] - mdl.VertexOffset[0]) + (int)(mesh.StartIndex + i) * 2));
            var subs = new List<object>();
            for (var s = mesh.SubMeshIndex; s < mesh.SubMeshIndex + mesh.SubMeshCount; s++)
            {
                var sm = mdl.SubMeshes[s];
                subs.Add(new { start = sm.IndexOffset - mesh.StartIndex, count = sm.IndexCount,
                               attrs = Enumerable.Range(0, 32).Where(b => (sm.AttributeIndexMask & (1u << b)) != 0).Select(b => mdl.Attributes[b]).ToArray() });
            }

            meshes.Add(new { material = mdl.Materials[mesh.MaterialIndex], positions = pos, normals = nrm, uvs = uv, colors = col, bones, weights, indices = idx, submeshes = subs });
        }

        File.WriteAllText(args[2], System.Text.Json.JsonSerializer.Serialize(new { meshes, materials = mdl.Materials, attributes = mdl.Attributes, shapes = mdl.Shapes.Select(s => s.ShapeName) }));
        Console.WriteLine($"exported {meshes.Count} meshes");
        break;
    }
    case "tex2png":
    {
        // tex2png <in.tex | game path> <out.png>  -- top mip, decoded by Lumina
        var data = OpenGame();
        var tex  = File.Exists(args[1]) ? data.GetFileFromDisk<Lumina.Data.Files.TexFile>(args[1]) : data.GetFile<Lumina.Data.Files.TexFile>(args[1])!;
        var img  = tex.ImageData;   // BGRA
        var w = tex.Header.Width; var h = tex.Header.Height;
        var rgba = new byte[img.Length];
        for (var i = 0; i < w * h; i++)
        {
            rgba[i * 4] = img[i * 4 + 2]; rgba[i * 4 + 1] = img[i * 4 + 1]; rgba[i * 4 + 2] = img[i * 4]; rgba[i * 4 + 3] = img[i * 4 + 3];
        }

        File.WriteAllBytes(args[2] + ".raw", rgba);
        File.WriteAllText(args[2] + ".size", $"{w} {h}");
        Console.WriteLine($"{w}x{h} {tex.Header.Format}");
        break;
    }
    case "mtrljson":
    {
        // mtrljson <file.mtrl> <out.json>  -- shader, texture paths, colour table rows and dye rows
        var mtrl = new MtrlFile(File.ReadAllBytes(args[1]));
        var rows = new List<object>();
        var dyes = new List<object>();
        if (mtrl.Table is Penumbra.GameData.Files.MaterialStructs.ColorTable table)
            for (var r = 0; r < Penumbra.GameData.Files.MaterialStructs.ColorTable.NumRows; r++)
            {
                var row = table[r];
                rows.Add(new { diffuse = new[] { (float)row.DiffuseColor.Red, (float)row.DiffuseColor.Green, (float)row.DiffuseColor.Blue },
                               specular = new[] { (float)row.SpecularColor.Red, (float)row.SpecularColor.Green, (float)row.SpecularColor.Blue },
                               emissive = new[] { (float)row.EmissiveColor.Red, (float)row.EmissiveColor.Green, (float)row.EmissiveColor.Blue },
                               roughness = (float)row.Roughness, metalness = (float)row.Metalness });
            }
        if (mtrl.DyeTable is Penumbra.GameData.Files.MaterialStructs.ColorDyeTable dt)
            for (var r = 0; r < Penumbra.GameData.Files.MaterialStructs.ColorDyeTable.NumRows; r++)
                dyes.Add(new { template = (int)dt[r].Template, channel = (int)dt[r].Channel, diffuse = dt[r].DiffuseColor });
        File.WriteAllText(args[2], System.Text.Json.JsonSerializer.Serialize(new
        {
            shader = mtrl.ShaderPackage.Name, dawntrail = mtrl.IsDawntrail,
            textures = mtrl.Textures.Select(t => t.Path).ToArray(),
            samplers = mtrl.ShaderPackage.Samplers.Select(x => new { id = x.SamplerId, tex = (int)x.TextureIndex }).ToArray(),
            rows, dyes,
        }));
        Console.WriteLine("ok");
        break;
    }
    case "mtrlrecolor":
    {
        // mtrlrecolor <in.mtrl> <out.mtrl> <spec.json>
        // spec: {"rows": {"12": {"diffuse": [r,g,b], "specular": [r,g,b], "emissive": [r,g,b], "roughness": x, "metalness": x}},
        //        "textures": {"0": "new/game/path.tex"}, "keepDyes": false}
        // Copies a vanilla material, edits colour table rows (linear colours) and drops the dye table so
        // the colours stay as authored.
        var mtrl = new MtrlFile(File.ReadAllBytes(args[1]));
        var spec = System.Text.Json.JsonDocument.Parse(File.ReadAllText(args[3])).RootElement;
        Half H(System.Text.Json.JsonElement e) => (Half)e.GetSingle();
        if (spec.TryGetProperty("rows", out var rowsEl) && mtrl.Table is Penumbra.GameData.Files.MaterialStructs.ColorTable table)
            foreach (var r in rowsEl.EnumerateObject())
            {
                ref var row = ref table[int.Parse(r.Name)];
                if (r.Value.TryGetProperty("diffuse", out var d))
                    row.DiffuseColor = new Penumbra.GameData.Structs.HalfColor(H(d[0]), H(d[1]), H(d[2]));
                if (r.Value.TryGetProperty("specular", out var sp))
                    row.SpecularColor = new Penumbra.GameData.Structs.HalfColor(H(sp[0]), H(sp[1]), H(sp[2]));
                if (r.Value.TryGetProperty("emissive", out var em))
                    row.EmissiveColor = new Penumbra.GameData.Structs.HalfColor(H(em[0]), H(em[1]), H(em[2]));
                if (r.Value.TryGetProperty("roughness", out var ro))
                    row.Roughness = H(ro);
                if (r.Value.TryGetProperty("metalness", out var me))
                    row.Metalness = H(me);
            }
        if (spec.TryGetProperty("textures", out var texEl))
            foreach (var t in texEl.EnumerateObject())
                mtrl.Textures[int.Parse(t.Name)].Path = t.Value.GetString()!;
        if (!(spec.TryGetProperty("keepDyes", out var kd) && kd.GetBoolean()))
            mtrl.DyeTable = null!;
        File.WriteAllBytes(args[2], mtrl.Write());
        Console.WriteLine($"wrote {args[2]}");
        break;
    }
    case "mdlcopy":
    {
        // mdlcopy <in.mdl> <out.mdl> <spec.json>
        // spec: {"materials": {"/old.mtrl": "/new.mtrl"}, "attributes": {"atr_tv_a": "atr_xx_a" | ""}}
        // Byte-for-byte copy of a vanilla model with its material names (and optionally attribute names)
        // replaced; an attribute mapped to "" is removed from every submesh so it always shows.
        var mdl  = new MdlFile(File.ReadAllBytes(args[1]));
        var spec = System.Text.Json.JsonDocument.Parse(File.ReadAllText(args[3])).RootElement;
        if (spec.TryGetProperty("materials", out var mats))
            for (var i = 0; i < mdl.Materials.Length; i++)
                if (mats.TryGetProperty(mdl.Materials[i], out var nm))
                    mdl.Materials[i] = nm.GetString()!;
        if (spec.TryGetProperty("attributes", out var atrs))
        {
            var remove = new List<int>();
            for (var i = 0; i < mdl.Attributes.Length; i++)
                if (atrs.TryGetProperty(mdl.Attributes[i], out var na))
                {
                    var n = na.GetString()!;
                    if (n.Length == 0) remove.Add(i);
                    else mdl.Attributes[i] = n;
                }
            foreach (var bit in remove)
                for (var s = 0; s < mdl.SubMeshes.Length; s++)
                    mdl.SubMeshes[s].AttributeIndexMask &= ~(1u << bit);
        }
        File.WriteAllBytes(args[2], mdl.Write());
        Console.WriteLine($"wrote {args[2]}: materials={string.Join(",", mdl.Materials)} attributes={string.Join(",", mdl.Attributes)}");
        break;
    }
    case "fullsets":
    {
        // fullsets  -> equipment sets with a head, body, hands, legs and feet item sharing one model set + variant
        var data  = OpenGame();
        var sheet = data.GetExcelSheet<Item>()!;
        var slots = new Dictionary<uint, string> { [3] = "met", [4] = "top", [5] = "glv", [7] = "dwn", [8] = "sho" };
        var bySet = new Dictionary<(ulong Set, ulong Variant), Dictionary<string, string>>();
        foreach (var it in sheet)
        {
            if (!slots.TryGetValue(it.EquipSlotCategory.RowId, out var slot) || it.Name.IsEmpty)
                continue;
            var key = (it.ModelMain & 0xFFFF, (it.ModelMain >> 16) & 0xFFFF);
            if (!bySet.TryGetValue(key, out var d))
                bySet[key] = d = new Dictionary<string, string>();
            d.TryAdd(slot, $"{it.Name} [{it.RowId}, lv{it.LevelEquip}]");
        }

        foreach (var ((set, variant), d) in bySet.Where(p => p.Value.Count == 5).OrderBy(p => p.Key))
            Console.WriteLine($"e{set:D4} v{variant} | {d["met"]} | {d["top"]} | {d["glv"]} | {d["dwn"]} | {d["sho"]}");
        break;
    }
    case "import":
    {
        // import <in.glb> <out.mdl>  -- Penumbra's glTF importer, same as Advanced Editing > Models
        var root     = ModelRoot.Load(args[1]);
        var notifier = new IoNotifier(new Luna.FileLogger(Path.Combine(Path.GetTempPath(), "xivtool-import.log"), Luna.LogLevel.Debug));
        var mdl      = ModelImporter.Import(root, notifier);
        foreach (var w in notifier.GetWarnings())
            Console.WriteLine("WARN " + w);
        File.WriteAllBytes(args[2], mdl.Write());
        Console.WriteLine($"wrote {args[2]}: meshes={mdl.Meshes.Length} bones={mdl.Bones.Length} materials={string.Join(",", mdl.Materials)}");
        break;
    }
    default:
        Console.WriteLine("usage: xivtool extract|exists|mdlinfo|mtrlinfo|items|import ...");
        break;
}
