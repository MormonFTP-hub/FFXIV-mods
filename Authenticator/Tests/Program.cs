using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Authenticator.Core;

static class Program
{
    static int failures;

    [STAThread]
    static int Main(string[] args)
    {
        switch (args.FirstOrDefault())
        {
            case "icon": Icon.Write(args[1]); return 0;
            case "test": CoreTests(); break;
            case "screen": ScreenTest(); break;
            case "seed": Seed(args[1]); return 0;
            case "shot": return Shots.Run(args[1..]);
            case "render": return OffscreenRender.Run(args[1], args[2], args[3]);
            case "flows": return Flows.Run();
            default: Console.WriteLine("icon <path> | test | screen | seed <folder>"); return 2;
        }
        Console.WriteLine(failures == 0 ? "ALL PASSED" : $"{failures} FAILED");
        return failures == 0 ? 0 : 1;
    }

    static void Check(bool ok, string what)
    {
        Console.WriteLine($"{(ok ? "PASS" : "FAIL")}  {what}");
        if (!ok) failures++;
    }

    static void Throws<T>(Action action, string what) where T : Exception
    {
        try { action(); Check(false, what + " (no exception)"); }
        catch (T) { Check(true, what); }
        catch (Exception ex) { Check(false, $"{what} (threw {ex.GetType().Name}: {ex.Message})"); }
    }

