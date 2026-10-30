// Dragoon, early Stormblood at level 70, in two versions. Built on the 4.1–4.58 class (drg_sb.js): the two five-hit
// combos, Blood and Life of the Dragon, Mirage Dive and Geirskogul, with the launch numbers. Life of the Dragon needs four
// Eyes, Geirskogul is 220 on a 35s recast, Heavy Thrust's buff is +15%, and the jumps hit softer (Jump 250, Spineshatter
// 200, Dragonfire 300, Mirage Dive 200, Nastrond 320).
//  - 4.05–4.06: Blood of the Dragon 20s, extended by Sonic Thrust (as later); the 4.06 numbers (it ran 63 days against
//    4.05's 22): Heavy Thrust 140 (180 flank), Chaos Thrust 230 (270 rear) in combo, Fang and Claw / Wheeling Thrust 250
//    (290 positional), True Thrust 150, Vorpal 240, Impulse Drive 190.
//  - 4.0–4.01: Blood of the Dragon only 15s and Sonic Thrust doesn't extend it; Blood can be pressed during Life; Heavy
//    Thrust 100 (180 flank), Chaos Thrust 220 (270 rear), Fang and Claw / Wheeling Thrust 200 (290), Lance Mastery +30,
//    Full Thrust 440, Disembowel 230, Elusive Jump 60s.
// Numbers are 2017's job guide (Wayback), wiki revisions and the 4.05 / 4.06 / 4.1 patch notes. Gear is a rough
// Deltascape Savage set (Genji i340, the i345 spear: 100 weapon damage) with the ungraded Infusion (+10%, max 137).
// ref: scaled from the 4.1 bot by gear and potency (no bot of its own yet).
(function (B) {
  const SB = B.DragoonSB;
  const VERSIONS = {
    sb405: { label: 'Stormblood 4.05–4.06', history: 'SB 4.05–4.06', blood: 20, sonic: true, inLife: false, heavy: [140, 40], chaos: [100, 230, 40], fang: [250, 40],
      lance: 100, full: 450, disembowel: 240, elusive: 30, ref: 5200,
      note: 'Level 70: four Eyes for Life of the Dragon, Blood 20s extended by Sonic Thrust, Heavy Thrust +15%; the 4.06 numbers and Deltascape gear' },
    sb40: { label: 'Stormblood 4.0–4.01', history: 'SB 4.0–4.01', blood: 15, sonic: false, inLife: true, heavy: [100, 80], chaos: [100, 220, 50], fang: [200, 90],
      lance: 30, full: 440, disembowel: 230, elusive: 60, ref: 4700,
      note: 'Level 70, the launch: the Dragon Gauge with four Eyes, Mirage Dive, Nastrond and Dragon Sight, a 15s Blood of the Dragon; Deltascape gear' },
  };
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)

  class DragoonSB40 extends SB {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.eyesMax = 4;
      this.bloodDur = V.blood;
      this.sonicExtends = V.sonic;
      this.bloodInLife = V.inLife;
      this.heavyMult = 1.15;
      this.lanceBonus = V.lance;
      this.tinctureKey = 'str1sb';
      const A = Object.assign({}, this.actions);
      set(A, 'trueThrust', { potency: 150, desc: 'Delivers an attack with a potency of 150.' });
      set(A, 'vorpalThrust', { comboPotency: 240, desc: 'Delivers an attack with a potency of 100.\nCombo Action: True Thrust\nCombo Potency: 240' });
      set(A, 'impulseDrive', { potency: 190, desc: 'Delivers an attack with a potency of 190.' });
      set(A, 'fullThrust', { comboPotency: V.full, desc: A.fullThrust.desc.replace('450', String(V.full)) });
      set(A, 'disembowel', { comboPotency: V.disembowel, desc: A.disembowel.desc.replace('240', String(V.disembowel)) });
      set(A, 'heavyThrust', { potency: V.heavy[0], posBonus: V.heavy[1], desc: `Delivers an attack with a potency of ${V.heavy[0]}.\n180 when executed from a target's flank.\nAdditional Effect: Increases damage dealt by 15%\nDuration: 30s` });
      set(A, 'chaosThrust', { potency: V.chaos[0], comboPotency: V.chaos[1], posBonus: V.chaos[2], desc: `Delivers an attack with a potency of ${V.chaos[0]}.\nCombo Action: Disembowel\nCombo Potency: ${V.chaos[1]}\nRear Combo Potency: ${V.chaos[1] + V.chaos[2]}\nCombo Bonus: Damage over time\nPotency: 35\nDuration: 30s` });
      for (const k of ['fangAndClaw', 'wheelingThrust']) set(A, k, { potency: V.fang[0], posBonus: V.fang[1], desc: A[k].desc.replace('260', String(V.fang[0])).replace('300', String(V.fang[0] + V.fang[1])).replace(/\+100/g, `+${V.lance}`) });
      set(A, 'jump', { potency: 250, desc: A.jump.desc.replace('260', '250') });
      set(A, 'spineshatterDive', { potency: 200, desc: A.spineshatterDive.desc.replace('210', '200') });
      set(A, 'dragonfireDive', { potency: 300, desc: A.dragonfireDive.desc.replace('320', '300') });
      set(A, 'mirageDive', { potency: 200, desc: A.mirageDive.desc.replace('210', '200') });
      set(A, 'geirskogul', { potency: 220, recast: 35, desc: A.geirskogul.desc.replace('230', '220').replace('three', 'four') });
      set(A, 'nastrond', { potency: 320, desc: A.nastrond.desc.replace('330', '320') });
      set(A, 'bloodOfTheDragon', { desc: `Increases the potency of Jump and Spineshatter Dive by 30%.\nDuration: ${V.blood}s\nExtended by Fang and Claw and Wheeling Thrust${V.sonic ? ' and Sonic Thrust' : ''}, up to 30s.` });
      if (!V.sonic) set(A, 'sonicThrust', { comboPotency: 170, desc: 'Delivers an attack with a potency of 100 to all enemies in a cone before you.\nCombo Action: Doom Spike\nCombo Potency: 170' });
      set(A, 'elusiveJump', { recast: V.elusive });
      A.tincture = B.tincture('str1sb');
      this.actions = A;
      this.stats = { hp: 26000, main: 2519, mainStat: 'str', jobMod: 115, trait: 100, wd: 100, det: 1350, crit: 2000, dh: 1550, speed: 600, delay: 2.8 };
      this.referenceDps = V.ref;
    }

    helpHtml(seq) {
      const V = this.V;
      return super.helpHtml(seq).replace(/Stormblood 4\.1–4\.58/g, V.label).replace(/three Eyes/g, 'four Eyes').replace(/With three Dragon's Eyes/g, 'With four Dragon\'s Eyes') + `
<p style="color:#a9a3b4">What's different in ${V.label}: Life of the Dragon needs four Eyes (three from 4.1), Geirskogul is 220 on a 35s recast, Heavy Thrust ${V.heavy[0]} (180 flank) gives +15%, Chaos Thrust ${V.chaos[1]} (${V.chaos[1] + V.chaos[2]} rear) in combo, Fang and Claw / Wheeling Thrust ${V.fang[0]} (${V.fang[0] + V.fang[1]} positional, +${V.lance} from Lance Mastery), Jump 250, Spineshatter 200, Dragonfire 300, Mirage Dive 200, Nastrond 320; Blood of the Dragon lasts ${V.blood}s${V.sonic ? '' : ', Sonic Thrust doesn\'t extend it and it can be pressed during Life'}. Gear is a rough Deltascape Savage set (Strength 2,519, 100 weapon damage) with the ungraded Infusion of Strength.</p>`;
    }
  }

  B.registerJob({
    id: 'drg', name: 'Dragoon', abbr: 'DRG', role: 'melee', classJob: 22,
    versions: ['sb405', 'sb40'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new DragoonSB40(v) })),
  });
})(window.BLM);
