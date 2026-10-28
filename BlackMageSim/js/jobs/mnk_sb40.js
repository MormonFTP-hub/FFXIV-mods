// Monk, Stormblood 4.0–4.18 at level 70. Built on the 4.2–4.58 class (mnk_sb.js): forms, Greased Lightning, the
// Riddles and the Tackles, with the launch numbers. True Strike 140, Snap Punch 130, Twin Snakes 100, Demolish 30 (+50 a
// tick), Dragon Kick 100 (the positional values unchanged); Fists of Fire +5%; Perfect Balance on 180s, Mantra 120s,
// True North 150s. Brotherhood only helped party members (no +5% or chakra for the Monk, so nothing alone on a dummy).
// Wind Tackle's Riddle of Wind lasts 5s and its attack gives no Greased Lightning. No PvE Monk change in 4.01–4.18.
// Numbers are 2017's job guide (Wayback), wiki revisions and the 4.2 / 4.4 patch notes. Gear is a rough Deltascape
// Savage set (Genji i340, the i345 knuckles: 100 weapon damage) with the ungraded Infusion (+10%, max 137).
// ref: scaled from the 4.2 bot by gear and potency (no bot of its own yet).
(function (B) {
  const SB = B.MonkSB;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class MonkSB40 extends SB {
    constructor() {
      super();
      this.fofMult = 1.05;
      this.brotherhoodSelf = false;
      this.rowDur = 5;
      this.rowGl = false;
      this.tinctureKey = 'str1sb';
      const A = Object.assign({}, this.actions);
      const pot = (id, p) => set(A, id, { potency: p, desc: A[id].desc.replace(/potency of \d+/, `potency of ${p}`) });
      pot('trueStrike', 140); set(A, 'trueStrike', { posBonus: 40 });
      pot('snapPunch', 130); set(A, 'snapPunch', { posBonus: 40 });
      pot('twinSnakes', 100); set(A, 'twinSnakes', { posBonus: 30 });
      pot('demolish', 30); set(A, 'demolish', { posBonus: 40 });
      pot('dragonKick', 100); set(A, 'dragonKick', { posBonus: 40 });
      set(A, 'perfectBalance', { recast: 180 });
      set(A, 'mantra', { recast: 120 });
      set(A, 'trueNorth', { recast: 150 });
      set(A, 'fistsOfFire', { desc: A.fistsOfFire.desc.replace('6%', '5%') });
      set(A, 'brotherhood', { desc: 'Increases physical damage dealt by nearby party members by 5%.\nDuration: 15s\nAdditional Effect: 30% chance of opening a chakra when a party member\'s weaponskill lands\nIn 4.0–4.18 the Monk himself gets neither, so alone on a dummy it does nothing.' });
      A.tincture = B.tincture('str1sb');
      this.actions = A;
      this.stats = { hp: 27000, main: 2505, mainStat: 'str', jobMod: 110, trait: 100, wd: 100, det: 950, crit: 1950, dh: 1400, speed: 900, delay: 2.56 };
      this.referenceDps = 5100;
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace(/Stormblood 4\.2–4\.58/g, 'Stormblood 4.0–4.18') + `
<p style="color:#a9a3b4">What's different in 4.0–4.18: True Strike 140, Snap Punch 130, Twin Snakes 100, Demolish 30 (+50 a tick) and Dragon Kick 100 (positionals as later); Fists of Fire +5%; Perfect Balance 180s, Mantra 120s, True North 150s; Brotherhood buffs only the party; Riddle of Wind (from Wind Tackle) lasts 5s and gives no Greased Lightning. Gear is a rough Deltascape Savage set (Strength 2,505, 100 weapon damage) with the ungraded Infusion of Strength.</p>`;
    }
  }

  B.registerJob({
    id: 'mnk', name: 'Monk', abbr: 'MNK', role: 'melee', classJob: 20,
    versions: [{ id: 'sb40', label: 'Stormblood 4.0–4.18', history: 'SB 4.0–4.18', note: 'Level 70, the launch: Riddle of Fire with its recast penalty, Riddle of Earth, Wind Tackle, Brotherhood for the party only, 180s Perfect Balance; Deltascape gear', create: () => new MonkSB40() }],
  });
})(window.BLM);