    static void CoreTests()
    {
        // RFC 4226 appendix D
        var hotpKey = Encoding.ASCII.GetBytes("12345678901234567890");
        string[] hotp = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
        Check(Enumerable.Range(0, 10).All(i => Otp.Generate(hotpKey, i, 6, OtpAlgorithm.Sha1) == hotp[i]), "RFC 4226 HOTP vectors");

        // RFC 6238 appendix B
        long[] times = [59, 1111111109, 1111111111, 1234567890, 2000000000, 20000000000];
        var keys = new Dictionary<OtpAlgorithm, byte[]>
        {
            [OtpAlgorithm.Sha1] = Encoding.ASCII.GetBytes("12345678901234567890"),
            [OtpAlgorithm.Sha256] = Encoding.ASCII.GetBytes("12345678901234567890123456789012"),
            [OtpAlgorithm.Sha512] = Encoding.ASCII.GetBytes("1234567890123456789012345678901234567890123456789012345678901234"),
        };
        var expected = new Dictionary<OtpAlgorithm, string[]>
        {
            [OtpAlgorithm.Sha1] = ["94287082", "07081804", "14050471", "89005924", "69279037", "65353130"],
            [OtpAlgorithm.Sha256] = ["46119246", "68084774", "67062674", "91819424", "90698825", "77737706"],
            [OtpAlgorithm.Sha512] = ["90693936", "25091201", "99943326", "93441116", "38618901", "47863826"],
        };
        foreach (var (alg, codes) in expected)
        {
            var account = new Account { Secret = Base32.Encode(keys[alg]), Algorithm = alg, Digits = 8 };
            var got = times.Select(t => Otp.Totp(account, DateTimeOffset.FromUnixTimeSeconds(t))).ToArray();
            Check(got.SequenceEqual(codes), $"RFC 6238 TOTP {alg}: {string.Join(",", got)}");
        }
        Check(Otp.Format("123456") == "123 456" && Otp.Format("12345678") == "1234 5678", "code formatting");

        // Base32
        var hello = "Hello!"u8.ToArray().Concat(new byte[] { 0xDE, 0xAD, 0xBE, 0xEF }).ToArray();
        Check(Base32.Encode(hello) == "JBSWY3DPEHPK3PXP", "base32 encode");
        Check(Base32.TryDecode("jbsw y3dp-ehpk 3pxp====", out var b) && b.SequenceEqual(hello), "base32 decode with case/spaces/padding");
        Check(!Base32.TryDecode("JBSW1", out _), "base32 rejects '1'");
        Check(Base32.Group("JBSWY3DPEHPK3PXP") == "JBSW Y3DP EHPK 3PXP" && Base32.Group("ABCDEF") == "ABCD EF", "base32 grouping");
        for (int n = 1; n < 40; n++)
        {
            var data = Enumerable.Range(0, n).Select(i => (byte)(i * 37 + n)).ToArray();
            if (!Base32.TryDecode(Base32.Encode(data), out var back) || !back.SequenceEqual(data)) { Check(false, $"base32 round trip {n}"); goto doneB32; }
        }
        Check(true, "base32 round trip 1..39 bytes");
    doneB32:

        // otpauth://
        var a = OtpUri.Parse("otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example");
        Check(a.Issuer == "Example" && a.Name == "alice@google.com" && a.Secret == "JBSWY3DPEHPK3PXP" && a.Digits == 6 && a.Period == 30, "otpauth basic");
        a = OtpUri.Parse("otpauth://totp/ACME%20Co:john.doe+test@email.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME+Co&algorithm=SHA256&digits=8&period=60");
        Check(a.Issuer == "ACME Co" && a.Name == "john.doe+test@email.com" && a.Algorithm == OtpAlgorithm.Sha256 && a.Digits == 8 && a.Period == 60, "otpauth with options and + in email");
        a = OtpUri.Parse("otpauth://totp/GitHub:me?secret=jbsw%20y3dp%20ehpk%203pxp");
        Check(a.Issuer == "GitHub" && a.Name == "me" && a.Secret == "JBSWY3DPEHPK3PXP", "otpauth label issuer + spaced lowercase secret");
        a = OtpUri.Parse("otpauth://hotp/Bank?secret=JBSWY3DPEHPK3PXP&counter=7");
        Check(a.Type == OtpType.Hotp && a.Counter == 7 && a.Issuer == "" && a.Name == "Bank", "otpauth hotp");
        Throws<FormatException>(() => OtpUri.Parse("otpauth://totp/X?secret=NOT*BASE32"), "otpauth bad secret throws");
        Throws<FormatException>(() => OtpUri.Parse("otpauth://totp/X?issuer=Y"), "otpauth missing secret throws");
        Throws<FormatException>(() => OtpUri.Parse("otpauth://steam/X?secret=JBSWY3DPEHPK3PXP"), "otpauth unknown type throws");
        var original = new Account { Issuer = "Big Corp: EU", Name = "me+x@y.z", Secret = "JBSWY3DPEHPK3PXP", Algorithm = OtpAlgorithm.Sha512, Digits = 8, Period = 45 };
        var parsed = OtpUri.Parse(OtpUri.Build(original));
        Check(parsed.Issuer == original.Issuer && parsed.Name == original.Name && parsed.Secret == original.Secret && parsed.Algorithm == original.Algorithm && parsed.Digits == 8 && parsed.Period == 45,
            $"otpauth build/parse round trip ({OtpUri.Build(original)})");

        // Google Authenticator migration
        const string sample = "otpauth-migration://offline?data=CjEKCkhlbGxvId6tvu8SGEV4YW1wbGU6YWxpY2VAZ29vZ2xlLmNvbRoHRXhhbXBsZTAC";
        var batch = GoogleMigration.Parse(sample);
        Check(batch.Accounts.Count == 1 && batch.Accounts[0].Secret == "JBSWY3DPEHPK3PXP" && batch.Accounts[0].Issuer == "Example"
              && batch.Accounts[0].Name == "alice@google.com" && batch.Accounts[0].Type == OtpType.Totp, "migration known sample");
        batch = GoogleMigration.Parse(sample.Replace("data=", "data=").Replace("CjEKCkhlbGxvId6tvu8SGEV4YW1wbGU6YWxpY2VAZ29vZ2xlLmNvbRoHRXhhbXBsZTAC", Uri.EscapeDataString("CjEKCkhlbGxvId6tvu8SGEV4YW1wbGU6YWxpY2VAZ29vZ2xlLmNvbRoHRXhhbXBsZTAC")));
        Check(batch.Accounts.Count == 1, "migration url-escaped");
        Throws<FormatException>(() => GoogleMigration.Parse("otpauth-migration://offline?data=CjEKCkhl"), "migration truncated throws");

        var many = Enumerable.Range(1, 40).Select(i => new Account
        {
            Issuer = $"Service number {i}",
            Name = $"someone.with.a.long.name{i}@example.com",
            Secret = Base32.Encode(Enumerable.Range(0, 20).Select(j => (byte)(i * 7 + j)).ToArray()),
            Type = i % 9 == 0 ? OtpType.Hotp : OtpType.Totp,
            Counter = i % 9 == 0 ? i : 0,
            Digits = i % 5 == 0 ? 8 : 6,
            Algorithm = i % 7 == 0 ? OtpAlgorithm.Sha256 : OtpAlgorithm.Sha1,
        }).ToList();
        many.Add(new Account { Issuer = "Sixty", Name = "x", Secret = "JBSWY3DPEHPK3PXP", Period = 60 });
        var links = GoogleMigration.Build(many);
        var batches = links.Select(GoogleMigration.Parse).ToList();
        var back2 = batches.SelectMany(x => x.Accounts).ToList();
        bool same = back2.Count == 40 && back2.Zip(many.Take(40)).All(p => p.First.Secret == p.Second.Secret && p.First.Issuer == p.Second.Issuer
            && p.First.Name == p.Second.Name && p.First.Digits == p.Second.Digits && p.First.Algorithm == p.Second.Algorithm && p.First.Type == p.Second.Type
            && p.First.Counter == p.Second.Counter);
        Check(same, $"migration export round trip ({links.Count} QR codes, longest link {links.Max(l => l.Length)} chars, 60s account left out)");
        Check(batches.Select(x => x.BatchIndex).SequenceEqual(Enumerable.Range(0, links.Count)) && batches.All(x => x.BatchSize == links.Count && x.BatchId == batches[0].BatchId),
            "migration batch numbering");

        // Importer
        var importer = new Importer();
        var existing = new List<Account> { new() { Issuer = "Example", Name = "old", Secret = "JBSWY3DPEHPK3PXP" } };
        var result = importer.Import([sample, "https://example.com", "otpauth://totp/New?secret=GEZDGNBVGY3TQOJQ"], existing);
        Check(result.Added.Count == 1 && result.AlreadyThere.Count == 1 && result.OtherCodes == 1 && result.Errors.Count == 0, "importer: duplicate skipped, link ignored, new added");
        result = importer.Import([links[1]], []);
        Check(result.Notes.Count == 1 && result.Notes[0].Contains("Still to import: 1, 3"), $"importer batch note: {result.Notes.FirstOrDefault()}");
        result = importer.Import(links.Where((_, i) => i != 1), []);
        Check(result.Notes.Last().Contains($"last of the {links.Count}") && result.Added.Count == 40 - batches[1].Accounts.Count, $"importer batch complete note: {result.Notes.LastOrDefault()}");

        // Backup
        string temp = Path.Combine(Path.GetTempPath(), "authtools-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(temp);
        try
        {
            string backupPath = Path.Combine(temp, "b.authbackup");
            BackupFile.Write(backupPath, many, "correct horse");
            Check(BackupFile.LooksLikeBackup(backupPath), "backup detected");
            var restored = BackupFile.Read(backupPath, "correct horse");
            Check(restored.Count == many.Count && restored.Zip(many).All(p => p.First.Secret == p.Second.Secret && p.First.Period == p.Second.Period && p.First.Name == p.Second.Name), "backup round trip");
            Throws<WrongPasswordException>(() => BackupFile.Read(backupPath, "wrong"), "backup wrong password");
            Check(!File.ReadAllText(backupPath).Contains("JBSWY3DPEHPK3PXP") && !File.ReadAllText(backupPath).Contains("Service number"), "backup file has no plaintext");

            // Vault
            var vault = new Vault(temp);
            vault.Load();
            Check(vault.Accounts.Count == 0 && vault.LoadError == null, "vault empty start");
            vault.Accounts.AddRange(many.Take(5));
            vault.Save();
            vault.Accounts.Add(many[5]);
            vault.Save();
            Check(File.Exists(vault.BackupPath), "vault keeps previous copy");
            Check(!File.ReadAllText(vault.VaultPath, Encoding.Latin1).Contains("Service number"), "vault file encrypted");
            var vault2 = new Vault(temp);
            vault2.Load();
            Check(vault2.Accounts.Count == 6 && vault2.Accounts[5].Secret == many[5].Secret && !vault2.RecoveredFromBackup, "vault reload");
            File.WriteAllBytes(vault.VaultPath, [1, 2, 3, 4]);
            var vault3 = new Vault(temp);
            vault3.Load();
            Check(vault3.LoadError == null && vault3.RecoveredFromBackup && vault3.Accounts.Count == 5 && Directory.GetFiles(temp, "vault.unreadable-*").Length == 1,
                "vault falls back to previous copy and keeps the damaged file");
            vault3.Save();
            File.WriteAllBytes(vault.VaultPath, [9, 9]);
            File.WriteAllBytes(vault.BackupPath, [9, 9]);
            var vault4 = new Vault(temp);
            vault4.Load();
            Check(vault4.LoadError != null, "vault unreadable is reported");
            Throws<InvalidOperationException>(vault4.Save, "vault refuses to overwrite unreadable file");

            // QR codes
            QrRoundTrip(OtpUri.Build(original), "otpauth link", invert: false, scale: 4);
            QrRoundTrip(links[0], "migration export link", invert: false, scale: 3);
            QrRoundTrip(OtpUri.Build(original), "light-on-dark code", invert: true, scale: 4);
            QrRoundTrip(links[0], "migration link in a small 2px-module code", invert: false, scale: 2);

            string png = Path.Combine(temp, "qr.png");
            var bmp = QrCodes.Render(sample);
            var scaled = new TransformedBitmap(bmp, new ScaleTransform(6, 6));
            using (var fs = File.Create(png))
            {
                var enc = new PngBitmapEncoder();
                enc.Frames.Add(BitmapFrame.Create(scaled));
                enc.Save(fs);
            }
            var fromFile = QrCodes.Read(QrCodes.LoadImage(png));
            Check(fromFile.SequenceEqual([sample]), "QR from PNG file");

            // Clean saved pictures at many sizes, and rough "photo of a phone screen" versions.
            string[] texts = [OtpUri.Build(original), sample, links[0]];
            double[] scales = [1, 1.5, 2, 2.5, 3, 3.3, 4, 4.7, 5, 5.5, 6, 7, 8, 9.2, 10, 12];
            int clean = 0, cleanTotal = 0, photo = 0, photoTotal = 0;
            var misses = new List<string>();
            foreach (var text in texts)
            {
                var qrBmp = QrCodes.Render(text);
                foreach (var s in scales)
                {
                    cleanTotal++;
                    var img = QrCodes.FromBitmap(s == 1 ? qrBmp : new TransformedBitmap(qrBmp, new ScaleTransform(s, s)));
                    if (QrCodes.Read(img).Contains(text)) clean++; else misses.Add($"clean {text.Length}ch x{s}");
                }
                foreach (var (angle, s, blur) in new[] { (7.0, 6.0, 1.5), (-12.0, 8.0, 2.5), (25.0, 5.0, 1.0), (90.0, 4.0, 0.0), (3.0, 10.0, 4.0), (-4.0, 7.0, 3.0) })
                {
                    photoTotal++;
                    var shot = Photo(qrBmp, angle, s, blur, seed: photoTotal);
                    if (photoTotal == 2 && Environment.GetEnvironmentVariable("SAVE_PHOTO") is { } savePath)
                        using (var f = File.Create(savePath)) { var e = new PngBitmapEncoder(); e.Frames.Add(BitmapFrame.Create(BitmapSource.Create(shot.Width, shot.Height, 96, 96, PixelFormats.Bgr32, null, shot.Pixels, shot.Width * 4))); e.Save(f); }
                    if (QrCodes.Read(shot).Contains(text)) photo++; else misses.Add($"photo {text.Length}ch angle {angle} x{s} blur {blur}");
                }
            }
            Check(clean == cleanTotal, $"clean QR pictures at all sizes: {clean}/{cleanTotal}");
            Check(photo >= photoTotal - 1, $"rough photo-like QR images: {photo}/{photoTotal}");
            foreach (var m in misses) Console.WriteLine($"      missed {m}");
        }
        finally
        {
            Directory.Delete(temp, true);
        }

        var sync = TimeSync.SyncAsync().GetAwaiter().GetResult();
        Console.WriteLine($"INFO  clock sync: {(sync ? $"offset {TimeSync.Offset.TotalMilliseconds:0} ms" : "failed")}");
    }

    /// <summary>The code on a phone screen in a photo: rotated, blurred, grey-on-grey, on a dark surround, with sensor noise.</summary>
    static PixelImage Photo(BitmapSource qr, double angle, double scale, double blur, int seed)
    {
        double size = qr.PixelWidth * scale;
        double canvas = size * 1.8;
        var visual = new DrawingVisual();
        if (blur > 0)
            visual.Effect = new System.Windows.Media.Effects.BlurEffect { Radius = blur, KernelType = System.Windows.Media.Effects.KernelType.Gaussian };
        using (var dc = visual.RenderOpen())
        {
            dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(35, 30, 28)), null, new Rect(0, 0, canvas, canvas));
            dc.PushTransform(new RotateTransform(angle, canvas / 2, canvas / 2));
            dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(225, 228, 222)), null, new Rect((canvas - size * 1.25) / 2, (canvas - size * 1.6) / 2, size * 1.25, size * 1.6));
            var group = new DrawingGroup();
            RenderOptions.SetBitmapScalingMode(group, BitmapScalingMode.NearestNeighbor);
            group.Children.Add(new ImageDrawing(qr, new Rect((canvas - size) / 2, (canvas - size) / 2, size, size)));
            dc.PushOpacity(0.78); // washed-out blacks
            dc.DrawDrawing(group);
            dc.Pop();
            dc.Pop();
        }
        var rtb = new RenderTargetBitmap((int)canvas, (int)canvas, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(visual);
        var img = QrCodes.FromBitmap(rtb);
        var rng = new Random(seed);
        for (int i = 0; i < img.Pixels.Length; i += 4)
        {
            int n = rng.Next(-18, 19);
            for (int c = 0; c < 3; c++)
                img.Pixels[i + c] = (byte)Math.Clamp(img.Pixels[i + c] + n, 0, 255);
        }
        return img;
    }

    static void QrRoundTrip(string text, string what, bool invert, int scale)
    {
        var qr = QrCodes.Render(text);
        int w = qr.PixelWidth, h = qr.PixelHeight;
        var modules = new byte[w * h];
        qr.CopyPixels(modules, w, 0);

        // Put it on a big noisy "screen" like a web page would.
        int W = 1920, H = 1080, ox = 900, oy = 300;
        var screen = new byte[W * H * 4];
        var rng = new Random(1);
        for (int i = 0; i < screen.Length; i += 4)
        {
            byte bg = invert ? (byte)30 : (byte)245;
            screen[i] = screen[i + 1] = screen[i + 2] = bg;
        }
        for (int i = 0; i < 400; i++)
        {
            int x = rng.Next(0, 800), y = rng.Next(0, H - 20);
            for (int dy = 0; dy < 12; dy++) for (int dx = 0; dx < 6; dx++) { int p = ((y + dy) * W + x + dx) * 4; screen[p] = screen[p + 1] = screen[p + 2] = invert ? (byte)220 : (byte)40; }
        }
        for (int y = 0; y < h * scale; y++)
            for (int x = 0; x < w * scale; x++)
            {
                byte v = modules[(y / scale) * w + x / scale];
                if (invert) v = (byte)(255 - v);
                int p = ((oy + y) * W + ox + x) * 4;
                screen[p] = screen[p + 1] = screen[p + 2] = v;
            }
        var found = QrCodes.Read(new PixelImage(screen, W, H));
        Check(found.Contains(text), $"QR round trip: {what} ({w}x{h} modules)");
    }

    static void ScreenTest()
    {
        string text = OtpUri.Build(new Account { Issuer = "Screen Test", Name = "me@example.com", Secret = "JBSWY3DPEHPK3PXP" });
        var app = new Application();
        var window = new Window
        {
            Title = "QR screen test",
            Width = 360, Height = 400,
            WindowStartupLocation = WindowStartupLocation.CenterScreen,
            Topmost = true,
            Content = new Border
            {
                Background = Brushes.White,
                Child = new Image { Source = QrCodes.Render(text), Width = 260, Height = 260, Stretch = Stretch.Uniform },
            },
        };
        RenderOptions.SetBitmapScalingMode((Image)((Border)window.Content).Child, BitmapScalingMode.NearestNeighbor);
        window.ContentRendered += async (_, _) =>
        {
            await Task.Delay(500);
            var shot = QrCodes.CaptureScreen();
            Console.WriteLine($"INFO  captured {shot.Width}x{shot.Height}");
            var found = await Task.Run(() => QrCodes.Read(shot));
            Check(found.Contains(text), $"screen capture finds the QR code ({found.Count} found)");
            app.Shutdown();
        };
        app.Run(window);
    }

    /// <summary>Demo accounts for UI screenshots, in a throwaway data folder.</summary>
    static void Seed(string folder)
    {
        var vault = new Vault(folder);
        vault.Load();
        vault.Accounts.Clear();
        string[][] demo =
        [
            ["Google", "arcadia.demo@gmail.com"], ["Discord", "arcadia"], ["GitHub", "arcadia-dev"], ["Square Enix", "WoL Account"],
            ["Microsoft", "demo@outlook.com"], ["Twitch", "arcadia_streams"], ["", "Home NAS"],
        ];
        int i = 0;
        foreach (var d in demo)
            vault.Accounts.Add(new Account { Issuer = d[0], Name = d[1], Secret = Base32.Encode(Encoding.UTF8.GetBytes($"demo-secret-{i++:00}-xyz")) });
        vault.Accounts.Add(new Account { Issuer = "Bank", Name = "card reader", Secret = Base32.Encode("demo-hotp-secret-1"u8), Type = OtpType.Hotp });
        vault.Save();
        Console.WriteLine($"seeded {vault.Accounts.Count} accounts in {folder}");
    }
}

