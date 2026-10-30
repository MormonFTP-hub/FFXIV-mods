// Ninja, Dawntrail 7.1–7.57 (js/jobs/nin_dt.js). The Balance's standard play: Ten-Chi-Jin Suiton landing on the pull
// and Kassatsu before it; Dokumori, Bunshin, Kunai's Bane and Dream Within a Dream in the opener; Suiton (for Shadow
// Walker) before every Kunai's Bane, Kassatsu's Hyosho Ranryu inside it, Ten Chi Jin (Fuma → Raiton → Suiton) into
// Tenri Jindo and Meisui every two minutes; Raiton when the mudra charges would cap or inside Kunai's Bane, keeping one
// for the next Suiton; every Raiju before the next combo weaponskill; Ninki pooled for Kunai's Bane without capping;
// Aeolian Edge while Kazematoi lasts, Armor Crush otherwise. Mudras are GCDs here, so nothing is woven mid-sequence.
// AoE: Goka Mekkyaku from two targets, Hellfrog Medium from three, Death Blossom → Hakke Mujinsatsu from four.
BLM.SIM_APLS.nin = `
# Ninja — Dawntrail 7.1–7.57
actions.precombat=ten,at=-3
actions.precombat+=/chi,at=-2.5
actions.precombat+=/jin,at=-2
actions.precombat+=/suiton,at=-0.6
actions.precombat+=/kassatsu,at=-0.5

# Suiton is due when Kunai's Bane is close and there's no Shadow Walker.
actions=/variable,name=suiton,value=!buff.shadowWalker.up&cd.kunaisBane.remains<12

# Abilities, woven between GCDs.
actions+=/tincture,if=time<5|cd.dokumori.remains<gcd*2
actions+=/dokumori,if=time>1&(cd.kunaisBane.remains<gcd*2|debuff.kunaisBane.up)&gauge.ninki<=60
actions+=/bunshin,if=gauge.ninki>=50
actions+=/kunaisBane,if=time>4|cd.dokumori.remains>5
actions+=/kassatsu,if=debuff.kunaisBane.up|cd.kunaisBane.remains<gcd*2
actions+=/tenChiJin,if=debuff.kunaisBane.up&!buff.kassatsu.up&gauge.mudras.length=0&!buff.raijuReady.up
actions+=/tenriJindo
actions+=/meisui,if=cd.kunaisBane.remains>20&gauge.ninki<=50
actions+=/dreamWithinADream,if=debuff.kunaisBane.up|cd.kunaisBane.remains>20
actions+=/zeshoMeppo,if=debuff.kunaisBane.up|buff.higi.remains<6
actions+=/hellfrogMedium,if=targets>=3&!buff.higi.up&gauge.ninki>=50&(debuff.kunaisBane.up|gauge.ninki>=85|cd.kunaisBane.remains>30&cd.bunshin.remains>15)
actions+=/bhavacakra,if=gauge.ninki>=50&(debuff.kunaisBane.up|gauge.ninki>=85|cd.kunaisBane.remains>30&cd.bunshin.remains>15)

# Ten Chi Jin: Fuma Shuriken → Raiton → Suiton.
actions+=/ten,if=buff.tenChiJin.up&gauge.tcj.length=0
actions+=/chi,if=buff.tenChiJin.up&gauge.tcj.length=1
actions+=/jin,if=buff.tenChiJin.up&gauge.tcj.length=2

# A mudra sequence under way: Ten → Chi (Raiton) → Jin (Suiton); Kassatsu: Ten → Jin (Hyosho), Chi → Ten (Goka).
actions+=/ninjutsu,if=is.ninjutsu.hyoshoRanryu|is.ninjutsu.gokaMekkyaku|is.ninjutsu.suiton|is.ninjutsu.raiton&!var.suiton
actions+=/jin,if=gauge.mudras.length=2&var.suiton
actions+=/ten,if=gauge.mudras.length=1&buff.kassatsu.up&targets>=2
actions+=/jin,if=gauge.mudras.length=1&buff.kassatsu.up
actions+=/chi,if=gauge.mudras.length=1&!buff.kassatsu.up

# Raiju before any combo weaponskill throws it away; Phantom Kamaitachi in Kunai's Bane.
actions+=/fleetingRaiju
actions+=/phantomKamaitachi,if=debuff.kunaisBane.up|buff.phantomKamaitachiReady.remains<gcd*3|cd.kunaisBane.remains>30

# Starting a ninjutsu.
actions+=/chi,if=buff.kassatsu.up&targets>=2&(debuff.kunaisBane.up|buff.kassatsu.remains<gcd*3)
actions+=/ten,if=buff.kassatsu.up&(debuff.kunaisBane.up|buff.kassatsu.remains<gcd*3)
actions+=/ten,if=var.suiton&cd.ten.charges>=1&!buff.kassatsu.up
actions+=/ten,if=!buff.kassatsu.up&!buff.tenChiJin.up&(cd.ten.charges>=2|cd.ten.fullin<gcd|cd.ten.charges>=1&(debuff.kunaisBane.up|cd.kunaisBane.remains>25))

# The combo.
actions+=/run_action_list,name=aoe,if=targets>=4
actions+=/aeolianEdge,if=combo.gustSlash&gauge.kaze>=1
actions+=/armorCrush,if=combo.gustSlash
actions+=/gustSlash,if=combo.spinningEdge
actions+=/spinningEdge

actions.aoe=hakkeMujinsatsu,if=combo.deathBlossom
actions.aoe+=/deathBlossom
`;
