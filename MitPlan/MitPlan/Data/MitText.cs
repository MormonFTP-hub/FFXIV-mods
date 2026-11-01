using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace MitPlan.Data;

/// <summary>One button an item asks for, named for the job reading it.</summary>
public sealed class MitButton
{
    public required string Label { get; init; }

    /// <summary>Game action names, for icons (a kitchen sink is several).</summary>
    public List<string> Actions { get; init; } = [];

    /// <summary>False when it's another job's button (Dismantle for a Bard, Sacred Soil for a Sage).</summary>
    public bool ForYou { get; init; } = true;

    public string? OnlyFor { get; init; }
}

/// <summary>A piece of an item: a button, or the sheet's own words between buttons.</summary>
public sealed record MitPart(MitButton? Button, string? Text);

/// <summary>One sheet item ("Reprisal 50% cast", "Party Mit (GNB/DRK) ¹") read for a job.</summary>
public sealed class MitItem
{
    /// <summary>The sheet's text, untouched, for the tooltip.</summary>
    public required string Raw { get; init; }

    /// <summary>The item in the sheet's order: "-10s" then Recitation; Reprisal then "50% cast".</summary>
    public List<MitPart> Parts { get; init; } = [];

    /// <summary>The buttons named in the item. Empty when it's an instruction ("100% hp keep topped").</summary>
    public IEnumerable<MitButton> Buttons => Parts.Where(p => p.Button != null).Select(p => p.Button!);

    /// <summary>Footnote markers (¹, *) pointing at the phase notes.</summary>
    public List<string> Refs { get; init; } = [];

    /// <summary>False when the item is limited to other jobs ("Party Mit (GNB/DRK)" for a Warrior).</summary>
    public bool ForYou { get; init; } = true;

    public string? OnlyFor { get; init; }

    public bool AnyForYou => ForYou && (!Buttons.Any() || Buttons.Any(b => b.ForYou));
}

/// <summary>Turns the sheets' shorthand into each job's buttons.</summary>
public static partial class MitText
{
    private const string Superscripts = "¹²³⁴⁵⁶⁷⁸⁹⁰";

    private sealed record Term(string? Generic, string[] Actions, string? Label);

    private static readonly List<(Regex Pattern, Term Term)> Terms = [];

