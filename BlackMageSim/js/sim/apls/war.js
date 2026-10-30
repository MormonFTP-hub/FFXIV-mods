// Warrior, Dawntrail 7.01–7.57 (js/jobs/war_dt.js, on war_ew.js). The Balance's standard play: Tomahawk and
// Infuriate before the pull, Inner Release after the first Storm's Eye, then every minute the three free Fell Cleaves,
// Primal Wrath, Primal Rend → Primal Ruination and an Inner Chaos inside the window. Surging Tempest is kept up with
// Storm's Eye only when it has room for the full 30s, Infuriate is used under 50 gauge and outside Nascent Chaos,
// and the Beast Gauge never overcaps.
BLM.SIM_APLS.war = `
# Warrior — Dawntrail 7.01–7.57
actions.precombat=tomahawk,at=-0.7
actions.precombat+=/infuriate

# Abilities, woven between GCDs.
actions=/tincture,if=cd.innerRelease.remains<3&(prev_gcd.stormsEye|prev_gcd.mythrilTempest|time>10)&((time+10)%120<20)
actions+=/innerRelease,if=buff.surgingTempest.up&(prev_gcd.stormsEye|prev_gcd.mythrilTempest|time>10)
actions+=/primalWrath
actions+=/upheaval,if=buff.surgingTempest.up&targets<3
actions+=/orogeny,if=buff.surgingTempest.up&targets>=3
actions+=/infuriate,if=!buff.nascentChaos.up&gauge.beast<=50&(buff.innerRelease.up|cd.innerRelease.remains>5|cd.infuriate.charges>=2)
actions+=/onslaught,if=buff.surgingTempest.up&(buff.innerRelease.up|cd.onslaught.fullin<gcd)

# Weaponskills: the free Fell Cleaves (Decimate at four or more), Primal Rend → Primal Ruination, Inner Chaos.
actions+=/fellCleave,if=buff.innerRelease.up&targets<4
actions+=/decimate,if=buff.innerRelease.up
actions+=/primalRend,if=!buff.innerRelease.up|buff.innerRelease.remains<gcd*2
actions+=/primalRuination
actions+=/chaoticCyclone,if=targets>=4&(buff.surgingTempest.up|buff.nascentChaos.remains<gcd*2)
actions+=/innerChaos,if=buff.surgingTempest.up|buff.nascentChaos.remains<gcd*2
actions+=/variable,name=spend,value=gauge.beast>=50&(gauge.beast>=90|(combo.maim|combo.overpower)&gauge.beast>=80|combo.heavySwing&gauge.beast>=90|cd.infuriate.fullin<gcd*2|buff.medicated.up)
actions+=/decimate,if=targets>=4&var.spend
actions+=/fellCleave,if=var.spend

# AoE: Overpower → Mythril Tempest in place of the single-target combo.
actions+=/call_action_list,name=aoe,if=targets>=3

actions+=/stormsEye,if=combo.maim&buff.surgingTempest.remains<30
actions+=/stormsPath,if=combo.maim
actions+=/maim,if=combo.heavySwing
actions+=/heavySwing

actions.aoe=/mythrilTempest,if=combo.overpower
actions.aoe+=/overpower
`;
