using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.Numerics;
using System.Text;

namespace VoiceLink.Speech;

/// <summary>
/// The Sec-MS-GEC token the Edge read-aloud service wants on every connection (format "2-…").
/// It's SHA-256 over a hidden 57-byte prefix plus the time and client token, with the prefix
/// already folded into the starting state below, followed by a small custom checksum ("CS64").
/// Ported from edge-tts's drm.py; the constants are theirs.
/// </summary>
internal static class EdgeToken
{
    public const string TrustedClientToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";

    /// <summary>Seconds between 1601-01-01 (Windows file time) and the Unix epoch.</summary>
    private const long WindowsEpochOffset = 11644473600;

    private static readonly uint[] Initial =
        [0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19];

    /// <summary>Working registers after the first 14 rounds of the hidden block.</summary>
    private static readonly uint[] PrefixState =
        [0xFD9FBEA2, 0x91243CE7, 0xBE499094, 0xCD2E1E0A, 0x6C006F49, 0x04BD35AB, 0xFEB0A7E4, 0x03EFFBD2];

    /// <summary>The hidden block's precomputed contribution to message-schedule words 16 to 29.</summary>
    private static readonly uint[] PrefixSchedule =
    [
        0xEB24BF9E, 0x1558691F, 0xA0C09EE2, 0x0CFA32BA, 0xA622EE8C, 0xD1DD9491, 0xC0DD25A0,
        0xF9E70AB6, 0xF0C31573, 0x7058CE4E, 0x7188E606, 0x00E5AB33, 0xD258B060, 0x72766564,
    ];

    private static readonly uint[] RoundConstants =
    [
        0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
        0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
        0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
        0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
        0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
        0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
        0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
        0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2,
    ];

    /// <summary>Stands in for round constant 14 in the first block, absorbing the hidden byte that shares word 14.</summary>
    private const uint Adjustment = 0xC9DC06A7;
    private const uint Sigma0Adjustment = 0x059C0B80;
    private const uint Sigma1Adjustment = 0x000B92C0;

    private static readonly uint[] FirstBlockConstants = BuildFirstBlockConstants();

    private static readonly (uint Coefficient, uint Offset)[] Cs64Coefficients =
    [
        (0xE82E91B1, 0xB32700D0), (0x44DE24C6, 0x88DFF51D), (0x3BEB65BC, 0x29514038), (0xC89C5933, 0xB328CBDF),
        (0x8D1EC211, 0xD405B4D5), (0x314EF5D5, 0x26E55F3C), (0xE92491B1, 0x607801C6), (0xF0A5B9D5, 0x82B2C1FB),
        (0x06064CF3, 0xFA51A3DA), (0xDA79FA60, 0x207CC464), (0xBED20560, 0x3C3C74F3), (0x89F9C9F8, 0xD2D14B61),
        (0x35FA38C6, 0xBB04A2C1), (0xCB49E3C6, 0xC5626167),
    ];

    private const uint Cs64Factor = 0x82893933;
    private const uint Cs64Adjustment0 = 0xF2F90B1A;
    private const uint Cs64Adjustment1 = 0x0B1A0000;

    public static string Generate(long unixSeconds)
    {
        var seconds = unixSeconds + WindowsEpochOffset;
        seconds -= seconds % 300; // valid for 5 minutes
        var data = Encoding.ASCII.GetBytes($"{seconds * 10_000_000L}{TrustedClientToken}"); // 100 ns ticks

        var digest = Sha256WithPrefix(data);
        var (low, high) = Cs64(data, digest);
        Span<byte> cs64 = stackalloc byte[8];
        BinaryPrimitives.WriteUInt32LittleEndian(cs64, low);
        BinaryPrimitives.WriteUInt32LittleEndian(cs64[4..], high);
        return $"{Convert.ToHexString(cs64)}-{Convert.ToHexString(digest)}";
    }

    private static uint[] BuildFirstBlockConstants()
    {
        var constants = (uint[])RoundConstants.Clone();
        constants[14] = Adjustment;
        return constants;
    }

    private static byte[] Sha256WithPrefix(byte[] data)
    {
        if (data.Length < 7)
            throw new ArgumentException("Token data must be at least seven bytes.", nameof(data));

        // The hidden prefix is 57 bytes, so the first block is it plus our first 7 bytes.
        var length = 57 + data.Length;
        var zeros = (((55 - length) % 64) + 64) % 64;
        var padded = new byte[data.Length - 7 + 1 + zeros + 8];
        data.AsSpan(7).CopyTo(padded);
        padded[data.Length - 7] = 0x80;
        BinaryPrimitives.WriteUInt64BigEndian(padded.AsSpan(padded.Length - 8), (ulong)length * 8);

        var state = FirstBlock(data.AsSpan(0, 7));
        var words = new uint[64];
        for (var offset = 0; offset < padded.Length; offset += 64)
        {
            for (var i = 0; i < 16; i++)
                words[i] = BinaryPrimitives.ReadUInt32BigEndian(padded.AsSpan(offset + (i * 4)));
            ExpandSchedule(words, 16);
            var working = Rounds(state, words, 0);
            unchecked
            {
                for (var i = 0; i < 8; i++)
                    state[i] += working[i];
            }
        }

        var digest = new byte[32];
        for (var i = 0; i < 8; i++)
            BinaryPrimitives.WriteUInt32BigEndian(digest.AsSpan(i * 4), state[i]);
        return digest;
    }

