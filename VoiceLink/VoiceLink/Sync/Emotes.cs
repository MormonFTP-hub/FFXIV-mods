using System.Linq;
using FFXIVClientStructs.FFXIV.Client.UI.Agent;
using Lumina.Excel.Sheets;

namespace VoiceLink.Sync;

internal static unsafe class Emotes
{
    public const string PhotographCommand = "/photograph";

    /// <summary>Row id of /photograph, looked up by its command in case it moves between patches.</summary>
    public static ushort? Photograph { get; } = Find(PhotographCommand);

    public static bool CanUse(ushort id)
    {
        var agent = AgentEmote.Instance();
        return agent != null && agent->CanUseEmote(id);
    }

    /// <summary>Same as using the emote from the emote window. Framework thread only.</summary>
    public static bool Use(ushort id)
    {
        var agent = AgentEmote.Instance();
        if (agent == null || !agent->CanUseEmote(id))
            return false;
        agent->ExecuteEmote(id);
        return true;
    }

    private static ushort? Find(string command)
    {
        var row = Plugin.DataManager.GetExcelSheet<Emote>()
            .FirstOrDefault(e => e.TextCommand.IsValid && e.TextCommand.Value.Command.ToString() == command);
        return row.RowId == 0 ? null : (ushort)row.RowId;
    }
}
