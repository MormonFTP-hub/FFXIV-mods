using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Media;
using System.Windows.Media.Imaging;

/// <summary>
/// Drives the real app for screenshots: shot &lt;exe&gt; &lt;dataFolder&gt; &lt;outDir&gt; &lt;theme&gt; [steps...]
/// Steps: "wait:ms", "click:AutomationName", "menu:Header" (click a context-menu item), "snap:name" (window incl. popups),
/// "key:ctrl+v", "type:text", "close".
/// </summary>
static class Shots
{
    public static int Run(string[] args)
    {
        string exe = args[0], data = args[1], outDir = args[2], theme = args[3];
        Directory.CreateDirectory(outDir);
        var psi = new ProcessStartInfo(exe) { UseShellExecute = false };
        psi.Environment["AUTHENTICATOR_DATA"] = data;
        psi.Environment["AUTHENTICATOR_THEME"] = theme;
        using var proc = Process.Start(psi)!;
        IntPtr hwnd = IntPtr.Zero;
        for (int i = 0; i < 100 && hwnd == IntPtr.Zero; i++)
        {
            Thread.Sleep(100);
            proc.Refresh();
            hwnd = proc.MainWindowHandle;
        }
        if (hwnd == IntPtr.Zero) { Console.WriteLine("no window"); return 1; }
        SetForegroundWindow(hwnd);
        Thread.Sleep(1200);
        var root = AutomationElement.FromHandle(hwnd);

        foreach (var step in args[4..])
        {
            int colon = step.IndexOf(':');
            string cmd = colon < 0 ? step : step[..colon], arg = colon < 0 ? "" : step[(colon + 1)..];
            try
            {
                switch (cmd)
                {
                    case "wait": Thread.Sleep(int.Parse(arg)); break;
                    case "expect": FindByName(AutomationElement.RootElement, arg, proc.Id); break;
                    case "click": Invoke(FindByName(AutomationElement.RootElement, arg, proc.Id)); Thread.Sleep(400); break;
                    case "menu": Invoke(FindByName(AutomationElement.RootElement, arg, proc.Id)); Thread.Sleep(500); break;
                    case "rclick":
                        {
                            var el = FindByName(root, arg, proc.Id);
                            var r = el.Current.BoundingRectangle;
                            SetCursorPos((int)(r.Left + 20), (int)(r.Top + 20));
                            mouse_event(0x0008, 0, 0, 0, 0); mouse_event(0x0010, 0, 0, 0, 0);
                            Thread.Sleep(500);
                            break;
                        }
                    case "lclick":
                        {
                            var el = FindByName(root, arg, proc.Id);
                            var r = el.Current.BoundingRectangle;
                            SetCursorPos((int)(r.Left + 20), (int)(r.Top + 20));
                            mouse_event(0x0002, 0, 0, 0, 0); mouse_event(0x0004, 0, 0, 0, 0);
                            Thread.Sleep(300);
                            break;
                        }
                    case "key": SendKeys(arg); Thread.Sleep(500); break;
                    case "snap": Snap(proc.Id, Path.Combine(outDir, arg + ".png")); break;
                    case "close": proc.CloseMainWindow(); proc.WaitForExit(5000); break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"step {step} failed: {ex.Message}");
                Snap(proc.Id, Path.Combine(outDir, "failed.png"));
                if (!proc.HasExited) proc.Kill();
                return 1;
            }
            Console.WriteLine($"ok {step}");
        }
        if (!proc.HasExited) { proc.CloseMainWindow(); if (!proc.WaitForExit(3000)) proc.Kill(); }
        return 0;
    }

    static AutomationElement FindByName(AutomationElement scope, string name, int pid)
    {
        for (int i = 0; i < 30; i++)
        {
            var cond = new AndCondition(new PropertyCondition(AutomationElement.NameProperty, name), new PropertyCondition(AutomationElement.ProcessIdProperty, pid));
            var el = scope.FindFirst(TreeScope.Descendants, cond);
            if (el != null) return el;
            Thread.Sleep(150);
        }
        throw new InvalidOperationException($"element '{name}' not found");
    }

    static void Invoke(AutomationElement el)
    {
        if (el.TryGetCurrentPattern(InvokePattern.Pattern, out var p)) ((InvokePattern)p).Invoke();
        else if (el.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out var e)) ((ExpandCollapsePattern)e).Expand();
        else throw new InvalidOperationException("not invokable");
    }

    /// <summary>Screenshot of the union of all visible top-level windows of the process (main window, dialogs, menus).</summary>
    static void Snap(int pid, string path)
    {
        var rects = new List<RECT>();
        EnumWindows((h, _) =>
        {
            GetWindowThreadProcessId(h, out int p);
            if (p == pid && IsWindowVisible(h) && DwmGetWindowAttribute(h, 9, out RECT r, Marshal.SizeOf<RECT>()) == 0 && r.Right - r.Left > 10)
                rects.Add(r);
            return true;
        }, IntPtr.Zero);
        if (rects.Count == 0) { Console.WriteLine("nothing to snap"); return; }
        int left = rects.Min(r => r.Left), top = rects.Min(r => r.Top), right = rects.Max(r => r.Right), bottom = rects.Max(r => r.Bottom);
        int w = right - left, h = bottom - top;
        var shot = Authenticator.Core.QrCodes.CaptureScreen();
        int vx = GetSystemMetrics(76), vy = GetSystemMetrics(77);
        var px = new byte[w * h * 4];
        for (int y = 0; y < h; y++)
            Buffer.BlockCopy(shot.Pixels, ((top - vy + y) * shot.Width + (left - vx)) * 4, px, y * w * 4, w * 4);
        for (int i = 3; i < px.Length; i += 4) px[i] = 255;
        var bmp = BitmapSource.Create(w, h, 96, 96, PixelFormats.Bgra32, null, px, w * 4);
        using var fs = File.Create(path);
        var enc = new PngBitmapEncoder();
        enc.Frames.Add(BitmapFrame.Create(bmp));
        enc.Save(fs);
        Console.WriteLine($"snap {path} {w}x{h}");
    }

    static void SendKeys(string combo)
    {
        var parts = combo.ToLowerInvariant().Split('+');
        var mods = parts[..^1].Select(m => m switch { "ctrl" => (byte)0x11, "shift" => (byte)0x10, "alt" => (byte)0x12, _ => (byte)0 }).ToList();
        string key = parts[^1];
        byte vk = key switch { "enter" => 0x0D, "esc" => 0x1B, "tab" => 0x09, _ => (byte)char.ToUpperInvariant(key[0]) };
        foreach (var m in mods) keybd_event(m, 0, 0, 0);
        keybd_event(vk, 0, 0, 0); keybd_event(vk, 0, 2, 0);
        foreach (var m in mods) keybd_event(m, 0, 2, 0);
    }

    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc proc, IntPtr l);
    [DllImport("user32.dll")] static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern void mouse_event(int flags, int dx, int dy, int data, int extra);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, int flags, int extra);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
}
