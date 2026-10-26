using System.Text;

namespace Authenticator.Core;

/// <summary>One "Transfer accounts" QR code from Google Authenticator. Big exports are split over several codes.</summary>
public sealed record MigrationBatch(IReadOnlyList<Account> Accounts, int BatchIndex, int BatchSize, int BatchId);

/// <summary>
/// Google Authenticator's otpauth-migration://offline?data=... links: base64 of a protobuf MigrationPayload
/// { repeated OtpParameters otp_parameters = 1; int32 version = 2; int32 batch_size = 3; int32 batch_index = 4; int32 batch_id = 5; }
/// OtpParameters { bytes secret = 1; string name = 2; string issuer = 3; Algorithm algorithm = 4; DigitCount digits = 5; OtpType type = 6; int64 counter = 7; }
/// </summary>
public static class GoogleMigration
{
    const string Scheme = "otpauth-migration://";

    /// <summary>Longest link put in one exported QR code, so a phone camera can still read it off a monitor.</summary>
    const int MaxLinkLength = 1100;

    public static bool IsMigration(string text) => text.TrimStart().StartsWith(Scheme, StringComparison.OrdinalIgnoreCase);

    /// <summary>Accounts whose codes Google Authenticator can reproduce (it only does 30-second 6- or 8-digit codes).</summary>
    public static bool CanExport(Account account) =>
        account.Digits is 6 or 8 && (account.Type == OtpType.Hotp || account.Period == 30);

    public static MigrationBatch Parse(string uri)
    {
        string s = uri.Trim();
        int question = s.IndexOf('?');
        if (!IsMigration(s) || question < 0)
            throw new FormatException("This isn't a Google Authenticator export code.");
        // Read the raw parameter: '+' in it is base64, not a space.
        string? data = null;
        foreach (var part in s[(question + 1)..].Split('&'))
            if (part.StartsWith("data=", StringComparison.OrdinalIgnoreCase))
                data = part[5..];
        if (string.IsNullOrWhiteSpace(data))
            throw new FormatException("The Google Authenticator code has no data in it.");

        string base64 = Uri.UnescapeDataString(data).Trim().Replace(' ', '+').Replace('-', '+').Replace('_', '/');
        base64 = base64.PadRight(base64.Length + (4 - base64.Length % 4) % 4, '=');
        byte[] payload;
        try { payload = Convert.FromBase64String(base64); }
        catch (FormatException) { throw new FormatException("The Google Authenticator code is damaged (bad base64)."); }
        return Decode(payload);
    }

    public static MigrationBatch Decode(byte[] payload)
    {
        var accounts = new List<Account>();
        int batchSize = 1, batchIndex = 0, batchId = 0;
        var reader = new ProtoReader(payload);
        while (reader.Next(out int field, out int wire))
        {
            switch (field, wire)
            {
                case (1, 2): accounts.Add(DecodeAccount(reader.ReadBytes())); break;
                case (3, 0): batchSize = (int)reader.ReadVarint(); break;
                case (4, 0): batchIndex = (int)reader.ReadVarint(); break;
                case (5, 0): batchId = (int)reader.ReadVarint(); break;
                default: reader.Skip(wire); break;
            }
        }
        return new MigrationBatch(accounts, batchIndex, Math.Max(batchSize, 1), batchId);
    }

    static Account DecodeAccount(byte[] data)
    {
        byte[] secret = [];
        string name = "", issuer = "";
        var account = new Account();
        var reader = new ProtoReader(data);
        while (reader.Next(out int field, out int wire))
        {
            switch (field, wire)
            {
                case (1, 2): secret = reader.ReadBytes(); break;
                case (2, 2): name = Encoding.UTF8.GetString(reader.ReadBytes()); break;
                case (3, 2): issuer = Encoding.UTF8.GetString(reader.ReadBytes()); break;
                case (4, 0):
                    account.Algorithm = reader.ReadVarint() switch
                    {
                        2 => OtpAlgorithm.Sha256,
                        3 => OtpAlgorithm.Sha512,
                        4 => OtpAlgorithm.Md5,
                        _ => OtpAlgorithm.Sha1,
                    };
                    break;
                case (5, 0): account.Digits = reader.ReadVarint() == 2 ? 8 : 6; break;
                case (6, 0): account.Type = reader.ReadVarint() == 1 ? OtpType.Hotp : OtpType.Totp; break;
                case (7, 0): account.Counter = (long)reader.ReadVarint(); break;
                default: reader.Skip(wire); break;
            }
        }
        if (secret.Length == 0)
            throw new FormatException("An account in the Google Authenticator code has no secret key.");
        account.Secret = Base32.Encode(secret);

        // Google stores the label, which is often "Issuer:account".
        name = name.Trim();
        issuer = issuer.Trim();
        int colon = name.IndexOf(':');
        if (colon >= 0)
        {
            string prefix = name[..colon].Trim();
            if (issuer.Length == 0 || prefix.Equals(issuer, StringComparison.OrdinalIgnoreCase))
            {
                issuer = issuer.Length == 0 ? prefix : issuer;
                name = name[(colon + 1)..].Trim();
            }
        }
        account.Issuer = issuer;
        account.Name = name;
        return account;
    }

