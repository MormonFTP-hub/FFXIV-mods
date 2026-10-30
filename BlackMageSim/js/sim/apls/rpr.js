// Reaper, Dawntrail 7.3–7.57 (js/jobs/rpr_dt.js). The Balance's standard play: Soulsow and Harpe before the pull,
// Arcane Circle and Gluttony after the first Soul Slice, Plentiful Harvest into the free Enshroud, Perfectio after its
// Communio. Death's Design kept between 30 and 60s, Soul Slice never left at two charges, Soul spent on Blood Stalk
// (Unveiled Gibbet / Gallows) without starving Gluttony, Shroud spent on Enshroud before it overcaps.
BLM.SIM_APLS.rpr = `
# Reaper — Dawntrail 7.3–7.57
actions.precombat=soulsow,at=-4
actions.precombat+=/harpe,at=-1.7

# Abilities, woven between GCDs.
actions=/tincture,if=time<5|cd.arcaneCircle.remains<5
actions+=/arcaneCircle,if=time>2&debuff.deathsDesign.up
actions+=/sacrificium
actions+=/lemuresSlice
actions+=/enshroud,if=buff.idealHost.up&!buff.executioner.up&!buff.soulReaver.up&!buff.perfectioParata.up
actions+=/gluttony,if=!buff.enshrouded.up&!buff.soulReaver.up&!buff.executioner.up&debuff.deathsDesign.remains>6
actions+=/enshroud,if=!buff.enshrouded.up&gauge.shroud>=50&!buff.soulReaver.up&!buff.executioner.up&!buff.perfectioParata.up&debuff.deathsDesign.remains>10&!usable.plentifulHarvest
actions+=/grimSwathe,if=targets>=3&!buff.enshrouded.up&!buff.soulReaver.up&!buff.executioner.up&(cd.gluttony.remains>8|gauge.soul>=90|fight.remains<cd.gluttony.remains+3)
actions+=/bloodStalk,if=!buff.enshrouded.up&!buff.soulReaver.up&!buff.executioner.up&(cd.gluttony.remains>8|gauge.soul>=90|fight.remains<cd.gluttony.remains+3)&gauge.shroud<=90

# Weaponskills.
actions+=/perfectio
actions+=/communio,if=gauge.lemure=1
actions+=/grimReaping,if=targets>=3
actions+=/voidReaping,if=!buff.enhancedCrossReaping.up
actions+=/crossReaping
actions+=/shadowOfDeath,if=debuff.deathsDesign.remains<gcd&!buff.enshrouded.up&fight.remains>gcd*2
actions+=/executionersGuillotine,if=targets>=3
actions+=/executionersGallows,if=buff.enhancedGallows.up
actions+=/executionersGibbet
actions+=/plentifulHarvest
actions+=/guillotine,if=targets>=3
actions+=/gallows,if=buff.enhancedGallows.up
actions+=/gibbet
actions+=/soulSlice,if=gauge.soul<=50
actions+=/whorlOfDeath,if=targets>=3&debuff.deathsDesign.remains<30&time>10&fight.remains>debuff.deathsDesign.remains
actions+=/shadowOfDeath,if=debuff.deathsDesign.remains<30&time>10&fight.remains>debuff.deathsDesign.remains+5
actions+=/harvestMoon,if=buff.arcaneCircle.up&buff.medicated.up&time>60|fight.remains<gcd*2
actions+=/nightmareScythe,if=targets>=3&combo.spinningScythe
actions+=/spinningScythe,if=targets>=3
actions+=/infernalSlice,if=combo.waxingSlice
actions+=/waxingSlice,if=combo.slice
actions+=/slice
`;
