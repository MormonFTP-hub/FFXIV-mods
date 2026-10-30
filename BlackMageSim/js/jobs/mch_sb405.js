// Machinist, Stormblood 4.05 at level 70. Built on the 4.06–4.58 class (mch_sb.js), which already has what 4.05 brought
// (Barrel Stabilizer on 60s, 5 Heat a shot, Rook Overload 800), with what 4.06 and later changed put back: Hot Shot +8%
// for 30s, Overheat +10%, a 10s Gauss Barrel recast, Flamethrower 10 Heat a tick, ammunition +25 potency, Gauss Round 200,
// Ricochet 300.
// Also 4.0–4.01 (MachinistSB40): Barrel Stabilizer on 120s, Hot Shot +5%, Hot Shot, Spread Shot and the Heated shots add
// 10 Heat, Quick Reload takes 10 off, Rook Overload 400; the i320 gear before Savage (SE forum's 2017-06-21 primer). Numbers are 2017's job guide (Wayback), wiki revisions and the 4.06 / 4.2 / 4.4 patch notes. Gear is a
// rough Deltascape Savage set (Genji i340, the i345 gun: 100 weapon damage) with the ungraded Infusion (+10%, max 137).
// ref: scaled from the 4.06 bot by gear and the buff changes (no bot of its own yet).
(function (B) {
  const SB = B.MachinistSB;
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)

  class MachinistSB405 extends SB {
    constructor() {
      super();
      this.hotShotMult = 1.08;
      this.hotShotDur = 30;
      this.overheatMult = 1.10;
      this.ammoBonus = 25;
      this.flameHeat = 10;
      this.tinctureKey = 'dex1sb';
      const A = Object.assign({}, this.actions);
      set(A, 'hotShot', { desc: 'Delivers an attack with a potency of 120.\nAdditional Effect: Increases damage dealt by 8%\nDuration: 30s' });
      set(A, 'gaussRound', { potency: 200, desc: 'Delivers an attack with a potency of 200.' });
      set(A, 'ricochet', { potency: 300, desc: A.ricochet.desc.replace('320', '300') });
      set(A, 'gaussBarrel', { recast: 10, desc: A.gaussBarrel.desc.replace('+20%', '+10%') });
      A.tincture = B.tincture('dex1sb');
      this.actions = A;
      this.stats = { hp: 25500, main: 2519, mainStat: 'dex', jobMod: 115, trait: 120, wd: 100, det: 1550, crit: 1600, dh: 1400, speed: 670, delay: 2.64 };
      this.referenceDps = 6100;
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace(/Stormblood 4\.06–4\.58/g, 'Stormblood 4.05') + `
<p style="color:#a9a3b4">What's different in 4.05: Hot Shot gives +8% for 30s (10% for 60s from 4.06), Overheat +10% (+20% later), the Gauss Barrel recasts in 10s, Flamethrower adds 10 Heat a tick (20 from 4.06), ammunition adds 25 potency, Gauss Round 200, Ricochet 300. Gear is a rough Deltascape Savage set (Dexterity 2,519, 100 weapon damage) with the ungraded Infusion of Dexterity.</p>`;
    }
  }

  class MachinistSB40 extends MachinistSB405 {
    constructor() {
      super();
      this.hotShotMult = 1.05;
      this.quickReloadHeat = -10;
      this.heatOf = { hotShot: 10, spreadShot: 10, heatedSplitShot: 10, heatedSlugShot: 10, heatedCleanShot: 10 };
      const A = Object.assign({}, this.actions);
      set(A, 'hotShot', { desc: 'Delivers an attack with a potency of 120.\nAdditional Effect: Increases damage dealt by 5%\nDuration: 30s\nGauss Barrel Bonus: Heat +10' });
      set(A, 'barrelStabilizer', { recast: 120 });
      set(A, 'quickReload', { desc: (A.quickReload.desc || 'Loads one round of ammunition.') + '\nGauss Barrel Bonus: reduces Heat by 10' });
      if (A.rookOverload) set(A, 'rookOverload', { potency: 400 });
      this.actions = A;
      this.stats = { hp: 24100, main: 2276, mainStat: 'dex', jobMod: 115, trait: 120, wd: 97, det: 1579, crit: 1061, dh: 1689, speed: 956, delay: 2.64 };
      this.referenceDps = 5050;
      this.referenceGcd = 2.41;
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace(/Stormblood 4\.05/g, 'Stormblood 4.0–4.01') + `
<p style="color:#a9a3b4">What 4.0–4.01 changes on top: Barrel Stabilizer recasts in 120s, Hot Shot gives only +5%, Hot Shot, Spread Shot and the Heated shots add 10 Heat (the rest 5), Quick Reload takes 10 Heat off, Rook Overload is 400. An opener from the SE forum's Stormblood primer (Zoof, 2017-06-21): Gauss Round and Barrel Stabilizer at the pull, Hot Shot, Reload, Heated Split Shot, Hypercharge, Heated Slug Shot, the potion, Heated Split Shot, Flamethrower for three ticks, Wildfire, Cooldown with Ricochet and Rapid Fire. Gear: an i320 set (Genta of Aiming with Lakshmi's accessories and Susano's Revolver: Dexterity 2,276, 97 weapon damage). ref: scaled from 4.05 by gear and the buff changes (no bot of its own).</p>`;
    }
  }

  B.registerJob({
    id: 'mch', name: 'Machinist', abbr: 'MCH', role: 'ranged', classJob: 31,
    versions: [{ id: 'sb405', label: 'Stormblood 4.05–4.05', history: 'SB 4.05–4.05', note: 'Level 70: Barrel Stabilizer at 60s, Hot Shot +8%, Overheat +10%, a 10s Gauss Barrel; Deltascape gear', create: () => new MachinistSB405() },
      { id: 'sb40', label: 'Stormblood 4.0–4.01', history: 'SB 4.0–4.01', note: 'Level 70, the launch: Barrel Stabilizer on 120s, Hot Shot +5%, 10-Heat Heated shots, Quick Reload cools 10 Heat, Rook Overload 400; i320 gear', create: () => new MachinistSB40() }],
  });
})(window.BLM);
