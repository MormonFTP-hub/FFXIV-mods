namespace Authenticator.Core;

public sealed class ImportResult
{
    public List<Account> Added { get; } = [];
    public List<Account> AlreadyThere { get; } = [];
    public List<string> Errors { get; } = [];
    /// <summary>QR codes that were read fine but aren't authenticator codes (a website link, ...).</summary>
    public int OtherCodes { get; set; }
    public List<string> Notes { get; } = [];

    public bool FoundAnything => Added.Count + AlreadyThere.Count + Errors.Count + OtherCodes > 0;
}

/// <summary>Turns scanned or pasted text into accounts, skipping ones already added.</summary>
public sealed class Importer
{
    /// <summary>Which parts of a multi-QR Google Authenticator export have been scanned, by batch id.</summary>
    readonly Dictionary<int, SortedSet<int>> migrationParts = [];

    public ImportResult Import(IEnumerable<string> texts, IReadOnlyList<Account> existing)
    {
        var result = new ImportResult();
        foreach (var raw in texts)
        {
            string text = raw.Trim();
            try
            {
                if (GoogleMigration.IsMigration(text))
                {
                    var batch = GoogleMigration.Parse(text);
                    foreach (var account in batch.Accounts)
                        Add(account, existing, result);
                    if (batch.BatchSize > 1)
                        NoteMigrationPart(batch, result);
                }
                else if (OtpUri.IsOtpAuth(text))
                {
                    Add(OtpUri.Parse(text), existing, result);
                }
                else
                {
                    result.OtherCodes++;
                }
            }
            catch (FormatException ex)
            {
                result.Errors.Add(ex.Message);
            }
        }
        return result;
    }

    public static ImportResult Import(IEnumerable<Account> accounts, IReadOnlyList<Account> existing)
    {
        var result = new ImportResult();
        foreach (var account in accounts)
            Add(account, existing, result);
        return result;
    }

    static void Add(Account account, IReadOnlyList<Account> existing, ImportResult result)
    {
        if (existing.Concat(result.Added).Any(a => a.HasSameSecret(account)))
        {
            result.AlreadyThere.Add(account);
            return;
        }
        account.Id = Guid.NewGuid().ToString("N");
        result.Added.Add(account);
    }

    void NoteMigrationPart(MigrationBatch batch, ImportResult result)
    {
        if (!migrationParts.TryGetValue(batch.BatchId, out var seen))
            migrationParts[batch.BatchId] = seen = [];
        seen.Add(batch.BatchIndex);
        var missing = Enumerable.Range(0, batch.BatchSize).Where(i => !seen.Contains(i)).Select(i => (i + 1).ToString()).ToList();
        result.Notes.Add(missing.Count == 0
            ? $"That was the last of the {batch.BatchSize} Google Authenticator export codes."
            : $"Google Authenticator split the export into {batch.BatchSize} QR codes. Still to import: {string.Join(", ", missing)}.");
    }
}
