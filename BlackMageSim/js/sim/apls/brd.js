// Bard, Dawntrail 7.0–7.57 (js/jobs/brd_dt.js). The Balance's standard play: the tincture just before the pull,
// Stormbite at the pull, the songs Wanderer's Minuet → Mage's Ballad → Army's Paeon (each cut after its last
// Repertoire roll at 42s, the Minuet cutting the Paeon when it comes back), Battle Voice, Radiant Finale and Raging
// Strikes on the Minuet, Barrage into a triple Refulgent Arrow, Encore and Resonant Arrow inside the buffs, a buffed
// Iron Jaws as Raging Strikes ends, Heartbreak Shot pooled for the burst and never overcapped (spent freely in the
// Ballad), Pitch Perfect at three, Apex Arrow at 80+ (held for Raging Strikes when it's near).
BLM.SIM_APLS.brd = `
# Bard — Dawntrail 7.0–7.57
actions.precombat=tincture,at=-1.2

# Abilities, woven between GCDs.
actions=/wanderersMinuet
actions+=/empyrealArrow,if=!(buff.wanderersMinuet.up&gauge.rep>=3)
actions+=/battleVoice,if=buff.wanderersMinuet.up
actions+=/tincture,if=buff.wanderersMinuet.up&(cd.battleVoice.ready|buff.battleVoice.up)|fight.remains<31
actions+=/radiantFinale,if=buff.battleVoice.up|fight.remains<20
actions+=/ragingStrikes,if=buff.battleVoice.up&(buff.radiantFinale.up|cd.radiantFinale.remains>10)|fight.remains<20
actions+=/pitchPerfect,if=gauge.rep>=3|buff.wanderersMinuet.remains<3|fight.remains<3
actions+=/magesBallad,if=buff.wanderersMinuet.up&buff.wanderersMinuet.remains<2.6|!buff.wanderersMinuet.up&!buff.armysPaeon.up&!buff.magesBallad.up&cd.wanderersMinuet.remains>3
actions+=/armysPaeon,if=buff.magesBallad.up&buff.magesBallad.remains<2.6&cd.wanderersMinuet.remains>15|!buff.wanderersMinuet.up&!buff.armysPaeon.up&!buff.magesBallad.up&cd.wanderersMinuet.remains>3
actions+=/barrage,if=buff.ragingStrikes.up
actions+=/sidewinder,if=buff.ragingStrikes.up|cd.ragingStrikes.remains>12
# AoE: Rain of Death (100 to all) beats Heartbreak Shot (180) from two targets.
actions+=/rainOfDeath,if=targets>=2&(buff.ragingStrikes.up|cd.rainOfDeath.fullin<2.6|buff.magesBallad.up|fight.remains<10)
actions+=/heartbreakShot,if=buff.ragingStrikes.up|cd.heartbreakShot.fullin<2.6|buff.magesBallad.up|buff.wanderersMinuet.up&cd.ragingStrikes.remains>30|fight.remains<10

# Weaponskills.
actions+=/stormbite,if=!debuff.stormbite.up
actions+=/causticBite,if=!debuff.causticBite.up
actions+=/ironJaws,if=debuff.stormbite.remains<3|debuff.causticBite.remains<3
actions+=/ironJaws,if=buff.ragingStrikes.up&buff.ragingStrikes.remains<3&debuff.stormbite.remains<40
actions+=/radiantEncore,if=usable.radiantEncore&(buff.ragingStrikes.up|buff.radiantEncoreReady.remains<3)
actions+=/shadowbite,if=targets>=4&buff.barrage.up
actions+=/refulgentArrow,if=buff.barrage.up
actions+=/resonantArrow,if=usable.resonantArrow
actions+=/blastArrow,if=usable.blastArrow
actions+=/apexArrow,if=gauge.soul>=80&(cd.ragingStrikes.remains>15|buff.ragingStrikes.up)|gauge.soul>=100&(cd.ragingStrikes.remains>8|buff.ragingStrikes.up)|gauge.soul>=20&fight.remains<5
# AoE: Shadowbite (200 to all) and Ladonsbite (140 to all) beat Refulgent Arrow and Burst Shot from two targets.
actions+=/shadowbite,if=targets>=2&buff.hawksEye.up
actions+=/refulgentArrow,if=buff.hawksEye.up
actions+=/ladonsbite,if=targets>=2
actions+=/burstShot
`;
