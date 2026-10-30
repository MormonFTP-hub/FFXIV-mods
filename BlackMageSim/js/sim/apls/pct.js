// Pictomancer, Dawntrail 7.1–7.57 (js/jobs/pct_dt.js). The Balance's standard play: the pom, hammer and starry sky
// come painted (7.1+), Rainbow Drip is hardcast before the pull; Starry Muse and the tincture every two minutes with
// the free Subtractive Palette, Comet, Star Prism, the instant Rainbow Drip and the Hammer combo inside it; Living Muse
// and Striking Muse never sit on full charges, portraits go in the burst unless the next one would overwrite them;
// motifs are repainted outside the burst (Swiftcast on one), Fire / Aero / Water fill, Holy keeps the paint from capping.
BLM.SIM_APLS.pct = `
# Pictomancer — Dawntrail 7.1–7.57
actions.precombat=rainbowDrip,at=-4.5

# Abilities, woven between GCDs.
actions=/starryMuse,if=time>2|prev_gcd.holyInWhite
actions+=/tincture,if=buff.starryMuse.up|cd.starryMuse.remains<2
actions+=/strikingMuse,if=!buff.hammerTime.up&(cd.starryMuse.remains<3|buff.starryMuse.up|cd.strikingMuse.fullin<10)
actions+=/subtractivePalette,if=buff.subtractiveSpectrum.up|gauge.palette>=100|gauge.palette>=50&(buff.starryMuse.up|cd.starryMuse.remains>30)
actions+=/mogOfTheAges,if=buff.starryMuse.up|cd.starryMuse.remains>30|cd.livingMuse.charges>=1&gauge.creature&gauge.next%4=0
actions+=/livingMuse,if=cd.livingMuse.charges>=3|cd.livingMuse.fullin<6|buff.starryMuse.up|cd.starryMuse.remains>30|cd.starryMuse.remains<1
actions+=/swiftcast,if=!gauge.creature|!gauge.weapon|!gauge.landscape
actions+=/lucidDreaming,if=mp<7000

# The Starry Muse burst.
actions+=/starPrism
actions+=/rainbowDrip,if=buff.rainbowBright.up
actions+=/cometInBlack,if=buff.starryMuse.up|cd.starryMuse.remains>15
actions+=/hammerStamp,if=buff.starryMuse.up|buff.hammerTime.remains<8|cd.starryMuse.remains>30
actions+=/call_action_list,name=aoe,if=targets>=3
actions+=/blizzardInCyan
# Motifs, outside the burst.
actions+=/creatureMotif,if=!buff.starryMuse.up&(cd.livingMuse.charges>=1|cd.livingMuse.remains<4)
actions+=/hammerMotif,if=!buff.starryMuse.up&!buff.hammerTime.up
actions+=/starrySkyMotif,if=!buff.starryMuse.up
actions+=/creatureMotif,if=!buff.starryMuse.up
# Filler.
actions+=/holyInWhite,if=gauge.white>=5|buff.starryMuse.up&buff.hyperphantasia.up&!buff.subtractivePalette.up
actions+=/fireInRed

actions.aoe=/holyInWhite,if=gauge.white>=2
`;