    /// <summary>Export links for Google Authenticator's "Import accounts" scanner, split so each fits a readable QR code.</summary>
    public static List<string> Build(IReadOnlyList<Account> accounts)
    {
        var groups = new List<List<Account>>();
        var current = new List<Account>();
        foreach (var account in accounts.Where(CanExport))
        {
            current.Add(account);
            if (current.Count > 1 && Link(current, 1, 0, 0).Length > MaxLinkLength)
            {
                current.RemoveAt(current.Count - 1);
                groups.Add(current);
                current = [account];
            }
        }
        if (current.Count > 0)
            groups.Add(current);

        int batchId = Random.Shared.Next(1, int.MaxValue);
        return groups.Select((group, index) => Link(group, groups.Count, index, batchId)).ToList();
    }

    static string Link(List<Account> accounts, int batchSize, int batchIndex, int batchId)
    {
        var payload = new ProtoWriter();
        foreach (var account in accounts)
        {
            var otp = new ProtoWriter();
            otp.WriteBytes(1, account.SecretBytes());
            otp.WriteBytes(2, Encoding.UTF8.GetBytes(account.Name));
            otp.WriteBytes(3, Encoding.UTF8.GetBytes(account.Issuer));
            otp.WriteVarint(4, account.Algorithm switch
            {
                OtpAlgorithm.Sha256 => 2UL,
                OtpAlgorithm.Sha512 => 3UL,
                OtpAlgorithm.Md5 => 4UL,
                _ => 1UL,
            });
            otp.WriteVarint(5, account.Digits == 8 ? 2UL : 1UL);
            otp.WriteVarint(6, account.Type == OtpType.Hotp ? 1UL : 2UL);
            if (account.Type == OtpType.Hotp)
                otp.WriteVarint(7, (ulong)account.Counter);
            payload.WriteBytes(1, otp.ToArray());
        }
        payload.WriteVarint(2, 1);
        payload.WriteVarint(3, (ulong)batchSize);
        payload.WriteVarint(4, (ulong)batchIndex);
        payload.WriteVarint(5, (ulong)batchId);
        return Scheme + "offline?data=" + Uri.EscapeDataString(Convert.ToBase64String(payload.ToArray()));
    }

    sealed class ProtoReader(byte[] data)
    {
        int pos;

        public bool Next(out int field, out int wire)
        {
            field = wire = 0;
            if (pos >= data.Length)
                return false;
            ulong key = ReadVarint();
            field = (int)(key >> 3);
            wire = (int)(key & 7);
            return true;
        }

        public ulong ReadVarint()
        {
            ulong result = 0;
            for (int shift = 0; shift < 64; shift += 7)
            {
                if (pos >= data.Length)
                    throw new FormatException("The Google Authenticator code is damaged (cut short).");
                byte b = data[pos++];
                result |= (ulong)(b & 0x7F) << shift;
                if ((b & 0x80) == 0)
                    return result;
            }
            throw new FormatException("The Google Authenticator code is damaged (bad number).");
        }

        public byte[] ReadBytes()
        {
            ulong length = ReadVarint();
            if (length > (ulong)(data.Length - pos))
                throw new FormatException("The Google Authenticator code is damaged (cut short).");
            var bytes = data.AsSpan(pos, (int)length).ToArray();
            pos += (int)length;
            return bytes;
        }

        public void Skip(int wire)
        {
            switch (wire)
            {
                case 0: ReadVarint(); break;
                case 1: pos += 8; break;
                case 2: ReadBytes(); break;
                case 5: pos += 4; break;
                default: throw new FormatException("The Google Authenticator code is damaged (unknown field).");
            }
            if (pos > data.Length)
                throw new FormatException("The Google Authenticator code is damaged (cut short).");
        }
    }

    sealed class ProtoWriter
    {
        readonly MemoryStream stream = new();

        public void WriteVarint(int field, ulong value)
        {
            WriteRaw((ulong)(field << 3));
            WriteRaw(value);
        }

        public void WriteBytes(int field, byte[] bytes)
        {
            WriteRaw((ulong)((field << 3) | 2));
            WriteRaw((ulong)bytes.Length);
            stream.Write(bytes);
        }

        void WriteRaw(ulong value)
        {
            while (value >= 0x80)
            {
                stream.WriteByte((byte)(value | 0x80));
                value >>= 7;
            }
            stream.WriteByte((byte)value);
        }

        public byte[] ToArray() => stream.ToArray();
    }
}
