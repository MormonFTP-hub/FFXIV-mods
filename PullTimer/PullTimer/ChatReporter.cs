using Dalamud.Game.Text.SeStringHandling;
using Lumina.Excel;
using Lumina.Excel.Sheets;
using PullTimer.Tracking;

namespace PullTimer;

/// <summary>Prints pull results to your own chat log (echo only, nothing is sent to other players).</summary>
public sealed class ChatReporter
{
    private const string Tag = "PullTimer";

    private readonly Configuration config;
    private readonly ushort green;
    private readonly ushort yellow;
    private readonly ushort red;
    private readonly ushort grey;

    public ChatReporter(Configuration config)
    {
        this.config = config;

        // UIColor row ids aren't stable across patches, so pick whichever rows look closest.
        var colors = Plugin.DataManager.GetExcelSheet<UIColor>();
        green = Nearest(colors, 0x66DD66);
        yellow = Nearest(colors, 0xFFD24D);
        red = Nearest(colors, 0xFF5A5A);
        grey = Nearest(colors, 0x9A9A9A);
    }

    public void AnnouncePull(PullRecord record)
    {
        var timing = Timing.Classify(record.Offset, config.OnTimeWindow);
        if (config.PullChat == ChatMode.Never || (config.PullChat == ChatMode.OnlyWhenOff && timing == PullTiming.OnTime))
            return;

        PrintPull(record);
    }

    public void AnnounceOwn(PullRecord record)
    {
        if (!config.PrintOwnFirstHit || record.You is not { } you || Timing.OwnHit(you) is not { } hit)
            return;

        var (offset, label) = hit;
        // When it landed, also say when it went off; otherwise the headline already is the went-off time.
        var detail = Timing.ActionDetail(you.Action, you.CastStart, you.Landed != null ? you.WentOff : null);
        var message = new SeStringBuilder()
            .AddText($"Your first hit {label} ")
            .AddUiForeground(ColorFor(offset))
            .AddText(Timing.Signed(offset))
            .AddUiForegroundOff()
            .AddText($" · {detail}")
            .Build();
        Plugin.ChatGui.Print(message, Tag, green);
    }

    /// <summary>Used by /pulltimer last.</summary>
    public void PrintLast(PullRecord? record)
    {
        if (record == null)
        {
            Plugin.ChatGui.Print("No pulls recorded yet.", Tag, green);
            return;
        }

        PrintPull(record);
        if (!record.PullerIsYou && record.You is { WentOff: not null })
            AnnounceOwn(record);
    }

    private void PrintPull(PullRecord record)
    {
        var message = new SeStringBuilder()
            .AddText("Pull ")
            .AddUiForeground(ColorFor(record.Offset))
            .AddText(Timing.Describe(record.Offset, config.OnTimeWindow))
            .AddUiForegroundOff()
            .AddText($" {Timing.Puller(record)}")
            .AddUiForeground(grey)
            .AddText($" [{record.CountdownSeconds}s countdown]")
            .AddUiForegroundOff()
            .Build();
        Plugin.ChatGui.Print(message, Tag, green);
    }

    private ushort ColorFor(double offset) => Timing.Classify(offset, config.OnTimeWindow) switch
    {
        PullTiming.Early => red,
        PullTiming.Late => yellow,
        _ => green,
    };

    private static ushort Nearest(ExcelSheet<UIColor> sheet, uint rgb)
    {
        int tr = (int)(rgb >> 16) & 0xFF, tg = (int)(rgb >> 8) & 0xFF, tb = (int)rgb & 0xFF;
        ushort best = 0;
        var bestDistance = int.MaxValue;
        foreach (var row in sheet)
        {
            if (row.RowId == 0)
                continue;

            // Stored as 0xRRGGBBAA.
            var c = row.Dark;
            int r = (int)(c >> 24) & 0xFF, g = (int)(c >> 16) & 0xFF, b = (int)(c >> 8) & 0xFF;
            var distance = ((r - tr) * (r - tr)) + ((g - tg) * (g - tg)) + ((b - tb) * (b - tb));
            if (distance < bestDistance)
            {
                bestDistance = distance;
                best = (ushort)row.RowId;
            }
        }

        return best;
    }
}
