using System.Runtime.InteropServices;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ZXingCpp;

namespace Authenticator.Core;

/// <summary>32-bit BGR pixels plus an unused fourth byte, top row first.</summary>
public sealed record PixelImage(byte[] Pixels, int Width, int Height);

/// <summary>Reading and drawing QR codes, with zxing-cpp.</summary>
public static class QrCodes
{
    /// <summary>Every QR code text found in the image (screenshots, photos of a phone screen, ...).</summary>
    public static List<string> Read(PixelImage image)
    {
        var found = new List<string>();
        ReadInto(image, found);
        if (found.Count == 0)
        {
            // A tightly cropped code (a saved QR picture) reads better with a wider white margin,
            // and a small or soft one at double size.
            var padded = Pad(image, Math.Max(image.Width, image.Height) / 4);
            ReadInto(padded, found);
            if (found.Count == 0 && Math.Max(image.Width, image.Height) <= 1000)
                ReadInto(DoubleSize(padded), found);
        }
        return found;
    }

    static void ReadInto(PixelImage image, List<string> found)
    {
        using var reader = new BarcodeReader
        {
            Formats = BarcodeFormat.QRCode,
            TryHarder = true,
            TryRotate = true,
            TryInvert = true, // light-on-dark codes on dark-mode sites
            TryDownscale = true,
        };
        var pin = GCHandle.Alloc(image.Pixels, GCHandleType.Pinned);
        try
        {
            var view = new ImageView(pin.AddrOfPinnedObject(), image.Width, image.Height, ImageFormat.BGRA, image.Width * 4, 4);
            foreach (var barcode in reader.From(view))
            {
                using (barcode)
                    if (barcode.IsValid && !string.IsNullOrWhiteSpace(barcode.Text) && !found.Contains(barcode.Text))
                        found.Add(barcode.Text);
            }
        }
        finally
        {
            pin.Free();
        }
    }

    static PixelImage Pad(PixelImage image, int margin)
    {
        int w = image.Width + margin * 2, h = image.Height + margin * 2;
        var pixels = new byte[w * h * 4];
        Array.Fill(pixels, (byte)255);
        for (int y = 0; y < image.Height; y++)
            Buffer.BlockCopy(image.Pixels, y * image.Width * 4, pixels, ((y + margin) * w + margin) * 4, image.Width * 4);
        return new PixelImage(pixels, w, h);
    }

    static PixelImage DoubleSize(PixelImage image)
    {
        int w = image.Width * 2, h = image.Height * 2;
        var pixels = new byte[w * h * 4];
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
                Buffer.BlockCopy(image.Pixels, ((y / 2) * image.Width + x / 2) * 4, pixels, (y * w + x) * 4, 4);
        return new PixelImage(pixels, w, h);
    }

    /// <summary>Loads an image file, flattening any transparency onto white.</summary>
    public static PixelImage LoadImage(string path)
    {
        using var stream = File.OpenRead(path);
        var decoder = BitmapDecoder.Create(stream, BitmapCreateOptions.IgnoreColorProfile, BitmapCacheOption.OnLoad);
        return FromBitmap(decoder.Frames[0]);
    }

    public static PixelImage FromBitmap(BitmapSource source)
    {
        var bgra = new FormatConvertedBitmap(source, PixelFormats.Bgra32, null, 0);
        int w = bgra.PixelWidth, h = bgra.PixelHeight;
        var pixels = new byte[w * h * 4];
        bgra.CopyPixels(pixels, w * 4, 0);

        // Clipboard bitmaps often come with alpha all zero: treat those as opaque.
        bool anyAlpha = false;
        for (int i = 3; i < pixels.Length && !anyAlpha; i += 4)
            anyAlpha = pixels[i] != 0;
        if (anyAlpha)
        {
            for (int i = 0; i < pixels.Length; i += 4)
            {
                int alpha = pixels[i + 3];
                for (int c = 0; c < 3; c++)
                    pixels[i + c] = (byte)((pixels[i + c] * alpha + 255 * (255 - alpha) + 127) / 255);
            }
        }
        return new PixelImage(pixels, w, h);
    }

    /// <summary>A screenshot of every monitor, in real pixels.</summary>
    public static PixelImage CaptureScreen()
    {
        int x = GetSystemMetrics(SM_XVIRTUALSCREEN), y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        int w = GetSystemMetrics(SM_CXVIRTUALSCREEN), h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        var pixels = new byte[w * h * 4];

        IntPtr screenDc = GetDC(IntPtr.Zero);
        IntPtr memoryDc = CreateCompatibleDC(screenDc);
        IntPtr bitmap = CreateCompatibleBitmap(screenDc, w, h);
        try
        {
            IntPtr old = SelectObject(memoryDc, bitmap);
            BitBlt(memoryDc, 0, 0, w, h, screenDc, x, y, SRCCOPY | CAPTUREBLT);
            SelectObject(memoryDc, old);
            var info = new BITMAPINFO
            {
                biSize = Marshal.SizeOf<BITMAPINFOHEADER>(),
                biWidth = w,
                biHeight = -h, // top-down
                biPlanes = 1,
                biBitCount = 32,
            };
            if (GetDIBits(memoryDc, bitmap, 0, (uint)h, pixels, ref info, 0) == 0)
                throw new InvalidOperationException("Couldn't take a screenshot.");
        }
        finally
        {
            DeleteObject(bitmap);
            DeleteDC(memoryDc);
            ReleaseDC(IntPtr.Zero, screenDc);
        }
        return new PixelImage(pixels, w, h);
    }

    /// <summary>A QR code with one pixel per module and a 4-module quiet zone; scale it up with nearest-neighbour.</summary>
    public static BitmapSource Render(string text)
    {
        using var options = new CreatorOptions(BarcodeFormat.QRCode, text.Length > 300 ? "ecLevel=L" : "ecLevel=M");
        using var barcode = new Barcode(text, options);
        using var writer = new WriterOptions { Scale = 1, AddQuietZones = true };
        using var image = barcode.ToImage(writer);
        var bitmap = BitmapSource.Create(image.Width, image.Height, 96, 96, PixelFormats.Gray8, null, image.ToArray(), image.Width);
        bitmap.Freeze();
        return bitmap;
    }

    const int SM_XVIRTUALSCREEN = 76, SM_YVIRTUALSCREEN = 77, SM_CXVIRTUALSCREEN = 78, SM_CYVIRTUALSCREEN = 79;
    const int SRCCOPY = 0x00CC0020, CAPTUREBLT = 0x40000000;

    [StructLayout(LayoutKind.Sequential)]
    struct BITMAPINFOHEADER
    {
        public int biSize, biWidth, biHeight;
        public short biPlanes, biBitCount;
        public int biCompression, biSizeImage, biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant;
    }

    /// <summary>BITMAPINFOHEADER plus room for the colour table GetDIBits may write.</summary>
    [StructLayout(LayoutKind.Sequential)]
    struct BITMAPINFO
    {
        public int biSize, biWidth, biHeight;
        public short biPlanes, biBitCount;
        public int biCompression, biSizeImage, biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant;
        public uint color0, color1, color2, color3;
    }

    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr hdc);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int width, int height);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr hdc, IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr dest, int x, int y, int w, int h, IntPtr src, int sx, int sy, int rop);
    [DllImport("gdi32.dll")] static extern int GetDIBits(IntPtr hdc, IntPtr bitmap, uint start, uint lines, byte[] bits, ref BITMAPINFO info, uint usage);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr hdc);
}
