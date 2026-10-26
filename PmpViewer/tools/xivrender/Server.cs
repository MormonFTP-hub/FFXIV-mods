using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace XivRender;

/// <summary>
/// Minimal HTTP server for the PMP viewer page (CORS open, localhost only):
///   POST /scene  JSON SceneDesc without bones: models, materials, redirects, customize, env
///   POST /frame  [u32 json length][json: camera, width, height, env, output, models (visible, hiddenAttributes, shapes, boneCount)][f32 bone palettes]
///                -> raw RGBA (format "rgba") or PNG, with X-Width / X-Height / X-Ms headers
///   GET  /log    renderer notes so far
/// </summary>
public sealed class Server
{
    private readonly Renderer _r;
    private SceneDesc _scene = new();
    private readonly object _lock = new();

    public Server(Renderer r) => _r = r;

    public void Run(int port)
    {
        var l = new TcpListener(IPAddress.Loopback, port);
        l.Start();
        Console.WriteLine($"PORT {((IPEndPoint)l.LocalEndpoint).Port}");
        Console.Out.Flush();
        while (true)
        {
            var c = l.AcceptTcpClient();
            _ = Task.Run(() => Handle(c));
        }
    }

    private static string ReadLine(Stream s)
    {
        var sb = new StringBuilder();
        int b;
        while ((b = s.ReadByte()) >= 0)
        {
            if (b == '\n') break;
            if (b != '\r') sb.Append((char)b);
        }

        return sb.ToString();
    }

    private void Handle(TcpClient c)
    {
        using var _ = c;
        c.NoDelay = true;
        var s = c.GetStream();
        try
        {
            while (true)   // keep-alive
            {
                var line = ReadLine(s);
                if (line.Length == 0)
                    return;
                var parts = line.Split(' ');
                var method = parts[0];
                var path   = parts.Length > 1 ? parts[1] : "/";
                var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                string h;
                while ((h = ReadLine(s)).Length > 0)
                {
                    var i = h.IndexOf(':');
                    if (i > 0)
                        headers[h[..i].Trim()] = h[(i + 1)..].Trim();
                }

                var len  = headers.TryGetValue("Content-Length", out var cl) ? int.Parse(cl) : 0;
                var body = new byte[len];
                var got  = 0;
                while (got < len)
                {
                    var n = s.Read(body, got, len - got);
                    if (n <= 0) return;
                    got += n;
                }

                var (status, ctype, payload, extra) = Route(method, path, body);
                var head = new StringBuilder();
                head.Append($"HTTP/1.1 {status} {(status == 200 ? "OK" : "Error")}\r\n");
                head.Append("Access-Control-Allow-Origin: *\r\n");
                head.Append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
                head.Append("Access-Control-Allow-Headers: *\r\n");
                head.Append("Access-Control-Expose-Headers: X-Width, X-Height, X-Ms, X-Notes\r\n");
                head.Append($"Content-Type: {ctype}\r\nContent-Length: {payload.Length}\r\nCache-Control: no-store\r\n");
                foreach (var (k, v) in extra)
                    head.Append($"{k}: {v}\r\n");
                head.Append("\r\n");
                var hb = Encoding.ASCII.GetBytes(head.ToString());
                s.Write(hb);
                s.Write(payload);
                s.Flush();
            }
        }
        catch (IOException)
        {
        }
        catch (Exception e)
        {
            Console.Error.WriteLine(e);
        }
    }

    private static (int, string, byte[], Dictionary<string, string>) Json(object o, int status = 200)
        => (status, "application/json", JsonSerializer.SerializeToUtf8Bytes(o), new());

    private (int, string, byte[], Dictionary<string, string>) Route(string method, string path, byte[] body)
    {
        if (method == "OPTIONS")
            return (200, "text/plain", Array.Empty<byte>(), new());
        try
        {
            switch (path.Split('?')[0])
            {
                case "/ping":
                    return Json(new { ok = true, adapter = _r.Gpu.AdapterName });
                case "/log":
                    lock (_r.Log)
                        return Json(new { log = _r.Log.ToList() });
                case "/scene":
                    lock (_lock)
                    {
                        _scene = SceneDesc.Parse(Encoding.UTF8.GetString(body));
                        lock (_r.Log)
                            _r.Log.Clear();
                        return Json(new { ok = true, models = _scene.Models.Count, redirects = _scene.Redirects.Count });
                    }
                case "/frame":
                    lock (_lock)
                        return Frame(body);
            }

            return Json(new { error = "not found" }, 404);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine(e);
            return Json(new { error = e.GetType().Name + ": " + e.Message }, 500);
        }
    }

