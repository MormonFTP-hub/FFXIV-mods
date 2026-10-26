using System.Numerics;
using Dalamud.Interface.Colors;
using PullTimer.Tracking;

namespace PullTimer;

public enum PullTiming
{
    Early,
    OnTime,
    Late,
}

/// <summary>Shared classification and wording, so chat, overlay and windows all agree.</summary>
public static class Timing
{
    public static PullTiming Classify(double offset, float window) =>
        offset < -window ? PullTiming.Early : offset > window ? PullTiming.Late : PullTiming.OnTime;

    public static string Signed(double seconds) => seconds < 0 ? $"-{-seconds:0.00}s" : $"+{seconds:0.00}s";

    public static string Describe(double offset, float window) => Classify(offset, window) switch
    {
        PullTiming.Early => $"{-offset:0.00}s early",
        PullTiming.Late => $"{offset:0.00}s late",
        _ => $"on time ({Signed(offset)})",
    };

    /// <summary>"Fire III, cast from -3.71s, went off -0.70s", leaving out whatever isn't known.</summary>
    public static string ActionDetail(string? action, double? castStart, double? wentOff)
    {
        var text = action ?? "?";
        if (castStart is { } cast)
            text += $", cast from {Signed(cast)}";
        if (wentOff is { } off)
            text += $", went off {Signed(off)}";
        return text;
    }

    public static string Puller(PullRecord record)
    {
        if (record.PullerName == null)
            return "with no party action seen (body pull, or someone outside your party)";

        var action = ActionDetail(record.PullerAction, record.PullerCastStart, record.PullerWentOff);
        var who = record.PullerIsYou
            ? $"by you ({action})"
            : $"by {record.PullerName} ({record.PullerJob} · {action})";

        // Couldn't see the hit land, so the offset above is when it went off.
        return record.Source == PullSource.Action && !record.PullLanded ? $"{who}, hit not seen" : who;
    }

    /// <summary>Your own first hit: "landed +0.06s" or, if the landing wasn't seen, "went off -0.70s".</summary>
    public static (double Offset, string Label)? OwnHit(MemberResult you) =>
        you.Landed is { } landed ? (landed, "landed") : you.WentOff is { } wentOff ? (wentOff, "went off") : null;

    public static string Summary(PullRecord record, float window) =>
        $"Pull {Describe(record.Offset, window)} {Puller(record)} [{record.CountdownSeconds}s countdown]";

    public static Vector4 Color(PullTiming timing) => timing switch
    {
        PullTiming.Early => ImGuiColors.DalamudRed,
        PullTiming.Late => ImGuiColors.DalamudYellow,
        _ => ImGuiColors.HealerGreen,
    };

    public static Vector4 Color(double offset, float window) => Color(Classify(offset, window));
}
