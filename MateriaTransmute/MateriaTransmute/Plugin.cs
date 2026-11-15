using Dalamud.Game.Command;
using Dalamud.Game.Text.SeStringHandling.Payloads;
using Dalamud.Interface.Windowing;
using Dalamud.IoC;
using Dalamud.Plugin;
using Dalamud.Plugin.Services;
using MateriaTransmute.Windows;

namespace MateriaTransmute;

public sealed class Plugin : IDalamudPlugin
{
    [PluginService] internal static IDalamudPluginInterface PluginInterface { get; private set; } = null!;
    [PluginService] internal static ICommandManager CommandManager { get; private set; } = null!;
    [PluginService] internal static IClientState ClientState { get; private set; } = null!;
    [PluginService] internal static IDataManager DataManager { get; private set; } = null!;
    [PluginService] internal static IFramework Framework { get; private set; } = null!;
    [PluginService] internal static ICondition Condition { get; private set; } = null!;
    [PluginService] internal static IObjectTable ObjectTable { get; private set; } = null!;
    [PluginService] internal static ITargetManager TargetManager { get; private set; } = null!;
    [PluginService] internal static IGameGui GameGui { get; private set; } = null!;
    [PluginService] internal static ITextureProvider TextureProvider { get; private set; } = null!;
    [PluginService] internal static IChatGui ChatGui { get; private set; } = null!;
    [PluginService] internal static IPluginLog Log { get; private set; } = null!;

    private const string CommandName = "/transmute";
    private const string AltCommand = "/mutamix";

    public Configuration Configuration { get; }
    public MateriaCatalog Catalog { get; }
    public Transmuter Transmuter { get; }

    private readonly WindowSystem windowSystem = new("MateriaTransmute");
    private readonly MainWindow mainWindow;

    public Plugin()
    {
        Configuration = PluginInterface.GetPluginConfig() as Configuration ?? new Configuration();
        Catalog = new MateriaCatalog(DataManager);
        Transmuter = new Transmuter(this);

        mainWindow = new MainWindow(this);
        windowSystem.AddWindow(mainWindow);

        CommandManager.AddHandler(CommandName, new CommandInfo(OnCommand)
        {
            HelpMessage = "Open Materia Transmuter. \"/transmute start\" and \"/transmute stop\" run it without the window.",
        });
        CommandManager.AddHandler(AltCommand, new CommandInfo(OnCommand) { HelpMessage = "Same as /transmute." });

        PluginInterface.UiBuilder.Draw += windowSystem.Draw;
        PluginInterface.UiBuilder.OpenMainUi += ToggleMainUi;
        PluginInterface.UiBuilder.OpenConfigUi += ToggleMainUi;
        ClientState.TerritoryChanged += OnTerritoryChanged;
    }

    public void Dispose()
    {
        ClientState.TerritoryChanged -= OnTerritoryChanged;
        PluginInterface.UiBuilder.Draw -= windowSystem.Draw;
        PluginInterface.UiBuilder.OpenMainUi -= ToggleMainUi;
        PluginInterface.UiBuilder.OpenConfigUi -= ToggleMainUi;
        CommandManager.RemoveHandler(CommandName);
        CommandManager.RemoveHandler(AltCommand);

        windowSystem.RemoveAllWindows();
        Transmuter.Dispose();
    }

    public void ToggleMainUi() => mainWindow.Toggle();

    /// <summary>Puts a flag on Mutamix in Central Thanalan and opens the map there.</summary>
    public static void FlagMutamix() =>
        GameGui.OpenMapWithMapLink(new MapLinkPayload(Transmuter.TerritoryId, Transmuter.MapId, Transmuter.MapX, Transmuter.MapY));

    private void OnTerritoryChanged(uint territory)
    {
        if (Transmuter.Running)
            Transmuter.Stop("Stopped: you changed zones.");
    }

    private void OnCommand(string command, string args)
    {
        switch (args.Trim().ToLowerInvariant())
        {
            case "start":
            case "go":
                Transmuter.Start();
                break;
            case "test":
                Transmuter.Start(testRun: true);
                break;
            case "stop":
                Transmuter.Stop("Stopped.");
                break;
            case "where":
            case "map":
                FlagMutamix();
                break;
            default:
                ToggleMainUi();
                break;
        }
    }
}
