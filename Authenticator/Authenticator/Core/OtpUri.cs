using System.Globalization;
using System.Text;

namespace Authenticator.Core;

/// <summary>otpauth:// links, the format inside a site's 2-step setup QR code.</summary>
public static class OtpUri
{
    const string Scheme = "otpauth://";

    public static bool IsOtpAuth(string text) => text.TrimStart().StartsWith(Scheme, StringComparison.OrdinalIgnoreCase);

    /// <summary>Throws <see cref="FormatException"/> with a message fit to show the user.</summary>
    public static Account Parse(string uri)
    {
        string s = uri.Trim();
        if (!s.StartsWith(Scheme, StringComparison.OrdinalIgnoreCase))
            throw new FormatException("This isn't an otpauth:// link.");
        s = s[Scheme.Length..];

        int slash = s.IndexOf('/');
        if (slash < 0)
            throw new FormatException("The link has no account name.");
        string type = s[..slash].ToLowerInvariant();
        string rest = s[(slash + 1)..];
        int question = rest.IndexOf('?');
        // A label is a path segment, so '+' stays a plus (e.g. me+2fa@gmail.com).
        string label = Unescape(question < 0 ? rest : rest[..question], plusIsSpace: false);
        var query = ParseQuery(question < 0 ? "" : rest[(question + 1)..]);

        var account = new Account
        {
            Type = type switch
            {
                "totp" => OtpType.Totp,
                "hotp" => OtpType.Hotp,
                _ => throw new FormatException($"\"{type}\" codes aren't supported, only time-based (totp) and counter-based (hotp)."),
            },
        };

        if (!query.TryGetValue("secret", out var secret) || secret.Trim().Length == 0)
            throw new FormatException("The link has no secret key.");
        if (!Base32.TryDecode(secret, out var key))
            throw new FormatException("The secret key in the link isn't valid.");
        account.Secret = Base32.Encode(key);

        // The label is "Issuer:account" or just "account". The issuer itself may contain a colon.
        string issuer = query.TryGetValue("issuer", out var issuerParam) ? issuerParam.Trim() : "";
        string name = label;
        if (issuer.Length > 0 && label.StartsWith(issuer + ":", StringComparison.OrdinalIgnoreCase))
        {
            name = label[(issuer.Length + 1)..];
        }
        else if (label.IndexOf(':') is int colon and >= 0)
        {
            if (issuer.Length == 0)
                issuer = label[..colon].Trim();
            name = label[(colon + 1)..];
        }
        account.Name = name.Trim();
        account.Issuer = issuer;

        if (query.TryGetValue("algorithm", out var algorithm) && algorithm.Length > 0)
        {
            if (!Otp.TryParseAlgorithm(algorithm, out var parsed))
                throw new FormatException($"The {algorithm} algorithm isn't supported.");
            account.Algorithm = parsed;
        }
        if (query.TryGetValue("digits", out var digitsText) && digitsText.Length > 0)
        {
            if (!int.TryParse(digitsText, NumberStyles.None, CultureInfo.InvariantCulture, out int digits) || digits is < Otp.MinDigits or > Otp.MaxDigits)
                throw new FormatException($"{digitsText}-digit codes aren't supported.");
            account.Digits = digits;
        }
        if (query.TryGetValue("period", out var periodText) && periodText.Length > 0)
        {
            if (!int.TryParse(periodText, NumberStyles.None, CultureInfo.InvariantCulture, out int period) || period is < 1 or > 86400)
                throw new FormatException($"A code period of \"{periodText}\" seconds isn't valid.");
            account.Period = period;
        }
        if (query.TryGetValue("counter", out var counterText) && counterText.Length > 0)
        {
            if (!long.TryParse(counterText, NumberStyles.None, CultureInfo.InvariantCulture, out long counter))
                throw new FormatException($"The counter \"{counterText}\" isn't valid.");
            account.Counter = counter;
        }
        return account;
    }

    public static string Build(Account account)
    {
        string label = account.Issuer.Length > 0 ? $"{Escape(account.Issuer)}:{Escape(account.Name)}" : Escape(account.Name);
        var sb = new StringBuilder(Scheme)
            .Append(account.Type == OtpType.Hotp ? "hotp/" : "totp/")
            .Append(label)
            .Append("?secret=").Append(account.Secret);
        if (account.Issuer.Length > 0)
            sb.Append("&issuer=").Append(Escape(account.Issuer));
        if (account.Algorithm != OtpAlgorithm.Sha1)
            sb.Append("&algorithm=").Append(Otp.AlgorithmName(account.Algorithm));
        if (account.Digits != 6)
            sb.Append("&digits=").Append(account.Digits.ToString(CultureInfo.InvariantCulture));
        if (account.Type == OtpType.Totp && account.Period != 30)
            sb.Append("&period=").Append(account.Period.ToString(CultureInfo.InvariantCulture));
        if (account.Type == OtpType.Hotp)
            sb.Append("&counter=").Append(account.Counter.ToString(CultureInfo.InvariantCulture));
        return sb.ToString();
    }

    internal static Dictionary<string, string> ParseQuery(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var part in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            int eq = part.IndexOf('=');
            string key = Unescape(eq < 0 ? part : part[..eq], plusIsSpace: true);
            string value = eq < 0 ? "" : Unescape(part[(eq + 1)..], plusIsSpace: true);
            result.TryAdd(key, value);
        }
        return result;
    }

    static string Unescape(string text, bool plusIsSpace)
    {
        if (plusIsSpace)
            text = text.Replace('+', ' ');
        try { return Uri.UnescapeDataString(text); }
        catch (UriFormatException) { return text; }
    }

    static string Escape(string text) => Uri.EscapeDataString(text);
}
