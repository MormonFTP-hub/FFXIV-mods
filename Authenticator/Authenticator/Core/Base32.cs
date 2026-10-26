using System.Text;

namespace Authenticator.Core;

/// <summary>RFC 4648 Base32, the encoding setup keys are shown in. Decoding ignores case, spaces, dashes and padding.</summary>
public static class Base32
{
    const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public static bool TryDecode(string text, out byte[] bytes)
    {
        bytes = [];
        var output = new List<byte>(text.Length * 5 / 8);
        int buffer = 0, bits = 0;
        foreach (char raw in text)
        {
            if (char.IsWhiteSpace(raw) || raw is '-' or '=')
                continue;
            int value = Alphabet.IndexOf(char.ToUpperInvariant(raw));
            if (value < 0)
                return false;
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8)
            {
                bits -= 8;
                output.Add((byte)(buffer >> bits));
                buffer &= (1 << bits) - 1;
            }
        }
        bytes = output.ToArray();
        return bytes.Length > 0;
    }

    public static string Encode(ReadOnlySpan<byte> data)
    {
        var sb = new StringBuilder((data.Length * 8 + 4) / 5);
        int buffer = 0, bits = 0;
        foreach (byte b in data)
        {
            buffer = (buffer << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                bits -= 5;
                sb.Append(Alphabet[(buffer >> bits) & 31]);
            }
            buffer &= (1 << bits) - 1;
        }
        if (bits > 0)
            sb.Append(Alphabet[(buffer << (5 - bits)) & 31]);
        return sb.ToString();
    }

    /// <summary>"JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP", the way sites print keys.</summary>
    public static string Group(string key) =>
        string.Join(' ', Enumerable.Range(0, (key.Length + 3) / 4).Select(i => key.Substring(i * 4, Math.Min(4, key.Length - i * 4))));
}
