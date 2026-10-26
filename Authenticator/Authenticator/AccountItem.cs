using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Media;
using Authenticator.Core;

namespace Authenticator;

/// <summary>One account card in the list: the code and countdown, refreshed by the main window's timer.</summary>
public sealed class AccountItem : INotifyPropertyChanged
{
    static readonly Color[] AvatarColors = new[] { "#1A73E8", "#D93025", "#188038", "#E37400", "#9334E6", "#007B83", "#C5221F", "#5F6368", "#B06000", "#3367D6" }
        .Select(c => (Color)ColorConverter.ConvertFromString(c)).ToArray();

    byte[] key;
    long shownStep = long.MinValue;
    bool hotpRevealed;

    public AccountItem(Account account)
    {
        Account = account;
        key = account.SecretBytes();
        Refresh();
    }

    public Account Account { get; }

    public string Title => Account.Issuer.Length > 0 ? Account.Issuer : Account.Name.Length > 0 ? Account.Name : "Unnamed account";
    public string Subtitle => Account.Issuer.Length > 0 ? Account.Name : "";
    public bool HasSubtitle => Subtitle.Length > 0;
    public string Initial => Title.FirstOrDefault(char.IsLetterOrDigit) is var c and not '\0' ? char.ToUpperInvariant(c).ToString() : "?";

    public Brush AvatarBrush
    {
        get
        {
            // FNV-1a, so an account keeps its colour between runs.
            uint hash = 2166136261;
            foreach (char c in Title.ToLowerInvariant())
                hash = (hash ^ c) * 16777619;
            var brush = new SolidColorBrush(AvatarColors[hash % (uint)AvatarColors.Length]);
            brush.Freeze();
            return brush;
        }
    }

    public bool IsTotp => Account.Type == OtpType.Totp;
    public bool IsHotp => Account.Type == OtpType.Hotp;

    public string Code { get; private set; } = "";
    /// <summary>The code without the space, for copying.</summary>
    public string RawCode { get; private set; } = "";
    public int SecondsLeft { get; private set; }
    public double Progress { get; private set; }
    public bool IsExpiring { get; private set; }
    public bool HasCode => RawCode.Length > 0;

    public string? FlashText { get; private set; }

    public event PropertyChangedEventHandler? PropertyChanged;

    /// <summary>Called after the account is renamed or edited.</summary>
    public void Refresh()
    {
        key = Account.SecretBytes();
        shownStep = long.MinValue;
        OnChanged(nameof(Title));
        OnChanged(nameof(Subtitle));
        OnChanged(nameof(HasSubtitle));
        OnChanged(nameof(Initial));
        OnChanged(nameof(AvatarBrush));
        Tick(TimeSync.Now);
    }

    public void Tick(DateTimeOffset now)
    {
        if (Account.Type == OtpType.Hotp)
        {
            // Like Google Authenticator: the code stays hidden until you ask for the next one.
            SetCode(hotpRevealed ? Otp.Generate(key, Account.Counter, Account.Digits, Account.Algorithm) : "");
            return;
        }

        long step = Otp.TimeStep(now, Account.Period);
        if (step != shownStep)
        {
            shownStep = step;
            SetCode(Otp.Generate(key, step, Account.Digits, Account.Algorithm));
        }
        double left = Otp.SecondsLeft(now, Account.Period);
        int seconds = (int)Math.Ceiling(left);
        double progress = left / Account.Period;
        if (seconds != SecondsLeft)
        {
            SecondsLeft = seconds;
            OnChanged(nameof(SecondsLeft));
            bool expiring = seconds <= 5 && Account.Period >= 15;
            if (expiring != IsExpiring)
            {
                IsExpiring = expiring;
                OnChanged(nameof(IsExpiring));
            }
        }
        if (Math.Abs(progress - Progress) > 0.001)
        {
            Progress = progress;
            OnChanged(nameof(Progress));
        }
    }

    /// <summary>HOTP: moves to the next counter value and shows its code.</summary>
    public void NextHotpCode()
    {
        Account.Counter++;
        hotpRevealed = true;
        Tick(TimeSync.Now);
    }

    public string NextTotpCode(DateTimeOffset now) => Otp.Generate(key, Otp.TimeStep(now, Account.Period) + 1, Account.Digits, Account.Algorithm);

    void SetCode(string raw)
    {
        if (raw == RawCode)
            return;
        RawCode = raw;
        Code = raw.Length > 0 ? Otp.Format(raw) : new string('•', 3) + " " + new string('•', 3);
        OnChanged(nameof(RawCode));
        OnChanged(nameof(Code));
        OnChanged(nameof(HasCode));
    }

    /// <summary>Briefly replaces the account line with a note such as "Copied".</summary>
    public async void Flash(string text)
    {
        FlashText = text;
        OnChanged(nameof(FlashText));
        await Task.Delay(1400);
        if (FlashText == text)
        {
            FlashText = null;
            OnChanged(nameof(FlashText));
        }
    }

    void OnChanged([CallerMemberName] string? name = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}
