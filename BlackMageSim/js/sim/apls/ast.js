// Astrologian, Dawntrail 7.4–7.57 (js/jobs/ast_dt.js, dt74). The Balance's standard play: Earthly Star before the
// pull so it goes off in the opening burst, Fall Malefic hardcast, Combust III and the tincture, Lightspeed for the
// weaves, then Divination with the Balance (Play I) and Lord of Crowns from the opening hand, Oracle, Umbral Draw and
// the Spear straight away. The one-minute Astral Draw is held (the Balance and Lord of Crowns wait for the next
// Divination), so Umbral Draw always lands in the burst. Cards go on yourself; the Arrow, the Spire, the Bole, the
// Ewer and Lady of Crowns add no damage and stay in hand. Combust III kept up, Earthly Star on cooldown and set off
// once it has matured, Lucid Dreaming for MP. The tincture goes with Divination, or earlier when waiting for it would
// cost a use before the fight ends. Lightspeed goes just before Divination for the weaves, whenever a charge would
// be lost, and to make room for the tincture.
BLM.SIM_APLS.ast = `
# Astrologian — Dawntrail 7.4–7.57
actions.precombat=earthlyStar,at=-4
actions.precombat+=/fallMalefic,at=-1.5

actions=/variable,name=burst,value=buff.divination.up|fight.remains<20
actions+=/variable,name=burst_in,value=cd.divination.remains
actions+=/variable,name=want_pot,value=cd.tincture.ready&(time<10|var.burst_in<3|(fight.remains>285&fight.remains-var.burst_in<285)|fight.remains<var.burst_in+15)

# Abilities, woven between GCDs.
actions+=/tincture,if=var.want_pot
actions+=/lightspeed,if=!buff.lightspeed.up&(cd.divination.remains<3|cd.lightspeed.charges>=2|cd.lightspeed.fullin<10|var.want_pot)&time>2
actions+=/divination,if=time>4&!buff.divining.up
actions+=/play1,if=var.burst|is.play1.spearDt&cd.divination.remains>17
actions+=/oracle,if=buff.divining.up
actions+=/minorArcana,if=is.minorArcana.lordOfCrowns&(var.burst|cd.divination.remains>70)
actions+=/astralDraw,if=!gauge.hand.1&!is.minorArcana.lordOfCrowns
actions+=/stellarDetonation,if=buff.giantDominance.up
actions+=/earthlyStar,if=!gauge.star&(cd.divination.remains<15|cd.divination.remains>45)
actions+=/lucidDreaming,if=mp<8000

# AoE.
actions+=/combust3,if=targets>=3&debuff.combust3.remains<2.5&fight.remains>15
actions+=/macrocosmos,if=targets>=3&!buff.macrocosmos.up
actions+=/gravity2,if=targets>=3

# Single target.
actions+=/combust3,if=debuff.combust3.remains<2.5&fight.remains>12
actions+=/fallMalefic
`;
