using System;
using System.Linq;
using System.Text.RegularExpressions;
using Dalamud.Game.Chat;
using Dalamud.Game.Text;
using Dalamud.Game.Text.SeStringHandling;
using Dalamud.Game.Text.SeStringHandling.Payloads;
using VoiceLink.Speech;

namespace VoiceLink;

/// <summary>Picks out the chat messages to read aloud and hands them to the speaker.</summary>
public sealed partial class ChatListener : IDisposable
{
    public static readonly (string Label, XivChatType[] Types)[] ChannelGroups =
    [
        ("Party", [XivChatType.Party, XivChatType.CrossParty]),
        ("Alliance", [XivChatType.Alliance]),
        ("Say", [XivChatType.Say]),
        ("Tells", [XivChatType.TellIncoming, XivChatType.TellOutgoing]),
        ("Yell", [XivChatType.Yell]),
        ("Shout", [XivChatType.Shout]),
        ("Free Company", [XivChatType.FreeCompany]),
        ("Linkshells",
        [
            XivChatType.Ls1, XivChatType.Ls2, XivChatType.Ls3, XivChatType.Ls4,
            XivChatType.Ls5, XivChatType.Ls6, XivChatType.Ls7, XivChatType.Ls8,
        ]),
        ("Cross-world Linkshells",
        [
            XivChatType.CrossLinkShell1, XivChatType.CrossLinkShell2, XivChatType.CrossLinkShell3, XivChatType.CrossLinkShell4,
            XivChatType.CrossLinkShell5, XivChatType.CrossLinkShell6, XivChatType.CrossLinkShell7, XivChatType.CrossLinkShell8,
        ]),
        ("Novice Network", [XivChatType.NoviceNetwork]),
    ];

    private readonly Configuration config;
    private readonly Speaker speaker;

    public ChatListener(Configuration config, Speaker speaker)
    {
        this.config = config;
        this.speaker = speaker;
        Plugin.ChatGui.ChatMessage += OnChatMessage;
    }

    public void Dispose()
    {
        Plugin.ChatGui.ChatMessage -= OnChatMessage;
    }

    private void OnChatMessage(IHandleableChatMessage message)
    {
        if (!config.Enabled || !config.Channels.Contains(message.LogKind))
            return;

        var text = CleanText(message.Message.TextValue);
        if (text.Length == 0)
            return;

        var (name, world) = Sender(message.Sender);
        // An outgoing tell's "sender" is who it went to, but the words are ours.
        var isOwn = message.LogKind == XivChatType.TellOutgoing || IsLocalPlayer(name);

        PairedPlayer? paired = null;
        if (isOwn)
        {
            if (!config.ReadOwnMessages)
                return;
        }
        else
        {
            paired = FindPaired(name, world);
            if (paired == null && config.OnlyPaired)
                return;
        }

        if (config.SayNames && !isOwn && name.Length > 0)
            text = $"{name.Split(' ')[0]} says, {text}";

        speaker.Say(text, paired is { Voice.Length: > 0 } ? paired.Voice : null);
    }

    private PairedPlayer? FindPaired(string name, string? world)
    {
        foreach (var player in config.Paired)
        {
            if (!string.Equals(player.Name.Trim(), name, StringComparison.OrdinalIgnoreCase))
                continue;
            // A sender without a world attached (rare) matches on name alone.
            if (player.World.Length == 0 || world == null || string.Equals(player.World.Trim(), world, StringComparison.OrdinalIgnoreCase))
                return player;
        }

        return null;
    }

    private static bool IsLocalPlayer(string name)
    {
        var own = Plugin.PlayerState.IsLoaded ? Plugin.PlayerState.CharacterName : Plugin.ObjectTable.LocalPlayer?.Name.TextValue;
        return !string.IsNullOrEmpty(own) && string.Equals(own, name, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Name and home world. Other players come with a player payload; our own lines are plain text.</summary>
    private static (string Name, string? World) Sender(SeString sender)
    {
        if (sender.Payloads.OfType<PlayerPayload>().FirstOrDefault() is { } player)
            return (player.PlayerName, player.World.IsValid ? player.World.Value.Name.ToString() : null);

        // Strip the party-slot number and cross-world glyphs the game puts around names.
        return (NonNameCharacters().Replace(sender.TextValue, string.Empty).Trim(), null);
    }

    private string CleanText(string text)
    {
        text = GameGlyphs().Replace(text, " ");
        text = Links().Replace(text, " link ");
        text = Whitespace().Replace(text, " ").Trim();
        if (text.Length > config.MaxLength)
        {
            var cut = text.LastIndexOf(' ', config.MaxLength);
            text = text[..(cut > config.MaxLength / 2 ? cut : config.MaxLength)];
        }

        return text;
    }

    /// <summary>The game's private-use icon characters (auto-translate brackets, item icons and so on), plus control characters.</summary>
    [GeneratedRegex(@"[\uE000-\uF8FF\p{Cc}]")]
    private static partial Regex GameGlyphs();

    [GeneratedRegex(@"\b(?:https?://|www\.)\S+", RegexOptions.IgnoreCase)]
    private static partial Regex Links();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"[^\p{L}'\- ]")]
    private static partial Regex NonNameCharacters();
}
