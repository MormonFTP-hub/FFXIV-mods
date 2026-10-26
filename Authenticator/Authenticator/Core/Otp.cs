using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json.Serialization;

namespace Authenticator.Core;

public enum OtpType { Totp, Hotp }

public enum OtpAlgorithm { Sha1, Sha256, Sha512, Md5 }

public sealed class Account
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Issuer { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>Base32 without padding.</summary>
    public string Secret { get; set; } = "";
    public OtpType Type { get; set; } = OtpType.Totp;
    public OtpAlgorithm Algorithm { get; set; } = OtpAlgorithm.Sha1;
    public int Digits { get; set; } = 6;
    public int Period { get; set; } = 30;
    public long Counter { get; set; }

    [JsonIgnore]
    public string DisplayName => Issuer.Length > 0 && Name.Length > 0 ? $"{Issuer} ({Name})" : Issuer.Length > 0 ? Issuer : Name;

    public byte[] SecretBytes() => Base32.TryDecode(Secret, out var key) ? key : [];

    public bool HasSameSecret(Account other) =>
        Type == other.Type && SecretBytes().AsSpan().SequenceEqual(other.SecretBytes());

    public Account Clone() => (Account)MemberwiseClone();
}

/// <summary>HOTP (RFC 4226) and TOTP (RFC 6238).</summary>
public static class Otp
{
    public const int MinDigits = 4, MaxDigits = 10;

    public static string Generate(byte[] key, long counter, int digits, OtpAlgorithm algorithm)
    {
        Span<byte> message = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(message, counter);
        byte[] hash = algorithm switch
        {
            OtpAlgorithm.Sha256 => HMACSHA256.HashData(key, message),
            OtpAlgorithm.Sha512 => HMACSHA512.HashData(key, message),
            OtpAlgorithm.Md5 => HMACMD5.HashData(key, message),
            _ => HMACSHA1.HashData(key, message),
        };
        int offset = hash[^1] & 0x0F;
        long binary = ((hash[offset] & 0x7F) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        long modulo = (long)Math.Pow(10, Math.Clamp(digits, MinDigits, MaxDigits));
        return (binary % modulo).ToString(CultureInfo.InvariantCulture).PadLeft(digits, '0');
    }

    public static long TimeStep(DateTimeOffset now, int period) => now.ToUnixTimeSeconds() / period;

    public static double SecondsLeft(DateTimeOffset now, int period)
    {
        double seconds = now.ToUnixTimeMilliseconds() / 1000.0;
        return period - seconds % period;
    }

    /// <summary>The code for <paramref name="now"/>; <paramref name="stepsAhead"/> = 1 gives the next one.</summary>
    public static string Totp(Account account, DateTimeOffset now, int stepsAhead = 0) =>
        Generate(account.SecretBytes(), TimeStep(now, account.Period) + stepsAhead, account.Digits, account.Algorithm);

    /// <summary>"123456" -> "123 456", "12345678" -> "1234 5678".</summary>
    public static string Format(string code) => code.Length < 6 ? code : code.Insert((code.Length + 1) / 2, " ");

    public static string AlgorithmName(OtpAlgorithm algorithm) => algorithm switch
    {
        OtpAlgorithm.Sha256 => "SHA256",
        OtpAlgorithm.Sha512 => "SHA512",
        OtpAlgorithm.Md5 => "MD5",
        _ => "SHA1",
    };

    public static bool TryParseAlgorithm(string text, out OtpAlgorithm algorithm)
    {
        algorithm = text.Trim().Replace("-", "").ToUpperInvariant() switch
        {
            "SHA1" => OtpAlgorithm.Sha1,
            "SHA256" => OtpAlgorithm.Sha256,
            "SHA512" => OtpAlgorithm.Sha512,
            "MD5" => OtpAlgorithm.Md5,
            _ => (OtpAlgorithm)(-1),
        };
        return Enum.IsDefined(algorithm);
    }
}
