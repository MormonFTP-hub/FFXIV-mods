using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;
using NAudio.Wave;

namespace VoiceLink.Speech;

/// <summary>
/// Speaks messages one at a time, in order. The next message is synthesized while the current one plays,
/// so back-to-back messages don't wait on the network.
/// </summary>
public sealed class Speaker : IDisposable
{
    /// <summary>Messages beyond this many waiting are dropped rather than read minutes late.</summary>
    private const int MaxWaiting = 6;

    private readonly Configuration config;
    private readonly Synthesizer synthesizer;
    private readonly Channel<Utterance> waiting = Channel.CreateBounded<Utterance>(
        new BoundedChannelOptions(MaxWaiting) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });
    private readonly Channel<Clip> ready = Channel.CreateBounded<Clip>(
        new BoundedChannelOptions(1) { SingleReader = true, SingleWriter = true });
    private readonly CancellationTokenSource disposing = new();
    private readonly Task synthesizing;
    private readonly Task playing;

    /// <summary>Bumped by <see cref="Stop"/>; anything queued under an older value is dropped.</summary>
    private int generation;
    /// <summary>Cancelled by <see cref="Stop"/> to cut off what's playing.</summary>
    private CancellationTokenSource stopCurrent = new();
    private string? problem;

    public Speaker(Configuration config, Synthesizer synthesizer)
    {
        this.config = config;
        this.synthesizer = synthesizer;
        synthesizing = Task.Run(SynthesizeLoop);
        playing = Task.Run(PlayLoop);
    }

    /// <summary>Shown in settings: why the last message wasn't spoken as asked, if it wasn't.</summary>
    public string? LastProblem => problem ?? synthesizer.Problem;

    /// <param name="voice">Natural voice id; null uses the main one.</param>
    public void Say(string text, string? voice = null)
    {
        var utterance = new Utterance(text, voice ?? config.Voice, Volatile.Read(ref generation));
        if (!waiting.Writer.TryWrite(utterance))
            Plugin.Log.Debug("Speech queue full, dropped a message");
    }

    /// <summary>Stops what's playing and forgets everything queued.</summary>
    public void Stop()
    {
        // Generation first: the play loop reads the token before checking the generation, so it can't miss both.
        Interlocked.Increment(ref generation);
        Interlocked.Exchange(ref stopCurrent, new CancellationTokenSource()).Cancel();
    }

    public void Dispose()
    {
        disposing.Cancel();
        stopCurrent.Cancel();
        waiting.Writer.TryComplete();
        try
        {
            Task.WaitAll([synthesizing, playing], TimeSpan.FromSeconds(3));
        }
        catch (AggregateException)
        {
            // Already logged by the loops.
        }

        disposing.Dispose();
    }

    private async Task SynthesizeLoop()
    {
        var ct = disposing.Token;
        try
        {
            await foreach (var utterance in waiting.Reader.ReadAllAsync(ct))
            {
                if (utterance.Generation != Volatile.Read(ref generation))
                    continue;

                WaveStream audio;
                try
                {
                    audio = await synthesizer.SynthesizeAsync(utterance.Text, utterance.Voice, ct);
                    problem = null;
                }
                catch (Exception e) when (!ct.IsCancellationRequested)
                {
                    problem = $"Couldn't make speech: {e.Message}";
                    Plugin.Log.Warning(e, "Speech synthesis failed");
                    continue;
                }

                await ready.Writer.WriteAsync(new Clip(audio, utterance.Generation), ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Unloading.
        }
    }

    private async Task PlayLoop()
    {
        var ct = disposing.Token;
        try
        {
            await foreach (var clip in ready.Reader.ReadAllAsync(ct))
            {
                using var audio = clip.Audio;
                var stop = Volatile.Read(ref stopCurrent).Token;
                if (clip.Generation != Volatile.Read(ref generation))
                    continue;

                using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, stop);
                try
                {
                    await AudioOutput.PlayAsync(audio, config.OutputDevice, config.Volume, linked.Token);
                }
                catch (Exception e) when (!ct.IsCancellationRequested)
                {
                    problem = $"Couldn't play audio: {e.Message}";
                    Plugin.Log.Warning(e, "Audio playback failed");
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Unloading.
        }
    }

    private sealed record Utterance(string Text, string Voice, int Generation);

    private sealed record Clip(WaveStream Audio, int Generation);
}
