using System;
using System.Collections.Generic;
using Penumbra.Api.Enums;
using Penumbra.Api.IpcSubscribers;

namespace VoiceLink.Sync;

/// <summary>The few Penumbra calls broadcasting needs. Call from the framework thread.</summary>
internal sealed class PenumbraBridge
{
    private const string ModTag = "VoiceLink";
    /// <summary>High so the clip wins over any sound mod for the same file.</summary>
    private const int ModPriority = 99_999;
    private const int LocalPlayerIndex = 0;

    private readonly ApiVersion apiVersion;
    private readonly GetModDirectory getModDirectory;
    private readonly GetCollectionForObject getCollection;
    private readonly AddTemporaryMod addTemporaryMod;
    private readonly RemoveTemporaryMod removeTemporaryMod;
    private readonly RedrawObject redrawObject;

    /// <summary>The collection the redirect was added to, so it can be taken off the same one.</summary>
    private Guid? appliedTo;

    public PenumbraBridge()
    {
        var pi = Plugin.PluginInterface;
        apiVersion = new ApiVersion(pi);
        getModDirectory = new GetModDirectory(pi);
        getCollection = new GetCollectionForObject(pi);
        addTemporaryMod = new AddTemporaryMod(pi);
        removeTemporaryMod = new RemoveTemporaryMod(pi);
        redrawObject = new RedrawObject(pi);
    }

    public bool Available
    {
        get
        {
            try
            {
                return apiVersion.Invoke().Breaking >= 5;
            }
            catch (Exception)
            {
                return false; // not installed or not loaded
            }
        }
    }

    public string ModDirectory() => getModDirectory.Invoke();

    /// <summary>The collection your character uses, and whether it's assigned to you specifically (rather than everyone).</summary>
    public (Guid Id, string Name, bool Individual)? PlayerCollection()
    {
        var (valid, individual, collection) = getCollection.Invoke(LocalPlayerIndex);
        return valid ? (collection.Id, collection.Name, individual) : null;
    }

    /// <summary>Points <paramref name="gamePath"/> at <paramref name="file"/> for your character only.</summary>
    public void Redirect(string gamePath, string file)
    {
        var collection = PlayerCollection() ?? throw new InvalidOperationException("Your character isn't loaded.");
        if (appliedTo is { } previous && previous != collection.Id)
            removeTemporaryMod.Invoke(ModTag, previous, ModPriority);

        // Same tag and priority replaces the previous redirect rather than stacking another.
        var paths = new Dictionary<string, string> { [gamePath] = file };
        var result = addTemporaryMod.Invoke(ModTag, collection.Id, paths, string.Empty, ModPriority);
        if (result != PenumbraApiEc.Success)
            throw new InvalidOperationException($"Penumbra refused the sound redirect ({result}).");
        appliedTo = collection.Id;
    }

    public void RemoveRedirect()
    {
        if (appliedTo is not { } collection)
            return;
        try
        {
            removeTemporaryMod.Invoke(ModTag, collection, ModPriority);
        }
        catch (Exception e)
        {
            Plugin.Log.Debug(e, "Couldn't remove the sound redirect (Penumbra gone?)");
        }

        appliedTo = null;
    }

    public void RedrawSelf() => redrawObject.Invoke(LocalPlayerIndex, RedrawType.Redraw);
}
