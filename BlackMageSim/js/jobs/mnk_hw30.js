// Monk, Heavensward 3.0–3.05 at level 60: the launch. Built on the 3.07–3.57 class (mnk_hw.js) with what 3.07 and 3.2
// changed put back: Greased Lightning 9% a stack (27% at three) lasting 12s, Tornado Kick on a 60s recast, Meditation
// a 1.5s GCD, Demolish's DoT 40 and Howling Fist 170. The Forbidden Chakra's longer animation lock before 3.07 isn't
// published, so it isn't modelled. Numbers are the Lodestone notes for 3.07 and 3.2 and the FFXIV wiki's 2015 Monk
// and Pugilist pages. Gear is a rough 3.0x Alexander: Gordias Savage set (Gordian Cesti: 76 weapon damage, 2.48 delay)
// with the Draconian Potion of Strength.
// ref: scaled from the 3.5 bot by gear and the 3.07 / 3.2 changes (no bot of its own yet).
(function (B) {
  const HW = B.MonkHW;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class MonkHW30 extends HW {
    constructor() {
      super();
      this.glDur = 12;
      this.glStep = 0.09;
      this.potionCap = 105;
      const A = Object.assign({}, this.actions);
      set(A, 'tornadoKick', { recast: 60 });
      set(A, 'meditation', { recast: 1.5 });
      set(A, 'demolish', { dot: { potency: 40, duration: 21 }, desc: A.demolish.desc.replace('Potion: 50', 'Potency: 40').replace('Potency: 50', 'Potency: 40').replace(/Duration: 14s/g, 'Duration: 12s') });
      set(A, 'snapPunch', { desc: A.snapPunch.desc.replace('Duration: 14s', 'Duration: 12s') });
      set(A, 'howlingFist', { potency: 170, desc: A.howlingFist.desc.replace(/potency of \d+/, 'potency of 170') });
      A.tincture = Object.assign({}, A.tincture, { name: 'Draconian Potion of Strength', desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 105)\nDuration: 15s' });
      this.actions = A;
      this.stats = Object.assign({}, this.stats, { hp: 27000, main: 1020, wd: 76, det: 450, crit: 720, speed: 560, delay: 2.48 });
      this.autoAttack = Object.assign({}, this.autoAttack, { delay: 2.48 });
      this.referenceDps = 1540;
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace(/Heavensward 3\.07–3\.57/g, 'Heavensward 3.0–3.05') + `
<p style="color:#a9a3b4">What's different in 3.0–3.05: Greased Lightning is 9% a stack (27% at three) and lasts only 12s; Tornado Kick recasts in 60s; Meditation is a 1.5s GCD; Demolish's DoT is 40 a tick and Howling Fist 170 (raised in 3.2). Gear is a rough Alexander: Gordias Savage set (Strength 1,020, the Gordian Cesti: 76 weapon damage, 2.48 delay) with the Draconian Potion of Strength (max 105).</p>`;
    }
  }

  B.registerJob({
    id: 'mnk', name: 'Monk', abbr: 'MNK', role: 'melee', classJob: 20,
    versions: [{ id: 'hw30', label: 'Heavensward 3.0–3.05', history: 'HW 3.0–3.05', note: 'Level 60, the launch: Greased Lightning 27% for 12s, Tornado Kick every 60s, The Forbidden Chakra from Meditation; Gordias gear', create: () => new MonkHW30() }],
  });
})(window.BLM);
