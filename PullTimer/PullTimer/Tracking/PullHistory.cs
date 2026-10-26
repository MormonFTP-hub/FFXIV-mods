using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace PullTimer.Tracking;

/// <summary>Finished pulls, stored as JSON next to the plugin config.</summary>
public sealed class PullHistory
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly string path;
    private readonly object saveLock = new();
    private int saveVersion;
    private int writtenVersion;

    public List<PullRecord> Records { get; private set; } = [];

    public PullRecord? Latest => Records.Count > 0 ? Records[^1] : null;

    public PullHistory(string configDirectory)
    {
        Directory.CreateDirectory(configDirectory);
        path = Path.Combine(configDirectory, "history.json");
        Load();
    }

    public void Add(PullRecord record, int maxEntries)
    {
        Records.Add(record);
        if (Records.Count > maxEntries)
            Records.RemoveRange(0, Records.Count - maxEntries);
        Save();
    }

    public void Clear()
    {
        Records.Clear();
        Save();
    }

    private void Load()
    {
        if (!File.Exists(path))
            return;

        try
        {
            Records = JsonSerializer.Deserialize<List<PullRecord>>(File.ReadAllText(path), JsonOptions) ?? [];
        }
        catch (Exception ex)
        {
            Plugin.Log.Error(ex, "Could not read pull history, starting fresh");
            Records = [];
        }
    }

    /// <summary>Writes on a background thread so serialising never hitches the game; the newest snapshot wins.</summary>
    private void Save()
    {
        var snapshot = Records.ToArray();
        var version = Interlocked.Increment(ref saveVersion);
        Task.Run(() =>
        {
            lock (saveLock)
            {
                if (version < writtenVersion)
                    return;

                try
                {
                    var temp = path + ".tmp";
                    File.WriteAllText(temp, JsonSerializer.Serialize(snapshot, JsonOptions));
                    File.Move(temp, path, overwrite: true);
                    writtenVersion = version;
                }
                catch (Exception ex)
                {
                    Plugin.Log.Error(ex, "Could not save pull history");
                }
            }
        });
    }
}
