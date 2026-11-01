using System.IO;
using System.Linq;
using Dalamud.Game.Command;
using Dalamud.Interface.Windowing;
using Dalamud.IoC;
using Dalamud.Plugin;
using Dalamud.Plugin.Services;
using MitPlan.Data;
using MitPlan.Tracking;
using MitPlan.Windows;

namespace MitPlan;

public sealed class Plugin : IDalamudPlugin
{
    [PluginService] internal static IDalamudPluginInterface PluginInterface { get; private set; } = null!;
    [PluginService] internal static ICommandManager CommandManager { get; private set; } = null!;
    [PluginService] internal static IClientState ClientState { get; private set; } = null!;
    [PluginService] internal static IDataManager DataManager { get; private set; } = null!;
    [PluginService] internal static IFramework Framework { get; private set; } = null!;
    [PluginService] internal static ICondition Condition { get; private set; } = null!;
    [PluginService] internal static IObjectTable ObjectTable { get; private set; } = null!;
    [PluginService] internal static ITextureProvider TextureProvider { get; private set; } = null!;
    [PluginService] internal static IChatGui ChatGui { get; private set; } = null!;
    [PluginService] internal static IPluginLog Log { get; private set; } = null!;

    private const string CommandName = "/mitplan";
    private const string ShortCommand = "/mits";

    public Configuration Configuration { get; }
    public PlanLibrary Library { get; }
    public FightFollower Follower { get; }

    /// <summary>The plan for the duty you're in, or null outside the fights it knows.</summary>
    public Plan? DutyPlan { get; private set; }

    private readonly WindowSystem windowSystem = new("MitPlan");
    private readonly MainWindow mainWindow;
    private readonly ConfigWindow configWindow;

    public Plugin()
    {
        Configuration = PluginInterface.GetPluginConfig() as Configuration ?? new Configuration();
        Library = new PlanLibrary(Path.Combine(PluginInterface.GetPluginConfigDirectory(), "plans"));
        Follower = new FightFollower(this);

        mainWindow = new MainWindow(this);
        configWindow = new ConfigWindow(this);
        windowSystem.AddWindow(mainWindow);
        windowSystem.AddWindow(configWindow);

        CommandManager.AddHandler(CommandName, new CommandInfo(OnCommand)
        {
            HelpMessage = "Open Mit Plan. Subcommands: config, reload, or a fight (dmu, fru, m9s … m12s).",
        });
        CommandManager.AddHandler(ShortCommand, new CommandInfo(OnCommand) { HelpMessage = "Same as /mitplan." });

        PluginInterface.UiBuilder.Draw += windowSystem.Draw;
        PluginInterface.UiBuilder.OpenConfigUi += ToggleConfigUi;
        PluginInterface.UiBuilder.OpenMainUi += ToggleMainUi;
        ClientState.TerritoryChanged += OnTerritoryChanged;

        OnTerritoryChanged(ClientState.TerritoryType);
    }

    public void Dispose()
    {
        ClientState.TerritoryChanged -= OnTerritoryChanged;
        PluginInterface.UiBuilder.Draw -= windowSystem.Draw;
        PluginInterface.UiBuilder.OpenConfigUi -= ToggleConfigUi;
        PluginInterface.UiBuilder.OpenMainUi -= ToggleMainUi;
        CommandManager.RemoveHandler(CommandName);
        CommandManager.RemoveHandler(ShortCommand);

        windowSystem.RemoveAllWindows();
        Follower.Dispose();
    }

    public void ToggleConfigUi() => configWindow.Toggle();
    public void ToggleMainUi() => mainWindow.Toggle();

    /// <summary>The job the window is showing: the override, else the job you're on.</summary>
    public string? Job
    {
        get
        {
            if (Configuration.JobOverride is { } job)
                return job;

            var player = ObjectTable.LocalPlayer;
            return player != null && player.ClassJob.IsValid ? Jobs.Normalize(player.ClassJob.Value.Abbreviation.ToString()) : null;
        }
    }

    public void ReloadPlans()
    {
        Library.Reload();
        OnTerritoryChanged(ClientState.TerritoryType);
    }

    private void OnTerritoryChanged(uint territory)
    {
        DutyPlan = Library.ForDuty(GameData.CurrentDuty());
        if (DutyPlan == null)
            return;

        if (Configuration.PickFightFromDuty && Configuration.SelectedPlan != DutyPlan.Id)
        {
            Configuration.SelectedPlan = DutyPlan.Id;
            Configuration.Save();
        }

        if (Configuration.OpenInDuty)
            mainWindow.IsOpen = true;
    }

    private void OnCommand(string command, string args)
    {
        var arg = args.Trim().ToLowerInvariant();
        switch (arg)
        {
            case "":
                ToggleMainUi();
                break;
            case "config":
            case "settings":
                ToggleConfigUi();
                break;
            case "reload":
                ReloadPlans();
                ChatGui.Print($"[Mit Plan] Loaded {Library.Plans.Count} plans" + (Library.Errors.Count > 0 ? $", {Library.Errors.Count} with errors (see settings)." : "."));
                break;
            default:
                var plan = Library.Plans.FirstOrDefault(p => p.Id == arg || p.Short.Equals(arg, System.StringComparison.OrdinalIgnoreCase));
                if (plan == null)
                {
                    ChatGui.PrintError($"[Mit Plan] No fight called \"{arg}\". Fights: {string.Join(", ", Library.Plans.Select(p => p.Id))}.");
                    break;
                }

                Configuration.SelectedPlan = plan.Id;
                Configuration.Save();
                mainWindow.IsOpen = true;
                break;
        }
    }
}
