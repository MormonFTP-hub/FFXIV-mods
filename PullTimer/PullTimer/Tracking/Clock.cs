using System.Diagnostics;

namespace PullTimer.Tracking;

/// <summary>Monotonic high-resolution time in seconds. Unaffected by system clock changes.</summary>
public static class Clock
{
    public static double Now => Stopwatch.GetTimestamp() / (double)Stopwatch.Frequency;
}
