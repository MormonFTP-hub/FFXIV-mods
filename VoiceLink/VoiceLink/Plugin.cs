using Dalamud.Game.Command;
using Dalamud.Interface.Windowing;
using Dalamud.IoC;
using Dalamud.Plugin;
using Dalamud.Plugin.Services;
using VoiceLink.Speech;
using VoiceLink.Sync;
using VoiceLink.Windows;

namespace VoiceLink;

public sealed class Plugin : IDalamudPlugin
{
    [PluginService] internal static IDalamudPluginInterface PluginInterface { get; private set; } = null!;
    [PluginService] internal static ICommandManager CommandManager { get; private set; } = null!;
    [PluginService] internal static IChatGui ChatGui { get; private set; } = null!;
    [PluginService] internal static IDataManager DataManager { get; private set; } = null!;
    [PluginService] internal static IFramework Framework { get; private set; } = null!;
    [PluginService] internal static IPlayerState PlayerState { get; private set; } = null!;
    [PluginService] internal static IObjectTable ObjectTable { get; private set; } = null!;
    [PluginService] internal static ITargetManager TargetManager { get; private set; } = null!;
    [PluginService] internal static IPartyList PartyList { get; private set; } = null!;
    [PluginService] internal static IPluginLog Log { get; private set; } = null!;

    private const string CommandName = "/voicelink";
    private const string ShortCommandName = "/vl";
    private const string Tag = "VoiceLink";

    public Configuration Configuration { get; }
    public Speaker Speaker { get; }
    public Broadcaster Broadcaster { get; }

    private readonly ChatListener listener;
    private readonly WindowSystem windowSystem = new("VoiceLink");
    private readonly ConfigWindow configWindow;

    public Plugin()
    {
        Configuration = PluginInterface.GetPluginConfig() as Configuration ?? new Configuration();

        var synthesizer = new Synthesizer(Configuration);
        Speaker = new Speaker(Configuration, synthesizer);
        Broadcaster = new Broadcaster(Configuration, synthesizer);
        listener = new ChatListener(Configuration, Speaker);

        configWindow = new ConfigWindow(this);
        windowSystem.AddWindow(configWindow);

        var command = new CommandInfo(OnCommand)
        {
            HelpMessage = "Open Voice Link settings. \"/voicelink <text>\" speaks text: through your mod sync when broadcasting is on "
                          + "(you do /photograph and synced players hear it), otherwise on your PC only. Nothing is sent to chat. "
                          + "Also: stop (silence and clear the queue), on, off.",
        };
        CommandManager.AddHandler(CommandName, command);
        CommandManager.AddHandler(ShortCommandName, new CommandInfo(OnCommand) { ShowInHelp = false });

        PluginInterface.UiBuilder.Draw += windowSystem.Draw;
        PluginInterface.UiBuilder.OpenConfigUi += ToggleConfigUi;
        PluginInterface.UiBuilder.OpenMainUi += ToggleConfigUi;
    }

    public void Dispose()
    {
        PluginInterface.UiBuilder.Draw -= windowSystem.Draw;
        PluginInterface.UiBuilder.OpenConfigUi -= ToggleConfigUi;
        PluginInterface.UiBuilder.OpenMainUi -= ToggleConfigUi;
        CommandManager.RemoveHandler(CommandName);
        CommandManager.RemoveHandler(ShortCommandName);

        windowSystem.RemoveAllWindows();
        listener.Dispose();
        Broadcaster.Dispose();
        Speaker.Dispose();
    }

    public void ToggleConfigUi() => configWindow.Toggle();

    private void OnCommand(string command, string args)
    {
        var text = args.Trim();
        switch (text.ToLowerInvariant())
        {
            case "":
            case "config":
            case "settings":
                ToggleConfigUi();
                break;
            case "stop":
                Speaker.Stop();
                break;
            case "on":
            case "off":
                Configuration.Enabled = text.ToLowerInvariant() == "on";
                Configuration.Save();
                ChatGui.Print(Configuration.Enabled ? "Reading chat aloud." : "Not reading chat aloud.", Tag);
                break;
            default:
                if (Configuration.Broadcast)
                    Broadcaster.Send(text);
                else
                    Speaker.Say(text);
                break;
        }
    }
}