    private (int, string, byte[], Dictionary<string, string>) Frame(byte[] body)
    {
        var jlen = BitConverter.ToInt32(body, 0);
        var req  = JsonNode.Parse(Encoding.UTF8.GetString(body, 4, jlen))!.AsObject();
        var floats = new float[(body.Length - 4 - jlen) / 4];
        Buffer.BlockCopy(body, 4 + jlen, floats, 0, floats.Length * 4);

        var scene = _scene;
        var frame = new SceneDesc
        {
            Width = req["width"]?.GetValue<int>() ?? scene.Width, Height = req["height"]?.GetValue<int>() ?? scene.Height,
            Camera = req["camera"] is { } cam ? cam.Deserialize<CameraDesc>(SceneDesc.Options)! : scene.Camera,
            Env = req["env"] is { } env ? env.Deserialize<EnvDesc>(SceneDesc.Options)! : scene.Env,
            Redirects = scene.Redirects, Customize = scene.Customize, Output = req["output"]?.GetValue<string>() ?? "final",
            ShadowBounds = req["shadowBounds"]?.Deserialize<float[]>(),
        };
        // per-model state for this frame: "figure" picks the scene figure (0 = the top-level one), "index" its model;
        // bone palettes follow in the same order
        var figures = scene.Figures is { Count: > 0 } fs
            ? fs
            : new List<FigureDesc> { new() { Redirects = scene.Redirects, Customize = scene.Customize, Models = scene.Models } };
        var outFigures = figures.Select(f => new FigureDesc { Redirects = f.Redirects, Customize = f.Customize }).ToList();
        if (req["customize"] is { } cust)
            outFigures[0].Customize = cust.Deserialize<Dictionary<string, float[]>>(SceneDesc.Options);
        var at = 0;
        if (req["models"] is JsonArray ms)
        {
            foreach (var mn in ms)
            {
                var m   = mn!.AsObject();
                var fi  = m["figure"]?.GetValue<int>() ?? 0;
                var idx = m["index"]?.GetValue<int>() ?? 0;
                var count = m["boneCount"]?.GetValue<int>() ?? 0;
                var bones = new List<float[]?>(count);
                for (var b = 0; b < count && at + 16 <= floats.Length; b++, at += 16)
                    bones.Add(floats.AsSpan(at, 16).ToArray());
                if (fi < 0 || fi >= figures.Count || idx < 0 || idx >= figures[fi].Models.Count || m["visible"]?.GetValue<bool>() == false)
                    continue;
                var src = figures[fi].Models[idx];
                outFigures[fi].Models.Add(new ModelDesc
                {
                    Id = src.Id, Mdl = src.Mdl, Materials = src.Materials, Bones = bones,
                    World = m["world"]?.Deserialize<float[]>(),
                    HiddenAttributes = m["hiddenAttributes"]?.Deserialize<List<string>>() ?? src.HiddenAttributes,
                    Shapes = m["shapes"]?.Deserialize<List<string>>() ?? src.Shapes,
                    MulColor = src.MulColor, DecalColor = src.DecalColor, Decal = src.Decal, Stains = src.Stains,
                });
            }
        }
        else
        {
            for (var i = 0; i < figures.Count; i++)
                outFigures[i].Models = figures[i].Models;
        }

        frame.Figures = outFigures;
        var res = _r.Render(frame);
        var fmt = req["format"]?.GetValue<string>() ?? "rgba";
        var extra = new Dictionary<string, string>
        {
            ["X-Width"] = res.Width.ToString(), ["X-Height"] = res.Height.ToString(), ["X-Ms"] = res.Ms.ToString("F0"),
            ["X-Notes"] = res.Log.Count.ToString(),
        };
        if (fmt == "png")
            return (200, "image/png", Png.Encode(res.Rgba, res.Width, res.Height), extra);
        return (200, "application/octet-stream", res.Rgba, extra);
    }
}
