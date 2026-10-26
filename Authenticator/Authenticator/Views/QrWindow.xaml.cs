using System.Windows;
using Authenticator.Core;

namespace Authenticator;

/// <summary>Shows QR codes for another device to scan: one account, or a Google Authenticator export in pages.</summary>
public partial class QrWindow : Window
{
    IReadOnlyList<string> links = [];
    IReadOnlyList<string> captions = [];
    int page;

    QrWindow()
    {
        InitializeComponent();
        Theme.Attach(this);
    }

    public static void ShowAccount(Window owner, Account account)
    {
        var window = new QrWindow();
        window.HeadingText.Text = account.DisplayName;
        window.IntroText.Text = "Scan this with another authenticator app to add the same account there, or type in the setup key.";
        window.links = [OtpUri.Build(account)];
        window.captions = [""];
        window.PageText.Visibility = Visibility.Collapsed;
        window.PagerPanel.Visibility = Visibility.Collapsed;
        window.KeyText.Text = Base32.Group(account.Secret);
        window.DetailsText.Text = account.Type == OtpType.Hotp
            ? $"Counter-based · {account.Digits} digits · {Otp.AlgorithmName(account.Algorithm)} · counter {account.Counter}"
            : $"Time-based · {account.Digits} digits · {Otp.AlgorithmName(account.Algorithm)} · new code every {account.Period} s";
        window.ShowPage(0);
        window.SetOwner(owner);
        window.ShowDialog();
    }

    public static void ShowExport(Window owner, IReadOnlyList<string> links, IReadOnlyList<string> captions, string? note)
    {
        var window = new QrWindow();
        window.HeadingText.Text = "Export to Google Authenticator";
        window.IntroText.Text = "In Google Authenticator on your phone, open the menu, choose Transfer accounts › Import accounts, and scan "
            + (links.Count > 1 ? "each of these QR codes." : "this QR code.") + (note != null ? Environment.NewLine + Environment.NewLine + note : "");
        window.links = links;
        window.captions = captions;
        window.KeyPanel.Visibility = Visibility.Collapsed;
        if (links.Count == 1)
            window.PagerPanel.Visibility = Visibility.Collapsed;
        window.ShowPage(0);
        window.SetOwner(owner);
        window.ShowDialog();
    }

    void ShowPage(int index)
    {
        page = index;
        QrImage.Source = QrCodes.Render(links[page]);
        PageText.Text = links.Count > 1 ? $"QR code {page + 1} of {links.Count} · {captions[page]}" : captions[page];
        PrevButton.IsEnabled = page > 0;
        NextButton.IsEnabled = page < links.Count - 1;
    }

    void Prev_Click(object sender, RoutedEventArgs e) => ShowPage(page - 1);

    void Next_Click(object sender, RoutedEventArgs e) => ShowPage(page + 1);

    void CopyKey_Click(object sender, RoutedEventArgs e)
    {
        if (ClipboardHelper.SetText(KeyText.Text.Replace(" ", ""), sensitive: true))
            DetailsText.Text = "Key copied.";
    }
}
