using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Win32;

namespace Authenticator;

/// <summary>Light and dark colours following the Windows "app mode" setting, and a title bar to match.</summary>
static class Theme
{
    public static bool IsDark { get; private set; }

    static readonly Dictionary<string, (string Light, string Dark)> Palette = new()
    {
        ["WindowBg"] = ("#F3F3F3", "#1F1F1F"),
        ["CardBg"] = ("#FFFFFF", "#2B2B2B"),
        ["CardHover"] = ("#F6F8FC", "#323232"),
        ["CardPressed"] = ("#EDF1F8", "#3A3A3A"),
        ["Border"] = ("#E0E0E0", "#3D3D3D"),
        ["Text"] = ("#1B1B1B", "#F2F2F2"),
        ["SubText"] = ("#686868", "#A3A3A3"),
        ["Accent"] = ("#1A73E8", "#7AACFF"),
        ["AccentHover"] = ("#1765CC", "#8FB9FF"),
        ["OnAccent"] = ("#FFFFFF", "#0B1B33"),
        ["Danger"] = ("#D93025", "#FF7B72"),
        ["InputBg"] = ("#FFFFFF", "#2B2B2B"),
        ["MenuBg"] = ("#FFFFFF", "#2C2C2C"),
        ["MenuHover"] = ("#EEEEEE", "#3A3A3A"),
        ["Track"] = ("#E2E2E2", "#3F3F3F"),
        ["ScrollThumb"] = ("#C2C2C2", "#5A5A5A"),
        ["ToastBg"] = ("#323232", "#E8E8E8"),
        ["ToastText"] = ("#FFFFFF", "#1B1B1B"),
    };

    public static void Apply()
    {
        IsDark = ReadSystemIsDark();
        var resources = Application.Current.Resources;
        foreach (var (key, (light, dark)) in Palette)
        {
            var brush = new SolidColorBrush((Color)ColorConverter.ConvertFromString(IsDark ? dark : light));
            brush.Freeze();
            resources[key] = brush;
        }
        foreach (Window window in Application.Current.Windows)
            ApplyTitleBar(window);
    }

    static bool ReadSystemIsDark()
    {
        if (Environment.GetEnvironmentVariable("AUTHENTICATOR_THEME") is ("dark" or "light") and var forced)
            return forced == "dark";
        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
        return key?.GetValue("AppsUseLightTheme") is int value && value == 0;
    }

    /// <summary>Call from every window's constructor.</summary>
    public static void Attach(Window window)
    {
        window.SourceInitialized += (_, _) =>
        {
            ApplyTitleBar(window);
            // WM_SETTINGCHANGE "ImmersiveColorSet" = the user switched light/dark.
            HwndSource.FromHwnd(new WindowInteropHelper(window).Handle)?.AddHook((IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled) =>
            {
                if (msg == 0x001A && lParam != IntPtr.Zero && Marshal.PtrToStringUni(lParam) == "ImmersiveColorSet")
                    window.Dispatcher.BeginInvoke(() => { if (ReadSystemIsDark() != IsDark) Apply(); });
                return IntPtr.Zero;
            });
        };
    }

    static void ApplyTitleBar(Window window)
    {
        var hwnd = new WindowInteropHelper(window).Handle;
        if (hwnd == IntPtr.Zero)
            return;
        int dark = IsDark ? 1 : 0;
        DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, sizeof(int));
        // Windows 11: title bar in the window's own background colour (ignored on Windows 10).
        var bg = ((SolidColorBrush)Application.Current.Resources["WindowBg"]).Color;
        var fg = ((SolidColorBrush)Application.Current.Resources["Text"]).Color;
        int caption = bg.R | (bg.G << 8) | (bg.B << 16), text = fg.R | (fg.G << 8) | (fg.B << 16);
        DwmSetWindowAttribute(hwnd, DWMWA_CAPTION_COLOR, ref caption, sizeof(int));
        DwmSetWindowAttribute(hwnd, DWMWA_TEXT_COLOR, ref text, sizeof(int));
    }

    const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20, DWMWA_CAPTION_COLOR = 35, DWMWA_TEXT_COLOR = 36;

    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);
}