    static MitText()
    {
        // Generic terms, resolved per job.
        Add(G("party mit"), "party mit", "party mits", "partymit");
        Add(G("short mit"), "short mit", "short cd", "10s mitigation");
        Add(G("40%"), "40%");
        Add(G("90s"), "90s");
        Add(G("invuln"), "invulnerability", "invuln", "invulns");
        Add(G("buddy mit"), "buddy mit");
        Add(G("lb3"), "lb3", "tank lb");
        Add(G("kitchen sink"), "kitchen sink");
        Add(G("gcd shields"), "gcd", "gcds", "gcd spam", "gcd shields", "gcd tanks", "emergency gcd");

        // Every job's role actions.
        Add(A("Reprisal"), "reprisal", "rep");
        Add(A("Rampart"), "rampart");
        Add(A("Provoke"), "provoke");
        Add(A("Feint"), "feint");
        Add(A("Addle"), "addle");

        // Job actions named in the sheets.
        Add(A("Passage of Arms"), "pld wings", "passage of arms");
        Add(A("Dismantle"), "dismantle");
        Add(A("Magick Barrier"), "magick barrier", "barrier");
        Add(A("Tempera Grassa"), "tempera grassa", "tempera");
        Add(A("Shake It Off"), "shake it off", "shake");
        Add(A("Divine Veil"), "divine veil");
        Add(A("Dark Missionary"), "dark missionary");
        Add(A("Heart of Light"), "heart of light");
        Add(A("Troubadour"), "troubadour", "troub");
        Add(A("Tactician"), "tactician", "tact");
        Add(A("Shield Samba"), "shield samba", "samba");

        // Scholar.
        Add(L("Recitation + Spreadlo", "Recitation", "Deployment Tactics"), "reci-spreadlo", "reci spreadlo", "reci/prot spreadlo",
            "reci/prot dissipation spreadlo", "recit spreadlo");
        Add(L("Spreadlo", "Deployment Tactics"), "spreadlo", "spread-lo", "spread lo", "crit spreadlo", "fish crit spreadlo");
        Add(L("Recitation + Concitation", "Recitation", "Concitation"), "reci-concitation", "reci concitation", "recit concit");
        Add(L("Recitation + GCD shield", "Recitation", "Adloquium"), "reci-gcd");
        Add(A("Recitation"), "recitation", "reci");
        Add(A("Protraction"), "protraction", "prot");
        Add(A("Sacred Soil"), "sacred soil", "scared soil", "soil");
        Add(A("Fey Illumination"), "fey illumination", "fey illumuniation", "illum", "fey");
        Add(A("Whispering Dawn"), "whispering dawn", "whispering", "whisp", "wisp");
        Add(A("Fey Blessing"), "fey blessing", "blessing");
        Add(A("Seraphism"), "seraphism");
        Add(A("Summon Seraph"), "summon seraph", "seraph", "serpah");
        Add(A("Consolation"), "consolation", "seraph veils", "veils", "veil", "1st veil", "2nd veil");
        Add(A("Expedient"), "expedient", "expedience", "exped", "exp");
        Add(A("Concitation"), "concitation", "concit");
        Add(A("Indomitability"), "indomitability", "indom");
        Add(A("Dissipation"), "dissipation");
        Add(A("Excogitation"), "excogitation", "excog");
        Add(A("Aetherpact"), "aetherpact");

        // Sage.
        Add(L("Zoe + Eukrasian Prognosis II", "Zoe", "Eukrasian Prognosis II"), "zoe shields", "zoe eukprog");
        Add(A("Zoe"), "zoe");
        Add(A("Eukrasian Prognosis II"), "eukprog", "eukrasian prognosis");
        Add(A("Kerachole"), "kerachole", "kera");
        Add(A("Holos"), "holos");
        Add(A("Panhaima"), "panhaima");
        Add(A("Philosophia"), "philosophia", "sophia");

        // White Mage.
        Add(A("Temperance"), "temperance", "temp");
        Add(A("Liturgy of the Bell"), "liturgy of the bell", "bell");
        Add(A("Divine Caress"), "divine caress", "caress");
        Add(A("Plenary Indulgence"), "plenary indulgence", "confession");
        Add(A("Benediction"), "benediction");
        Add(A("Asylum"), "asylum");

        // Astrologian.
        Add(A("Collective Unconscious"), "collective unconscious", "cu");
        Add(A("Neutral Sect"), "neutral sect", "neutral");
        Add(A("Sun Sign"), "sun sign", "sun");
        Add(A("Macrocosmos"), "macrocosmos", "macro");
    }

    private static Term G(string key) => new(key, [], null);
    private static Term A(string action) => new(null, [action], null);
    private static Term L(string label, params string[] actions) => new(null, actions, label);

    private static void Add(Term term, params string[] words)
    {
        foreach (var w in words)
            Terms.Add((new Regex($@"(?<![a-z]){Regex.Escape(w)}(?![a-z])", RegexOptions.IgnoreCase | RegexOptions.Compiled), term));
    }

    [GeneratedRegex(@"[¹²³⁴⁵⁶⁷⁸⁹⁰]+|\*+")]
    private static partial Regex RefPattern();

    [GeneratedRegex(@"\(\s*((?:PLD|WAR|DRK|GNB|WHM|SCH|AST|SGE|MNK|DRG|NIN|SAM|RPR|VPR|BRD|MCH|DNC|BLM|SMN|RDM|PCT)(?:\s*/\s*(?:PLD|WAR|DRK|GNB|WHM|SCH|AST|SGE|MNK|DRG|NIN|SAM|RPR|VPR|BRD|MCH|DNC|BLM|SMN|RDM|PCT))*)\s*\)")]
    private static partial Regex JobsPattern();

    [GeneratedRegex(@"\s{2,}")]
    private static partial Regex Spaces();