    /// <summary>Finishes the first block (hidden prefix + 7 data bytes) from round 14 on.</summary>
    private static uint[] FirstBlock(ReadOnlySpan<byte> data)
    {
        unchecked
        {
            var words = new uint[64];
            words[14] = (uint)((data[0] << 16) | (data[1] << 8) | data[2]);
            words[15] = BinaryPrimitives.ReadUInt32BigEndian(data[3..7]);
            for (var i = 16; i < 30; i++)
            {
                var value = PrefixSchedule[i - 16];
                value += i == 16 ? Sigma1(words[i - 2]) ^ Sigma1Adjustment : Sigma1(words[i - 2]);
                if (i >= 21)
                    value += words[i - 7];
                if (i == 29)
                    value += Sigma0(words[i - 15]) ^ Sigma0Adjustment;
                words[i] = value;
            }

            words[30] = Sigma1(words[28]) + words[23] + Sigma0(words[15]) + words[14] + Adjustment - RoundConstants[14];
            ExpandSchedule(words, 31);

            var working = Rounds(PrefixState, words, 14);
            var state = new uint[8];
            for (var i = 0; i < 8; i++)
                state[i] = Initial[i] + working[i];
            return state;
        }
    }

    private static void ExpandSchedule(uint[] words, int first)
    {
        unchecked
        {
            for (var i = first; i < 64; i++)
                words[i] = Sigma1(words[i - 2]) + words[i - 7] + Sigma0(words[i - 15]) + words[i - 16];
        }
    }

    /// <summary>Standard SHA-256 compression rounds, optionally starting partway into a block.</summary>
    private static uint[] Rounds(uint[] state, uint[] words, int firstRound)
    {
        unchecked
        {
            var k = firstRound == 14 ? FirstBlockConstants : RoundConstants;
            uint a = state[0], b = state[1], c = state[2], d = state[3], e = state[4], f = state[5], g = state[6], h = state[7];
            for (var i = firstRound; i < 64; i++)
            {
                var t1 = h + (RotR(e, 6) ^ RotR(e, 11) ^ RotR(e, 25)) + (g ^ (e & (f ^ g))) + k[i] + words[i];
                var t2 = (RotR(a, 2) ^ RotR(a, 13) ^ RotR(a, 22)) + ((a & b) | (c & (a | b)));
                h = g;
                g = f;
                f = e;
                e = d + t1;
                d = c;
                c = b;
                b = a;
                a = t1 + t2;
            }

            return [a, b, c, d, e, f, g, h];
        }
    }

    private static (uint Low, uint High) Cs64(byte[] data, byte[] digest)
    {
        unchecked
        {
            var keyA = BinaryPrimitives.ReadUInt32LittleEndian(digest) | 1;
            var keyB = BinaryPrimitives.ReadUInt32LittleEndian(digest.AsSpan(4)) | 1;
            uint[] factors = [keyA * Cs64Factor, keyB * Cs64Factor];

            var terms = new List<uint>();
            var offsets = new List<uint>();
            for (var i = 0; i < Cs64Coefficients.Length; i++)
            {
                terms.Add(Cs64Coefficients[i].Coefficient * factors[i % 2]);
                offsets.Add(Cs64Coefficients[i].Offset);
            }

            // A zero byte, then the data, as little-endian words padded to an even count.
            var wordCount = (data.Length + 1 + 3) / 4;
            wordCount += wordCount % 2;
            var bytes = new byte[wordCount * 4];
            data.CopyTo(bytes, 1);
            for (var i = 0; i < wordCount; i++)
            {
                var word = BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(i * 4));
                var even = i % 2 == 0;
                var term = word * (even ? keyA : keyB);
                var offset = Rol16(word) * (even ? 0xEF0569FBu : 0xC31713DBu);
                if (i == 0)
                {
                    term += Cs64Adjustment0 * factors[0];
                    offset += Cs64Adjustment1;
                }

                terms.Add(term);
                offsets.Add(offset);
            }

            uint swapAcc = 0, swapLast = 0, state = 0, acc = 0;
            for (var i = 0; i < terms.Count; i += 2)
            {
                uint x = terms[i], y = terms[i + 1];
                var t = Rol16(offsets[i] + x);
                var q = t * 0x76F50F34u;
                swapAcc += (Rol16(q) * 0xC3EFEA97u) + q;
                t = Rol16(offsets[i + 1] + y);
                q = t * 0x1881CE3Cu;
                swapLast = (Rol16(q) * 0x35BD1EC9u) + q;
                swapAcc += swapLast;

                state = (state * keyA) + x;
                state = Rol16(state) * 0xCF98B111u;
                state = Rol16(state) * 0x87085B9Fu;
                state = Rol16(state) * 0x12CEB96Du;
                state = Rol16(state) * 0x257E1D83u;
                acc += state;
                t = (state * keyB) + y;
                t = Rol16(t) * 0xA27416F5u;
                t = Rol16(t) * 0xD38396FFu;
                state = Rol16(Rol16(t) * 0x7C932B89u) * 0xBFA49F69u;
                acc += state;
            }

            return (swapLast ^ state, swapAcc ^ acc);
        }
    }

    private static uint Sigma0(uint x) => RotR(x, 7) ^ RotR(x, 18) ^ (x >> 3);
    private static uint Sigma1(uint x) => RotR(x, 17) ^ RotR(x, 19) ^ (x >> 10);
    private static uint RotR(uint x, int n) => BitOperations.RotateRight(x, n);
    private static uint Rol16(uint x) => BitOperations.RotateLeft(x, 16);
}
