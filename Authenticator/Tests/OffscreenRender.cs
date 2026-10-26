using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

/// <summary>
/// Renders the real app's windows to PNGs without ever putting them on screen (they live at -20000,-20000, not activated,
/// no taskbar button): render &lt;dataFolder&gt; &lt;outDir&gt; &lt;dark|light&gt;
/// </summary>
static class OffscreenRender
{
    static string outDir = "";
    static readonly Assembly AppAssembly = typeof(Authenticator.MainWindow).Assembly;

    public static int Run(string data, string outDirectory, string theme)
    {
        outDir = outDirectory;
        Directory.CreateDirectory(outDir);
        Environment.SetEnvironmentVariable("AUTHENTICATOR_DATA", data);
        Environment.SetEnvironmentVariable("AUTHENTICATOR_THEME", theme);

        var app = new Authenticator.App();
        app.InitializeComponent();
        app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        AppAssembly.GetType("Authenticator.Theme")!.GetMethod("Apply")!.Invoke(null, null);

        int exit = 0;
        app.Dispatcher.BeginInvoke(async () =>
        {
            try
            {
                var window = new Authenticator.MainWindow(data);
                Offscreen(window);
                window.Show();
                await Task.Delay(1500);
                Save(window, $"{theme}-main");

                // Add menu and an account card's right-click menu, rendered standalone.
                var addMenu = (ContextMenu)window.Resources["AddMenu"];
                Save(addMenu, $"{theme}-addmenu");
                var moreMenu = (ContextMenu)window.Resources["MoreMenu"];
                Save(moreMenu, $"{theme}-moremenu");
                var card = FindAll<Border>(window).First(b => b.Name == "Card");
                card.ContextMenu.DataContext = card.DataContext;
                Save(card.ContextMenu, $"{theme}-cardmenu");

                // Copy click feedback
                var item = (Authenticator.AccountItem)card.DataContext;
                item.Flash("Copied");
                await Task.Delay(200);
                Save(window, $"{theme}-copied");

                // Dialogs: shown modally by the app, captured by a timer then closed.
                await Dialog(() => Authenticator.AccountWindow.Add(window), $"{theme}-addkey");
                await Dialog(() => Authenticator.AccountWindow.Add(window, "otpauth://hotp/Bank:me?secret=JBSWY3DPEHPK3PXP&counter=3&digits=8"), $"{theme}-addkey-filled");
                await Dialog(() => Authenticator.QrWindow.ShowAccount(window, item.Account), $"{theme}-qr");
                await Dialog(() => Authenticator.MessageDialog.Show(window, $"Delete {item.Account.DisplayName}?",
                    "Its codes will no longer be on this PC. Make sure you still have them on your phone.", "Delete", "Cancel", danger: true), $"{theme}-delete");
                await Dialog(() => Authenticator.PasswordWindow.AskNew(window), $"{theme}-password");
                await Dialog(() => window.GetType().GetMethod("ExportGoogle_Click", BindingFlags.NonPublic | BindingFlags.Instance)!
                    .Invoke(window, [window, new RoutedEventArgs()]), $"{theme}-export");
                window.Close();

                // Empty state, with a fresh data folder.
                string empty = Path.Combine(Path.GetTempPath(), "authtools-empty-" + Guid.NewGuid().ToString("N"));
                var emptyWindow = new Authenticator.MainWindow(empty);
                Offscreen(emptyWindow);
                emptyWindow.Show();
                await Task.Delay(800);
                Save(emptyWindow, $"{theme}-empty");
                emptyWindow.Close();
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
                exit = 1;
            }
            finally
            {
                app.Shutdown();
            }
        });
        app.Run();
        return exit;
    }

    static void Offscreen(Window window)
    {
        window.WindowStartupLocation = WindowStartupLocation.Manual;
        window.Left = -20000;
        window.Top = -20000;
        window.ShowActivated = false;
        window.ShowInTaskbar = false;
    }

    static async Task Dialog(Action show, string name)
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(700) };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            var dialog = Application.Current.Windows.Cast<Window>().LastOrDefault(w => w is not Authenticator.MainWindow && w.IsVisible);
            if (dialog == null)
            {
                Console.WriteLine($"no dialog for {name}");
                return;
            }
            Save(dialog, name);
            dialog.Close();
        };
        timer.Start();
        await Task.Yield();
        show();
    }

    static IEnumerable<T> FindAll<T>(DependencyObject root) where T : DependencyObject
    {
        for (int i = 0; i < VisualTreeHelper.GetChildrenCount(root); i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child is T t) yield return t;
            foreach (var x in FindAll<T>(child)) yield return x;
        }
    }

    static void Save(FrameworkElement element, string name)
    {
        if (element is not Window)
        {
            element.Measure(new Size(double.PositiveInfinity, double.PositiveInfinity));
            element.Arrange(new Rect(element.DesiredSize));
            element.UpdateLayout();
        }
        var root = element is Window win ? (FrameworkElement)VisualTreeHelper.GetChild(win, 0) : element;
        double w = root.ActualWidth, h = root.ActualHeight;
        const double scale = 1.5;
        var bmp = new RenderTargetBitmap((int)(w * scale), (int)(h * scale), 96 * scale, 96 * scale, PixelFormats.Pbgra32);
        if (element is Window window)
        {
            // Window content plus its background.
            var visual = new DrawingVisual();
            using (var dc = visual.RenderOpen())
            {
                dc.DrawRectangle(window.Background, null, new Rect(0, 0, w, h));
                dc.DrawRectangle(new VisualBrush(root)
                {
                    Stretch = Stretch.None, AlignmentX = AlignmentX.Left, AlignmentY = AlignmentY.Top,
                    ViewboxUnits = BrushMappingMode.Absolute, Viewbox = new Rect(0, 0, w, h),
                }, null, new Rect(0, 0, w, h));
            }
            bmp.Render(visual);
        }
        else
        {
            bmp.Render(element);
        }
        var path = Path.Combine(outDir, name + ".png");
        using var fs = File.Create(path);
        var enc = new PngBitmapEncoder();
        enc.Frames.Add(BitmapFrame.Create(bmp));
        enc.Save(fs);
        Console.WriteLine($"saved {name} ({w:0}x{h:0})");
    }
}
