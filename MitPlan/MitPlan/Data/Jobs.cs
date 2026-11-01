using System.Collections.Generic;
using System.Linq;

namespace MitPlan.Data;

public enum Role
{
    None,
    Tank,
    Healer,
    Melee,
    Ranged,
    Caster,
}

/// <summary>Jobs, their roles, and what each one presses for the sheets' generic terms ("Party Mit", "40%").</summary>
public static class Jobs
{
    public static readonly string[] All =
    [
        "PLD", "WAR", "DRK", "GNB",
        "WHM", "SCH", "AST", "SGE",
        "MNK", "DRG", "NIN", "SAM", "RPR", "VPR",
        "BRD", "MCH", "DNC",
        "BLM", "SMN", "RDM", "PCT",
    ];

    private static readonly Dictionary<string, string> BaseClass = new()
    {
        ["GLA"] = "PLD", ["MRD"] = "WAR", ["CNJ"] = "WHM", ["PGL"] = "MNK", ["LNC"] = "DRG",
        ["ROG"] = "NIN", ["ARC"] = "BRD", ["THM"] = "BLM", ["ACN"] = "SMN",
    };

    /// <summary>The job a class levels into, so a Gladiator sees the Paladin plan.</summary>
    public static string Normalize(string abbreviation) =>
        BaseClass.TryGetValue(abbreviation, out var job) ? job : abbreviation;

    public static Role RoleOf(string? job) => job switch
    {
        "PLD" or "WAR" or "DRK" or "GNB" => Role.Tank,
        "WHM" or "SCH" or "AST" or "SGE" => Role.Healer,
        "MNK" or "DRG" or "NIN" or "SAM" or "RPR" or "VPR" => Role.Melee,
        "BRD" or "MCH" or "DNC" => Role.Ranged,
        "BLM" or "SMN" or "RDM" or "PCT" => Role.Caster,
        _ => Role.None,
    };

    public static bool Fits(Slot slot, string job)
    {
        if (slot.Jobs is { Count: > 0 } jobs)
            return jobs.Contains(job);

        return slot.Role switch
        {
            "tank" => RoleOf(job) == Role.Tank,
            "melee" => RoleOf(job) == Role.Melee,
            "ranged" => RoleOf(job) == Role.Ranged,
            "caster" => RoleOf(job) == Role.Caster,
            _ => false,
        };
    }

    /// <summary>The column a job reads by default: its own job column, else the first position for its role.</summary>
    public static Slot? DefaultSlot(Plan plan, string job) =>
        plan.Slots.FirstOrDefault(s => s.Jobs?.Contains(job) == true)
        ?? plan.Slots.FirstOrDefault(s => s.Role != "extras" && Fits(s, job));

    /// <summary>Generic sheet terms, per job. A job missing from a term has nothing for it.</summary>
    public static readonly Dictionary<string, Dictionary<string, string[]>> Generic = new()
    {
        ["party mit"] = new()
        {
            ["WAR"] = ["Shake It Off"], ["PLD"] = ["Divine Veil"], ["DRK"] = ["Dark Missionary"], ["GNB"] = ["Heart of Light"],
            ["BRD"] = ["Troubadour"], ["MCH"] = ["Tactician"], ["DNC"] = ["Shield Samba"],
            ["RDM"] = ["Magick Barrier"], ["PCT"] = ["Tempera Grassa"],
        },
        ["short mit"] = new()
        {
            ["WAR"] = ["Bloodwhetting"], ["PLD"] = ["Holy Sheltron"], ["DRK"] = ["The Blackest Night"], ["GNB"] = ["Heart of Corundum"],
        },
        ["40%"] = new()
        {
            ["WAR"] = ["Damnation"], ["PLD"] = ["Guardian"], ["DRK"] = ["Shadowed Vigil"], ["GNB"] = ["Great Nebula"],
        },
        ["90s"] = new()
        {
            ["WAR"] = ["Thrill of Battle"], ["PLD"] = ["Bulwark"], ["DRK"] = ["Dark Mind"], ["GNB"] = ["Camouflage"],
        },
        ["invuln"] = new()
        {
            ["WAR"] = ["Holmgang"], ["PLD"] = ["Hallowed Ground"], ["DRK"] = ["Living Dead"], ["GNB"] = ["Superbolide"],
        },
        ["buddy mit"] = new()
        {
            ["WAR"] = ["Nascent Flash"], ["PLD"] = ["Intervention"], ["DRK"] = ["The Blackest Night"], ["GNB"] = ["Heart of Corundum"],
        },
        ["lb3"] = new()
        {
            ["WAR"] = ["Land Waker"], ["PLD"] = ["Last Bastion"], ["DRK"] = ["Dark Force"], ["GNB"] = ["Gunmetal Soul"],
        },
        ["kitchen sink"] = new()
        {
            ["WAR"] = ["Rampart", "Damnation", "Bloodwhetting", "Thrill of Battle"],
            ["PLD"] = ["Rampart", "Guardian", "Holy Sheltron", "Bulwark"],
            ["DRK"] = ["Rampart", "Shadowed Vigil", "The Blackest Night", "Dark Mind", "Oblation"],
            ["GNB"] = ["Rampart", "Great Nebula", "Heart of Corundum", "Camouflage"],
        },
        ["gcd shields"] = new()
        {
            ["SCH"] = ["Adloquium", "Concitation"], ["SGE"] = ["Eukrasian Diagnosis", "Eukrasian Prognosis II"],
        },
    };

