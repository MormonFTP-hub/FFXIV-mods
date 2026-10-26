using System.Windows;

namespace Authenticator;

public partial class PasswordWindow : Window
{
    const int MinLength = 8;
    readonly bool confirm;

    PasswordWindow(bool confirm)
    {
        InitializeComponent();
        Theme.Attach(this);
        this.confirm = confirm;
        ConfirmPanel.Visibility = confirm ? Visibility.Visible : Visibility.Collapsed;
        Loaded += (_, _) => PasswordBox1.Focus();
    }

    /// <summary>Asks for a new backup password, twice.</summary>
    public static string? AskNew(Window owner)
    {
        var window = new PasswordWindow(confirm: true);
        window.HeadingText.Text = "Back up to a file";
        window.IntroText.Text = "Choose a password for the backup file. You'll need it to restore the backup, and it can't be recovered if you forget it.";
        window.OkButton.Content = "Next";
        window.SetOwner(owner);
        return window.ShowDialog() == true ? window.PasswordBox1.Password : null;
    }

    /// <summary>Asks for an existing backup's password.</summary>
    public static string? AskExisting(Window owner, string fileName, string? error)
    {
        var window = new PasswordWindow(confirm: false);
        window.HeadingText.Text = "Restore from a backup";
        window.IntroText.Text = $"Enter the password for {fileName}.";
        window.OkButton.Content = "Restore";
        if (error != null)
            window.ShowError(error);
        window.SetOwner(owner);
        return window.ShowDialog() == true ? window.PasswordBox1.Password : null;
    }

    void Ok_Click(object sender, RoutedEventArgs e)
    {
        string password = PasswordBox1.Password;
        if (password.Length == 0)
        {
            ShowError("Enter a password.");
            return;
        }
        if (confirm)
        {
            if (password.Length < MinLength)
            {
                ShowError($"Use at least {MinLength} characters.");
                return;
            }
            if (password != PasswordBox2.Password)
            {
                ShowError("The two passwords are different.");
                PasswordBox2.Clear();
                PasswordBox2.Focus();
                return;
            }
        }
        DialogResult = true;
    }

    void ShowError(string message)
    {
        ErrorText.Text = message;
        ErrorText.Visibility = Visibility.Visible;
    }
}
