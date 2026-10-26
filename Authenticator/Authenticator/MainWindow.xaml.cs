using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Authenticator.Core;
using Microsoft.Win32;

namespace Authenticator;

public partial class MainWindow : Window
{
    public const string HelpMessage =
        "1.  In Google Authenticator on your phone, open the menu and choose Transfer accounts › Export accounts.\n" +
        "2.  Get that QR code onto this PC. If your phone lets you take a screenshot of it, send the screenshot here. " +
        "If it blocks screenshots (Android does), take a photo of the screen with another phone or camera.\n" +
        "3.  Open the picture with Open QR code image, drag it onto this window, or copy it and press Ctrl⁠+⁠V. " +
        "Big exports come as several QR codes: add each one.\n\n" +
        "Or add accounts one at a time: on a site's 2-step verification page, set up an authenticator app and use " +
        "Scan QR code on screen while its QR code is showing. You can scan the same QR code with your phone too, so both show the codes.";

    readonly string dataFolder;
    readonly Vault vault;
    readonly AppSettings settings;
    readonly ObservableCollection<AccountItem> items = [];
    readonly ICollectionView view;
    readonly Importer importer = new();
    readonly DispatcherTimer timer;
    bool busy;

    public MainWindow(string folder)
    {
        InitializeComponent();
        Theme.Attach(this);
        dataFolder = folder;
        settings = AppSettings.Load(folder);
        RestorePlacement();
        HelpText.Text = HelpMessage;

        vault = new Vault(folder);
        vault.Load();
        foreach (var account in vault.Accounts)
            items.Add(new AccountItem(account));
        view = CollectionViewSource.GetDefaultView(items);
        view.Filter = Matches;
        AccountList.ItemsSource = view;
        UpdateListState();

        timer = new DispatcherTimer(TimeSpan.FromMilliseconds(100), DispatcherPriority.Render, (_, _) => Tick(), Dispatcher);
        timer.Start();
        Loaded += OnLoaded;
        Closing += (_, _) => SavePlacement();
    }

    async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (vault.LoadError != null)
        {
            MessageDialog.Show(this, "Your saved accounts couldn't be opened",
                "The account file exists but this Windows user can't decrypt it (it only opens for the Windows account that saved it). " +
                "To keep it safe, this window won't save anything over it. Your phone still has your codes.\n\n" +
                $"Folder: {vault.Folder}\n\n{vault.LoadError}");
        }
        else if (vault.RecoveredFromBackup)
        {
            ShowToast("The account file was damaged, so the previous copy was loaded.");
        }

