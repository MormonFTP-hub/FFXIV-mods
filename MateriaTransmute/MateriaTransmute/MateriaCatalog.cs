using System.Collections.Generic;
using System.Linq;
using Dalamud.Plugin.Services;
using Lumina.Excel.Sheets;

namespace MateriaTransmute;

/// <summary>One materia item: a stat (Materia sheet row) at one grade.</summary>
public sealed record MateriaItem(uint ItemId, uint TypeId, int Grade, string TypeName, string Name, uint Icon);

/// <summary>Every materia in the game, read from the client's own Materia sheet, so it follows new grades and the
/// game's language by itself.</summary>
public sealed class MateriaCatalog
{
    private readonly Dictionary<uint, MateriaItem> byItem = [];
    private readonly Dictionary<uint, string> typeNames = [];

    public MateriaCatalog(IDataManager data)
    {
        var items = data.GetExcelSheet<Item>();
        foreach (var row in data.GetExcelSheet<Materia>())
        {
            var typeName = row.BaseParam.ValueNullable?.Name.ExtractText();
            if (string.IsNullOrEmpty(typeName))
                continue;

            for (var g = 0; g < row.Item.Count; g++)
            {
                var id = row.Item[g].RowId;
                if (id == 0 || items.GetRowOrDefault(id) is not { } item)
                    continue;

                byItem[id] = new MateriaItem(id, row.RowId, g + 1, typeName, item.Name.ExtractText(), item.Icon);
                typeNames.TryAdd(row.RowId, typeName);
            }
        }
    }

    public bool TryGet(uint itemId, out MateriaItem materia) => byItem.TryGetValue(itemId, out materia!);

    public string TypeName(uint typeId) => typeNames.GetValueOrDefault(typeId, $"Stat #{typeId}");

    public IEnumerable<MateriaItem> All => byItem.Values;

    public MateriaItem? Find(uint typeId, int grade) => byItem.Values.FirstOrDefault(m => m.TypeId == typeId && m.Grade == grade);

    private static readonly string[] Numerals = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];

    public static string Roman(int grade) => grade > 0 && grade < Numerals.Length ? Numerals[grade] : grade.ToString();
}
