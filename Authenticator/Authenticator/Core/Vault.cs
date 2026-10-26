using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Authenticator.Core;

public sealed class VaultData
{
    public int Version { get; set; } = 1;
    public List<Account> Accounts { get; set; } = [];
}

static class Json
{
    public static readonly JsonSerializerOptions Options = new()
    {
        Converters = { new JsonStringEnumConverter() },
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static readonly JsonSerializerOptions Indented = new(Options) { WriteIndented = true };
}

/// <summary>
/// The accounts, kept in %APPDATA%\Authenticator\vault.dat encrypted with Windows DPAPI: only this Windows user
/// on this PC can read it. Every save keeps the previous file as vault.bak.
/// </summary>
public sealed class Vault(string folder)
{
    static readonly byte[] Entropy = "Authenticator vault v1"u8.ToArray();

    public string Folder { get; } = folder;
    public string VaultPath => Path.Combine(Folder, "vault.dat");
    public string BackupPath => Path.Combine(Folder, "vault.bak");

    public List<Account> Accounts { get; private set; } = [];

    /// <summary>Set when a vault exists but can't be read. Saving is refused then, so the file is never overwritten.</summary>
    public string? LoadError { get; private set; }

    public bool RecoveredFromBackup { get; private set; }

    public static string DefaultFolder =>
        Environment.GetEnvironmentVariable("AUTHENTICATOR_DATA") is { Length: > 0 } folder
            ? folder
            : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Authenticator");

    public void Load()
    {
        LoadError = null;
        RecoveredFromBackup = false;
        Accounts = [];
        if (!File.Exists(VaultPath) && !File.Exists(BackupPath))
            return;

        var errors = new List<string>();
        foreach (var path in new[] { VaultPath, BackupPath })
        {
            if (!File.Exists(path))
                continue;
            try
            {
                Accounts = Read(path);
                RecoveredFromBackup = path == BackupPath;
                // Keep the unreadable file, but out of the way so the next save doesn't rotate it over the good backup.
                if (RecoveredFromBackup && File.Exists(VaultPath))
                    File.Move(VaultPath, Path.Combine(Folder, $"vault.unreadable-{DateTime.Now:yyyyMMdd-HHmmss}.dat"));
                return;
            }
            catch (Exception ex) when (ex is CryptographicException or JsonException or IOException or UnauthorizedAccessException)
            {
                errors.Add($"{Path.GetFileName(path)}: {ex.Message}");
            }
        }
        LoadError = string.Join(Environment.NewLine, errors);
    }

    static List<Account> Read(string path)
    {
        byte[] json = ProtectedData.Unprotect(File.ReadAllBytes(path), Entropy, DataProtectionScope.CurrentUser);
        try
        {
            var data = JsonSerializer.Deserialize<VaultData>(json, Json.Options) ?? throw new JsonException("The vault is empty.");
            return data.Accounts.Where(a => a.SecretBytes().Length > 0).ToList();
        }
        finally
        {
            CryptographicOperations.ZeroMemory(json);
        }
    }

    public void Save()
    {
        if (LoadError != null)
            throw new InvalidOperationException("The saved accounts couldn't be read, so nothing is saved over them.");
        Directory.CreateDirectory(Folder);

        byte[] json = JsonSerializer.SerializeToUtf8Bytes(new VaultData { Accounts = Accounts }, Json.Options);
        byte[] blob = ProtectedData.Protect(json, Entropy, DataProtectionScope.CurrentUser);
        CryptographicOperations.ZeroMemory(json);

        string temp = VaultPath + ".tmp";
        using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough))
        {
            stream.Write(blob);
            stream.Flush(flushToDisk: true);
        }
        if (File.Exists(VaultPath))
            File.Replace(temp, VaultPath, BackupPath, ignoreMetadataErrors: true);
        else
            File.Move(temp, VaultPath);
    }
}

/// <summary>Window placement and options. Nothing secret, so plain JSON.</summary>
public sealed class AppSettings
{
    public double? Left { get; set; }
    public double? Top { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public bool AlwaysOnTop { get; set; }

    static string PathIn(string folder) => Path.Combine(folder, "settings.json");

    public static AppSettings Load(string folder)
    {
        try { return JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(PathIn(folder)), Json.Options) ?? new(); }
        catch { return new(); }
    }

    public void Save(string folder)
    {
        try
        {
            Directory.CreateDirectory(folder);
            File.WriteAllText(PathIn(folder), JsonSerializer.Serialize(this, Json.Indented));
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}
