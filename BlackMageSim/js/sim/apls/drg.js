// Dragoon, Dawntrail 7.1–7.57 (js/jobs/drg_dt.js). The Balance's standard play: the tincture before the pull; Lance
// Charge and Geirskogul (Life of the Dragon) every minute with Battle Litany and Dragonfire Dive every two; Stardiver,
// Starcross, Nastrond and Rise of the Dragon inside the window; High Jump on cooldown; Life Surge on Heavens' Thrust or
// Drakesbane under the buffs (or before its charges cap); the ten-GCD loop alternating its halves on Power Surge and
// Chaotic Spring. The AoE combo from three targets.
BLM.SIM_APLS.drg = `
# Dragoon — Dawntrail 7.1–7.57
actions.precombat=tincture,at=-1.5

# Abilities, woven between GCDs (Stardiver's long lock only fits the first slot after a GCD).
actions=/tincture,if=cd.lanceCharge.remains<gcd&cd.battleLitany.remains<gcd*2
actions+=/lanceCharge
actions+=/battleLitany,if=buff.lanceCharge.up
actions+=/geirskogul,if=!buff.nastrondReady.up&(buff.lanceCharge.up|cd.lanceCharge.remains>15)
actions+=/dragonfireDive,if=!buff.dragonsFlight.up&(buff.lanceCharge.up|cd.lanceCharge.remains>20)
actions+=/lifeSurge,if=!buff.lifeSurge.up&(combo.lanceBarrage|is.fangAndClaw.drakesbane)&(buff.lanceCharge.up|buff.lifeOfTheDragon.up|cd.lifeSurge.charges_fractional>1.6)
actions+=/lifeSurge,if=!buff.lifeSurge.up&targets>=3&combo.sonicThrust&(buff.lanceCharge.up|buff.lifeOfTheDragon.up|cd.lifeSurge.charges_fractional>1.6)
actions+=/highJump,if=!buff.diveReady.up&(time>5|buff.lanceCharge.up)
actions+=/riseOfTheDragon
actions+=/stardiver,if=!buff.starcrossReady.up
actions+=/starcross
actions+=/nastrond
actions+=/mirageDive
actions+=/wyrmwindThrust

# Weaponskills: three or more targets take the AoE combo.
actions+=/run_action_list,name=aoe,if=targets>=3
actions+=/drakesbane
actions+=/fangAndClaw,if=combo.heavensThrust
actions+=/wheelingThrust,if=combo.chaoticSpring
actions+=/heavensThrust,if=combo.lanceBarrage
actions+=/chaoticSpring,if=combo.spiralBlow
actions+=/spiralBlow,if=combo.trueThrust&(buff.powerSurge.remains<10|debuff.chaoticSpring.remains<8)
actions+=/lanceBarrage,if=combo.trueThrust
actions+=/trueThrust

actions.aoe=coerthanTorment,if=combo.sonicThrust
actions.aoe+=/sonicThrust,if=combo.doomSpike
actions.aoe+=/doomSpike
`;
