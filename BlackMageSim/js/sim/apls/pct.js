// Pictomancer, Dawntrail 7.1–7.57 (js/jobs/pct_dt.js). The Balance's standard play: the pom, hammer and starry sky
// come painted (7.1+), Rainbow Drip is hardcast before the pull, Striking Muse goes at the pull and Holy, Pom Muse and
// a Wing Motif lead into Starry Muse. Every two minutes Starry Muse and the tincture with the free Subtractive Palette,
// Comet, Star Prism, the instant Rainbow Drip, the Hammer combo, a Living Muse and a portrait. Living Muse and Striking
// Muse never sit on full charges; motifs are repainted outside the burst, just before they're needed (Swiftcast on
// one); Fire / Aero / Water fill, Subtractive Palette whenever the gauge allows, Holy keeps the paint from capping.
BLM.SIM_APLS.pct = `
# Pictomancer — Dawntrail 7.1–7.57
actions.precombat=rainbowDrip,at=-4.5

# Gauge, charges and portraits are held for Starry Muse when it's under var.hold seconds away; the starry sky is
# repainted when Starry Muse is under var.sky seconds away.
actions=/variable,name=hold,value=25
actions+=/variable,name=sky,value=12

# Abilities, woven between GCDs.
actions+=/strikingMuse,if=time<1
actions+=/starryMuse,if=time>5
actions+=/strikingMuse,if=!buff.hammerTime.up&(cd.starryMuse.remains<3|cd.starryMuse.remains>var.hold|cd.strikingMuse.fullin<5)
actions+=/subtractivePalette,if=buff.subtractiveSpectrum.up|gauge.palette>=50&(buff.starryMuse.up|cd.starryMuse.remains>var.hold|gauge.palette>=100)
# The tincture with Starry Muse, unless spending it now fits one more in before the end.
actions+=/tincture,if=buff.starryMuse.up|cd.starryMuse.remains<4
actions+=/tincture,if=(fight.remains-fight.remains%270)>(fight.remains-cd.starryMuse.remains)-(fight.remains-cd.starryMuse.remains)%270|fight.remains<cd.starryMuse.remains
actions+=/livingMuse,if=time<5|buff.starryMuse.up|cd.livingMuse.charges>=3|cd.livingMuse.fullin<5|cd.starryMuse.remains>var.hold&cd.livingMuse.charges>=2
actions+=/mogOfTheAges,if=buff.starryMuse.up|cd.starryMuse.remains>var.hold|gauge.creature&gauge.next%4=0&cd.livingMuse.charges>=1
actions+=/swiftcast,if=!buff.starryMuse.up&(!gauge.creature|!gauge.weapon|!gauge.landscape)
actions+=/lucidDreaming,if=mp<7000

# The Starry Muse burst: Hammer Stamp first (Subtractive Palette woven after it), then the five Hyperphantasia stacks on
# paint spells (Blizzard, Stone, Thunder, Comet and a Holy or Fire), Star Prism, Rainbow Drip and the other hammers.
actions+=/holyInWhite,if=time<3
actions+=/hammerStamp,if=buff.hammerTime.remains<buff.hammerTime.stacks*2.5+1
actions+=/starPrism
actions+=/rainbowDrip,if=buff.rainbowBright.up
actions+=/hammerStamp,if=buff.hyperphantasia.stacks>=5&is.hammerStamp.hammerStamp
actions+=/cometInBlack,if=buff.hyperphantasia.up|cd.starryMuse.remains>var.hold|gauge.white>=4
actions+=/call_action_list,name=aoe,if=targets>=3
actions+=/blizzardInCyan,if=buff.hyperphantasia.up|buff.starryMuse.up
actions+=/holyInWhite,if=buff.hyperphantasia.up
actions+=/fireInRed,if=buff.hyperphantasia.up
actions+=/hammerStamp,if=buff.starryMuse.up|buff.hammerTime.remains<8|cd.starryMuse.remains>var.hold
actions+=/blizzardInCyan
# Motifs, outside the burst and just before they're used.
actions+=/creatureMotif,if=!buff.starryMuse.up&(cd.livingMuse.charges>=1|cd.livingMuse.remains<4|cd.starryMuse.remains<8)
actions+=/hammerMotif,if=!buff.starryMuse.up&!buff.hammerTime.up&(cd.strikingMuse.charges>=1|cd.strikingMuse.remains<4)
actions+=/starrySkyMotif,if=!buff.starryMuse.up&cd.starryMuse.remains<var.sky
# Filler (instants while moving).
actions+=/holyInWhite,if=gauge.white>=5|moving
actions+=/cometInBlack,if=moving
actions+=/hammerStamp,if=moving
actions+=/fireInRed

actions.aoe=/holyInWhite
`;
