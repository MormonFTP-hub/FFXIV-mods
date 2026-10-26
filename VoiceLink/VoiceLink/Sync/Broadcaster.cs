using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;
using VoiceLink.Speech;

namespace VoiceLink.Sync;

/// <summary>
/// Sends speech to other players through their mod sync (Lightless Sync and the like), so they hear it
/// without Voice Link. Each message becomes the camera sound of /photograph: the clip is written into
/// Penumbra's mod folder and redirected for your character, the sync plugin uploads it to everyone
/// paired with you, and then the emote plays it from your character on their screens.
/// </summary>
public sealed class Broadcaster : IDisposable
{
    public const string SoundPath = "sound/vfx/etc/SE_Vfx_Etc_Emote_InstCam.scd";
    private const string ClipFolder = "Voice Link clips";
    private const int ClipsToKeep = 5;
    private const int MaxWaiting = 3;

    /// <summary>The camera sound fires about this long into /photograph.</summary>
    private static readonly TimeSpan SoundStartsAfter = TimeSpan.FromSeconds(6);

    private readonly Configuration config;
    private readonly Synthesizer synthesizer;
    private readonly PenumbraBridge penumbra = new();
    private readonly Channel<string> waiting = Channel.CreateBounded<string>(
        new BoundedChannelOptions(MaxWaiting) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });
    private readonly CancellationTokenSource disposing = new();
    private readonly Task sending;

    private ScdClip.Template? template;
    /// <summary>Swapping the clip while the last one is still playing would cut it off for everyone, so wait for this.</summary>
    private DateTime lastClipEnds = DateTime.MinValue;

    public Broadcaster(Configuration config, Synthesizer synthesizer)
    {
        this.config = config;
        this.synthesizer = synthesizer;
        sending = Task.Run(SendLoop);
    }

    /// <summary>What it's doing now, for the settings window.</summary>
    public string Status { get; private set; } = "Idle";

    public string? Problem { get; private set; }

    public bool Busy { get; private set; }

    public bool PenumbraAvailable => penumbra.Available;

    /// <summary>For the settings window; null when it can't tell. Framework thread only.</summary>
    public (Guid Id, string Name, bool Individual)? PlayerCollection()
    {
        try
        {
            return penumbra.PlayerCollection();
        }
        catch (Exception)
        {
            return null; // Penumbra mid-reload
        }
    }

    /// <summary>Removes the redirect so /photograph sounds normal again. Framework thread only.</summary>
    public void PutSoundBack() => penumbra.RemoveRedirect();

    /// <summary>Installed and loaded sync plugins we know of.</summary>
    public static string[] SyncPlugins() => Plugin.PluginInterface.InstalledPlugins
        .Where(p => p.IsLoaded && p.InternalName is "LightlessSync" or "Snowcloak" or "MareSynchronos" or "PlayerSync")
        .Select(p => p.Name)
        .ToArray();

    public void Send(string text)
    {
        if (!waiting.Writer.TryWrite(text))
            Plugin.ChatGui.PrintError("Voice Link: still sending the last few messages, try again in a moment.");
    }

    public void Dispose()
    {
        disposing.Cancel();
        waiting.Writer.TryComplete();
        try
        {
            sending.Wait(TimeSpan.FromSeconds(3));
        }
        catch (AggregateException)
        {
            // Logged by the loop.
        }

        // Put the camera sound back. Lightless forgets the path when the redirect goes, so the first
        // message after re-enabling isn't heard by others; see the README.
        Plugin.Framework.RunOnFrameworkThread(penumbra.RemoveRedirect).Wait(TimeSpan.FromSeconds(2));
        disposing.Dispose();
    }

    private async Task SendLoop()
    {
        var ct = disposing.Token;
        try
        {
            await foreach (var text in waiting.Reader.ReadAllAsync(ct))
            {
                Busy = true;
                try
                {
                    await SendOne(text, ct);
                    Problem = null;
                }
                catch (Exception e) when (!ct.IsCancellationRequested)
                {
                    Problem = e.Message;
                    Status = "Idle";
                    Plugin.Log.Warning(e, "Broadcast failed");
                    Plugin.ChatGui.PrintError($"Voice Link couldn't send that: {e.Message}");
                }
                finally
                {
                    Busy = false;
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Unloading.
        }
    }

    private async Task SendOne(string text, CancellationToken ct)
    {
        if (Emotes.Photograph is not { } emote)
            throw new InvalidOperationException("Couldn't find the /photograph emote in the game data.");

        var clipDirectory = await Plugin.Framework.RunOnFrameworkThread(() =>
        {
            if (!penumbra.Available)
                throw new InvalidOperationException("Penumbra isn't running.");
            if (!Emotes.CanUse(emote))
                throw new InvalidOperationException("You can't use /photograph right now (not unlocked, or mounted, in combat, etc.).");
            var modDirectory = penumbra.ModDirectory();
            if (string.IsNullOrEmpty(modDirectory) || !Directory.Exists(modDirectory))
                throw new InvalidOperationException("Penumbra has no mod folder set.");
            return Path.Combine(modDirectory, ClipFolder);
        });

        Status = "Making speech...";
        template ??= ScdClip.ReadTemplate(Plugin.DataManager.GetFile(SoundPath)?.Data
                                          ?? throw new InvalidOperationException($"Couldn't read {SoundPath}."));
        short[] samples;
        using (var audio = await synthesizer.SynthesizeAsync(text, config.Voice, ct))
            samples = ToSamples(audio, template.SampleRate);
        var scd = ScdClip.Build(template, samples);
        var seconds = Math.Max(samples.Length, template.Samples) / (double)template.SampleRate;

        if (lastClipEnds > DateTime.UtcNow)
        {
            Status = "Waiting for the last message to finish...";
            await Task.Delay(lastClipEnds - DateTime.UtcNow, ct);
        }

        // A new name every time: the sync plugins and the game both cache by file, and the sync only
        // uploads files that live inside Penumbra's mod folder.
        var file = WriteClip(clipDirectory, scd);
        await Plugin.Framework.RunOnFrameworkThread(() =>
        {
            penumbra.Redirect(SoundPath, file);
            if (config.RedrawAfterClip)
                penumbra.RedrawSelf();
        });

        Status = "Waiting for it to reach synced players...";
        await Task.Delay(TimeSpan.FromSeconds(config.SyncDelaySeconds), ct);

        var used = await Plugin.Framework.RunOnFrameworkThread(() => Emotes.Use(emote));
        if (!used)
            throw new InvalidOperationException("Couldn't use /photograph (mounted, in combat, or busy?).");

        lastClipEnds = DateTime.UtcNow + SoundStartsAfter + TimeSpan.FromSeconds(seconds + 1);
        Status = $"Sent \"{Shorten(text)}\"";
        DeleteOldClips(clipDirectory);
    }

    /// <summary>Mono 16-bit at <paramref name="sampleRate"/>, peak-normalised so it isn't quieter than game sounds.</summary>
    private static short[] ToSamples(WaveStream audio, int sampleRate)
    {
        ISampleProvider source = audio.ToSampleProvider();
        if (source.WaveFormat.Channels > 1)
            source = new StereoToMonoSampleProvider(source);
        if (source.WaveFormat.SampleRate != sampleRate)
            source = new WdlResamplingSampleProvider(source, sampleRate);

        var floats = new List<float>(sampleRate * 5);
        var buffer = new float[4096];
        int read;
        while ((read = source.Read(buffer, 0, buffer.Length)) > 0)
            floats.AddRange(buffer.AsSpan(0, read));

        var peak = floats.Count == 0 ? 0f : floats.Max(MathF.Abs);
        var gain = peak > 0.001f ? Math.Min(0.9f / peak, 4f) : 1f;
        var samples = new short[floats.Count];
        for (var i = 0; i < samples.Length; i++)
            samples[i] = (short)Math.Clamp(floats[i] * gain * short.MaxValue, short.MinValue, short.MaxValue);
        return samples;
    }

    private static string WriteClip(string directory, byte[] scd)
    {
        Directory.CreateDirectory(directory);
        WriteModMetadata(directory);
        var file = Path.Combine(directory, $"clip-{DateTime.UtcNow:yyyyMMdd-HHmmss-fff}.scd");
        File.WriteAllBytes(file, scd);
        return file;
    }

    /// <summary>Makes the clip folder an empty, harmless mod as far as Penumbra is concerned.</summary>
    private static void WriteModMetadata(string directory)
    {
        var meta = Path.Combine(directory, "meta.json");
        if (File.Exists(meta))
            return;

        File.WriteAllText(meta, """
            {
              "FileVersion": 3,
              "Name": "Voice Link clips",
              "Author": "Voice Link",
              "Description": "Speech clips Voice Link sends through your mod sync. It applies them itself; you don't need to enable this mod. Safe to delete.",
              "Version": "",
              "Website": "",
              "ModTags": []
            }
            """);
        File.WriteAllText(Path.Combine(directory, "default_mod.json"), """
            {
              "Name": "",
              "Priority": 0,
              "Files": {},
              "FileSwaps": {},
              "Manipulations": []
            }
            """);
    }

    private static void DeleteOldClips(string directory)
    {
        var old = new DirectoryInfo(directory).GetFiles("clip-*.scd")
            .OrderByDescending(f => f.Name)
            .Skip(ClipsToKeep);
        foreach (var file in old)
        {
            try
            {
                file.Delete();
            }
            catch (IOException)
            {
                // In use by the game or the sync plugin; next time.
            }
        }
    }

    private static string Shorten(string text) => text.Length <= 40 ? text : text[..37] + "...";
}
