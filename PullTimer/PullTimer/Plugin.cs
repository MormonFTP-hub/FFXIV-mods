using Dalamud.Game.Command;
using Dalamud.Interface.GameFonts;
using Dalamud.Interface.ManagedFontAtlas;
using Dalamud.Interface.Windowing;
using Dalamud.IoC;
using Dalamud.Plugin;
using Dalamud.Plugin.Services;
using PullTimer.Tracking;
using PullTimer.Windows;

namespace PullTimer;

public sealed class Plugin : IDalamudPlugin
{
    [PluginService] internal static IDalamudPluginInterface PluginInterface { get; private set; } = null!;
    [PluginService] internal static ICommandManager CommandManager { get; private set; } = null!;
    [PluginService] internal static IClientState ClientState { get; private set; } = null!;
    [PluginService] internal static IDataManager DataManager { get; private set; } = null!;
    [PluginService] internal static IFramework Framework { get; private set; } = null!;
    [PluginService] internal static ICondition Condition { get; private set; } = null!;
    [PluginService] internal static IObjectTable ObjectTable { get; private set; } = null!;
    [PluginService] internal static IPartyList PartyList { get; private set; } = null!;
    [PluginService] internal static IChatGui ChatGui { get; private set; } = null!;
    [PluginService] internal static IGameInteropProvider GameInterop { get; private set; } = null!;
    [PluginService] internal static IPluginLog Log { get; private set; } = null!;

    private const string CommandName = "/pulltimer";

    public Configuration Configuration { get; }
    public PullHistory History { get; }
    public PullTracker Tracker { get; }
    public IFontHandle BigFont { get; }

    private readonly ChatReporter reporter;
    private readonly WindowSystem windowSystem = new("PullTimer");
    private readonly MainWindow mainWindow;
    private readonly ConfigWindow configWindow;
    private readonly OverlayWindow overlayWindow;

    public Plugin()
    {
        Configuration = PluginInterface.GetPluginConfig() as Configuration ?? new Configuration();
        History = new PullHistory(PluginInterface.GetPluginConfigDirectory());
        BigFont = PluginInterface.UiBuilder.FontAtlas.NewGameFontHandle(new GameFontStyle(GameFontFamily.Axis, 30f));

        reporter = new ChatReporter(Configuration);
        Tracker = new PullTracker(Configuration);
        Tracker.PullAnnounced += reporter.AnnouncePull;
        Tracker.OwnFirstHit += reporter.AnnounceOwn;
        Tracker.Completed += OnPullCompleted;

        mainWindow = new MainWindow(this);
        configWindow = new ConfigWindow(this);
        overlayWindow = new OverlayWindow(this);
        windowSystem.AddWindow(mainWindow);
        windowSystem.AddWindow(configWindow);
        windowSystem.AddWindow(overlayWindow);

        CommandManager.AddHandler(CommandName, new CommandInfo(OnCommand)
        {
            HelpMessage = "Open Pull Timer. Subcommands: config, overlay (toggle), last (print the last pull to chat).",
        });

        PluginInterface.UiBuilder.Draw += windowSystem.Draw;
        PluginInterface.UiBuilder.OpenConfigUi += ToggleConfigUi;
        PluginInterface.UiBuilder.OpenMainUi += ToggleMainUi;
    }

    public void Dispose()
    {
        PluginInterface.UiBuilder.Draw -= windowSystem.Draw;
        PluginInterface.UiBuilder.OpenConfigUi -= ToggleConfigUi;
        PluginInterface.UiBuilder.OpenMainUi -= ToggleMainUi;
        CommandManager.RemoveHandler(CommandName);

        windowSystem.RemoveAllWindows();
        Tracker.Dispose();
        BigFont.Dispose();
    }

    public void ToggleConfigUi() => configWindow.Toggle();
    public void ToggleMainUi() => mainWindow.Toggle();

    private void OnPullCompleted(PullRecord record) => History.Add(record, Configuration.MaxHistory);

    private void OnCommand(string command, string args)
    {
        switch (args.Trim().ToLowerInvariant())
        {
            case "config":
            case "settings":
                ToggleConfigUi();
                break;
            case "overlay":
                Configuration.ShowOverlay = !Configuration.ShowOverlay;
                Configuration.Save();
                break;
            case "last":
                reporter.PrintLast(History.Latest);
                break;
            default:
                ToggleMainUi();
                break;
        }
    }
}
