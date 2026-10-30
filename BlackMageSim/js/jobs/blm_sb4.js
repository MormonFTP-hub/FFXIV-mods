// Black Mage, early Stormblood at level 70, in two versions. Built on the 4.2–4.58 class (blm_sb.js) with what played
// differently before 4.2: Fire IV 260, Firestarter and Thundercloud 12s, Transpose on a 12s recast.
//  - 4.05–4.18: as above.
//  - 4.0–4.01: also Fire IV and Blizzard IV 3.0s casts (2.8 from 4.05), Triplecast on 90s (60s from 4.05), Fire 1,440 MP,
//    Blizzard IV 1,200 MP and Foul costing MP (about 240; the exact figure isn't recorded).
// Numbers are 2017's job guide (Wayback), wiki and Gamer Escape revisions, the 4.05 / 4.2 / 4.4 patch notes and the 4.11
// game data. Gear is a rough Deltascape Savage set (Genji i340, the i345 rod: 135 magic damage); the only tincture then
// was the ungraded Infusion (+10%, max 137). ref: scaled from the 4.2 bot by gear and potency (no bot of its own yet).
(function (B) {
  const SB = B.BlackMageSB;
  const VERSIONS = {
    sb405: { label: 'Stormblood 4.05–4.18', history: 'SB 4.05–4.18', cast: 2.8, triple: 60, fireMp: 1200, b4Mp: 960, foulMp: 0, ref: 5050,
      note: 'Level 70: Fire IV 260, 12s Firestarter / Thundercloud, a 12s Transpose, 60s Triplecast; Deltascape gear' },
    sb40: { label: 'Stormblood 4.0–4.01', history: 'SB 4.0–4.01', cast: 3.0, triple: 90, fireMp: 1440, b4Mp: 1200, foulMp: 240, ref: 4800,
      note: 'Level 70, the launch: 3s Fire IV and Blizzard IV, a 90s Triplecast, Foul costing MP, the job gauge and Polyglot debut' },
  };
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class BlackMageSB4 extends SB {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      const A = Object.assign({}, this.actions);
      set(A, 'fire4', { potency: 260, cast: V.cast, desc: A.fire4.desc.replace(/potency of \d+/, 'potency of 260') });
      set(A, 'blizzard4', { cast: V.cast, mp: V.b4Mp });
      set(A, 'fire', { mp: V.fireMp });
      set(A, 'foul', { mp: V.foulMp });
      set(A, 'triplecast', { recast: V.triple });
      set(A, 'transpose', { recast: 12 });
      A.tincture = B.tincture('int1sb');
      this.actions = A;
      this.cfg = Object.assign({}, this.cfg, { fsDur: 12, tcDur: 12, tincture: 'int1sb' });
      this.stats = { hp: 24000, main: 2519, mainStat: 'int', jobMod: 115, trait: 130, wd: 135, det: 1060, crit: 1650, dh: 1450, speed: 1050, delay: 3.28 };
      this.referenceDps = V.ref;
    }

    helpHtml(seq) {
      const V = this.V;
      return B.BLM_SB.help(seq).replace('Stormblood 4.2–4.58', V.label) + `
<p style="color:#a9a3b4">What's different in ${V.label}: Fire IV 260 (280 from 4.2, 300 from 4.4), Firestarter and Thundercloud last 12s (18s from 4.2), Transpose recasts in 12s (8s from 4.2)${V.cast > 2.8 ? ', Fire IV and Blizzard IV are 3.0s casts, Triplecast recasts in 90s, Fire costs 1,440 MP, Blizzard IV 1,200 and Foul about 240 (the exact cost isn\'t recorded)' : ', Triplecast recasts in 60s'}. Gear is a rough Deltascape Savage set (Intelligence 2,519, 135 magic damage) with the ungraded Infusion of Intelligence (+10%, max 137), the only one in ${V.cast > 2.8 ? '4.0' : '4.0–4.1x'}.</p>`;
    }
  }

  B.registerJob({
    id: 'blm', name: 'Black Mage', abbr: 'BLM', role: 'caster', classJob: 25,
    versions: ['sb405', 'sb40'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new BlackMageSB4(v) })),
  });
})(window.BLM);
