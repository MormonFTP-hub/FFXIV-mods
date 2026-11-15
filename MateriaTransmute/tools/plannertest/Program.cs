using FFXIVClientStructs.FFXIV.Client.Game;
using MateriaTransmute;

// Made-up materia: Piety (type 7) and Tenacity (type 19) at grades X and XI, Crit (type 13) XI kept.
var pietyX = new MateriaItem(1, 7, 10, "Piety", "Piety Materia X", 0);
var pietyXI = new MateriaItem(2, 7, 11, "Piety", "Piety Materia XI", 0);
var tenX = new MateriaItem(3, 19, 10, "Tenacity", "Tenacity Materia X", 0);
var critXI = new MateriaItem(4, 13, 11, "Critical Hit", "Critical Hit Materia XI", 0);

MateriaStack S(MateriaItem m, int q, short slot) => new(InventoryType.Inventory1, slot, m, q);
var bags = new List<MateriaStack> { S(pietyX, 3, 0), S(pietyX, 1, 1), S(tenX, 2, 2), S(pietyXI, 7, 3), S(critXI, 20, 4) };
var fails = 0;
void Check(string what, bool ok) { Console.WriteLine($"{(ok ? "ok  " : "FAIL")} {what}"); if (!ok) fails++; }

var cfg = new Configuration();
Check("nothing ticked → no trade", Planner.Next(bags, cfg) == null && Planner.CountTrades(bags, cfg) == 0);

cfg.TrashTypes.Add(7); // all Piety
var b = Planner.Next(bags, cfg);
Check("Piety only: grade X has 4 → skipped, XI trade of 5", b != null && b.Grade == 11 && b.Picks.Sum(p => p.Take) == 5 && b.Picks.All(p => p.Stack.Materia == pietyXI));
Check("Piety only: 1 trade", Planner.CountTrades(bags, cfg) == 1);

cfg.TrashItems.Add(3); // Tenacity X too
b = Planner.Next(bags, cfg);
Check("mixing: grade X first (4 Piety + 1 Tenacity)", b != null && b.Grade == 10 && b.Picks.Sum(p => p.Take) == 5);
Check("smallest stack first", b != null && b.Picks.Where(p => p.Stack.Materia == pietyX).Select(p => p.Stack.Quantity).SequenceEqual(new[] { 1, 3 }));
Check("never touches Crit", Planner.CountTrades(bags, cfg) == 2 && b!.Picks.All(p => p.Stack.Materia != critXI));
Console.WriteLine("   " + b!.Describe());

cfg.MixTypes = false;
b = Planner.Next(bags, cfg);
Check("no mixing: grade X can't make 5 of one item → XI", b != null && b.Grade == 11 && Planner.CountTrades(bags, cfg) == 1);

cfg.MixTypes = true;
cfg.KeepPerItem = 2;
Check("keep 2 of each: X has 2+0 spare, XI has 5 → 1 trade", Planner.CountTrades(bags, cfg) == 1 && Planner.Next(bags, cfg)?.Grade == 11);
cfg.KeepPerItem = 3;
Check("keep 3: XI has 4 spare → none", Planner.Next(bags, cfg) == null);

// The in-game case from 2026-11-15: 127 Spell Speed XI and 12 Piety XI, both junk.
var sps = new MateriaItem(5, 25, 11, "Spell Speed", "Quicktongue Materia XI", 0);
var pie = new MateriaItem(6, 7, 11, "Piety", "Piety Materia XI", 0);
var bag2 = new List<MateriaStack> { S(sps, 127, 0), S(pie, 12, 1) };
var cfg2 = new Configuration { TrashTypes = [7, 25] };
b = Planner.Next(bag2, cfg2);
Check("one Piety + four Spell Speed (Piety rides along to rule it out)",
    b != null && b.Picks.Single(p => p.Stack.Materia == pie).Take == 1 && b.Picks.Single(p => p.Stack.Materia == sps).Take == 4);
Console.WriteLine("   " + b!.Describe());

// Six junk stats at one grade: five different ones in the trade, one each.
var six = Enumerable.Range(0, 6).Select(i => S(new MateriaItem((uint)(10 + i), (uint)(30 + i), 9, $"Stat{i}", $"Stat{i} IX", 0), 10 + i, (short)i)).ToList();
var cfg3 = new Configuration { TrashTypes = [30, 31, 32, 33, 34, 35] };
b = Planner.Next(six, cfg3);
Check("six junk stats → five different, one each, biggest piles first",
    b != null && b.Picks.Count == 5 && b.Picks.All(p => p.Take == 1) && b.Picks.All(p => p.Stack.Materia.ItemId != 10));

cfg3.MixTypes = false;
b = Planner.Next(six, cfg3);
Check("mixing off → five of the biggest pile", b != null && b.Picks.Count == 1 && b.Picks[0].Take == 5 && b.Picks[0].Stack.Materia.ItemId == 15);

Console.WriteLine(fails == 0 ? "all passed" : $"{fails} failed");
return fails;
