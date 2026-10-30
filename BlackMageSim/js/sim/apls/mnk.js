// Monk, Dawntrail 7.01–7.57 (js/jobs/mnk_dt.js). The Balance's standard play: Forbidden Meditation and Form Shift
// before the pull; Riddle of Fire on cooldown with every Blitz, Fire's Reply and Wind's Reply inside it; Brotherhood
// and the tincture with it every two minutes; three Perfect Balances every two minutes (Rising Phoenix and Elixir
// Burst in the burst, Phantom Rush on the odd minute), pressed only with the Beast Chakra empty; each form alternates
// its Fury generator and spender. Enlightenment from three targets, the AoE weaponskills from four.
BLM.SIM_APLS.mnk = `
# Monk — Dawntrail 7.01–7.57
actions.precombat=meditation,at=-14
actions.precombat+=/formShift,at=-3

# Abilities, woven between GCDs.
actions=/perfectBalance,if=time<1
actions+=/tincture,if=time<5|cd.brotherhood.remains<gcd*3
actions+=/brotherhood,if=time>3&(buff.riddleOfFire.up|cd.riddleOfFire.remains<gcd*2)
actions+=/riddleOfFire,if=time>5
actions+=/perfectBalance,if=gauge.beast.length=0&time>1&!buff.riddleOfFire.up&cd.riddleOfFire.remains<gcd*2.6
actions+=/perfectBalance,if=gauge.beast.length=0&time>1&buff.riddleOfFire.remains>gcd*4.2
actions+=/perfectBalance,if=gauge.beast.length=0&cd.riddleOfFire.remains>fight.remains&fight.remains>gcd*4
actions+=/riddleOfWind,if=time>5
actions+=/enlightenment,if=gauge.chakra>=5&targets>=3
actions+=/forbiddenChakra,if=gauge.chakra>=5

# Weaponskills.
actions+=/sixSidedStar,if=fight.remains<gcd+0.5
actions+=/masterfulBlitz
actions+=/firesReply
actions+=/windsReply,if=buff.riddleOfFire.up|buff.windsRumination.remains<gcd*2|cd.riddleOfFire.remains>buff.windsRumination.remains
actions+=/run_action_list,name=aoe,if=targets>=4
actions+=/call_action_list,name=pb,if=buff.perfectBalance.up
actions+=/leapingOpo,if=(buff.opoOpo.up|buff.formlessFist.up)&gauge.opoFury
actions+=/dragonKick,if=buff.opoOpo.up|buff.formlessFist.up
actions+=/risingRaptor,if=gauge.raptorFury
actions+=/twinSnakes,if=buff.raptor.up
actions+=/pouncingCoeurl,if=gauge.coeurlFury
actions+=/demolish,if=buff.coeurl.up
actions+=/dragonKick

# Perfect Balance: Solar (one of each form) unless only Lunar is missing (three opo-opo); Phantom Rush takes opo-opo too.
actions.pb=leapingOpo,if=gauge.opoFury&(gauge.solar|gauge.beast.length=0)
actions.pb+=/dragonKick,if=gauge.solar|gauge.beast.length=0
actions.pb+=/risingRaptor,if=gauge.raptorFury&gauge.beast.length=1
actions.pb+=/twinSnakes,if=gauge.beast.length=1
actions.pb+=/pouncingCoeurl,if=gauge.coeurlFury
actions.pb+=/demolish

# Four or more targets: the AoE weaponskills round the forms.
actions.aoe=shadowOfTheDestroyer,if=buff.perfectBalance.up&(gauge.solar|gauge.beast.length=0)
actions.aoe+=/fourPointFury,if=buff.perfectBalance.up&gauge.beast.length=1
actions.aoe+=/rockbreaker,if=buff.perfectBalance.up
actions.aoe+=/shadowOfTheDestroyer,if=buff.opoOpo.up|buff.formlessFist.up
actions.aoe+=/fourPointFury,if=buff.raptor.up
actions.aoe+=/rockbreaker,if=buff.coeurl.up
actions.aoe+=/shadowOfTheDestroyer
`;
