// White Mage, Dawntrail 7.4–7.57 (js/jobs/whm_dt.js, dt74). The Balance's standard play: Glare III hardcast before
// the pull, Dia then the tincture, Presence of Mind after two Glares with its three Glare IVs and the opening Misery
// (7.4 starts with the Blood Lily in bloom); Dia kept up, Assize on cooldown, Thin Air on MP spells, Lucid Dreaming
// for MP. Lilies are spent one at a time as they would overcap; the Misery they bloom waits for the next Presence of
// Mind when that is close, and goes before the next Lily would be lost. The tincture goes with Presence of Mind, or
// earlier when waiting for it would cost a use before the fight ends; an instant GCD (a Lily, Misery) opens the weave.
// var.lily_in: seconds to the next Lily (gauge.lilyAt is on the engine's clock, `now`).
BLM.SIM_APLS.whm = `
# White Mage — Dawntrail 7.4–7.57
actions.precombat=glare3,at=-1.5

actions=/variable,name=lily_in,value=gauge.lilyAt-now
actions+=/variable,name=burst_in,value=cd.presenceOfMind.remains
actions+=/variable,name=want_pot,value=cd.tincture.ready&(time<10|var.burst_in<3|(fight.remains>285&fight.remains-var.burst_in<285)|fight.remains<var.burst_in+15)

# Abilities, woven between GCDs.
actions+=/tincture,if=var.want_pot
actions+=/presenceOfMind,if=time>5
actions+=/assize,if=time>6
actions+=/thinAir,if=!buff.thinAir.up&(cd.thinAir.charges>=2|cd.thinAir.fullin<20|mp<5000)
actions+=/lucidDreaming,if=mp<8000

# AoE.
actions+=/afflatusMisery,if=targets>=3&gauge.blood>=3
actions+=/glare4,if=targets>=3&buff.sacredSight.up
actions+=/afflatusRapture,if=targets>=3&gauge.lilies>=1&gauge.blood<3
actions+=/dia,if=targets>=3&debuff.dia.remains<2&fight.remains>15
actions+=/holy3,if=targets>=3

# Single target.
actions+=/dia,if=debuff.dia.remains<2&fight.remains>12
actions+=/afflatusMisery,if=gauge.blood>=3&(buff.presenceOfMind.up|buff.medicated.up&var.burst_in>20|var.burst_in>35|(gauge.lilies>=3&var.lily_in<6)|fight.remains<10)
actions+=/glare4,if=buff.sacredSight.up
actions+=/afflatusRapture,if=gauge.lilies>=3&gauge.blood<3
actions+=/afflatusRapture,if=gauge.lilies>=1&gauge.blood<3&(var.want_pot|fight.remains<gcd*(3-gauge.blood)+gcd+2)
actions+=/glare3
# Moving: the instants.
actions+=/afflatusRapture,if=moving&gauge.lilies>=1&gauge.blood<3
actions+=/dia,if=moving&debuff.dia.remains<15
`;
