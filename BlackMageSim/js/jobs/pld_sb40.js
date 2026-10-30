// Paladin, Stormblood 4.0–4.01 at level 70: the launch. Built on the 4.05–4.58 class (pld_sb.js) with the launch
// numbers: Holy Spirit 430 (400 from 4.05, 380 from 4.2) and Shield Swipe 150 (it needs a blocked attack, so a dummy
// never allows it). Swapping Oaths halved the Oath Gauge until 4.05, which doesn't touch damage here. Numbers are
// 2017's job guide (Wayback) and the 4.05 / 4.2 patch notes. Gear: the first savage tier (Deltascape, i340) opened only
// in 4.05; this uses a rough i340 tank set anyway, as the other 4.0 versions do, with the ungraded Infusion (max 137).
// ref: scaled from the 4.5 bot by gear (no bot of its own yet).
(function (B) {
  const SB = B.PaladinSB;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class PaladinSB40 extends SB {
    constructor() {
      super();
      this.potionCap = B.TINCTURES.str1sb.cap;
      const A = Object.assign({}, this.actions);
      set(A, 'holySpirit', { potency: 430, desc: A.holySpirit.desc.replace(/potency of \d+/, 'potency of 430') });
      set(A, 'shieldSwipe', { potency: 150, desc: A.shieldSwipe.desc.replace('potency of 100', 'potency of 150') });
      A.tincture = B.tincture('str1sb');
      this.actions = A;
      this.stats = Object.assign({}, this.stats, { hp: 52850, main: 2118, wd: 100, det: 1648, crit: 950, dh: 1222, speed: 699, ten: 1360 });
      this.referenceDps = 3250;
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace(/Stormblood 4\.05–4\.58/g, 'Stormblood 4.0–4.01') + `
<p style="color:#a9a3b4">What's different in 4.0–4.01: Holy Spirit 430 (400 from 4.05, 380 from 4.2), Shield Swipe 150, and swapping Oaths halves the Oath Gauge. Gear is a rough i340 tank set (Strength 2,118, 100 weapon damage) with the ungraded Infusion of Strength.</p>`;
    }
  }

  B.registerJob({
    id: 'pld', name: 'Paladin', abbr: 'PLD', role: 'tank', classJob: 19,
    versions: [{ id: 'sb40', label: 'Stormblood 4.0–4.01', history: 'SB 4.0–4.01', note: 'Level 70, the launch: the Oath Gauge, Requiescat into Holy Spirit (430), Fight or Flight 25%; i340 gear', create: () => new PaladinSB40() }],
  });
})(window.BLM);