static class Icon
{
    /// <summary>Blue rounded square, white countdown ring and keyhole. 256 px as PNG, smaller sizes as 32-bit DIBs.</summary>
    public static void Write(string path)
    {
        int[] sizes = [16, 20, 24, 32, 40, 48, 64, 256];
        var images = sizes.Select(s => (Size: s, Data: s == 256 ? Png(Render(s)) : Dib(Render(s), s))).ToList();
        using var file = new BinaryWriter(File.Create(path));
        file.Write((short)0);
        file.Write((short)1);
        file.Write((short)images.Count);
        int offset = 6 + 16 * images.Count;
        foreach (var (size, data) in images)
        {
            file.Write((byte)(size >= 256 ? 0 : size));
            file.Write((byte)(size >= 256 ? 0 : size));
            file.Write((byte)0);
            file.Write((byte)0);
            file.Write((short)1);
            file.Write((short)32);
            file.Write(data.Length);
            file.Write(offset);
            offset += data.Length;
        }
        foreach (var (_, data) in images)
            file.Write(data);

        var preview = Path.ChangeExtension(path, ".preview.png");
        File.WriteAllBytes(preview, Png(Render(256)));
        Console.WriteLine($"wrote {path} and {preview}");
    }

    static BitmapSource Render(int size)
    {
        double s = size;
        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            var bg = new LinearGradientBrush((Color)ColorConverter.ConvertFromString("#3B8BFF"), (Color)ColorConverter.ConvertFromString("#1452D0"), 60);
            double r = s * 0.22;
            dc.DrawRoundedRectangle(bg, null, new Rect(0, 0, s, s), r, r);

            var center = new Point(s / 2, s / 2);
            double thick = Math.Max(s * 0.095, 1.6);
            double radius = s * 0.30;
            var pen = new Pen(Brushes.White, thick) { StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round };
            // Ring from 12 o'clock, 290 degrees clockwise: a countdown with a bit used up.
            double sweep = 290 * Math.PI / 180;
            var start = new Point(center.X, center.Y - radius);
            var end = new Point(center.X + radius * Math.Sin(sweep), center.Y - radius * Math.Cos(sweep));
            var fig = new PathFigure { StartPoint = start };
            fig.Segments.Add(new ArcSegment(end, new Size(radius, radius), 0, true, SweepDirection.Clockwise, true));
            dc.DrawGeometry(null, pen, new PathGeometry([fig]));

            // Keyhole
            double hole = s * 0.085;
            var holeCenter = new Point(center.X, center.Y - s * 0.04);
            dc.DrawEllipse(Brushes.White, null, holeCenter, hole, hole);
            if (size >= 24)
            {
                var stem = new StreamGeometry();
                using (var g = stem.Open())
                {
                    g.BeginFigure(new Point(holeCenter.X - hole * 0.45, holeCenter.Y), true, true);
                    g.LineTo(new Point(holeCenter.X + hole * 0.45, holeCenter.Y), true, false);
                    g.LineTo(new Point(holeCenter.X + hole * 0.75, center.Y + s * 0.13), true, false);
                    g.LineTo(new Point(holeCenter.X - hole * 0.75, center.Y + s * 0.13), true, false);
                }
                dc.DrawGeometry(Brushes.White, null, stem);
            }
        }
        var bmp = new RenderTargetBitmap(size, size, 96, 96, PixelFormats.Pbgra32);
        bmp.Render(visual);
        return bmp;
    }

    static byte[] Png(BitmapSource bmp)
    {
        var enc = new PngBitmapEncoder();
        enc.Frames.Add(BitmapFrame.Create(bmp));
        using var ms = new MemoryStream();
        enc.Save(ms);
        return ms.ToArray();
    }

    static byte[] Dib(BitmapSource bmp, int size)
    {
        var px = new byte[size * size * 4];
        bmp.CopyPixels(px, size * 4, 0);
        // Pbgra -> straight alpha
        for (int i = 0; i < px.Length; i += 4)
        {
            int a = px[i + 3];
            if (a is > 0 and < 255)
                for (int c = 0; c < 3; c++)
                    px[i + c] = (byte)Math.Min(255, px[i + c] * 255 / a);
        }
        int maskStride = (size + 31) / 32 * 4;
        using var ms = new MemoryStream();
        var w = new BinaryWriter(ms);
        w.Write(40); w.Write(size); w.Write(size * 2); w.Write((short)1); w.Write((short)32);
        w.Write(0); w.Write(size * size * 4 + maskStride * size); w.Write(0); w.Write(0); w.Write(0); w.Write(0);
        for (int y = size - 1; y >= 0; y--)
            w.Write(px, y * size * 4, size * 4);
        w.Write(new byte[maskStride * size]);
        return ms.ToArray();
    }
}
