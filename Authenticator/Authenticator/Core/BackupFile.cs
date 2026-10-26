using System.Security.Cryptography;
using System.Text.Json;

namespace Authenticator.Core;

/// <summary>
/// Password-protected backup (.authbackup): AES-256-GCM with a key from PBKDF2-SHA256. Unlike the vault it can be
/// restored on any PC, as long as you know the password.
/// </summary>
public static class BackupFile
{
    public const string Extension = ".authbackup";
    const string Format = "authenticator-backup";
    const int Iterations = 600_000;
    static readonly byte[] AssociatedData = "authenticator-backup v1"u8.ToArray();

    sealed class Envelope
    {
        public string Format { get; set; } = "";
        public int Version { get; set; }
        public string Kdf { get; set; } = "";
        public int Iterations { get; set; }
        public string Salt { get; set; } = "";
        public string Nonce { get; set; } = "";
        public string Tag { get; set; } = "";
        public string Data { get; set; } = "";
    }

    public static void Write(string path, IReadOnlyList<Account> accounts, string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(16);
        byte[] nonce = RandomNumberGenerator.GetBytes(12);
        byte[] key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        byte[] plain = JsonSerializer.SerializeToUtf8Bytes(new VaultData { Accounts = accounts.ToList() }, Json.Options);
        byte[] cipher = new byte[plain.Length];
        byte[] tag = new byte[16];
        using (var aes = new AesGcm(key, tag.Length))
            aes.Encrypt(nonce, plain, cipher, tag, AssociatedData);
        CryptographicOperations.ZeroMemory(plain);
        CryptographicOperations.ZeroMemory(key);

        var envelope = new Envelope
        {
            Format = Format,
            Version = 1,
            Kdf = "pbkdf2-sha256",
            Iterations = Iterations,
            Salt = Convert.ToBase64String(salt),
            Nonce = Convert.ToBase64String(nonce),
            Tag = Convert.ToBase64String(tag),
            Data = Convert.ToBase64String(cipher),
        };
        File.WriteAllText(path, JsonSerializer.Serialize(envelope, Json.Indented));
    }

    public static bool LooksLikeBackup(string path)
    {
        try
        {
            if (new FileInfo(path).Length > 16 * 1024 * 1024)
                return false;
            return JsonSerializer.Deserialize<Envelope>(File.ReadAllText(path), Json.Options)?.Format == Format;
        }
        catch { return false; }
    }

    /// <summary>Throws <see cref="WrongPasswordException"/> for a wrong password, <see cref="FormatException"/> for a file that isn't a backup.</summary>
    public static List<Account> Read(string path, string password)
    {
        Envelope envelope;
        try
        {
            envelope = JsonSerializer.Deserialize<Envelope>(File.ReadAllText(path), Json.Options) ?? throw new JsonException();
        }
        catch (JsonException) { throw new FormatException("This file isn't an Authenticator backup."); }
        if (envelope.Format != Format || envelope.Version != 1 || envelope.Kdf != "pbkdf2-sha256")
            throw new FormatException("This file isn't an Authenticator backup, or it's from a newer version.");

        byte[] salt = Convert.FromBase64String(envelope.Salt);
        byte[] nonce = Convert.FromBase64String(envelope.Nonce);
        byte[] tag = Convert.FromBase64String(envelope.Tag);
        byte[] cipher = Convert.FromBase64String(envelope.Data);
        byte[] key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Math.Max(envelope.Iterations, 1), HashAlgorithmName.SHA256, 32);
        byte[] plain = new byte[cipher.Length];
        try
        {
            using var aes = new AesGcm(key, tag.Length);
            aes.Decrypt(nonce, cipher, tag, plain, AssociatedData);
        }
        catch (AuthenticationTagMismatchException)
        {
            throw new WrongPasswordException();
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
        }

        try
        {
            var data = JsonSerializer.Deserialize<VaultData>(plain, Json.Options) ?? new VaultData();
            return data.Accounts.Where(a => a.SecretBytes().Length > 0).ToList();
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plain);
        }
    }
}

public sealed class WrongPasswordException() : Exception("The password is wrong.");
