// Red Mage, Dawntrail 7.4–7.57 (js/jobs/rdm_ew.js, dt74). The Balance's standard play: Veraero III hardcast before
// the pull, then a hardcast (Jolt III or a Verfire / Verstone proc) and a Dualcast Verthunder III / Veraero III for the
// lower mana in turn; Acceleration and Swiftcast for extra instant Ver spells, Grand Impact in a hardcast's place.
// Every two minutes Embolden, the tincture and Manafication (a free melee combo and Prefulgence) with Vice of Thorns,
// and a melee combo whenever the mana reaches 50|50 (the finishers right behind it). Corps-a-corps
// takes you into melee, Engagement and Corps-a-corps never sit on two charges, Fleche and Contre Sixte on cooldown.
BLM.SIM_APLS.rdm = `
# Red Mage — Dawntrail 7.4–7.57
actions.precombat=tincture,at=-6.4
actions.precombat+=/veraero3,at=-5

# The opener: Verthunder III (Dualcast), Swiftcast; Veraero III, Acceleration, Corps-a-corps; Verthunder III,
# Embolden, Manafication; then the free melee combo.
actions=/call_action_list,name=opener,if=time<8

# Abilities, woven between GCDs.
# Embolden and Manafication together after an instant spell, then the free combo.
actions+=/embolden,if=time>8&!combo.any&gauge.stacks=0&!buff.dualcast.up&cd.manafication.remains<0.5&gcd.remains>1.2
actions+=/manafication,if=!combo.any&gauge.stacks=0&!buff.dualcast.up&buff.embolden.up
# The tincture with Embolden, unless spending it now fits one more in before the end.
actions+=/tincture,if=buff.embolden.up|cd.embolden.remains<1
actions+=/tincture,if=(fight.remains-fight.remains%270)>(fight.remains-cd.embolden.remains)-(fight.remains-cd.embolden.remains)%270|fight.remains<cd.embolden.remains
actions+=/corpsACorps,if=!usable.enchantedRiposte&(buff.magickedSwordplay.up|gauge.black>=20&gauge.white>=20)
actions+=/viceOfThorns
actions+=/prefulgence
actions+=/fleche
actions+=/contreSixte
actions+=/acceleration,if=!buff.acceleration.up&!buff.grandImpactReady.up&(cd.acceleration.charges>=2|cd.acceleration.fullin<10|buff.embolden.up)
actions+=/engagement,if=buff.embolden.up|cd.engagement.fullin<5
actions+=/corpsACorps,if=buff.embolden.up|cd.corpsACorps.fullin<5
actions+=/swiftcast,if=!buff.dualcast.up&!buff.acceleration.up&gauge.stacks=0&!combo.any
actions+=/lucidDreaming,if=mp<7000

# The finisher combo.
actions+=/resolution
actions+=/scorch
actions+=/verholy,if=gauge.white<gauge.black
actions+=/verflare
# The melee combo: Magicked Swordplay, or 50|50 mana (holding it for Embolden gains nothing: the mana never caps).
actions+=/enchantedRedoublement,if=combo.zwerchhau
actions+=/enchantedZwerchhau,if=combo.riposte
actions+=/enchantedRiposte,if=!buff.dualcast.up&!buff.acceleration.up&!buff.swiftcast.up&(buff.magickedSwordplay.up|gauge.black>=50&gauge.white>=50)
# Grand Impact in a hardcast's place.
actions+=/grandImpact,if=!buff.dualcast.up&!buff.swiftcast.up&!buff.acceleration.up
# The instant Ver spell for the lower mana.
actions+=/call_action_list,name=aoe,if=targets>=3
actions+=/veraero3,if=(buff.dualcast.up|buff.acceleration.up|buff.swiftcast.up)&gauge.white<gauge.black
actions+=/verthunder3,if=buff.dualcast.up|buff.acceleration.up|buff.swiftcast.up
# The hardcast: a proc, or Jolt III.
actions+=/verstone,if=gauge.white<=gauge.black|!buff.verfireReady.up
actions+=/verfire
actions+=/jolt3

actions.opener=/swiftcast,if=!buff.dualcast.up
actions.opener+=/acceleration,if=!buff.swiftcast.up&!buff.acceleration.up&cd.acceleration.charges>=2
actions.opener+=/corpsACorps,if=buff.acceleration.up
actions.opener+=/manafication,if=buff.embolden.up&cd.manafication.ready
actions.opener+=/embolden,if=!buff.acceleration.up&!buff.swiftcast.up&cd.acceleration.charges<2&cd.embolden.ready

actions.aoe=/impact,if=buff.dualcast.up|buff.acceleration.up|buff.swiftcast.up
actions.aoe+=/veraero2,if=gauge.white<gauge.black
actions.aoe+=/verthunder2
`;
