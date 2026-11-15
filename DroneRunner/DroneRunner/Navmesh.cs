using System;
using System.Linq;
using System.Numerics;
using Dalamud.Plugin.Ipc;

namespace DroneRunner;

/// <summary>Talks to the vnavmesh plugin, which does the walking. Every call is guarded: if vnavmesh isn't loaded,
/// the plugin falls back to flagging the map and letting you walk.</summary>
public sealed class Navmesh
{
    private readonly ICallGateSubscriber<bool> isReady;
    private readonly ICallGateSubscriber<Vector3, bool, bool> pathfindAndMoveTo;
    private readonly ICallGateSubscriber<bool> pathfindInProgress;
    private readonly ICallGateSubscriber<bool> isRunning;
    private readonly ICallGateSubscriber<object> stop;

    public Navmesh()
    {
        var pi = Plugin.PluginInterface;
        isReady = pi.GetIpcSubscriber<bool>("vnavmesh.Nav.IsReady");
        pathfindAndMoveTo = pi.GetIpcSubscriber<Vector3, bool, bool>("vnavmesh.SimpleMove.PathfindAndMoveTo");
        pathfindInProgress = pi.GetIpcSubscriber<bool>("vnavmesh.SimpleMove.PathfindInProgress");
        isRunning = pi.GetIpcSubscriber<bool>("vnavmesh.Path.IsRunning");
        stop = pi.GetIpcSubscriber<object>("vnavmesh.Path.Stop");
    }

    public static bool Installed =>
        Plugin.PluginInterface.InstalledPlugins.Any(p => p.InternalName == "vnavmesh" && p.IsLoaded);

    public bool IsReady => Try(() => isReady.InvokeFunc(), false);

    /// <summary>A path is being worked out or walked.</summary>
    public bool Busy => Try(() => pathfindInProgress.InvokeFunc() || isRunning.InvokeFunc(), false);

    public bool MoveTo(Vector3 destination) => Try(() => pathfindAndMoveTo.InvokeFunc(destination, false), false);

    public void Stop() => Try(() =>
    {
        stop.InvokeAction();
        return true;
    }, false);

    private static T Try<T>(Func<T> call, T fallback)
    {
        if (!Installed)
            return fallback;
        try
        {
            return call();
        }
        catch (Exception e)
        {
            Plugin.Log.Debug($"vnavmesh call failed: {e.Message}");
            return fallback;
        }
    }
}
