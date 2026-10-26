using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using NAudio.Wave;

namespace VoiceLink.Speech;

/// <summary>
/// The voices installed in Windows (SAPI), through late-bound COM so no extra assemblies ship with the plugin.
/// Offline and always there, but they sound noticeably more robotic than the natural voices.
/// </summary>
internal static class WindowsTts
{
    /// <summary>SpeechAudioFormatType.SAFT24kHz16BitMono.</summary>
    private const int Format24KHz16BitMono = 26;
    /// <summary>SVSFIsNotXML: read "&lt;" and friends literally.</summary>
    private const int SpeakIsNotXml = 16;

    public static readonly WaveFormat Format = new(24000, 16, 1);

    /// <summary>Returns raw PCM in <see cref="Format"/>.</summary>
    public static byte[] Synthesize(string text, string voiceName, int ratePercent, int volume)
    {
        dynamic? voice = null;
        dynamic? stream = null;
        dynamic? format = null;
        try
        {
            voice = Create("SAPI.SpVoice");
            stream = Create("SAPI.SpMemoryStream");
            format = Create("SAPI.SpAudioFormat");
            format.Type = Format24KHz16BitMono;
            stream.Format = format;
            voice.AudioOutputStream = stream;

            if (FindVoice(voice, voiceName) is { } token)
                voice.Voice = token;

            // SAPI's rate runs -10..10, roughly a doubling or halving at the ends.
            voice.Rate = Math.Clamp((int)Math.Round(ratePercent / 10.0), -10, 10);
            voice.Volume = Math.Clamp(volume, 0, 100);
            voice.Speak(text, SpeakIsNotXml);
            return (byte[])stream.GetData();
        }
        finally
        {
            Release(format);
            Release(stream);
            Release(voice);
        }
    }

    public static List<string> InstalledVoices()
    {
        var names = new List<string>();
        dynamic? voice = null;
        try
        {
            voice = Create("SAPI.SpVoice");
            foreach (var token in voice.GetVoices())
                names.Add((string)token.GetDescription());
        }
        catch (Exception e)
        {
            Plugin.Log.Warning(e, "Couldn't list Windows voices");
        }
        finally
        {
            Release(voice);
        }

        return names;
    }

    /// <summary>The named voice, else the first female one, else null (Windows' default).</summary>
    private static dynamic? FindVoice(dynamic voice, string name)
    {
        if (name.Length > 0)
        {
            foreach (var token in voice.GetVoices())
            {
                if ((string)token.GetDescription() == name)
                    return token;
            }
        }

        var female = voice.GetVoices("Gender=Female");
        return female.Count > 0 ? female.Item(0) : null;
    }

    private static dynamic Create(string progId) =>
        Activator.CreateInstance(Type.GetTypeFromProgID(progId, throwOnError: true)!)!;

    private static void Release(object? com)
    {
        if (com != null && Marshal.IsComObject(com))
            Marshal.FinalReleaseComObject(com);
    }
}
