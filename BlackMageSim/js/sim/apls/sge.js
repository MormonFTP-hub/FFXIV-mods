// Sage, Dawntrail 7.0–7.57 (js/jobs/sge_ew.js, dt70). The Balance's Toxikon opener: Eukrasia before the pull, Toxikon
// II to open and the tincture behind it, Eukrasian Dosis III, Dosis III, then both Phlegma III charges with Psyche
// between them as the party's buffs land. Eukrasian Dosis III kept up, Psyche on cooldown, Phlegma spent in the
// two-minute windows (time%120) and never left to overcap, Dosis III as filler; Addersgall spent on Druochole for
// its MP rather than lost, Lucid Dreaming when short. A Phlegma or Toxikon opens a weave for the tincture (Dosis
// III's hardcast leaves room for one quick ability only).
// The simulator stands healers 8y from the dummy, outside Phlegma's 6y: Icarus first thing before the pull closes in.
BLM.SIM_APLS.sge = `
# Sage — Dawntrail 7.0–7.57
actions.precombat=icarus
actions.precombat+=/eukrasia,at=-4
actions.precombat+=/toxikon2,at=-0.7
actions.precombat+=/tincture

actions=/variable,name=burst_in,value=120-time%120
actions+=/variable,name=window,value=time%120>5&time%120<24
actions+=/variable,name=want_pot,value=cd.tincture.ready&(var.burst_in<3|(fight.remains>285&fight.remains-var.burst_in<285)|fight.remains<var.burst_in+15)

# Abilities, woven between GCDs.
actions+=/tincture,if=var.want_pot
actions+=/psyche,if=time>5
actions+=/druochole,if=gauge.gall>=3|gauge.gall>=1&mp<7000
actions+=/rhizomata,if=gauge.gall<3
actions+=/lucidDreaming,if=mp<7000

# AoE.
actions+=/eukrasia,if=targets>=3&!buff.eukrasia.up&debuff.eukrasianDosis3.remains<3&fight.remains>15
actions+=/dosis3,if=targets>=3&buff.eukrasia.up
actions+=/phlegma3,if=targets>=3
actions+=/toxikon2,if=targets>=3
actions+=/dyskrasia2,if=targets>=3

# Single target.
actions+=/eukrasia,if=!buff.eukrasia.up&debuff.eukrasianDosis3.remains<3&fight.remains>12
actions+=/dosis3,if=buff.eukrasia.up
actions+=/phlegma3,if=var.window|buff.medicated.up&time>30|cd.phlegma3.charges>=2&time>5|cd.phlegma3.charges=1&cd.phlegma3.fullin<gcd+1|fight.remains<cd.phlegma3.charges*gcd+1
actions+=/phlegma3,if=var.want_pot&gcd.ready
actions+=/toxikon2,if=var.want_pot|mp<800|fight.remains<gauge.sting*gcd+1
actions+=/dosis3
# Moving: the instants.
actions+=/toxikon2,if=moving
actions+=/phlegma3,if=moving
actions+=/eukrasia,if=moving&!buff.eukrasia.up&debuff.eukrasianDosis3.remains<15
`;
