// Paladin, Dawntrail 7.0–7.57 (js/jobs/pld_dt.js). The Balance's standard play: a hardcast Holy Spirit before the
// pull, Fight or Flight and Imperator after the first Royal Authority, then every minute: the Confiteor chain, Goring
// Blade and the best of the Atonement chain / Divine Might Holy Spirit inside Fight or Flight, with Expiacion, Circle
// of Scorn, both Intervene charges and Blade of Honor woven in. Outside the window the Atonement steps and Divine
// Might are banked for the next one, spent only before Royal Authority would overwrite them.
BLM.SIM_APLS.pld = `
# Paladin — Dawntrail 7.0–7.57
actions.precombat=holySpirit,at=-2

# Abilities, woven between GCDs.
actions=/tincture,if=cd.fightOrFlight.remains<3&(prev_gcd.riotBlade|prev_gcd.totalEclipse|time>10)&((time+10)%120<20)
actions+=/fightOrFlight,if=prev_gcd.royalAuthority|prev_gcd.prominence|time>10
actions+=/imperator,if=buff.fightOrFlight.up|cd.fightOrFlight.remains>20
actions+=/bladeOfHonor
actions+=/circleOfScorn,if=buff.fightOrFlight.up|cd.fightOrFlight.remains>12
actions+=/expiacion,if=buff.fightOrFlight.up|cd.fightOrFlight.remains>12
actions+=/intervene,if=buff.fightOrFlight.up&cd.imperator.remains>gcd|!buff.fightOrFlight.up&cd.intervene.fullin+30<cd.fightOrFlight.remains

# AoE: Total Eclipse → Prominence, Holy Circle on Divine Might.
actions+=/call_action_list,name=aoe,if=targets>=3

# Inside Fight or Flight: the chain, Goring Blade, then the strongest of the banked GCDs.
actions+=/confiteor,if=buff.fightOrFlight.up|buff.confiteorReady.remains<gcd*5&buff.confiteorReady.up
actions+=/goringBlade,if=buff.fightOrFlight.up|buff.goringBladeReady.remains<gcd*2
actions+=/atonement,if=buff.fightOrFlight.up&buff.sepulchreReady.up
actions+=/atonement,if=buff.fightOrFlight.up&buff.supplicationReady.up
actions+=/holySpirit,if=buff.fightOrFlight.up&buff.divineMight.up
actions+=/atonement,if=buff.fightOrFlight.up&buff.atonementReady.up
actions+=/royalAuthority,if=buff.fightOrFlight.up&combo.riotBlade&!buff.atonementReady.up&!buff.divineMight.up

# Before Royal Authority, spend what it would overwrite (or anything about to run out).
actions+=/holySpirit,if=buff.divineMight.up&(combo.riotBlade|buff.divineMight.remains<gcd*2)
actions+=/atonement,if=buff.atonementReady.up&(combo.riotBlade|buff.atonementReady.remains<gcd*2)
actions+=/atonement,if=buff.supplicationReady.up&buff.supplicationReady.remains<gcd*2
actions+=/atonement,if=buff.sepulchreReady.up&buff.sepulchreReady.remains<gcd*2

# The combo.
actions+=/royalAuthority,if=combo.riotBlade
actions+=/riotBlade,if=combo.fastBlade
actions+=/fastBlade

actions.aoe=/confiteor
actions.aoe+=/holyCircle,if=buff.divineMight.up
actions.aoe+=/goringBlade,if=buff.fightOrFlight.up|buff.goringBladeReady.remains<gcd*2
actions.aoe+=/prominence,if=combo.totalEclipse
actions.aoe+=/totalEclipse
`;
