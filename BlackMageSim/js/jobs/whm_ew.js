// White Mage, Endwalker at level 90, in four versions. Built on the Dawntrail class (whm_dt.js) without what 7.0
// added (Glare IV and Sacred Sight, Divine Caress, Aetherial Shift, Medica III): Glare III (310, 1.5s) as filler, Dia
// kept up, Assize, Presence of Mind (+20% speed) and Thin Air; a Lily every 30s or 20s for the heals, three of which
// bloom the Blood Lily into Afflatus Misery. Swiftcast 60s, one Tetragrammaton charge, nothing starts full.
//  - 6.0–6.08: Misery 900 (25% less on the rest), a Lily every 30s, Assize 45s; a Lily set costs damage on a dummy.
//  - 6.1–6.18: Misery 1,240 (50% less), a Lily every 20s, so a set of three heals and Misery breaks even.
//  - 6.2–6.28: Liturgy of the Bell lasts 20s; Abyssos gear.
//  - 6.3–6.58: Assize 40s; 6.4's Dia 65 + 65 × 30s; Anabaseios gear.
// Numbers are the game data at each patch (xivapi's datamining) and the Lodestone notes; gear is The Balance's set for
// each tier (6.0 and 6.1 share one on purpose). ref: a scripted bot parses about 5,030 / 5,030 / 6,160 / 7,430.
(function (B) {
  const DT = B.WhiteMageDT;
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const VERSIONS = {
    ew63: { label: 'Endwalker 6.3–6.58', history: 'EW 6.3–6.58', misery: 1240, miseryAoe: 0.5, dia: 65, lilyTime: 20, assize: 40, liturgy: 20, tincture: 'mnd', ref: 7880,
      stats: { hp: 77580, main: 3365, wd: 132, det: 2047, crit: 2502, dh: 1012, speed: 664, piety: 390 },
      note: 'Level 90: Glare III, Dia, Misery 1,240, a Lily every 20s, Assize 40s, 6.4\'s Dia 65; Anabaseios gear' },
    ew62: { label: 'Endwalker 6.2–6.28', history: 'EW 6.2–6.28', misery: 1240, miseryAoe: 0.5, dia: 60, lilyTime: 20, assize: 45, liturgy: 20, tincture: 'mnd7', ref: 6530,
      stats: { hp: 64556, main: 2927, wd: 126, det: 1883, crit: 2312, dh: 988, speed: 827, piety: 390 },
      note: 'Level 90: Liturgy of the Bell 20s; Abyssos gear' },
    ew61: { label: 'Endwalker 6.1–6.18', history: 'EW 6.1–6.18', misery: 1240, miseryAoe: 0.5, dia: 60, lilyTime: 20, assize: 45, liturgy: 15, tincture: 'mnd6', ref: 5330,
      stats: { hp: 53961, main: 2571, wd: 120, det: 1830, crit: 2301, dh: 940, speed: 489, piety: 592 },
      note: 'Level 90: Misery 1,240 and a Lily every 20s, so a Lily set breaks even; Asphodelos gear' },
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', misery: 900, miseryAoe: 0.75, dia: 60, lilyTime: 30, assize: 45, liturgy: 15, tincture: 'mnd6', ref: 5330,
      stats: { hp: 53961, main: 2571, wd: 120, det: 1830, crit: 2301, dh: 940, speed: 489, piety: 592 },
      note: 'Level 90 at launch: Misery 900, a Lily every 30s (a Lily set loses damage on a dummy), Assize 45s; Asphodelos gear' },
  };

  class WhiteMageEW extends DT {
    constructor(version) {
      super('dt70');
      const V = Object.assign({}, VERSIONS[version], { glare: 310, holyCast: 2.5, startFull: false });
      this.V = V;
      this.level = 90;
      this.levelKey = 90;
      this.model = 'whm-dt';
      const A = Object.assign({}, this.actions);
      for (const k of ['glare4', 'divineCaress', 'aetherialShift', 'medica3']) delete A[k];
      set(A, 'glare3', { potency: 310, desc: 'Deals unaspected damage with a potency of 310.' });
      set(A, 'dia', { potency: V.dia, dot: { potency: V.dia, duration: 30 }, desc: `Deals unaspected damage with a potency of ${V.dia}.\nAdditional Effect: Unaspected damage over time\nPotency: ${V.dia}\nDuration: 30s` });
      set(A, 'afflatusMisery', { potency: V.misery, aoe: V.miseryAoe, desc: `Deals unaspected damage with a potency of ${V.misery.toLocaleString()} to target and all enemies nearby it, ${Math.round((1 - V.miseryAoe) * 100)}% less for all remaining enemies.\nCan only be executed while the Blood Lily is in full bloom.` });
      set(A, 'holy3', { cast: 2.5 });
      set(A, 'assize', { recast: V.assize, desc: `Deals unaspected damage with a potency of 400 to all nearby enemies.\nAdditional Effect: Restores own HP and the HP of all nearby party members\nAdditional Effect: Restores 5% of maximum MP\nRecast: ${V.assize}s` });
      set(A, 'presenceOfMind', { desc: 'Reduces spell cast time and recast time, and auto-attack delay by 20%.\nDuration: 15s' });
      set(A, 'swiftcast', { recast: 60, desc: 'Next spell is cast immediately.\nDuration: 10s' });
      set(A, 'tetragrammaton', { charges: undefined, desc: 'Restores target\'s HP.\nCure Potency: 700' });
      set(A, 'temperance', { desc: 'Increases healing magic potency by 20%, while reducing damage taken by self and all party members within a radius of 50 yalms by 10%.\nDuration: 20s' });
      A.medica2 = { name: 'Medica II', kind: 'gcd', potency: 0, cast: 2, mp: 1000, school: 'holy', sound: 'paradox', desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 250\nAdditional Effect: Regen\nCure Potency: 150\nDuration: 15s' };
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.stats = Object.assign({ mainStat: 'mnd', jobMod: 115, trait: 130, delay: 3.44 }, V.stats);
      this.selfStatusOrder = this.selfStatusOrder.filter(k => k !== 'sacredSight' && k !== 'divineGrace');
      this.defaultBars = this.defaultBars.map(r => r.map(id => id === 'medica3' ? 'medica2' : (id && A[id] ? id : null)));
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.map(id => id === 'medica3' ? 'medica2' : id).filter(id => A[id])]);
      this.referenceDps = V.ref;
    }

    initGauge() { return { lilies: 0, blood: 0, lilyAt: null }; }
    mpRegen() { return 200 + Math.floor(150 * (this.stats.piety - 390) / 1900); }

    resolve(id, e) {
      if (id === 'presenceOfMind') { e.addStatus('presenceOfMind', 15); return; }
      super.resolve(id, e);
    }

    // A Lily every 30s (6.0) or 20s in combat, up to three.
    nextEvent(e) {
      const g = e.g;
      if (!e.inCombat) return Infinity;
      if (g.lilyAt === null) g.lilyAt = e.now + this.V.lilyTime;
      return g.lilyAt;
    }
    process(e) {
      const g = e.g;
      if (e.inCombat && g.lilyAt !== null && e.now >= g.lilyAt - 1e-6) {
        g.lilyAt += this.V.lilyTime;
        if (g.lilies < 3) { g.lilies++; e.emit('lilies', {}); }
      }
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 White Mage on a dummy. Fill with <b>Glare III</b> (310, a 1.5s cast) and keep <b>Dia</b> up (${V.dia} + ${V.dia} × 30s). <b>Assize</b> (400, ${V.assize}s) and <b>Presence of Mind</b> (+20% speed for 15s, 120s) on cooldown; <b>Thin Air</b> makes a spell free.</p>
<p>A Lily every ${V.lilyTime}s in combat (up to three) pays for <b>Afflatus Solace</b> or <b>Rapture</b> (heals); three bloom the Blood Lily for <b>Afflatus Misery</b> (${V.misery.toLocaleString()}). ${V.lilyTime === 30 ? 'In 6.0 three heals and Misery cost more Glare damage than Misery gives back, so on a dummy you only spend Lilies when you must move.' : 'From 6.1 three heals and Misery break even with four Glares, so spend the Lilies on movement and keep Misery for the burst.'}</p>
<h3>The opener (The Balance)</h3>
${seq([['tincture'], 'glare3', 'dia', 'glare3', 'glare3', ['presenceOfMind'], 'glare3', ['assize'], 'glare3', 'glare3', 'glare3', 'glare3', 'glare3', 'glare3'])}
<p>The tincture at −3s and Glare III at −1.5s.</p>
<p style="color:#a9a3b4">${V.label} numbers: Glare III 310, Dia ${V.dia} + ${V.dia} × 30s, Afflatus Misery ${V.misery.toLocaleString()}, Assize 400, Holy III 150 (2.5s cast); Maim and Mend II +30%. Gear: The Balance's set for the tier (Mind ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.registerJob({
    id: 'whm', name: 'White Mage', abbr: 'WHM', role: 'healer', classJob: 24,
    versions: ['ew63', 'ew62', 'ew61', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new WhiteMageEW(v) })),
  });
})(window.BLM);
