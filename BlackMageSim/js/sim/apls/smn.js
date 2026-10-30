// Summoner, Dawntrail 7.1–7.57 (js/jobs/smn_dt.js). The Balance's standard play: Ruin III hardcast before the pull,
// a demi-summon every minute with all six Impulses, Enkindle, Astral Flow, Energy Drain and both Necrotizes inside it,
// Searing Light (and the tincture) on Solar Bahamut every two minutes, then Titan → Garuda (Swiftcast Slipstream) →
// Ifrit, Mountain Buster after every Topaz Rite, Ruin IV and Ruin III to fill until the next demi.
BLM.SIM_APLS.smn = `
# Summoner — Dawntrail 7.1–7.57
actions.precombat=ruin3,at=-1.5

# Abilities, woven between GCDs.
actions=/searingLight,if=usable.umbralImpulse|fight.remains<22
# The tincture goes on Solar Bahamut with Searing Light, unless spending it now fits one more in before the end.
actions+=/tincture,if=usable.umbralImpulse&(cd.searingLight.remains<5|buff.searingLight.up)
actions+=/tincture,if=(fight.remains-fight.remains%270)>(fight.remains-cd.searingLight.remains)-(fight.remains-cd.searingLight.remains)%270|fight.remains<cd.searingLight.remains
actions+=/mountainBuster
actions+=/enkindleBahamut,if=job.demiOut&!usable.rekindle&(!usable.umbralImpulse|buff.searingLight.up|cd.searingLight.remains>8)
actions+=/sunflare,if=buff.searingLight.up|cd.searingLight.remains>8
actions+=/deathflare
actions+=/energySiphon,if=targets>=3&job.demiOut
actions+=/energyDrain,if=job.demiOut|cd.summonBahamut.remains>15
actions+=/painflare,if=targets>=3
actions+=/necrotize,if=targets<3
actions+=/searingFlash
actions+=/swiftcast,if=buff.garudasFavor.up
actions+=/lucidDreaming,if=mp<6000

# The demi-summon, once every Arcanum is spent and no attunement is left.
actions+=/summonBahamut,if=!gauge.ruby&!gauge.topaz&!gauge.emerald&gauge.stacks=0&!buff.ifritsFavor.up&!buff.crimsonStrikeReady.up&!buff.garudasFavor.up
# Its Impulses (Flares on a pack).
actions+=/call_action_list,name=aoe,if=targets>=3
actions+=/umbralImpulse
actions+=/astralImpulse
actions+=/fountainOfFire
# The primals' GCDs.
actions+=/crimsonCyclone
actions+=/crimsonStrike
actions+=/slipstream
actions+=/gemshine
# The primals, in order, once the last one's Rites and Favors are spent.
actions+=/summonTitan2,if=gauge.stacks=0&!buff.ifritsFavor.up&!buff.crimsonStrikeReady.up&!buff.garudasFavor.up
actions+=/summonGaruda2,if=gauge.stacks=0&!buff.ifritsFavor.up&!buff.crimsonStrikeReady.up&!buff.garudasFavor.up
actions+=/summonIfrit2,if=gauge.stacks=0&!buff.ifritsFavor.up&!buff.crimsonStrikeReady.up&!buff.garudasFavor.up
# Filler.
actions+=/ruin4
actions+=/ruin3

actions.aoe=/umbralFlare
actions.aoe+=/astralFlare
actions.aoe+=/brandOfPurgatory
actions.aoe+=/crimsonCyclone
actions.aoe+=/crimsonStrike
actions.aoe+=/slipstream
actions.aoe+=/preciousBrilliance,if=gauge.stacks>0
actions.aoe+=/triDisaster,if=!job.demiOut&!gauge.ruby&!gauge.topaz&!gauge.emerald&gauge.stacks=0&!buff.furtherRuinDt.up&targets>=4
`;
