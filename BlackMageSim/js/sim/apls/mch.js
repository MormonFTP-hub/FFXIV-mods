// Machinist, Dawntrail 7.0–7.57 (js/jobs/mch_dt.js). The Balance's standard play: Reassemble and the tincture
// before the pull, Air Anchor at the pull, Barrel Stabilizer, Chain Saw into Excavator and the Queen, then Wildfire
// as the late weave before Full Metal Field and the free Hypercharge so six weaponskills land in it; every two minutes
// the same. Tools on cooldown with Reassemble on them (never on Full Metal Field), Hypercharge at 50 Heat only when no
// tool comes up during it, Double Check and Checkmate one per Blazing Shot and never sitting near three, the Queen at
// 90+ Battery (any 50+ in the burst), no Heat or Battery overcapped.
BLM.SIM_APLS.mch = `
# Machinist — Dawntrail 7.0–7.57
actions.precombat=reassemble,at=-4.8
actions.precombat+=/tincture,at=-2

# Abilities. Barrel Stabilizer's button turns into Full Metal Field and Wildfire's into Detonator: both are guarded.
actions=/tincture,if=cd.wildfire.remains<10|fight.remains<31
actions+=/barrelStabilizer,if=!buff.fullMetalMachinist.up&combat
actions+=/automatonQueen,if=gauge.battery>=90|gauge.battery>=50&(cd.wildfire.remains>105|cd.wildfire.remains<5|fight.remains<15)
actions+=/queenOverdrive,if=gauge.queen&fight.remains<2.5
actions+=/wildfire,if=!debuff.wildfire.up&gcd.remains<1.5&buff.fullMetalMachinist.up&!job.overheated&cd.chainSaw.remains>gcd.remains+0.1&!buff.excavatorReady.up&cd.airAnchor.remains>gcd.remains+0.1
actions+=/hypercharge2,if=!job.overheated&buff.hypercharged.up&(debuff.wildfire.up|cd.wildfire.remains>20)&!buff.fullMetalMachinist.up
# Outside the burst: Hypercharge at 50 Heat when no tool comes up during it (at 100 regardless).
actions+=/hypercharge2,if=!job.overheated&!debuff.wildfire.up&gauge.heat>=50&cd.wildfire.remains>8&cd.airAnchor.remains>8&cd.chainSaw.remains>8&cd.drill.fullin>8&!buff.excavatorReady.up&!buff.fullMetalMachinist.up
actions+=/hypercharge2,if=!job.overheated&!debuff.wildfire.up&(gauge.heat>=100|gauge.heat>=50&fight.remains<10)
actions+=/reassemble,if=!buff.reassembled.up&!job.overheated&!buff.fullMetalMachinist.up&(cd.airAnchor.remains<gcd.remains+0.1|cd.chainSaw.remains<gcd.remains+0.1|buff.excavatorReady.up|cd.drill.charges>=1)
actions+=/doubleCheck,if=job.overheated|cd.doubleCheck.charges_fractional>=2|cd.wildfire.remains>100|fight.remains<10
actions+=/checkmate,if=job.overheated|cd.checkmate.charges_fractional>=2|cd.wildfire.remains>100|fight.remains<10

# Weaponskills.
actions+=/fullMetalField,if=debuff.wildfire.up|buff.fullMetalMachinist.remains<3|fight.remains<5
actions+=/blazingShot,if=job.overheated
actions+=/airAnchor
actions+=/chainSaw
actions+=/excavator,if=usable.excavator
actions+=/drill
# AoE: Scattergun (130 to all, 10 Heat) over the combo from three targets.
actions+=/scattergun,if=targets>=3
actions+=/heatedCleanShot,if=combo.heatedSlugShot
actions+=/heatedSlugShot,if=combo.heatedSplitShot
actions+=/heatedSplitShot
`;
