# Maximize and focus the main window of a process: focus_window.ps1 <process name>
param([string]$Name = 'wow.export')
Add-Type @'
using System; using System.Runtime.InteropServices;
public class FocusWin {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@
$p = Get-Process $Name | Where-Object MainWindowTitle | Select-Object -First 1
[FocusWin]::ShowWindow($p.MainWindowHandle, 3) | Out-Null
[FocusWin]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
$p.MainWindowTitle
