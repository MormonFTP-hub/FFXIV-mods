// Scholar, Dawntrail 7.0–7.57 (js/jobs/sch_ew.js, dt70). The Balance's standard play: Broil IV hardcast before the
// pull, Biolysis and the tincture, Aetherflow, then Chain Stratagem with Baneful Impaction straight after it and the
// Energy Drains inside the window, Dissipation for three more once Aetherflow's are spent. Biolysis kept up, Lucid
// Dreaming for MP, Broil IV as filler; Aetherflow and Dissipation never overwrite stacks still held. The tincture
// goes with Chain Stratagem, or earlier when waiting for it would cost a use before the fight ends.
BLM.SIM_APLS.sch = `
# Scholar — Dawntrail 7.0–7.57
actions.precombat=broil4,at=-1.5

actions=/variable,name=burst_in,value=cd.chainStratagem.remains
actions+=/variable,name=want_pot,value=cd.tincture.ready&(time<10|var.burst_in<3|(fight.remains>285&fight.remains-var.burst_in<285)|fight.remains<var.burst_in+15)

# Abilities, woven between GCDs.
actions+=/tincture,if=var.want_pot
actions+=/chainStratagem,if=time>3
actions+=/banefulImpaction,if=debuff.chainStratagem.up|buff.impactImminent.remains<5
actions+=/aetherflow,if=gauge.flow=0
actions+=/dissipation,if=gauge.flow=0&cd.aetherflow.remains>gcd*3+2
actions+=/energyDrain,if=gauge.flow>0&(debuff.chainStratagem.up|buff.dissipation.up|cd.aetherflow.remains<gauge.flow*gcd+3|cd.dissipation.remains<gauge.flow*gcd+3|fight.remains<gauge.flow*gcd+3)
actions+=/lucidDreaming,if=mp<8000

# AoE.
actions+=/biolysis,if=targets>=3&debuff.biolysis.remains<3&fight.remains>15
actions+=/artOfWar2,if=targets>=3

# Single target.
actions+=/biolysis,if=debuff.biolysis.remains<2.5&fight.remains>12
actions+=/broil4
actions+=/ruin2
`;
