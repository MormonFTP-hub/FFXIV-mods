// Viper, Dawntrail 7.05–7.57 (js/jobs/vpr_dt.js). The Balance's 7.5 standard play: Reaving Fangs and Swiftskin's
// Sting first with Serpent's Ire woven, Vicewinder into both Coils with their Twin bites, the free Reawaken straight
// into the Generations (in order, each with its Legacy) and Ouroboros, then Uncoiled Fury. The dual-wield combo
// follows the venom on the bar (which also keeps Hunter's Instinct and Swiftscaled up); Death Rattle after every
// finisher; Vicewinder never sits on two charges; Serpent Offerings kept for a second Reawaken in each two-minute
// window without overcapping; Rattling Coils spent in the window or before they overcap.
BLM.SIM_APLS.vpr = `
# Viper — Dawntrail 7.05–7.57

# Abilities, woven between GCDs.
actions=/serpentsTail
actions+=/twinfang,if=buff.huntersVenom.up|buff.poisedForTwinfang.up|buff.fellhuntersVenom.up
actions+=/twinblood,if=buff.swiftskinsVenom.up|buff.poisedForTwinblood.up|buff.fellskinsVenom.up
actions+=/twinfang
actions+=/twinblood
actions+=/serpentsIre,if=combat
actions+=/tincture,if=(time<15&prev_gcd.vicewinder)|(time>15&(cd.serpentsIre.remains<5|cd.serpentsIre.remains>110))

# The opener's first two GCDs: Reaving Fangs, Swiftskin's Sting.
actions+=/reavingFangs,if=time<1
actions+=/swiftskinsSting,if=time<4

# A combo about to run out (30s) is finished first. (Engine time is fight time + 6: the pull is at 6.)
actions+=/flankstingStrike,if=gauge.dw.until-time-6<7&buff.flankstungVenom.up
actions+=/flanksbaneFang,if=gauge.dw.until-time-6<7&buff.flanksbaneVenom.up
actions+=/hindstingStrike,if=gauge.dw.until-time-6<7&buff.hindstungVenom.up
actions+=/hindsbaneFang,if=gauge.dw.until-time-6<7&buff.hindsbaneVenom.up
actions+=/hindstingStrike,if=gauge.dw.until-time-6<7
actions+=/flankstingStrike,if=gauge.dw.until-time-6<7

# Reawakened: the Generations in order, then Ouroboros.
actions+=/firstGeneration,if=gauge.tribute=5
actions+=/secondGeneration,if=gauge.tribute=4
actions+=/thirdGeneration,if=gauge.tribute=3
actions+=/fourthGeneration,if=gauge.tribute=2
actions+=/ouroboros,if=gauge.tribute=1

# Vicewinder's Coils, the side whose buff runs out first.
actions+=/huntersCoil,if=buff.huntersInstinct.remains<buff.swiftscaled.remains|gauge.tw.swift
actions+=/swiftskinsCoil
actions+=/huntersCoil
actions+=/huntersDen,if=buff.huntersInstinct.remains<buff.swiftscaled.remains|gauge.tw.swift
actions+=/swiftskinsDen
actions+=/huntersDen

# Reawaken: the free one from Serpent's Ire, and from 50 Offerings while keeping 50 for the next two-minute window.
actions+=/reawaken,if=!gauge.tw&!gauge.twins&buff.huntersInstinct.remains>12&buff.swiftscaled.remains>12&(buff.readyToReawaken.up|cd.serpentsIre.remains>40|gauge.offerings>=90|fight.remains<cd.serpentsIre.remains)
actions+=/uncoiledFury,if=!gauge.tw&(gauge.coils>=3|(cd.serpentsIre.remains>85&!buff.readyToReawaken.up)|fight.remains<10)

# A combo already at its finisher goes before a new Vicewinder.
actions+=/jaggedMaw,if=targets>=3&buff.grimhuntersVenom.up
actions+=/bloodiedMaw,if=targets>=3
actions+=/jaggedMaw,if=targets>=3
actions+=/flankstingStrike,if=buff.flankstungVenom.up
actions+=/flanksbaneFang,if=buff.flanksbaneVenom.up
actions+=/hindstingStrike,if=buff.hindstungVenom.up
actions+=/hindsbaneFang,if=buff.hindsbaneVenom.up
actions+=/hindstingStrike
actions+=/flankstingStrike

actions+=/vicepit,if=targets>=3&!gauge.tw&cd.vicewinder.charges_fractional>=1.6
actions+=/vicewinder,if=!gauge.tw&(cd.vicewinder.charges_fractional>=1.6|cd.serpentsIre.remains>85|cd.serpentsIre.remains<10)
actions+=/vicepit,if=targets>=3&!gauge.tw
actions+=/vicewinder,if=!gauge.tw

# AoE combo (three or more targets).
actions+=/huntersBite,if=targets>=3&buff.huntersInstinct.remains<buff.swiftscaled.remains
actions+=/swiftskinsBite,if=targets>=3
actions+=/steelMaw,if=targets>=3&buff.honedSteel.up
actions+=/reavingMaw,if=targets>=3

# The dual-wield combo: the Sting on the side the venom asks for, Honed Fangs first.
actions+=/huntersSting,if=buff.flankstungVenom.up|buff.flanksbaneVenom.up
actions+=/swiftskinsSting,if=buff.hindstungVenom.up|buff.hindsbaneVenom.up
actions+=/swiftskinsSting,if=buff.swiftscaled.remains<=buff.huntersInstinct.remains
actions+=/huntersSting
actions+=/steelFangs,if=buff.honedSteel.up
actions+=/reavingFangs
`;