        UpdateStatus();
        await TimeSync.SyncAsync();
        clockChecked = true;
        UpdateStatus();
    }

    bool clockChecked;

    void Tick()
    {
        var now = TimeSync.Now;
        foreach (var item in items)
            item.Tick(now);
    }

    public void BringToFront()
    {
        if (!IsVisible)
            Show();
        if (WindowState == WindowState.Minimized)
            WindowState = WindowState.Normal;
        Activate();
        Topmost = true;
        Topmost = settings.AlwaysOnTop;
    }

    // ---- List ----

    bool Matches(object obj)
    {
        string query = SearchBox.Text.Trim();
        if (query.Length == 0 || obj is not AccountItem item)
            return true;
        return item.Title.Contains(query, StringComparison.CurrentCultureIgnoreCase)
            || item.Subtitle.Contains(query, StringComparison.CurrentCultureIgnoreCase);
    }

    void UpdateListState()
    {
        bool none = items.Count == 0;
        EmptyState.Visibility = none ? Visibility.Visible : Visibility.Collapsed;
        ListScroller.Visibility = none ? Visibility.Collapsed : Visibility.Visible;
        NoMatches.Visibility = !none && view.IsEmpty ? Visibility.Visible : Visibility.Collapsed;
        UpdateStatus();
    }

    void UpdateStatus()
    {
        var parts = new List<string> { items.Count == 1 ? "1 account" : $"{items.Count} accounts" };
        if (vault.LoadError != null)
            parts.Add("read-only");
        if (clockChecked)
        {
            if (!TimeSync.IsSynced)
                parts.Add("couldn't check the clock (offline?)");
            else if (TimeSync.Offset.Duration() >= TimeSpan.FromSeconds(2))
                parts.Add($"PC clock is {TimeSync.Offset.Duration().TotalSeconds:0} s {(TimeSync.Offset < TimeSpan.Zero ? "fast" : "slow")}, codes corrected");
            else
                parts.Add("clock checked");
        }
        StatusText.Text = string.Join("  ·  ", parts);
    }

    void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
    {
        view.Refresh();
        UpdateListState();
    }

    void SearchBox_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && view.Cast<AccountItem>().FirstOrDefault() is { } first)
        {
            CopyCode(first);
            e.Handled = true;
        }
        else if (e.Key == Key.Escape && SearchBox.Text.Length > 0)
        {
            SearchBox.Clear();
            e.Handled = true;
        }
    }

    void Window_PreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (Keyboard.Modifiers != ModifierKeys.Control)
            return;
        switch (e.Key)
        {
            case Key.V:
                // Plain text into the search box stays a normal paste.
                if (SearchBox.IsKeyboardFocused && Clipboard.ContainsText() && !LooksImportable(Clipboard.GetText()))
                    return;
                e.Handled = true;
                Paste();
                break;
            case Key.O:
                e.Handled = true;
                OpenImage_Click(sender, e);
                break;
            case Key.N:
                e.Handled = true;
                EnterKey_Click(sender, e);
                break;
            case Key.F:
                e.Handled = true;
                SearchBox.Focus();
                SearchBox.SelectAll();
                break;
        }
    }

    static bool LooksImportable(string text) => OtpUri.IsOtpAuth(text) || GoogleMigration.IsMigration(text);

    // ---- Copying ----

    AccountItem? pressedItem;

    void Card_MouseLeftButtonDown(object sender, MouseButtonEventArgs e) => pressedItem = ItemOf(sender);

    void Card_MouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        // Only a click that started on this card (not the end of a scroll-bar drag).
        if (ItemOf(sender) is { } item && item == pressedItem)
            CopyCode(item);
        pressedItem = null;
    }

    void CopyCode(AccountItem item)
    {
        if (!item.HasCode)
        {
            NextHotp(item);
            if (!item.HasCode)
                return;
        }
        if (ClipboardHelper.SetText(item.RawCode))
            item.Flash("Copied");
        else
            ShowToast("Couldn't copy: another app is using the clipboard.");
    }

    void CopyCode_Click(object sender, RoutedEventArgs e)
    {
        if (ItemOf(sender) is { } item)
            CopyCode(item);
    }

    void CopyNextCode_Click(object sender, RoutedEventArgs e)
    {
        if (ItemOf(sender) is not { } item)
            return;
        var now = TimeSync.Now;
        if (ClipboardHelper.SetText(item.NextTotpCode(now)))
            item.Flash($"Next code copied (valid in {(int)Math.Ceiling(Otp.SecondsLeft(now, item.Account.Period))} s)");
    }

    void NextHotp_Click(object sender, RoutedEventArgs e)
    {
        if (ItemOf(sender) is { } item)
            NextHotp(item);
    }

    void NextHotp(AccountItem item)
    {
        if (!CanEdit())
            return;
        item.NextHotpCode();
        SaveVault();
    }

    static AccountItem? ItemOf(object sender) => (sender as FrameworkElement)?.DataContext as AccountItem;

    // ---- Account actions ----

    void Rename_Click(object sender, RoutedEventArgs e)
    {
        if (ItemOf(sender) is not { } item || !CanEdit())
            return;
        var before = item.Account.Clone();
        if (!AccountWindow.Rename(this, item.Account))
            return;
        if (!SaveVault())
        {
            item.Account.Issuer = before.Issuer;
            item.Account.Name = before.Name;
        }
        item.Refresh();
        view.Refresh();
    }

    void ShowQr_Click(object sender, RoutedEventArgs e)
    {
        if (ItemOf(sender) is { } item)
            QrWindow.ShowAccount(this, item.Account);
    }

    void MoveUp_Click(object sender, RoutedEventArgs e) => Move(ItemOf(sender), -1);

    void MoveDown_Click(object sender, RoutedEventArgs e) => Move(ItemOf(sender), +1);

    void Move(AccountItem? item, int delta)
    {
        if (item == null || !CanEdit())
            return;
        int from = items.IndexOf(item), to = from + delta;
        if (from < 0 || to < 0 || to >= items.Count)
            return;
        items.Move(from, to);
        vault.Accounts.RemoveAt(from);
        vault.Accounts.Insert(to, item.Account);
        SaveVault();
    }

    void Delete_Click(object sender, RoutedEventArgs e)
    {
        if (ItemOf(sender) is not { } item || !CanEdit())
            return;
        bool confirmed = MessageDialog.Show(this, $"Delete {item.Account.DisplayName}?",
            "Its codes will no longer be on this PC. Make sure you still have them on your phone (or have turned off 2-step verification for it), " +
            "or you could be locked out of the account.",
            "Delete", "Cancel", danger: true);
        if (!confirmed)
            return;
        int index = items.IndexOf(item);
        items.RemoveAt(index);
        vault.Accounts.Remove(item.Account);
        if (!SaveVault())
        {
            items.Insert(index, item);
            vault.Accounts.Insert(index, item.Account);
        }
        UpdateListState();
    }

    // ---- Adding ----

    void AddButton_Click(object sender, RoutedEventArgs e) => OpenMenu("AddMenu", AddButton);

    void MoreButton_Click(object sender, RoutedEventArgs e)
    {
        var menu = (ContextMenu)Resources["MoreMenu"];
        foreach (var menuItem in menu.Items.OfType<MenuItem>().Where(i => i.IsCheckable))
            menuItem.IsChecked = settings.AlwaysOnTop;
        OpenMenu("MoreMenu", MoreButton);
    }

    void OpenMenu(string key, Button button)
    {
        var menu = (ContextMenu)Resources[key];
        menu.PlacementTarget = button;
        menu.IsOpen = true;
    }

    async void ScanScreen_Click(object sender, RoutedEventArgs e)
    {
        if (busy || !CanEdit())
            return;
        busy = true;
        try
        {
            // Step out of the way so this window doesn't cover the QR code.
            Hide();
            await Task.Delay(350);
            PixelImage screen;
            try
            {
                screen = QrCodes.CaptureScreen();
            }
            finally
            {
                BringToFront();
            }
            StatusText.Text = "Looking for QR codes…";
            Cursor = Cursors.Wait;
            var texts = await Task.Run(() => QrCodes.Read(screen));
            Cursor = null;
            UpdateStatus();
            if (texts.Count == 0)
            {
                MessageDialog.Show(this, "No QR code found on screen",
                    "Make sure the whole QR code is showing on one of your screens and isn't covered by another window, then try again. " +
                    "If it's tiny, zoom in on the page first.");
                return;
            }
            ImportTexts(texts);
        }
        finally
        {
            Cursor = null;
            busy = false;
        }
    }

    async void OpenImage_Click(object sender, RoutedEventArgs e)
    {
        if (busy || !CanEdit())
            return;
        var dialog = new OpenFileDialog
        {
            Title = "Open QR code image",
            Filter = "Pictures|*.png;*.jpg;*.jpeg;*.jfif;*.bmp;*.gif;*.tif;*.tiff;*.webp;*.heic;*.heif|Authenticator backups|*" + BackupFile.Extension + "|All files|*.*",
            Multiselect = true,
        };
        if (dialog.ShowDialog(this) == true)
            await ImportFilesAsync(dialog.FileNames);
    }

    void Paste_Click(object sender, RoutedEventArgs e) => Paste();

    async void Paste()
    {
        if (busy || !CanEdit())
            return;
        try
        {
            if (Clipboard.ContainsFileDropList())
            {
                await ImportFilesAsync(Clipboard.GetFileDropList().Cast<string>().ToArray());
                return;
            }
            if (ClipboardImage() is { } image)
            {
                await ImportImagesAsync([("the copied picture", () => QrCodes.FromBitmap(image))]);
                return;
            }
            if (Clipboard.ContainsText())
            {
                string text = Clipboard.GetText().Trim();
                var links = text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(LooksImportable).ToList();
                if (links.Count > 0)
                {
                    ImportTexts(links);
                    return;
                }
                // A bare setup key: at least 16 Base32 characters, like sites show.
                if (Base32.TryDecode(text, out var key) && key.Length >= 10 && text.Length <= 128)
                {
                    AddManually(text);
                    return;
                }
            }
        }
        catch (System.Runtime.InteropServices.ExternalException ex)
        {
            MessageDialog.Show(this, "Couldn't read the clipboard", ex.Message);
            return;
        }
        MessageDialog.Show(this, "Nothing to paste",
            "Copy a picture of a QR code (or its file), an otpauth:// link, or a setup key, then paste again.");
    }

    /// <summary>Browsers put a PNG on the clipboard as well as a bitmap; the PNG keeps its colours intact.</summary>
    static BitmapSource? ClipboardImage()
    {
        if (Clipboard.GetData("PNG") is MemoryStream png)
        {
            try
            {
                return BitmapFrame.Create(png, BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
            }
            catch (Exception ex) when (ex is NotSupportedException or FileFormatException) { }
        }
        return Clipboard.ContainsImage() ? Clipboard.GetImage() : null;
    }

    void EnterKey_Click(object sender, RoutedEventArgs e)
    {
        if (!busy && CanEdit())
            AddManually(null);
    }

    void AddManually(string? key)
    {
        if (AccountWindow.Add(this, key) is { } account)
            ApplyImport(Importer.Import([account], vault.Accounts));
    }

    void Window_DragOver(object sender, DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop) || e.Data.GetDataPresent(DataFormats.UnicodeText)
            ? DragDropEffects.Copy
            : DragDropEffects.None;
        e.Handled = true;
    }

    async void Window_Drop(object sender, DragEventArgs e)
    {
        if (busy || !CanEdit())
            return;
        if (e.Data.GetData(DataFormats.FileDrop) is string[] files)
            await ImportFilesAsync(files);
        else if (e.Data.GetData(DataFormats.UnicodeText) is string text && LooksImportable(text))
            ImportTexts(text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Where(LooksImportable));
    }

    async Task ImportFilesAsync(IReadOnlyList<string> files)
    {
        var images = new List<(string, Func<PixelImage>)>();
        foreach (var file in files)
        {
            if (file.EndsWith(BackupFile.Extension, StringComparison.OrdinalIgnoreCase) || BackupFile.LooksLikeBackup(file))
                await RestoreBackupAsync(file);
            else
                images.Add((Path.GetFileName(file), () => QrCodes.LoadImage(file)));
        }
        if (images.Count > 0)
            await ImportImagesAsync(images);
    }

    async Task ImportImagesAsync(IReadOnlyList<(string Name, Func<PixelImage> Load)> images)
    {
        busy = true;
        Cursor = Cursors.Wait;
        StatusText.Text = "Looking for QR codes…";
        var texts = new List<string>();
        var problems = new List<string>();
        try
        {
            foreach (var (name, load) in images)
            {
                try
                {
                    var image = load();
                    var found = await Task.Run(() => QrCodes.Read(image));
                    if (found.Count == 0)
                        problems.Add($"No QR code found in {name}.");
                    texts.AddRange(found);
                }
                catch (Exception ex) when (ex is IOException or NotSupportedException or FileFormatException or UnauthorizedAccessException or ArgumentException or InvalidOperationException)
                {
                    problems.Add($"Couldn't open {name} as a picture.");
                }
            }
        }
        finally
        {
            Cursor = null;
            busy = false;
            UpdateStatus();
        }

        if (texts.Count == 0)
        {
            MessageDialog.Show(this, "No QR code found",
                string.Join("\n", problems) + "\n\nFor a photo of a phone screen: hold the camera straight on, fill most of the photo with the QR code, " +
                "and make sure it's sharp and without glare. A screenshot works best if the phone allows it.");
            return;
        }
        ImportTexts(texts, problems);
    }

    void ImportTexts(IEnumerable<string> texts, IReadOnlyList<string>? problems = null)
    {
        var result = importer.Import(texts, vault.Accounts);
        if (problems != null)
            result.Errors.InsertRange(0, problems);
        ApplyImport(result);
    }

    void ApplyImport(ImportResult result)
    {
        foreach (var account in result.Added)
        {
            vault.Accounts.Add(account);
            items.Add(new AccountItem(account));
        }
        if (result.Added.Count > 0 && !SaveVault())
        {
            foreach (var account in result.Added)
            {
                vault.Accounts.Remove(account);
                items.Remove(items.First(i => i.Account == account));
            }
            return;
        }
        if (result.Added.Count > 0 && SearchBox.Text.Length > 0)
            SearchBox.Clear();
        UpdateListState();

        bool simple = result.Errors.Count == 0 && result.Notes.Count == 0 && result.AlreadyThere.Count == 0 && result.OtherCodes == 0;
        if (simple && result.Added.Count == 1)
        {
            ShowToast($"Added {result.Added[0].DisplayName}");
            ScrollTo(result.Added[0]);
            return;
        }

        var lines = new List<string>();
        if (result.Added.Count > 0)
            lines.Add($"Added {Count(result.Added.Count)}:\n{NameList(result.Added)}");
        if (result.AlreadyThere.Count > 0)
            lines.Add($"Already here, so skipped: {NameList(result.AlreadyThere, inline: true)}");
        if (result.OtherCodes > 0 && result.Added.Count + result.AlreadyThere.Count == 0)
            lines.Add("The QR code was read, but it isn't an authenticator code. Use the one a site shows when you set up 2-step verification " +
                      "with an authenticator app, or Google Authenticator's Transfer accounts › Export accounts code.");
        lines.AddRange(result.Errors);
        lines.AddRange(result.Notes);

        string heading = result.Added.Count > 0 ? $"Added {Count(result.Added.Count)}"
            : result.AlreadyThere.Count > 0 ? "Nothing new to add"
            : "Nothing added";
        MessageDialog.Show(this, heading, string.Join("\n\n", lines));
        if (result.Added.Count > 0)
            ScrollTo(result.Added[0]);
    }

    static string Count(int n) => n == 1 ? "1 account" : $"{n} accounts";

    static string NameList(List<Account> accounts, bool inline = false)
    {
        var names = accounts.Take(12).Select(a => a.DisplayName).ToList();
        if (accounts.Count > names.Count)
            names.Add($"and {accounts.Count - names.Count} more");
        return inline ? string.Join(", ", names) : string.Join("\n", names.Select(n => "•  " + n));
    }

    void ScrollTo(Account account)
    {
        var item = items.FirstOrDefault(i => i.Account == account);
        if (item == null)
            return;
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, () =>
        {
            if (AccountList.ItemContainerGenerator.ContainerFromItem(item) is FrameworkElement container)
                container.BringIntoView();
        });
    }

    // ---- Export, backup, restore ----

    void ExportGoogle_Click(object sender, RoutedEventArgs e)
    {
        if (vault.Accounts.Count == 0)
        {
            MessageDialog.Show(this, "Nothing to export", "Add some accounts first.");
            return;
        }
        var exportable = vault.Accounts.Where(GoogleMigration.CanExport).ToList();
        int skipped = vault.Accounts.Count - exportable.Count;
        string? note = skipped > 0
            ? $"{Count(skipped)} use code settings Google Authenticator doesn't support (like 60-second codes) and are left out."
            : null;
        if (exportable.Count == 0)
        {
            MessageDialog.Show(this, "Nothing to export", note!);
            return;
        }
        var links = GoogleMigration.Build(exportable);
        var captions = links.Select(link =>
        {
            int n = GoogleMigration.Parse(link).Accounts.Count;
            return Count(n);
        }).ToList();
        QrWindow.ShowExport(this, links, captions, note);
    }

    async void Backup_Click(object sender, RoutedEventArgs e)
    {
        if (busy)
            return;
        if (vault.Accounts.Count == 0)
        {
            MessageDialog.Show(this, "Nothing to back up", "Add some accounts first.");
            return;
        }
        if (PasswordWindow.AskNew(this) is not { } password)
            return;
        var dialog = new SaveFileDialog
        {
            Title = "Save backup",
            FileName = $"Authenticator backup {DateTime.Now:yyyy-MM-dd}{BackupFile.Extension}",
            Filter = "Authenticator backups|*" + BackupFile.Extension,
            DefaultExt = BackupFile.Extension,
        };
        if (dialog.ShowDialog(this) != true)
            return;

        var snapshot = vault.Accounts.Select(a => a.Clone()).ToList();
        busy = true;
        Cursor = Cursors.Wait;
        try
        {
            await Task.Run(() => BackupFile.Write(dialog.FileName, snapshot, password));
            ShowToast($"Backed up {Count(snapshot.Count)} to {Path.GetFileName(dialog.FileName)}");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            MessageDialog.Show(this, "Couldn't save the backup", ex.Message);
        }
        finally
        {
            Cursor = null;
            busy = false;
        }
    }

    async void Restore_Click(object sender, RoutedEventArgs e)
    {
        if (busy || !CanEdit())
            return;
        var dialog = new OpenFileDialog
        {
            Title = "Restore from a backup",
            Filter = "Authenticator backups|*" + BackupFile.Extension + "|All files|*.*",
        };
        if (dialog.ShowDialog(this) == true)
            await RestoreBackupAsync(dialog.FileName);
    }

    async Task RestoreBackupAsync(string path)
    {
        if (!CanEdit())
            return;
        string? error = null;
        while (PasswordWindow.AskExisting(this, Path.GetFileName(path), error) is { } password)
        {
            busy = true;
            Cursor = Cursors.Wait;
            try
            {
                var accounts = await Task.Run(() => BackupFile.Read(path, password));
                ApplyImport(Importer.Import(accounts, vault.Accounts));
                return;
            }
            catch (WrongPasswordException)
            {
                error = "That password is wrong. Try again.";
            }
            catch (Exception ex) when (ex is FormatException or IOException or UnauthorizedAccessException)
            {
                MessageDialog.Show(this, "Couldn't restore the backup", ex.Message);
                return;
            }
            finally
            {
                Cursor = null;
                busy = false;
            }
        }
    }

    // ---- Other menu items ----

    void Help_Click(object sender, RoutedEventArgs e) => MessageDialog.Show(this, "Moving your codes from your phone", HelpMessage);

    void Topmost_Click(object sender, RoutedEventArgs e)
    {
        settings.AlwaysOnTop = ((MenuItem)sender).IsChecked;
        Topmost = settings.AlwaysOnTop;
        settings.Save(dataFolder);
    }

    void OpenDataFolder_Click(object sender, RoutedEventArgs e)
    {
        Directory.CreateDirectory(dataFolder);
        Process.Start(new ProcessStartInfo("explorer.exe", $"\"{dataFolder}\"") { UseShellExecute = true });
    }

    // ---- Helpers ----

    bool CanEdit()
    {
        if (vault.LoadError == null)
            return true;
        MessageDialog.Show(this, "Changes are switched off",
            "Your saved accounts couldn't be opened, so nothing is changed or saved over them. Use \"Open data folder\" from the ⋯ menu to look at the files.");
        return false;
    }

    bool SaveVault()
    {
        try
        {
            vault.Save();
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or InvalidOperationException or System.Security.Cryptography.CryptographicException)
        {
            MessageDialog.Show(this, "Couldn't save your accounts", ex.Message);
            return false;
        }
    }

    void ShowToast(string text)
    {
        ToastText.Text = text;
        var fade = new DoubleAnimationUsingKeyFrames();
        fade.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(150))));
        fade.KeyFrames.Add(new LinearDoubleKeyFrame(1, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(150 + 1800 + text.Length * 25))));
        fade.KeyFrames.Add(new LinearDoubleKeyFrame(0, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(150 + 2200 + text.Length * 25))));
        Toast.BeginAnimation(OpacityProperty, fade);
    }

    void RestorePlacement()
    {
        Topmost = settings.AlwaysOnTop;
        if (settings.Width is double w && settings.Height is double h && w >= MinWidth && h >= MinHeight)
        {
            Width = w;
            Height = h;
        }
        if (settings.Left is double left && settings.Top is double top)
        {
            // Only if it's still on a screen (monitors change).
            var screen = new Rect(SystemParameters.VirtualScreenLeft, SystemParameters.VirtualScreenTop,
                                  SystemParameters.VirtualScreenWidth, SystemParameters.VirtualScreenHeight);
            if (screen.Contains(new Point(left + 40, top + 20)) && screen.Contains(new Point(left + Width - 40, top + 40)))
            {
                WindowStartupLocation = WindowStartupLocation.Manual;
                Left = left;
                Top = top;
                return;
            }
        }
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
    }

    void SavePlacement()
    {
        var bounds = WindowState == WindowState.Normal ? new Rect(Left, Top, Width, Height) : RestoreBounds;
        if (bounds.IsEmpty)
            return;
        settings.Left = bounds.Left;
        settings.Top = bounds.Top;
        settings.Width = bounds.Width;
        settings.Height = bounds.Height;
        settings.Save(dataFolder);
    }
}
