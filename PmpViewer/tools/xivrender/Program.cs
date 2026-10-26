using Lumina;
using XivRender;

// xivrender: draws FFXIV models with the game's own shaders (see README in PmpViewer).
//   xivrender <sqpack> --scene scene.json [--out frame.png] [--debug]
var sqpack = args.Length > 0 && !args[0].StartsWith("--") ? args[0]
    : @"C:\Program Files (x86)\SquareEnix\FINAL FANTASY XIV - A Realm Reborn\game\sqpack";
string? Arg(string name)
{
    var i = Array.IndexOf(args, name);
    return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
}

var game = new GameData(sqpack, new LuminaOptions { PanicOnSheetChecksumMismatch = false });
using var r = new Renderer(game, args.Contains("--debug")) { Verbose = args.Contains("-v") };
Console.Error.WriteLine($"xivrender on {r.Gpu.AdapterName}");

if (Arg("--dump") is { } dumpPath)
{
    // a .shcd's reflection (constant buffer members, resources) and its disassembly
    var sh = r.Shaders.Code(dumpPath) ?? throw new Exception("missing " + dumpPath);
    Console.WriteLine(sh.Info);
    Console.WriteLine(Disasm.Of(sh.Blob));
    return;
}

if (Arg("--scene") is { } scenePath)
{
    var scene = SceneDesc.Parse(File.ReadAllText(scenePath));
    var res   = r.Render(scene);
    var out_  = Arg("--out") ?? scene.OutFile ?? Path.ChangeExtension(scenePath, ".png");
    File.WriteAllBytes(out_, Png.Encode(res.Rgba, res.Width, res.Height));
    Console.WriteLine($"{out_}: {res.Width}x{res.Height}, {res.Draws} draws, {res.Ms:F0} ms");
    foreach (var l in res.Log)
        Console.WriteLine("  " + l);
    return;
}

if (args.Contains("--serve"))
{
    // the viewer's server starts us; exit with it, even when it is killed rather than closed
    if (int.TryParse(Arg("--parent"), out var parentPid))
    {
        new Thread(() =>
        {
            try { System.Diagnostics.Process.GetProcessById(parentPid).WaitForExit(); }
            catch (ArgumentException) { }
            Environment.Exit(0);
        }) { IsBackground = true }.Start();
    }

    var port = int.TryParse(Arg("--serve"), out var p) ? p : 0;
    new Server(r).Run(port);
}
