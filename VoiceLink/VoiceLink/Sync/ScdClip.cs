using System;
using System.Buffers.Binary;
using System.IO;

namespace VoiceLink.Sync;

/// <summary>
/// Builds a game sound file (.scd) by putting new audio into an existing one. Everything except the
/// audio entry is kept from the game's file, apart from the two places that say how long it plays.
/// Layout notes are from VFXEditor's ScdFormat and vgmstream's sqex_scd.
/// </summary>
internal static class ScdClip
{
    private const int CodecMsAdpcm = 0x0C;
    private const int FlagMarker = 0x01;
    private const uint AttributeExtraDesc = 0x2000;
    /// <summary>Optional sound sections stored before the extra description; if any are present we can't find it.</summary>
    private const uint AttributesBeforeExtra = 0x0100 | 0x0400 | 0x0800 | 0x8000;
    private const ushort TrackCmdInterval = 0x03;

    public sealed record Template(byte[] Bytes, int SampleRate, int BlockAlign, int Samples, int AudioOffset, int FormatOffset, int FormatSize);

    /// <summary>Checks a game .scd has the shape this needs: one mono MS-ADPCM audio entry, stored last.</summary>
    public static Template ReadTemplate(byte[] scd)
    {
        var s = scd.AsSpan();
        if (scd.Length < 0x60 || BinaryPrimitives.ReadUInt64LittleEndian(s) != 0x4643535342444553UL) // "SEDBSSCF"
            throw new InvalidDataException("Not an SCD file.");
        if (s[0x0C] != 0)
            throw new InvalidDataException("Big-endian SCD isn't supported.");
        if (U16(s, 0x34) != 1)
            throw new InvalidDataException($"Expected one audio entry, found {U16(s, 0x34)}.");

        var audio = I32(s, I32(s, 0x3C));
        if (I32(s, audio + 0x0C) != CodecMsAdpcm || I32(s, audio + 0x04) != 1)
            throw new InvalidDataException("Expected mono MS-ADPCM audio.");

        var flags = I32(s, audio + 0x1C);
        var subInfo = I32(s, audio + 0x18);
        var format = audio + 0x20;
        if ((flags & FlagMarker) != 0)
        {
            var markerSize = I32(s, format + 4);
            format += markerSize;
            subInfo -= markerSize;
        }

        var blockAlign = U16(s, format + 12);
        var blocks = I32(s, audio) / blockAlign;
        return new Template(scd, I32(s, audio + 0x08), blockAlign, blocks * MsAdpcm.SamplesPerBlock(blockAlign), audio, format, subInfo);
    }

    /// <summary>A copy of the template playing <paramref name="samples"/> (mono, at the template's sample rate) instead.</summary>
    public static byte[] Build(Template template, short[] samples)
    {
        var t = template.Bytes.AsSpan();

        // Never shorter than the original: VFXEditor users found shorter replacements could crash the game.
        var padded = new short[Math.Max(samples.Length, template.Samples)];
        samples.CopyTo(padded);
        var data = MsAdpcm.Encode(padded, template.BlockAlign);
        var playSamples = data.Length / template.BlockAlign * MsAdpcm.SamplesPerBlock(template.BlockAlign);

        var entrySize = 0x20 + template.FormatSize + data.Length;
        var paddedEntry = (entrySize + 15) & ~15;
        var output = new byte[template.AudioOffset + paddedEntry];
        t[..template.AudioOffset].CopyTo(output);
        var o = output.AsSpan();

        // Audio entry header, then the template's ADPCM format block, then our data. No marker chunk.
        var e = template.AudioOffset;
        var oldFlags = I32(t, e + 0x1C);
        WriteI32(o, e + 0x00, data.Length);
        WriteI32(o, e + 0x04, 1);
        WriteI32(o, e + 0x08, template.SampleRate);
        WriteI32(o, e + 0x0C, CodecMsAdpcm);
        WriteI32(o, e + 0x10, 0);
        WriteI32(o, e + 0x14, 0);
        WriteI32(o, e + 0x18, template.FormatSize);
        WriteI32(o, e + 0x1C, oldFlags & ~FlagMarker);
        t.Slice(template.FormatOffset, template.FormatSize).CopyTo(o[(e + 0x20)..]);
        data.CopyTo(o[(e + 0x20 + template.FormatSize)..]);

        WriteI32(o, 0x10, output.Length);
        SetPlayLength(o, template, (int)Math.Ceiling(playSamples * 1000.0 / template.SampleRate));
        return output;
    }

    /// <summary>
    /// The sound says how long it plays in two places: the extra description's play time, and the track's
    /// "wait N ms" before it keys off. Both hold the original length, so both are stretched to the new one.
    /// </summary>
    private static void SetPlayLength(Span<byte> scd, Template template, int milliseconds)
    {
        var sound = I32(scd, 0x50);
        var attributes = (uint)I32(scd, sound + 4);
        int? oldLength = null;
        if ((attributes & AttributeExtraDesc) != 0 && (attributes & AttributesBeforeExtra) == 0)
        {
            // 16-byte sound header, then the extra description: version, reserved, size (u16), play time (i32).
            var playTime = sound + 0x10 + 4;
            oldLength = I32(scd, playTime);
            WriteI32(scd, playTime, milliseconds);
        }

        oldLength ??= (int)Math.Round(template.Samples * 1000.0 / template.SampleRate);

        var track = I32(scd, I32(scd, 0x38));
        for (var i = track; i + 6 <= template.AudioOffset; i += 2)
        {
            if (U16(scd, i) == TrackCmdInterval && I32(scd, i + 2) == oldLength)
            {
                WriteI32(scd, i + 2, milliseconds);
                return;
            }
        }

        Plugin.Log.Warning($"Couldn't find the sound's {oldLength} ms wait; long messages may be cut off");
    }

    private static int I32(ReadOnlySpan<byte> s, int offset) => BinaryPrimitives.ReadInt32LittleEndian(s[offset..]);
    private static int U16(ReadOnlySpan<byte> s, int offset) => BinaryPrimitives.ReadUInt16LittleEndian(s[offset..]);
    private static void WriteI32(Span<byte> s, int offset, int value) => BinaryPrimitives.WriteInt32LittleEndian(s[offset..], value);
}
