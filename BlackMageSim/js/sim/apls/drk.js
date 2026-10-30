// Dark Knight, Dawntrail 7.0–7.57 (js/jobs/drk_ew.js, DarkKnightDT on drk_shb.js). The Balance's standard play: Unmend
// and the tincture before the pull, Edge of Shadow and Living Shadow after the first Hard Slash, Delirium after
// Souleater, Disesteem ahead of Scarlet Delirium → Comeuppance → Torcleaver, Salted Earth / Salt and Darkness, Carve and
// Spit and Shadowbringer in the window. Darkside never drops, MP is spent on Edge of Shadow before it overcaps (and
// pooled for the party's two-minute buffs), and Blood is spent on Bloodspiller before Souleater or Blood Weapon would
// overcap it. The Blackest Night is left out: the dummy never breaks it, so it never gives Dark Arts.
BLM.SIM_APLS.drk = `
# Dark Knight — Dawntrail 7.0–7.57
actions.precombat=unmend,at=-0.7
actions.precombat+=/tincture

# Abilities, woven between GCDs.
actions=/tincture,if=time>10&cd.delirium.remains<3&((time+10)%120<20)
actions+=/floodOfShadow,if=targets>=3&(!buff.darkside.up|buff.darkside.remains<gcd*2)
actions+=/edgeOfShadow,if=!buff.darkside.up|buff.darkside.remains<gcd*2
actions+=/livingShadow
actions+=/delirium,if=prev_gcd.souleater|prev_gcd.stalwartSoul|time>10
actions+=/floodOfShadow,if=targets>=3&mp>=3000&(mp>=8600|buff.delirium.up&mp>=6000|raid.up|buff.medicated.up&time>10|raid.in>40&mp>=6000|fight.remains<gcd*2)
actions+=/edgeOfShadow,if=mp>=3000&(mp>=8600|buff.delirium.up&mp>=6000|raid.up|buff.medicated.up&time>10|raid.in>40&mp>=6000|fight.remains<gcd*2)
actions+=/saltedEarth,if=!debuff.saltedEarth.up&buff.darkside.up
actions+=/saltAndDarkness
actions+=/carveAndSpit,if=buff.darkside.up&targets<3
actions+=/abyssalDrain,if=buff.darkside.up&targets>=3
actions+=/shadowbringer,if=buff.darkside.up&(buff.delirium.up|raid.up|cd.shadowbringer.fullin<gcd)

# AoE: Unleash → Stalwart Soul, Impalement under Delirium, Quietus for Blood.
actions+=/call_action_list,name=aoe,if=targets>=3

# Weaponskills.
actions+=/disesteem,if=buff.delirium.up|buff.scorn.remains<gcd*2|raid.up
actions+=/bloodspiller,if=buff.delirium.up
actions+=/bloodspiller,if=gauge.blood>=50&(raid.up|buff.medicated.up|gauge.blood>=90|combo.syphonStrike&gauge.blood>=80|buff.bloodWeapon.up&gauge.blood>=70|raid.in>25|fight.remains<gcd*4)
actions+=/souleater,if=combo.syphonStrike
actions+=/syphonStrike,if=combo.hardSlash
actions+=/hardSlash

actions.aoe=/disesteem
actions.aoe+=/quietus,if=buff.delirium.up
actions.aoe+=/quietus,if=gauge.blood>=50
actions.aoe+=/stalwartSoul,if=combo.unleash
actions.aoe+=/unleash
`;
