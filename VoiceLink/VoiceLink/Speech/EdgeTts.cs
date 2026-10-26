using System;
using System.Globalization;
using System.IO;
using System.Net.WebSockets;
using System.Security;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace VoiceLink.Speech;

/// <summary>
/// Microsoft's neural voices, through the service behind Edge's "Read aloud". Free and needs no key,
/// but it's unofficial: if Microsoft changes it this throws, and the caller falls back to the Windows voice.
/// The protocol follows the edge-tts project (github.com/rany2/edge-tts).
/// </summary>
public static class EdgeTts
{
    private const string ChromiumVersion = "143.0.3650.75";
    private const string Endpoint = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

    /// <summary>Server time minus ours, learned from a rejected connection. The token is time-based, so a wrong PC clock breaks it.</summary>
    private static long clockSkewSeconds;

    /// <summary>Returns MP3 audio (24 kHz mono).</summary>
    public static async Task<byte[]> SynthesizeAsync(string text, string voice, int ratePercent, int pitchHz, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        ct = timeout.Token;

        using var ws = await Connect(ct);

        var timestamp = DateTime.UtcNow.ToString("ddd MMM dd yyyy HH:mm:ss 'GMT+0000 (Coordinated Universal Time)'", CultureInfo.InvariantCulture);
        await SendText(ws,
            $"X-Timestamp:{timestamp}\r\n"
            + "Content-Type:application/json; charset=utf-8\r\n"
            + "Path:speech.config\r\n\r\n"
            + "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"},"
            + "\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}\r\n", ct);

        var ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>"
                   + $"<voice name='{VoiceLongName(voice)}'>"
                   + $"<prosody pitch='{Signed(pitchHz)}Hz' rate='{Signed(ratePercent)}%' volume='+0%'>"
                   + SecurityElement.Escape(text)
                   + "</prosody></voice></speak>";
        // The trailing Z after an already-labelled timestamp is what Edge sends, so the service expects it.
        await SendText(ws,
            $"X-RequestId:{Guid.NewGuid():N}\r\n"
            + "Content-Type:application/ssml+xml\r\n"
            + $"X-Timestamp:{timestamp}Z\r\n"
            + "Path:ssml\r\n\r\n"
            + ssml, ct);

        using var audio = new MemoryStream();
        using var frame = new MemoryStream();
        var buffer = new byte[16 * 1024];
        while (true)
        {
            frame.SetLength(0);
            WebSocketReceiveResult result;
            do
            {
                result = await ws.ReceiveAsync(buffer, ct);
                if (result.MessageType == WebSocketMessageType.Close)
                    throw new IOException($"Voice service closed the connection ({ws.CloseStatus} {ws.CloseStatusDescription}).");
                frame.Write(buffer, 0, result.Count);
            }
            while (!result.EndOfMessage);

            var data = frame.GetBuffer().AsSpan(0, (int)frame.Length);
            if (result.MessageType == WebSocketMessageType.Text)
            {
                if (Encoding.UTF8.GetString(data).Contains("Path:turn.end", StringComparison.Ordinal))
                    break;
                continue;
            }

            // Binary frames: 2-byte big-endian header length, the header, then the audio chunk.
            if (data.Length < 2)
                continue;
            var headerLength = (data[0] << 8) | data[1];
            if (data.Length < 2 + headerLength)
                continue;
            var header = Encoding.UTF8.GetString(data.Slice(2, headerLength));
            if (header.Contains("Path:audio\r\n", StringComparison.Ordinal))
                audio.Write(data[(2 + headerLength)..]);
        }

        try
        {
            await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, null, CancellationToken.None);
        }
        catch (Exception)
        {
            // The audio is already here; a messy close doesn't matter.
        }

        if (audio.Length == 0)
            throw new IOException($"Voice service returned no audio (voice {voice}).");
        return audio.ToArray();
    }

    private static async Task<ClientWebSocket> Connect(CancellationToken ct)
    {
        var major = ChromiumVersion.Split('.')[0];
        for (var attempt = 0; ; attempt++)
        {
            var ws = new ClientWebSocket();
            ws.Options.CollectHttpResponseDetails = true;
            ws.Options.SetRequestHeader("Pragma", "no-cache");
            ws.Options.SetRequestHeader("Cache-Control", "no-cache");
            ws.Options.SetRequestHeader("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold");
            ws.Options.SetRequestHeader("Accept-Language", "en-US,en;q=0.9");
            ws.Options.SetRequestHeader("User-Agent",
                $"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{major}.0.0.0 Safari/537.36 Edg/{major}.0.0.0");
            ws.Options.SetRequestHeader("Cookie", $"muid={Convert.ToHexString(RandomNumberGenerator.GetBytes(16))};");

            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds() + Interlocked.Read(ref clockSkewSeconds);
            var url = $"{Endpoint}?TrustedClientToken={EdgeToken.TrustedClientToken}&ConnectionId={Guid.NewGuid():N}"
                      + $"&Sec-MS-GEC={EdgeToken.Generate(now)}&Sec-MS-GEC-Version=2-{ChromiumVersion}";
            try
            {
                await ws.ConnectAsync(new Uri(url), ct);
                return ws;
            }
            catch (WebSocketException) when (attempt == 0 && ServerClockSkew(ws) is { } skew && Math.Abs(skew) >= 60)
            {
                // Rejected, and the server's clock is well off ours: adopt its time and try once more.
                ws.Dispose();
                Interlocked.Exchange(ref clockSkewSeconds, skew);
            }
            catch
            {
                ws.Dispose();
                throw;
            }
        }
    }

    private static long? ServerClockSkew(ClientWebSocket ws)
    {
        if (ws.HttpResponseHeaders?.TryGetValue("Date", out var values) != true)
            return null;
        foreach (var value in values!)
        {
            if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var serverTime))
                return (long)(serverTime - DateTimeOffset.UtcNow).TotalSeconds;
        }

        return null;
    }

    /// <summary>"en-US-AvaNeural" → "Microsoft Server Speech Text to Speech Voice (en-US, AvaNeural)".</summary>
    private static string VoiceLongName(string shortName)
    {
        var parts = shortName.Split('-');
        if (parts.Length < 3)
            return shortName;
        var locale = $"{parts[0]}-{parts[1]}";
        var name = string.Join('-', parts[2..]);
        return $"Microsoft Server Speech Text to Speech Voice ({locale}, {name})";
    }

    private static string Signed(int value) => value.ToString("+0;-0;+0", CultureInfo.InvariantCulture);

    private static Task SendText(ClientWebSocket ws, string message, CancellationToken ct) =>
        ws.SendAsync(Encoding.UTF8.GetBytes(message), WebSocketMessageType.Text, true, ct);
}
