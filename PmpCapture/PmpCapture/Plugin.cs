using System;
using System.IO;
using Dalamud.Game.Command;
using Dalamud.IoC;
using Dalamud.Plugin;
using Dalamud.Plugin.Services;

namespace PmpCapture;

/// <summary>
/// /pmpcapture [label]: saves what the game draws right now for the PMP Viewer to redraw and compare.
/// The scene data (character, pose, camera, light, files) is read on the game thread; the next frame's render targets
/// (G-buffers, light buffers, depth, final image) are copied on the render thread, inside Dalamud's draw.
/// Read-only: nothing is hooked or written to the game.
/// </summary>
public sealed class Plugin : IDalamudPlugin
{
    [PluginService] internal static IDalamudPluginInterface PluginInterface { get; private set; } = null!;
    [PluginService] internal static ICommandManager CommandManager { get; private set; } = null!;
    [PluginService] internal static IClientState ClientState { get; private set; } = null!;
    [PluginService] internal static IObjectTable ObjectTable { get; private set; } = null!;
    [PluginService] internal static IFramework Framework { get; private set; } = null!;
    [PluginService] internal static IGameConfig GameConfig { get; private set; } = null!;
    [PluginService] internal static IChatGui ChatGui { get; private set; } = null!;
    [PluginService] internal static IPluginLog Log { get; private set; } = null!;

    private const string CommandName = "/pmpcapture";

    public Configuration Configuration { get; }

    private CaptureJob? pending;      // asked for; the game thread fills in the scene next update
    private CaptureJob? waiting;      // scene read; the render thread copies the targets at the next draw

    public Plugin()
    {
        Configuration = PluginInterface.GetPluginConfig() as Configuration ?? new Configuration();
        CommandManager.AddHandler(CommandName, new CommandInfo(OnCommand)
        {
            HelpMessage = "Save this moment for the PMP Viewer (optional label). \"/pmpcapture dir <folder>\" sets where captures go.",
        });
        Framework.Update += OnUpdate;
        // our draw handler reads render targets, so it has to run in GPose and with the UI hidden as well
        PluginInterface.UiBuilder.DisableGposeUiHide    = true;
        PluginInterface.UiBuilder.DisableUserUiHide     = true;
        PluginInterface.UiBuilder.DisableCutsceneUiHide = true;
        PluginInterface.UiBuilder.Draw += OnDraw;
    }

    public void Dispose()
    {
        PluginInterface.UiBuilder.Draw -= OnDraw;
        Framework.Update -= OnUpdate;
        CommandManager.RemoveHandler(CommandName);
    }

    private void OnCommand(string command, string args)
    {
        args = args.Trim();
        if (args.StartsWith("dir", StringComparison.OrdinalIgnoreCase))
        {
            var dir = args[3..].Trim().Trim('"');
            if (dir.Length > 0)
            {
                Configuration.OutputDirectory = dir;
                PluginInterface.SavePluginConfig(Configuration);
            }

            ChatGui.Print($"[PMP Capture] captures go to {Configuration.OutputDirectory}");
            return;
        }

        StartCapture(args);
    }

    /// <summary>Queues a capture: "[in N] [label]".</summary>
    private void StartCapture(string args)
    {
        if (pending != null || waiting != null)
        {
            ChatGui.Print("[PMP Capture] a capture is still being saved");
            WriteStatus("busy");
            return;
        }

        // "/pmpcapture in 5 [label]": wait 5 seconds first (time to hide the HUD with Scroll Lock or settle the camera)
        var delay = 0.0;
        var parts = args.Split(' ', 3, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2 && parts[0].Equals("in", StringComparison.OrdinalIgnoreCase) && double.TryParse(parts[1], out var secs))
        {
            delay = Math.Clamp(secs, 0, 60);
            args  = parts.Length > 2 ? parts[2] : "";
        }

        var stamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        var name  = args.Length > 0 ? $"{stamp}_{Sanitize(args)}" : stamp;
        pending   = new CaptureJob(Path.Combine(Configuration.OutputDirectory, name), args);
        due       = DateTime.UtcNow.AddSeconds(delay);
        if (delay > 0)
            ChatGui.Print($"[PMP Capture] capturing in {delay:0.#} s");
    }

    // A capture can also be asked for from the PC: write the arguments to <output>/request.txt.
    // The plugin deletes the file, captures, and writes the saved folder (or "failed: ...") to <output>/last.txt.
    private string RequestFile => Path.Combine(Configuration.OutputDirectory, "request.txt");
    private string StatusFile  => Path.Combine(Configuration.OutputDirectory, "last.txt");
    private DateTime nextPoll;

    private void PollRequest()
    {
        if (DateTime.UtcNow < nextPoll)
            return;
        nextPoll = DateTime.UtcNow.AddSeconds(0.5);
        try
        {
            if (!File.Exists(RequestFile))
                return;
            var args = File.ReadAllText(RequestFile).Trim();
            File.Delete(RequestFile);
            StartCapture(args);
        }
        catch (Exception e)
        {
            Log.Warning(e, "reading the capture request failed");
        }
    }

    private void WriteStatus(string text)
    {
        try
        {
            File.WriteAllText(StatusFile, text);
        }
        catch (Exception e)
        {
            Log.Warning(e, "writing the capture status failed");
        }
    }

    private DateTime due;

    private static string Sanitize(string s)
    {
        foreach (var c in Path.GetInvalidFileNameChars())
            s = s.Replace(c, '_');
        return s.Replace(' ', '_');
    }

    private void OnUpdate(IFramework framework)
    {
        PollRequest();
        var job = pending;
        if (job == null || DateTime.UtcNow < due)
            return;
        pending = null;
        try
        {
            job.ReadScene();
            waiting = job;
        }
        catch (Exception e)
        {
            Log.Error(e, "capture failed");
            ChatGui.PrintError($"[PMP Capture] failed: {e.Message}");
            WriteStatus("failed: " + e.Message);
        }
    }

    private void OnDraw()
    {
        var job = waiting;
        if (job == null)
            return;
        waiting = null;
        try
        {
            job.ReadTargets(PluginInterface.UiBuilder.DeviceHandle);
        }
        catch (Exception e)
        {
            Log.Error(e, "render target copy failed");
            job.Note("render targets: " + e.Message);
        }

        job.SaveInBackground(folder =>
            {
                ChatGui.Print($"[PMP Capture] saved {folder}");
                WriteStatus(folder);
            },
            e =>
            {
                ChatGui.PrintError($"[PMP Capture] saving failed: {e.Message}");
                WriteStatus("failed: " + e.Message);
            });
    }
}
