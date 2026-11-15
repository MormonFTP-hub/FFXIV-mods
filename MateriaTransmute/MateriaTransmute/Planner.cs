using System.Collections.Generic;
using System.Linq;
using FFXIVClientStructs.FFXIV.Client.Game;

namespace MateriaTransmute;

/// <summary>One stack of materia in your bags.</summary>
public readonly record struct MateriaStack(InventoryType Container, short Slot, MateriaItem Materia, int Quantity);

/// <summary>Five materia of one grade, as the stacks they come from.</summary>
public sealed record Batch(int Grade, IReadOnlyList<(MateriaStack Stack, int Take)> Picks)
{
    public string Describe() =>
        string.Join(", ", Picks.GroupBy(p => p.Stack.Materia.ItemId)
            .Select(g => $"{g.Sum(p => p.Take)}× {g.First().Stack.Materia.Name}"));
}

/// <summary>Picks what goes into each trade. Pure: it only reads the stacks and the settings.</summary>
public static class Planner
{
    public const int PerTrade = 5;

    public static bool IsTrash(Configuration config, MateriaItem m) =>
        config.TrashTypes.Contains(m.TypeId) || config.TrashItems.Contains(m.ItemId);

    /// <summary>The next trade to make, lowest grade first (so a lucky grade-up can join a later trade of that grade),
    /// or null when no grade has five junk materia left over.</summary>
    public static Batch? Next(IReadOnlyList<MateriaStack> stacks, Configuration config)
    {
        foreach (var grade in Junk(stacks, config).Select(s => s.Materia.Grade).Distinct().Order())
        {
            if (ForGrade(stacks, config, grade) is { } batch)
                return batch;
        }

        return null;
    }

    /// <summary>How many trades the junk in your bags makes right now (not counting what the trades give back).</summary>
    public static int CountTrades(IReadOnlyList<MateriaStack> stacks, Configuration config)
    {
        var spare = Spare(stacks, config);
        return config.MixTypes
            ? spare.GroupBy(s => s.Grade).Sum(g => g.Sum(s => s.Count) / PerTrade)
            : spare.Sum(s => s.Count / PerTrade);
    }

    /// <summary>How many of each junk materia can go in, after the keep amount.</summary>
    public static int SpareOf(IReadOnlyList<MateriaStack> stacks, Configuration config, uint itemId) =>
        Spare(stacks, config).FirstOrDefault(s => s.ItemId == itemId).Count;

    private static IEnumerable<MateriaStack> Junk(IReadOnlyList<MateriaStack> stacks, Configuration config) =>
        stacks.Where(s => IsTrash(config, s.Materia) && s.Quantity > 0);

    private static List<(uint ItemId, int Grade, int Count)> Spare(IReadOnlyList<MateriaStack> stacks, Configuration config) =>
        Junk(stacks, config)
            .GroupBy(s => s.Materia.ItemId)
            .Select(g => (g.Key, g.First().Materia.Grade, Count: g.Sum(s => s.Quantity) - config.KeepPerItem))
            .Where(s => s.Count > 0)
            .ToList();

    private static Batch? ForGrade(IReadOnlyList<MateriaStack> stacks, Configuration config, int grade)
    {
        var spare = Spare(stacks, config).Where(s => s.Grade == grade).OrderByDescending(s => s.Count).ToList();
        if (!config.MixTypes)
            spare = spare.Where(s => s.Count >= PerTrade).Take(1).ToList();
        if (spare.Sum(s => s.Count) < PerTrade)
            return null;

        var picks = new List<(MateriaStack, int)>();
        var need = PerTrade;
        foreach (var (itemId, _, count) in spare)
        {
            var fromItem = System.Math.Min(count, need);
            // Smallest stacks first, so a trade empties bag slots rather than nibbling at big stacks.
            foreach (var stack in stacks.Where(s => s.Materia.ItemId == itemId && s.Quantity > 0).OrderBy(s => s.Quantity))
            {
                if (fromItem == 0)
                    break;
                var take = System.Math.Min(stack.Quantity, fromItem);
                picks.Add((stack, take));
                fromItem -= take;
                need -= take;
            }

            if (need == 0)
                break;
        }

        return need == 0 ? new Batch(grade, picks) : null;
    }
}
