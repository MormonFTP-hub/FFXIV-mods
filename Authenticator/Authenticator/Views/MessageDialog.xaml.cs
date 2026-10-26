using System.Windows;

namespace Authenticator;

public partial class MessageDialog : Window
{
    MessageDialog()
    {
        InitializeComponent();
        Theme.Attach(this);
    }

    /// <summary>Returns true when the primary button was clicked.</summary>
    public static bool Show(Window? owner, string heading, string message, string primary = "OK", string? secondary = null, bool danger = false)
    {
        var dialog = new MessageDialog();
        dialog.HeadingText.Text = heading;
        dialog.BodyText.Text = message;
        dialog.PrimaryButton.Content = primary;
        if (danger)
            dialog.PrimaryButton.Style = (Style)dialog.FindResource("DangerButton");
        if (secondary == null)
        {
            dialog.SecondaryButton.Visibility = Visibility.Collapsed;
            dialog.PrimaryButton.IsCancel = true;
        }
        else
        {
            dialog.SecondaryButton.Content = secondary;
        }
        dialog.SetOwner(owner);
        return dialog.ShowDialog() == true;
    }

    void Primary_Click(object sender, RoutedEventArgs e) => DialogResult = true;

    void Secondary_Click(object sender, RoutedEventArgs e) => DialogResult = false;
}

static class DialogExtensions
{
    /// <summary>Centres on the owner when it's showing, otherwise on the screen.</summary>
    public static void SetOwner(this Window dialog, Window? owner)
    {
        if (owner is { IsVisible: true })
            dialog.Owner = owner;
        else
            dialog.WindowStartupLocation = WindowStartupLocation.CenterScreen;
    }
}
