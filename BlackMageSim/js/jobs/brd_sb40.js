// Bard, Stormblood 4.0–4.05 at level 70. Built on the 4.06–4.58 class (brd_sb.js): the same songs, Repertoire, Pitch
// Perfect and DoTs, with what 4.06 changed put back: Straight Shot's +10% crit lasts 20s (30s from 4.06) and Barrage
// recasts in 90s (80s later). Foe Requiem (+3% damage taken, draining MP) is in the 4.06 class. Numbers are 2017's job guide (Wayback), wiki revisions and the 4.06 patch notes. Gear is a rough
// Deltascape Savage set (Genji i340, the i345 bow: 100 weapon damage) with the ungraded Infusion (+10%, max 137).
// ref: scaled from the 4.06 bot by gear (no bot of its own yet).
(function (B) {
  const SB = B.BardSB;

  class BardSB40 extends SB {
    constructor() {
      super();
      this.ssDur = 20;
      this.tinctureKey = 'dex1sb';
      const A = Object.assign({}, this.actions);
      A.straightShot = Object.assign({}, A.straightShot, { desc: A.straightShot.desc.replace('Duration: 30s', 'Duration: 20s') });
      A.barrage = Object.assign({}, A.barrage, { recast: 90 });
      A.tincture = B.tincture('dex1sb');
      this.actions = A;
      this.stats = { hp: 25500, main: 2519, mainStat: 'dex', jobMod: 115, trait: 120, wd: 100, det: 1275, crit: 1850, dh: 1250, speed: 870, delay: 3.04 };
      this.referenceDps = 5300;
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace(/Stormblood 4\.06–4\.58/g, 'Stormblood 4.0–4.05') + `
<p style="color:#a9a3b4">What's different in 4.0–4.05: Straight Shot's crit buff lasts 20s (30s from 4.06), so refresh it more often; Barrage recasts in 90s (80s from 4.06). Gear is a rough Deltascape Savage set (Dexterity 2,519, 100 weapon damage) with the ungraded Infusion of Dexterity.</p>`;
    }
  }

  B.registerJob({
    id: 'brd', name: 'Bard', abbr: 'BRD', role: 'ranged', classJob: 23,
    versions: [{ id: 'sb40', label: 'Stormblood 4.0–4.05', history: 'SB 4.0–4.05', note: 'Level 70, the launch: songs with Repertoire, Pitch Perfect, Refulgent Arrow, a 20s Straight Shot, 90s Barrage; Deltascape gear', create: () => new BardSB40() }],
  });
})(window.BLM);
