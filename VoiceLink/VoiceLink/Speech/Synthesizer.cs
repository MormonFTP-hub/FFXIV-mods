using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Wave;

namespace VoiceLink.Speech;

/// <summary>Turns text into audio with the chosen engine, falling back to the Windows voice when the natural one fails.</summary>
public sealed class Synthesizer
{
    /// <summary>After the natural voice fails, how long to use the Windows voice before trying it again.</summary>
    private static readonly TimeSpan NaturalRetryAfter = TimeSpan.FromMinutes(1);

    private readonly Configuration config;
    private DateTime naturalFailedAt = DateTime.MinValue;

    public Synthesizer(Configuration config)
    {
        this.config = config;
    }

    /// <summary>Why the last message wasn't made with the voice asked for, if it wasn't.</summary>
    public string? Problem { get; private set; }

    public bool OnFallback => DateTime.UtcNow - naturalFailedAt < NaturalRetryAfter;

    /// <param name="voice">Natural voice id; ignored for the Windows engine.</param>
    public async Task<WaveStream> SynthesizeAsync(string text, string voice, CancellationToken ct)
    {
        if (config.Engine == VoiceEngine.Natural && !OnFallback)
        {
            // The service drops the odd connection, so one quick retry before giving up on it.
            for (var attempt = 1; attempt <= 2; attempt++)
            {
                try
                {
                    var mp3 = await EdgeTts.SynthesizeAsync(text, voice, config.Rate, config.Pitch, ct);
                    Problem = null;
                    return AudioOutput.Mp3(mp3);
                }
                catch (Exception e) when (!ct.IsCancellationRequested)
                {
                    if (attempt < 2)
                        continue;

                    naturalFailedAt = DateTime.UtcNow;
                    Problem = $"Natural voice unavailable ({e.Message}). Using the Windows voice for a minute.";
                    Plugin.Log.Warning(e, "Natural voice failed, falling back to the Windows voice");
                }
            }
        }

        var pcm = WindowsTts.Synthesize(text, config.WindowsVoice, config.Rate, 100);
        if (config.Engine == VoiceEngine.Windows)
            Problem = null;
        return new RawSourceWaveStream(new MemoryStream(pcm), WindowsTts.Format);
    }
}
