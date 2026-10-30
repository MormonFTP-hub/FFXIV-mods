// Gunbreaker, Dawntrail 7.4–7.57 (js/jobs/gnb_dt.js, GunbreakerDT74 on gnb_ew.js). The Balance's 7.4 play: Lightning
// Shot before the pull, No Mercy and Bloodfest after Brutal Shell, then every minute Sonic Break, Double Down, Reign of
// Beasts → Noble Blood → Lion Heart and one Gnashing Fang chain inside No Mercy, with Bow Shock, Blasting Zone and
// every Continuation woven in. The second Gnashing Fang charge goes mid-minute, before it would cap; Burst Strike only
// spends cartridges that would otherwise overcap (or be lost when Bloodfest's six-cartridge cap ends).
BLM.SIM_APLS.gnb = `
# Gunbreaker — Dawntrail 7.4–7.57
actions.precombat=lightningShot,at=-0.7

# Abilities, woven between GCDs.
actions=/continuation
actions+=/tincture,if=cd.noMercy.remains<5&(prev_gcd.keenEdge|prev_gcd.demonSlice|time>10)&((time+10)%120<20)
actions+=/noMercy,if=prev_gcd.brutalShell|prev_gcd.demonSlaughter|time>10
actions+=/bloodfest,if=gauge.carts<=3&(buff.noMercy.up|cd.noMercy.remains<gcd&time>10)
actions+=/bowShock,if=buff.noMercy.up
actions+=/blastingZone,if=buff.noMercy.up|cd.noMercy.remains>15

# Finish a chain once it's started.
actions+=/gnashingFang,if=gauge.ammo
actions+=/reignOfBeasts,if=gauge.reign

# Inside No Mercy.
actions+=/sonicBreak,if=buff.noMercy.up|buff.readyToBreak.remains<gcd*2
actions+=/doubleDown,if=buff.noMercy.up|cd.noMercy.remains>20&cd.doubleDown.ready
actions+=/reignOfBeasts,if=buff.noMercy.up|buff.readyToReign.remains<gcd*4
actions+=/gnashingFang,if=buff.noMercy.up&(!buff.readyToReign.up|buff.noMercy.remains>gcd*6)

# Outside it: the second Gnashing Fang before it caps.
actions+=/gnashingFang,if=cd.gnashingFang.fullin<gcd&cd.noMercy.remains>gcd*3

# AoE: Fated Circle (and Fated Brand) for spare cartridges, Demon Slice → Demon Slaughter.
actions+=/call_action_list,name=aoe,if=targets>=3

# Burst Strike only for cartridges that would go to waste.
actions+=/burstStrike,if=gauge.carts>3&buff.bloodfest.remains<gcd*(gauge.carts-2)
actions+=/burstStrike,if=combo.brutalShell&(gauge.carts>=6|gauge.carts>=3&!buff.bloodfest.up)
actions+=/burstStrike,if=fight.remains<gcd*gauge.carts
actions+=/solidBarrel,if=combo.brutalShell
actions+=/brutalShell,if=combo.keenEdge
actions+=/keenEdge

actions.aoe=/fatedCircle,if=gauge.carts>3&buff.bloodfest.remains<gcd*(gauge.carts-2)
actions.aoe+=/fatedCircle,if=combo.demonSlice&(gauge.carts>=6|gauge.carts>=3&!buff.bloodfest.up)
actions.aoe+=/fatedCircle,if=buff.noMercy.up&gauge.carts>=1&cd.doubleDown.remains>5
actions.aoe+=/demonSlaughter,if=combo.demonSlice
actions.aoe+=/demonSlice
`;
