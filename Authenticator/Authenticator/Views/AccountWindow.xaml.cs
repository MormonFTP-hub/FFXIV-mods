using System.Globalization;
using System.Windows;
using Authenticator.Core;

namespace Authenticator;

/// <summary>Adds an account from a typed setup key, or renames one.</summary>
public partial class AccountWindow : Window
{
    readonly Account? editing;
    Account? result;

    AccountWindow(Account? editing)
    {
        InitializeComponent();
        Theme.Attach(this);
        this.editing = editing;
        if (editing != null)
        {
            HeadingText.Text = "Rename";
            IntroText.Visibility = Visibility.Collapsed;
            KeySection.Visibility = Visibility.Collapsed;
            SaveButton.Content = "Save";
            IssuerBox.Text = editing.Issuer;
            NameBox.Text = editing.Name;
        }
        Loaded += (_, _) => (editing == null && IssuerBox.Text.Length > 0 ? KeyBox : IssuerBox).Focus();
    }

    public static Account? Add(Window owner, string? key = null)
    {
        var window = new AccountWindow(null);
        if (key != null)
            window.KeyBox.Text = key;
        window.SetOwner(owner);
        return window.ShowDialog() == true ? window.result : null;
    }

    public static bool Rename(Window owner, Account account)
    {
        var window = new AccountWindow(account);
        window.SetOwner(owner);
        if (window.ShowDialog() != true)
            return false;
        account.Issuer = window.IssuerBox.Text.Trim();
        account.Name = window.NameBox.Text.Trim();
        return true;
    }

    void KeyBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        // A pasted otpauth:// link fills in everything.
        string text = KeyBox.Text.Trim();
        if (!OtpUri.IsOtpAuth(text))
            return;
        try
        {
            var account = OtpUri.Parse(text);
            IssuerBox.Text = account.Issuer;
            NameBox.Text = account.Name;
            (account.Type == OtpType.Hotp ? HotpRadio : TotpRadio).IsChecked = true;
            (account.Digits switch { 7 => Digits7, 8 => Digits8, _ => Digits6 }).IsChecked = true;
            (account.Algorithm switch { OtpAlgorithm.Sha256 => Sha256Radio, OtpAlgorithm.Sha512 => Sha512Radio, _ => Sha1Radio }).IsChecked = true;
            PeriodBox.Text = account.Period.ToString(CultureInfo.InvariantCulture);
            CounterBox.Text = account.Counter.ToString(CultureInfo.InvariantCulture);
            KeyBox.Text = Base32.Group(account.Secret);
            KeyBox.CaretIndex = KeyBox.Text.Length;
            if (account.Digits != 6 || account.Algorithm != OtpAlgorithm.Sha1 || account.Period != 30 || account.Type == OtpType.Hotp)
                ShowOptions(true);
            ErrorText.Visibility = Visibility.Collapsed;
        }
        catch (FormatException ex)
        {
            ShowError(ex.Message);
        }
    }

    void Options_Click(object sender, RoutedEventArgs e) => ShowOptions(OptionsPanel.Visibility != Visibility.Visible);

    void ShowOptions(bool show)
    {
        OptionsPanel.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        OptionsChevron.Text = show ? "" : "";
    }

    void Type_Checked(object sender, RoutedEventArgs e)
    {
        if (PeriodPanel == null || CounterPanel == null)
            return; // still loading
        bool hotp = HotpRadio.IsChecked == true;
        PeriodPanel.Visibility = hotp ? Visibility.Collapsed : Visibility.Visible;
        CounterPanel.Visibility = hotp ? Visibility.Visible : Visibility.Collapsed;
    }

    void Save_Click(object sender, RoutedEventArgs e)
    {
        string issuer = IssuerBox.Text.Trim(), name = NameBox.Text.Trim();
        if (issuer.Length == 0 && name.Length == 0)
        {
            ShowError("Give the account a name, so you can tell it apart from the others.");
            IssuerBox.Focus();
            return;
        }
        if (editing != null)
        {
            DialogResult = true;
            return;
        }

        string key = KeyBox.Text;
        if (key.Trim().Length == 0)
        {
            ShowError("Enter the setup key the site shows you.");
            KeyBox.Focus();
            return;
        }
        if (!Base32.TryDecode(key, out var secret))
        {
            ShowError("That key has characters setup keys don't use. Keys only contain the letters A–Z and the digits 2–7.");
            KeyBox.Focus();
            return;
        }
        if (secret.Length < 5)
        {
            ShowError("That key looks too short. Check you copied all of it.");
            KeyBox.Focus();
            return;
        }

        var account = new Account
        {
            Issuer = issuer,
            Name = name,
            Secret = Base32.Encode(secret),
            Type = HotpRadio.IsChecked == true ? OtpType.Hotp : OtpType.Totp,
            Digits = Digits7.IsChecked == true ? 7 : Digits8.IsChecked == true ? 8 : 6,
            Algorithm = Sha256Radio.IsChecked == true ? OtpAlgorithm.Sha256 : Sha512Radio.IsChecked == true ? OtpAlgorithm.Sha512 : OtpAlgorithm.Sha1,
        };
        if (account.Type == OtpType.Totp)
        {
            if (!int.TryParse(PeriodBox.Text.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out int period) || period is < 1 or > 86400)
            {
                ShowError("The number of seconds per code should be a whole number, usually 30.");
                ShowOptions(true);
                PeriodBox.Focus();
                return;
            }
            account.Period = period;
        }
        else
        {
            if (!long.TryParse(CounterBox.Text.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out long counter))
            {
                ShowError("The counter should be a whole number, usually 0.");
                ShowOptions(true);
                CounterBox.Focus();
                return;
            }
            account.Counter = counter;
        }
        result = account;
        DialogResult = true;
    }

    void ShowError(string message)
    {
        ErrorText.Text = message;
        ErrorText.Visibility = Visibility.Visible;
    }
}