    /// <summary>Display names for the generic terms when there's no job to translate them for.</summary>
    public static readonly Dictionary<string, string> GenericLabel = new()
    {
        ["party mit"] = "Party Mit",
        ["short mit"] = "Short Mit",
        ["40%"] = "40%",
        ["90s"] = "90s",
        ["invuln"] = "Invuln",
        ["buddy mit"] = "Buddy Mit",
        ["lb3"] = "Tank LB3",
        ["kitchen sink"] = "Kitchen Sink",
        ["gcd shields"] = "GCD shields",
    };

    /// <summary>Actions only one job has. A cell naming another job's action isn't for you (e.g. Dismantle for a Bard).</summary>
    public static readonly Dictionary<string, string> Owner = new()
    {
        ["Dismantle"] = "MCH",
        ["Magick Barrier"] = "RDM",
        ["Tempera Grassa"] = "PCT",
        ["Tempera Coat"] = "PCT",
        ["Passage of Arms"] = "PLD",
        ["Shake It Off"] = "WAR",
        ["Divine Veil"] = "PLD",
        ["Dark Missionary"] = "DRK",
        ["Heart of Light"] = "GNB",
        ["Troubadour"] = "BRD",
        ["Tactician"] = "MCH",
        ["Shield Samba"] = "DNC",

        // Healer buttons, so a Sage reading a column written for a Scholar sees which ones aren't theirs.
        ["Recitation"] = "SCH", ["Protraction"] = "SCH", ["Deployment Tactics"] = "SCH", ["Adloquium"] = "SCH",
        ["Sacred Soil"] = "SCH", ["Fey Illumination"] = "SCH", ["Whispering Dawn"] = "SCH", ["Fey Blessing"] = "SCH",
        ["Seraphism"] = "SCH", ["Summon Seraph"] = "SCH", ["Consolation"] = "SCH", ["Expedient"] = "SCH",
        ["Concitation"] = "SCH", ["Indomitability"] = "SCH", ["Dissipation"] = "SCH", ["Excogitation"] = "SCH",
        ["Aetherpact"] = "SCH",
        ["Zoe"] = "SGE", ["Eukrasian Prognosis II"] = "SGE", ["Kerachole"] = "SGE", ["Holos"] = "SGE",
        ["Panhaima"] = "SGE", ["Philosophia"] = "SGE",
        ["Temperance"] = "WHM", ["Liturgy of the Bell"] = "WHM", ["Divine Caress"] = "WHM",
        ["Plenary Indulgence"] = "WHM", ["Benediction"] = "WHM", ["Asylum"] = "WHM",
        ["Collective Unconscious"] = "AST", ["Neutral Sect"] = "AST", ["Sun Sign"] = "AST", ["Macrocosmos"] = "AST",
    };

    /// <summary>Party mits that swap for each other: a WAR in a column saying "Divine Veil" presses Shake It Off.</summary>
    public static readonly HashSet<string> TankPartyMits = ["Shake It Off", "Divine Veil", "Dark Missionary", "Heart of Light"];
    public static readonly HashSet<string> RangedPartyMits = ["Troubadour", "Tactician", "Shield Samba"];
}
