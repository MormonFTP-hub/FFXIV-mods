using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace VoiceLink.Speech;

internal static class AudioOutput
{
    /// <summary>WAVE_MAPPER: whatever Windows has as the default playback device.</summary>
    private const int DefaultDevice = -1;

    /// <summary>Playback device names. Windows cuts them to 31 characters.</summary>
    public static List<string> Devices()
    {
        var names = new List<string>();
        var count = waveOutGetNumDevs();
        for (var i = 0; i < count; i++)
        {
            if (waveOutGetDevCaps(i, out var caps, Marshal.SizeOf<WaveOutCapabilities>()) == 0)
                names.Add(caps.ProductName);
        }

        return names;
    }

    /// <summary>Decodes with Windows' built-in MP3 codec.</summary>
    public static WaveStream Mp3(byte[] mp3) =>
        new Mp3FileReaderBase(new MemoryStream(mp3), format => new AcmMp3FrameDecompressor(format));

    /// <summary>Plays to the end, or until <paramref name="ct"/> is cancelled.</summary>
    public static async Task PlayAsync(WaveStream audio, string deviceName, int volume, CancellationToken ct)
    {
        // Volume is applied to the samples: WaveOut's own volume would change the whole game's.
        var samples = new VolumeSampleProvider(audio.ToSampleProvider()) { Volume = Math.Clamp(volume, 0, 100) / 100f };

        using var output = new WaveOutEvent { DeviceNumber = DeviceNumber(deviceName), DesiredLatency = 150 };
        var finished = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        output.PlaybackStopped += (_, e) =>
        {
            if (e.Exception != null)
                finished.TrySetException(e.Exception);
            else
                finished.TrySetResult();
        };

        output.Init(samples, convertTo16Bit: true);
        output.Play();
        await using (ct.Register(() => output.Stop()))
            await finished.Task;
    }

    private static int DeviceNumber(string name)
    {
        if (name.Length == 0)
            return DefaultDevice;

        var index = Devices().IndexOf(name);
        // -1 when it's been unplugged since it was picked, which is also the default device.
        return index >= 0 ? index : DefaultDevice;
    }

    [DllImport("winmm.dll")]
    private static extern int waveOutGetNumDevs();

    [DllImport("winmm.dll", CharSet = CharSet.Auto)]
    private static extern int waveOutGetDevCaps(nint deviceId, out WaveOutCapabilities caps, int size);
}
