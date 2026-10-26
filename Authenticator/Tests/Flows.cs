using System.IO;
using System.Reflection;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Authenticator;
using Authenticator.Core;

/// <summary>Drives MainWindow's own handlers off-screen against a temp data folder: flows</summary>
static class Flows
{
    static int failures;
    static readonly List<string> dialogText = [];

    static void Check(bool ok, string what)
    {
        Console.WriteLine($"{(ok ? "PASS" : "FAIL")}  {what}");
        if (!ok) failures++;
    }

    public static int Run()
    {
        string data = Path.Combine(Path.GetTempPath(), "authtools-flows-" + Guid.NewGuid().ToString("N"));
        Environment.SetEnvironmentVariable("AUTHENTICATOR_DATA", data);
        var app = new App();
        app.InitializeComponent();
        app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
        typeof(MainWindow).Assembly.GetType("Authenticator.Theme")!.GetMethod("Apply")!.Invoke(null, null);

        app.Dispatcher.BeginInvoke(async () =>
        {
            try
            {
                var w = new MainWindow(data);
                w.WindowStartupLocation = WindowStartupLocation.Manual;
                w.Left = w.Top = -20000;
                w.ShowActivated = false;
                w.ShowInTaskbar = false;
                w.Show();
                await Task.Delay(300);
                var items = (System.Collections.ObjectModel.ObservableCollection<AccountItem>)Field(w, "items");

                var three = new List<Account>
                {
                    new() { Issuer = "Alpha", Name = "a@x", Secret = "GEZDGNBVGY3TQOJQGEZDGNBV" },
                    new() { Issuer = "Beta", Name = "b@x", Secret = "MFRGGZDFMZTWQ2LKNNWG23TP" },
                    new() { Issuer = "Gamma", Name = "c@x", Secret = "ONSWG4TFOQYTEMZUGU3DOOBZ", Digits = 8 },
                };
                var link = GoogleMigration.Build(three).Single();

                await Dialog(() => Call(w, "ImportTexts", new List<string> { link }, null), accept: false);
                Check(items.Count == 3 && dialogText.Last().Contains("Added 3 accounts"), $"import Google export: {items.Count} items, dialog '{First(dialogText.Last())}'");
                var reloaded = new Vault(data);
                reloaded.Load();
                Check(reloaded.Accounts.Count == 3 && reloaded.Accounts[2].Digits == 8, "saved to vault");

                await Dialog(() => Call(w, "ImportTexts", new List<string> { link }, null), accept: false);
                Check(items.Count == 3 && dialogText.Last().Contains("Nothing new to add"), "re-import skips duplicates");

                // A QR picture file, as if opened or dropped.
                string png = Path.Combine(data, "qr.png");
                var qr = new TransformedBitmap(QrCodes.Render("otpauth://totp/Delta:d@x?secret=JBSWY3DPEHPK3PXP&issuer=Delta"), new ScaleTransform(5, 5));
                using (var fs = File.Create(png))
                {
                    var e = new PngBitmapEncoder();
                    e.Frames.Add(BitmapFrame.Create(qr));
                    e.Save(fs);
                }
                int before = dialogText.Count;
                Task? pending = null;
                await Dialog(() => pending = (Task)Call(w, "ImportFilesAsync", (object)new[] { png })!, accept: false);
                await pending!;
                Check(items.Count == 4 && items[3].Title == "Delta" && dialogText.Count == before,
                    $"import from picture file (toast, no dialog){(dialogText.Count > before ? ": " + dialogText.Last() : "")}");

                // Not an authenticator QR code
                await Dialog(() => Call(w, "ImportTexts", new List<string> { "https://example.com" }, null), accept: false);
                Check(dialogText.Last().Contains("isn't an authenticator code"), "plain link QR explained");

                // Move down, then delete with confirmation.
                Call(w, "MoveDown_Click", new Button { DataContext = items[0] }, new RoutedEventArgs());
                Check(items[0].Title == "Beta" && items[1].Title == "Alpha", "move down");
                await Dialog(() => Call(w, "Delete_Click", new Button { DataContext = items[1] }, new RoutedEventArgs()), accept: false);
                Check(items.Count == 4, "delete cancelled keeps it");
                await Dialog(() => Call(w, "Delete_Click", new Button { DataContext = items[1] }, new RoutedEventArgs()), accept: true);
                Check(items.Count == 3 && items.All(i => i.Title != "Alpha"), "delete confirmed removes it");
                reloaded = new Vault(data);
                reloaded.Load();
                Check(reloaded.Accounts.Select(a => a.Issuer).SequenceEqual(["Beta", "Gamma", "Delta"]), "order and delete saved");

                // Search filter (clipboard left alone).
                var search = (TextBox)w.FindName("SearchBox");
                search.Text = "gam";
                var view = (System.ComponentModel.ICollectionView)Field(w, "view");
                Check(view.Cast<AccountItem>().Select(i => i.Title).SequenceEqual(["Gamma"]), "search filter");
                search.Text = "zzz";
                Check(((FrameworkElement)w.FindName("NoMatches")).Visibility == Visibility.Visible, "no-match message");
                search.Text = "";

                var gamma = items.First(i => i.Title == "Gamma");
                gamma.Tick(TimeSync.Now);
                Check(gamma.RawCode == Otp.Totp(gamma.Account, TimeSync.Now) && gamma.RawCode.Length == 8, $"card shows the right code ({gamma.Code})");

                w.Close();
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
                failures++;
            }
            finally
            {
                app.Shutdown();
                try { Directory.Delete(data, true); } catch { }
            }
        });
        app.Run();
        Console.WriteLine(failures == 0 ? "ALL PASSED" : $"{failures} FAILED");
        return failures == 0 ? 0 : 1;
    }

    static string First(string s) => s.Split('\n')[0];

    static object Field(object o, string name) => o.GetType().GetField(name, BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(o)!;

    static object? Call(object o, string name, params object?[] args) =>
        o.GetType().GetMethod(name, BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Public)!.Invoke(o, args);

    /// <summary>Runs something that may open a modal dialog; records its text and closes it (or clicks its primary button).</summary>
    static async Task Dialog(Action show, bool accept)
    {
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(300) };
        timer.Tick += (_, _) =>
        {
            var dialog = Application.Current.Windows.Cast<Window>().LastOrDefault(x => x is MessageDialog && x.IsVisible);
            if (dialog == null)
                return;
            timer.Stop();
            var heading = ((TextBlock)dialog.FindName("HeadingText")).Text;
            var body = ((TextBlock)dialog.FindName("BodyText")).Text;
            dialogText.Add(heading + "\n" + body);
            if (accept)
                ((Button)dialog.FindName("PrimaryButton")).RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
            else
                dialog.Close();
        };
        timer.Start();
        await Task.Yield();
        show();
        await Task.Delay(1500);
        timer.Stop();
    }
}
