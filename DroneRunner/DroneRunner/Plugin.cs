using Dalamud.Game.Command;
using Dalamud.Game.Text.SeStringHandling.Payloads;
using Dalamud.Interface.Windowing;
using Dalamud.IoC;
using Dalamud.Plugin;
using Dalamud.Plugin.Services;
using DroneRunner.Windows;

namespace DroneRunner;

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

    private const string CommandName = "/drone";
    private const string AltCommand = "/dronerunner";

    public Configuration Configuration { get; }
    public Runner Runner { get; }

    private readonly WindowSystem windowSystem = new("DroneRunner");
    private readonly MainWindow mainWindow;

    public Plugin()
    {
        Configuration = PluginInterface.GetPluginConfig() as Configuration ?? new Configuration();
        Runner = new Runner(this);

        mainWindow = new MainWindow(this);
        windowSystem.AddWindow(mainWindow);

        CommandManager.AddHandler(CommandName, new CommandInfo(OnCommand)
        {
            HelpMessage = "Open Drone Runner. \"/drone start\", \"/drone stop\", \"/drone kaede\" (flag Kaede on the map).",
        });
        CommandManager.AddHandler(AltCommand, new CommandInfo(OnCommand) { HelpMessage = "Same as /drone." });

        PluginInterface.UiBuilder.Draw += windowSystem.Draw;
        PluginInterface.UiBuilder.OpenMainUi += ToggleMainUi;
        PluginInterface.UiBuilder.OpenConfigUi += ToggleMainUi;
    }

    public void Dispose()
    {
        PluginInterface.UiBuilder.Draw -= windowSystem.Draw;
        PluginInterface.UiBuilder.OpenMainUi -= ToggleMainUi;
        PluginInterface.UiBuilder.OpenConfigUi -= ToggleMainUi;
        CommandManager.RemoveHandler(CommandName);
        CommandManager.RemoveHandler(AltCommand);

        windowSystem.RemoveAllWindows();
        Runner.Dispose();
    }

    public void ToggleMainUi() => mainWindow.Toggle();

    /// <summary>Flags Kaede (drone modules and appraisal) on the map of the zone you're in, or Oizys.</summary>
    public static void FlagKaede()
    {
        var zone = Runner.CurrentZone ?? Zones.All[0];
        GameGui.OpenMapWithMapLink(new MapLinkPayload(zone.TerritoryId, zone.MapId, zone.KaedeMapPos.X, zone.KaedeMapPos.Y));
    }

    private void OnCommand(string command, string args)
    {
        switch (args.Trim().ToLowerInvariant())
        {
            case "start":
            case "go":
                Runner.Start();
                break;
            case "stop":
                Runner.Stop("Stopped.");
                break;
            case "kaede":
            case "map":
                FlagKaede();
                break;
            default:
                ToggleMainUi();
                break;
        }
    }
}
