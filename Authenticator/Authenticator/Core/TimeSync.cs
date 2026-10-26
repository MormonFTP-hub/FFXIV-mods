using System.Buffers.Binary;
using System.Net.Sockets;

namespace Authenticator.Core;

/// <summary>
/// Codes only match the site's if the PC clock is right, so the clock is checked once against an internet time
/// server (SNTP) and any difference is corrected for.
/// </summary>
public static class TimeSync
{
    static readonly string[] Servers = ["time.windows.com", "time.google.com", "pool.ntp.org"];
    static readonly DateTime NtpEpoch = new(1900, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public static TimeSpan Offset { get; private set; }
    public static bool IsSynced { get; private set; }

    public static DateTimeOffset Now => DateTimeOffset.UtcNow + Offset;

    public static async Task<bool> SyncAsync()
    {
        foreach (var server in Servers)
        {
            try
            {
                if (await QueryAsync(server) is { } offset && offset.Duration() < TimeSpan.FromDays(2))
                {
                    Offset = offset;
                    IsSynced = true;
                    return true;
                }
            }
            catch (Exception ex) when (ex is SocketException or OperationCanceledException or TimeoutException) { }
        }
        return false;
    }

    static async Task<TimeSpan?> QueryAsync(string server)
    {
        using var udp = new UdpClient();
        udp.Connect(server, 123);
        var request = new byte[48];
        request[0] = 0x1B; // no leap warning, version 3, client mode
        var t0 = DateTime.UtcNow;
        await udp.SendAsync(request);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        var reply = (await udp.ReceiveAsync(timeout.Token)).Buffer;
        var t3 = DateTime.UtcNow;

        if (reply.Length < 48 || (reply[0] & 0x07) != 4 || reply[1] == 0 || (reply[0] >> 6) == 3)
            return null; // not a server reply, kiss-of-death, or unsynchronised server
        var t1 = ReadTimestamp(reply, 32);
        var t2 = ReadTimestamp(reply, 40);
        return ((t1 - t0) + (t2 - t3)) / 2;
    }

    static DateTime ReadTimestamp(byte[] buffer, int offset)
    {
        ulong seconds = BinaryPrimitives.ReadUInt32BigEndian(buffer.AsSpan(offset));
        ulong fraction = BinaryPrimitives.ReadUInt32BigEndian(buffer.AsSpan(offset + 4));
        if ((seconds & 0x80000000) == 0)
            seconds += 0x1_0000_0000UL; // era 1, from February 2036
        return NtpEpoch.AddTicks((long)(seconds * TimeSpan.TicksPerSecond + ((fraction * TimeSpan.TicksPerSecond) >> 32)));
    }
}
