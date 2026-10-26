using System.Security.Cryptography;
using System.Text;
using System.Windows;
using System.Windows.Threading;
using Authenticator.Core;

namespace Authenticator;

public partial class App : Application
{
    Mutex? instanceMutex;
    EventWaitHandle? showEvent;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // One window per data folder: starting it again just brings the open one to the front.
        string folder = Vault.DefaultFolder;
        string id = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(folder.ToLowerInvariant())))[..16];
        instanceMutex = new Mutex(true, $@"Local\Authenticator-{id}", out bool first);
        showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, $@"Local\Authenticator-show-{id}");
        if (!first)
        {
            showEvent.Set();
            Shutdown();
            return;
        }
        new Thread(() =>
        {
            while (showEvent.WaitOne())
                Dispatcher.BeginInvoke(() => (MainWindow as MainWindow)?.BringToFront());
        }) { IsBackground = true, Name = "show-signal" }.Start();

        DispatcherUnhandledException += OnUnhandledException;
        Theme.Apply();
        var window = new MainWindow(folder);
        MainWindow = window;
        window.Show();
    }

    void OnUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        e.Handled = true;
        try
        {
            File.AppendAllText(Path.Combine(Vault.DefaultFolder, "error.log"), $"{DateTime.Now:O}{Environment.NewLine}{e.Exception}{Environment.NewLine}{Environment.NewLine}");
        }
        catch { }
        MessageDialog.Show(MainWindow, "Something went wrong", e.Exception.Message, "OK");
    }

    protected override void OnExit(ExitEventArgs e)
    {
        instanceMutex?.Dispose();
        showEvent?.Dispose();
        base.OnExit(e);
    }
}