    [GeneratedRegex(@"\(\s*\)")]
    private static partial Regex EmptyBrackets();

    /// <summary>
    /// Reads one item for a job. <paramref name="job"/> null keeps generic terms generic (the party view);
    /// <paramref name="slot"/> says which column it came from, so "Divine Veil" in a tank column means your party mit.
    /// </summary>
    public static MitItem Resolve(string raw, string? job, Slot? slot)
    {
        var text = raw;
        var refs = RefPattern().Matches(text).Select(m => m.Value).ToList();
        text = RefPattern().Replace(text, " ");

        string? onlyFor = null;
        var forYou = true;
        var jobs = JobsPattern().Match(text);
        if (jobs.Success)
        {
            onlyFor = jobs.Groups[1].Value.Replace(" ", "");
            text = text.Remove(jobs.Index, jobs.Length);
            if (job != null)
                forYou = onlyFor.Split('/').Contains(job);
        }

        // Someone else's line ("Party Mit (GNB/DRK)" for a Warrior) stays in the sheet's words, not yours.
        var reader = forYou ? job : null;

        // Every term in the text, left to right, the longest where two start together.
        var matches = Terms
            .SelectMany(t => t.Pattern.Matches(text).Select(m => (Match: m, t.Term)))
            .OrderBy(m => m.Match.Index)
            .ThenByDescending(m => m.Match.Length)
            .ToList();

        var parts = new List<MitPart>();
        var at = 0;
        foreach (var (match, term) in matches)
        {
            if (match.Index < at)
                continue;

            AddText(parts, text[at..match.Index]);
            at = match.Index + match.Length;
            parts.Add(new MitPart(Button(term, reader, slot?.Role), null));
        }

        AddText(parts, text[at..]);
        return new MitItem { Raw = raw, Parts = parts, Refs = refs, ForYou = forYou, OnlyFor = onlyFor };
    }

    /// <summary>Keeps the sheet's words between buttons, minus the joiners left over from splitting ("/", "+").</summary>
    private static void AddText(List<MitPart> parts, string text)
    {
        text = Spaces().Replace(EmptyBrackets().Replace(text, " "), " ").Trim().Trim('/', '|', ',', '&').Trim();
        if (text.Length > 0 && text != "+")
            parts.Add(new MitPart(null, text));
    }

    private static MitButton Button(Term term, string? job, string? role)
    {
        if (term.Generic is { } key)
        {
            if (job != null && Jobs.Generic[key].TryGetValue(job, out var mine))
            {
                var named = key is "kitchen sink" or "gcd shields" ? Jobs.GenericLabel[key] : string.Join(" + ", mine);
                return new MitButton { Label = named, Actions = [.. mine] };
            }

            return new MitButton { Label = Jobs.GenericLabel[key] };
        }

        var actions = term.Actions;
        var label = term.Label ?? actions[0];
        if (job == null)
            return new MitButton { Label = label, Actions = [.. actions] };

        // Another tank's or ranged's party mit in your column is yours to press with your own.
        if ((role == "tank" && Jobs.TankPartyMits.Contains(actions[0])) || (role == "ranged" && Jobs.RangedPartyMits.Contains(actions[0])))
        {
            if (Jobs.Generic["party mit"].TryGetValue(job, out var mine))
                return new MitButton { Label = mine[0], Actions = [.. mine] };
        }

        if (Jobs.Owner.TryGetValue(actions[0], out var owner) && owner != job)
            return new MitButton { Label = label, Actions = [.. actions], ForYou = false, OnlyFor = owner };

        return new MitButton { Label = label, Actions = [.. actions] };
    }

    /// <summary>The phase note a footnote marker points at ("¹ Use your 90s…", "*Shake/Veil can…").</summary>
    public static string? Footnote(IEnumerable<string> notes, string marker) =>
        notes.FirstOrDefault(n => n.StartsWith(marker, StringComparison.Ordinal)
                                  && (n.Length == marker.Length
                                      || (marker[0] == '*' ? n[marker.Length] != '*' : !Superscripts.Contains(n[marker.Length]))));
}
