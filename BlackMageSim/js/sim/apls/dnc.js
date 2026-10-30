// Dancer, Dawntrail 7.0–7.57 (js/jobs/dnc_dt.js), alone on the dummy (no dance partner). The Balance's standard play:
// Standard Step and its two steps before the pull, Standard Finish on it, Technical Step straight after, Devilment
// behind Technical Finish, then Tillana, Flourish, Dance of the Dawn, Fan Dance IV, Last Dance, Finishing Move and
// Starfall Dance inside the window. Steps are pressed in the order the dance asks (proc.<step>). Standard Step and
// Finishing Move on their shared 30s, Flourish every 60s, Esprit and feathers spent before they overcap and pooled
// for the two-minute window. The tincture can't be used while dancing in this module, so it goes after Technical Finish;
// Standard Step goes at −14.5 because pressed at −15 its 15s dance would end exactly on the pull.
BLM.SIM_APLS.dnc = `
# Dancer — Dawntrail 7.0–7.57
actions.precombat=standardStep,at=-14.5
actions.precombat+=/emboite,if=proc.emboite
actions.precombat+=/entrechat,if=proc.entrechat
actions.precombat+=/jete,if=proc.jete
actions.precombat+=/pirouette,if=proc.pirouette
actions.precombat+=/emboite,if=proc.emboite
actions.precombat+=/entrechat,if=proc.entrechat
actions.precombat+=/jete,if=proc.jete
actions.precombat+=/pirouette,if=proc.pirouette
actions.precombat+=/standardFinish,at=0

# Dancing: the step the dance asks for, then the Finish.
actions=/emboite,if=proc.emboite
actions+=/entrechat,if=proc.entrechat
actions+=/jete,if=proc.jete
actions+=/pirouette,if=proc.pirouette
actions+=/standardFinish,if=proc.standardFinish
actions+=/technicalFinish,if=proc.technicalFinish

# Abilities, woven between GCDs.
actions+=/devilment,if=buff.technicalFinish.up|cd.technicalStep.remains>100
actions+=/tincture,if=buff.technicalFinish.up|(cd.technicalStep.remains>100&time>5)
actions+=/flourish,if=!buff.finishingMoveReady.up&!buff.fourfoldFanDance.up&!buff.flourishingFanDance.up&(buff.technicalFinish.up|cd.technicalStep.remains>8)
actions+=/fanDance4,if=buff.technicalFinish.up|buff.fourfoldFanDance.remains<5|cd.flourish.remains<5
actions+=/fanDance3
actions+=/fanDance2,if=targets>=3&(gauge.feathers>=4|buff.technicalFinish.up|(gauge.feathers>=3&cd.technicalStep.remains>15))
actions+=/fanDance,if=gauge.feathers>=4|buff.technicalFinish.up|(gauge.feathers>=3&cd.technicalStep.remains>15)|fight.remains<10

# Weaponskills: the dances first, on their recasts.
actions+=/technicalStep
actions+=/tillana,if=buff.technicalFinish.up&gauge.esprit<50
actions+=/danceOfTheDawn
actions+=/lastDance,if=cd.standardStep.remains<gcd&(buff.finishingMoveReady.up|cd.technicalStep.remains>5)
actions+=/finishingMove,if=cd.technicalStep.remains>2|buff.technicalFinish.up
actions+=/standardStep,if=!buff.finishingMoveReady.up&cd.technicalStep.remains>5

# The window's GCDs.
actions+=/starfallDance,if=buff.flourishingStarfall.remains<gcd*2|buff.technicalFinish.up
actions+=/tillana,if=gauge.esprit<=50
actions+=/lastDance,if=buff.lastDanceReady.remains<gcd*2|buff.technicalFinish.up
actions+=/saberDance,if=gauge.esprit>=85|(buff.technicalFinish.up&gauge.esprit>=50)|(buff.danceOfTheDawnReady.up&gauge.esprit>=100)
actions+=/starfallDance
actions+=/tillana
actions+=/lastDance
actions+=/saberDance,if=gauge.esprit>=50&(cd.technicalStep.remains>20|gauge.esprit>=80)&!buff.danceOfTheDawnReady.up

# Procs (oldest first) and the combo; AoE versions on three or more targets.
actions+=/bloodshower,if=targets>=3
actions+=/risingWindmill,if=targets>=3
actions+=/bladeshower,if=targets>=3&combo.windmill
actions+=/windmill,if=targets>=3
actions+=/fountainfall
actions+=/reverseCascade
actions+=/fountain,if=combo.cascade
actions+=/cascade
`;
