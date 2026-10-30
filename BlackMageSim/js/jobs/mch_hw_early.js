// Machinist, Heavensward before 3.4, in two versions. Built on the 3.4–3.57 class (mch_hw.js). Before 3.4 the rounds
// Reload loads run out 30s after it (left unused, they're lost); whether Quick Reload restarted that clock isn't known,
// so here it doesn't.
//  - 3.2–3.38: otherwise as 3.4. Midas gear (the Midan Metal Musketoon: 73 weapon damage) and the Max-Potion.
//  - 3.07–3.15: Gauss Round 180, Hypercharge 15s, the turret's charged shots leave only 5% more damage taken, Split
//    Shot 70 TP, Hot Shot and Lead Shot 80. Gordias gear (the Gordian Musketoon: 68) and the Draconian Potion.
//  - 3.01–3.05: as 3.07, with Quick Reload on a 30s recast for 50 TP (3.07 made it 15s for 30).
//  - 3.0: the Gauss Barrel is a 3s-cast GCD spell worth +20% (3.01 made it an instant +30% toggle); Gauss Round 200,
//    Ricochet 100 + 300 shared; launch gear (i170 Yasha law with the Hive Musketoon, 65 weapon damage).
// Slug Shot's proc was unreliable inside Rapid Fire until 3.35, under conditions never published; not modelled.
// Numbers are the Lodestone notes for 3.07, 3.2, 3.35 and 3.4 and the FFXIV wiki's dated Machinist revisions.
// ref: scaled from the 3.5 bot by gear and the changes (no bots of their own yet).
(function (B) {
  const EPS = 1e-6;
  const HW = B.MachinistHW;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const VERSIONS = {
    hw32: { label: 'Heavensward 3.2–3.38', history: 'HW 3.2–3.38', early: false, potion: ['Max-Potion of Dexterity', 127], ref: 1950,
      stats: { hp: 24000, main: 1250, wd: 73, det: 600, crit: 900, speed: 470 },
      gear: 'a rough Alexander: Midas Savage set (Dexterity 1,250, the Midan Metal Musketoon: 73 weapon damage)',
      note: 'Level 60: the 20s Hypercharge and 10% turret vulnerability, but rounds that run out 30s after Reload; Midas gear' },
    hw307: { label: 'Heavensward 3.07–3.15', history: 'HW 3.07–3.15', early: true, potion: ['Draconian Potion of Dexterity', 105], ref: 1510,
      stats: { hp: 21000, main: 1030, wd: 68, det: 480, crit: 780, speed: 430 },
      gear: 'a rough Alexander: Gordias Savage set (Dexterity 1,030, the Gordian Musketoon: 68 weapon damage)',
      note: 'Level 60: Quick Reload\'s loop, Gauss Round 180, a 15s Hypercharge, 5% turret vulnerability, rounds lost after 30s; Gordias gear' },
    hw301: { label: 'Heavensward 3.01–3.05', history: 'HW 3.01–3.05', early: true, qr: [30, 50], potion: ['Draconian Potion of Dexterity', 105], ref: 1500,
      stats: { hp: 21000, main: 1030, wd: 68, det: 480, crit: 780, speed: 430 },
      gear: 'a rough Alexander: Gordias Savage set (Dexterity 1,030, the Gordian Musketoon: 68 weapon damage)',
      note: 'Level 60: the instant +30% Gauss Barrel, but Quick Reload on a 30s recast for 50 TP; Gauss Round 180, a 15s Hypercharge, rounds lost after 30s; Gordias gear' },
    hw30: { label: 'Heavensward 3.0–3.0', history: 'HW 3.0–3.0', early: true, barrelGcd: true, qr: [30, 50], potion: ['Draconian Potion of Dexterity', 105], ref: 1120,
      stats: { hp: 15500, main: 870, wd: 65, det: 420, crit: 542, speed: 581 },
      gear: 'launch gear (i170 Yasha law with the Hive Musketoon from Ravana Extreme: Dexterity about 870, 65 weapon damage)',
      note: 'Level 60 at launch: the Gauss Barrel a 3s-cast GCD worth +20%, Gauss Round 200, Ricochet 100 + 300, Quick Reload 30s for 50 TP; launch gear' },
  };

  class MachinistHWEarly extends HW {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.potionCap = V.potion[1];
      const A = Object.assign({}, this.actions);
      if (V.early) {
        this.hcDur = 15;
        this.vulnMult = 1.05;
        set(A, 'gaussRound', { potency: 180, desc: A.gaussRound.desc.replace('200', '180') });
        set(A, 'hypercharge', { desc: A.hypercharge.desc.replace('Duration: 20s', 'Duration: 15s') });
        set(A, 'splitShot', { tp: 70 });
        set(A, 'hotShot', { tp: 80 });
        set(A, 'leadShot', { tp: 80 });
      }
      set(A, 'reload', { desc: A.reload.desc + '\nThe rounds run out 30s after loading.' });
      if (V.barrelGcd) {
        this.barrelMult = 1.20;
        this.ricochetShare = 300;
        set(A, 'gaussBarrel', { kind: 'gcd', cast: 3, recast: 2.5, desc: 'Equips your firearm with a gauss barrel, increasing damage dealt by 20%. While it\'s equipped, auto-attacks stop and all weaponskills require a cast.\nEffect ends upon reuse.' });
        set(A, 'gaussRound', { potency: 200, desc: A.gaussRound.desc.replace('180', '200') });
        set(A, 'ricochet', { potency: 400, desc: 'Delivers an attack with a potency of 100 to target, and 300 split evenly between it and all enemies nearby it.\nCan only be executed with the Gauss Barrel equipped.' });
      }
      if (V.qr) { this.qrTp = V.qr[1]; set(A, 'quickReload', { recast: V.qr[0], desc: `Loads one round of ammunition and restores ${V.qr[1]} TP.` }); }
      A.tincture = Object.assign({}, A.tincture, { name: V.potion[0], desc: `This diluted brew temporarily increases dexterity.\nDexterity +20% (Max ${V.potion[1]})\nDuration: 15s` });
      this.actions = A;
      this.stats = Object.assign({}, this.stats, V.stats);
      this.referenceDps = V.ref;
    }

    initGauge(e) { return Object.assign(super.initGauge(e), { ammoUntil: 0 }); }

    // Rounds loaded by Reload run out after 30s.
    dropAmmo(e) {
      const g = e.g;
      if (g.ammo && e.now >= g.ammoUntil - EPS) { g.ammo = 0; e.removeStatus('ammunition', true); }
    }
    // 3.0: the Gauss Barrel is a cast on the GCD.
    castTime(id, e) {
      if (id === 'gaussBarrel' && this.V.barrelGcd) return e.has('swiftcast') ? 0 : e.speedScale(3, 0);
      return super.castTime(id, e);
    }

    resolve(id, e) {
      const g = e.g;
      if (id === 'gaussBarrel' && this.V.barrelGcd) { this.ability(id, e); return; }
      this.dropAmmo(e);
      const had = g.ammo;
      super.resolve(id, e);
      if (id === 'reload' || (id === 'quickReload' && !had)) g.ammoUntil = e.now + 30;
      if ((id === 'reload' || id === 'quickReload') && g.ammo) e.addStatus('ammunition', g.ammoUntil - e.now, { stacks: g.ammo });
    }
    nextEvent(e) {
      const t = super.nextEvent(e);
      return e.g.ammo ? Math.min(t, e.g.ammoUntil) : t;
    }
    process(e) {
      super.process(e);
      this.dropAmmo(e);
    }

    helpHtml(seq) {
      const V = this.V;
      return super.helpHtml(seq).replace(/Heavensward 3\.4–3\.57/g, V.label) + `
<p style="color:#a9a3b4">What's different in ${V.label}: the rounds Reload loads run out 30s after it, so spend them${V.early ? '; Gauss Round 180, Hypercharge 15s, and the turret\'s charged shots leave only 5% more damage taken (10% from 3.2); Split Shot costs 70 TP, Hot Shot and Lead Shot 80' : ''}. Gear is ${V.gear}, with the ${V.potion[0]} (max ${V.potion[1]}).</p>`;
    }
  }

  B.registerJob({
    id: 'mch', name: 'Machinist', abbr: 'MCH', role: 'ranged', classJob: 31,
    versions: ['hw32', 'hw307', 'hw301', 'hw30'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new MachinistHWEarly(v) })),
  });
})(window.BLM);
