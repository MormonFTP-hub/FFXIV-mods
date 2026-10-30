// Scholar, A Realm Reborn 2.1–2.57 at level 50. Built on the Heavensward class (sch_hw.js): Cleric Stance swapping
// Mind into Intelligence (+10%), Bio, Bio II, Miasma, Miasma II and Shadow Flare, Aetherflow's three stacks for Energy
// Drain (150 and some MP), Bane, and a faerie. What ARR didn't have: Broil, so Ruin (80, 2.5s) is the filler with Ruin
// II (80, instant) to weave; Indomitability, Deployment and Emergency Tactics, Dissipation and its second Aetherflow (all
// 3.0). MP costs are the same percentages of level 50's 2,660 as Heavensward's of 8,840, from a pool of about 3,900
// (Piety 335); Energy Drain gives 266. ARR's damage formula (B.LEVELS.arr50: the caster fit). The faerie's speed buff
// (Fey Glow) is left as Heavensward's Fey Wind, 3%: the ARR value isn't settled. No ARR Scholar damage guide survives;
// the opener is built from the Summoner guide's logic. Numbers are the Lodestone notes for 2.1–2.57, Gamer Escape's ARR
// pages and the xiv-sim data files (2015); gear is a constructed Final Coil set (Last Resort Zeta) with the X-Potion
// of Mind (max 84).
//  - A Realm Reborn 2.0: Ruin 3% of 2,660 (80), Ruin II 5% (133), Bio II 7% (186) and Aero 6% (160), all cut later; Thunder
//    from Thaumaturge as a fourth DoT (30 + 35 × 18s, 213 MP, gone in 2.1); Lustrate 20%. The Binding Coil i90 set
//    (Mind 498, 69 magic damage), a 4,042 MP pool (Piety 360) and the NQ X-Potion of Mind (max 67).
(function (B) {
  const HW = B.ScholarHW;
  const MP_SCALE = 2660 / 8840;

  class ScholarARR extends HW {
    constructor() {
      super();
      this.level = 50;
      this.levelKey = 'arr50';
      this.model = 'sch-arr';
      this.maxMp = 3900;
      this.potionCap = 84;
      this.edMp = 266;
      const A = Object.assign({}, this.actions);
      for (const k of ['broil', 'indomitability', 'deploymentTactics', 'emergencyTactics', 'dissipation']) delete A[k];
      for (const k of Object.keys(A)) if (A[k] && A[k].mp) A[k] = Object.assign({}, A[k], { mp: Math.round(A[k].mp * MP_SCALE) });
      A.tincture = Object.assign({}, A.tincture, { name: 'X-Potion of Mind', desc: 'This diluted brew temporarily increases mind.\nMind +20% (Max 84)\nDuration: 15s' });
      this.actions = A;
      this.stats = Object.assign({}, this.stats, { hp: 8500, main: 665, int: 200, wd: 82, det: 267, crit: 526, dh: 341, speed: 520, piety: 335, delay: 3.12 });
      this.selfStatusOrder = this.selfStatusOrder.filter(k => k !== 'dissipation' && k !== 'emergencyTactics');
      this.defaultBars = this.defaultBars.map(r => r.map(x => (x === 'broil' ? 'ruin' : x && A[x] ? x : null)));
      this.defaultBars[1] = this.defaultBars[1].map(x => (x === 'ruin' ? null : x));
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
      this.referenceDps = 400;     // a scripted rotation parses about 380 on the dummy
      this.referenceGcd = 2.33;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.maxMp.toLocaleString()} MP · A Realm Reborn's formula (no Direct Hit)`; }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.1–2.57)</h3>
<p>Level 50 Scholar on a dummy: <b>Cleric Stance</b> swaps your Mind into Intelligence (+10% attack magic). Keep <b>Bio</b> (40 × 18s), <b>Bio II</b> (35 × 30s) and <b>Miasma</b> (20 + 35 × 24s) up, <b>Shadow Flare</b> on cooldown, and fill with <b>Ruin</b> (80, 2.5s); <b>Ruin II</b> is instant for weaving. <b>Aetherflow</b> (60s) gives three stacks and 20% MP: <b>Energy Drain</b> (150) spends them and gives some MP back. No Broil or Dissipation until Heavensward.</p>
<p>MP is tight: about 3,900 at level 50, each spell priced as in Heavensward but on that small pool. Selene keeps a small speed buff up.</p>
<h3>An opener (constructed)</h3>
${seq([['clericStance'], 'bio2', 'miasma', ['tincture'], 'bio', ['swiftcast'], 'shadowFlare', ['energyDrain'], 'ruin2', ['energyDrain'], 'ruin', ['energyDrain'], ['aetherflow'], 'ruin', 'ruin', 'ruin2'])}
<p>No ARR Scholar damage guide survives; this follows the Summoner guide's order. Summon Selene before the pull.</p>
<p style="color:#a9a3b4">The 2.5x numbers: Ruin 80, Ruin II 80, Bio 40 × 18s, Bio II 35 × 30s, Miasma 20 + 35 × 24s, Miasma II 20 + 10 × 15s, Shadow Flare 25 a tick, Energy Drain 150. ARR's damage formula here is a refit of the 2013–14 community formulas. Gear: a constructed Final Coil set (Mind 665, 82 magic damage) with the X-Potion of Mind.</p>`;
    }
  }

  class ScholarARR20 extends ScholarARR {
    constructor() {
      super();
      const A = Object.assign({}, this.actions);
      for (const [k, mp] of Object.entries({ ruin: 80, ruin2: 133, bio2: 186, aero: 160 })) if (A[k]) A[k] = Object.assign({}, A[k], { mp });
      A.thunder = { name: 'Thunder', kind: 'gcd', school: 'thunder', sound: 'thunder', potency: 30, cast: 2.5, mp: 213, delay: 0.8, target: true, range: 25,
        dot: { potency: 35, duration: 18 }, desc: 'Deals lightning damage with a potency of 30.\nAdditional Effect: Lightning damage over time\nPotency: 35\nDuration: 18s\n(Thaumaturge cross-class skill)' };
      A.tincture = Object.assign({}, A.tincture, { desc: 'This diluted brew temporarily increases mind.\nMind +20% (Max 67)\nDuration: 15s' });
      this.actions = A;
      this.maxMp = 4042;
      this.potionCap = 67;
      this.stats = Object.assign({}, this.stats, { hp: 6500, main: 498, int: 200, wd: 69, det: 279, crit: 433, speed: 389, piety: 360, delay: 3.2 });
      this.statuses = Object.assign({}, this.statuses, { thunder: { name: 'Thunder', self: false, icon: 'st_thunder' } });
      this.targetStatusOrder = this.targetStatusOrder.concat(['thunder']);
      this.defaultBars = this.defaultBars.map(r => r.slice());
      const i = this.defaultBars[1].indexOf(null);
      if (i >= 0) this.defaultBars[1][i] = 'thunder';
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, n === 'Cross-class' ? ids.concat(['thunder']) : ids]);
      this.referenceDps = 305;     // a scripted 2.0 rotation parses about 287
      this.referenceGcd = 2.45;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.0)</h3>
<p>Level 50 Scholar at launch. <b>Cleric Stance</b> swaps your Mind into Intelligence. Keep four DoTs up: <b>Bio</b> (40 × 18s), <b>Bio II</b> (35 × 30s), <b>Miasma</b> (20 + 35 × 24s) and <b>Thunder</b> from Thaumaturge (30 + 35 × 18s; 2.1 took it away from healers), plus <b>Shadow Flare</b>, and fill with <b>Ruin</b> (80). <b>Aetherflow</b> (60s) gives three stacks for <b>Energy Drain</b> (150 and 266 MP).</p>
<p>MP is the limit: 4,042 at Piety 360, and 2.0's prices are steeper (Ruin 80, Ruin II 133, Bio II 186). Aero from Conjurer costs 160 and is rarely worth it beside Thunder.</p>
<h3>An opener (constructed)</h3>
${seq([['clericStance'], 'bio2', 'miasma', ['tincture'], 'bio', 'thunder', ['swiftcast'], 'shadowFlare', ['energyDrain'], 'ruin2', ['energyDrain'], 'ruin', ['energyDrain'], ['aetherflow'], 'ruin', 'ruin'])}
<p style="color:#a9a3b4">Gear: the Binding Coil i90 set with the Allagan Grimoire (Mind 498, 69 magic damage) and the NQ X-Potion of Mind (max 67). ARR's damage formula is a refit of the 2013–14 community formulas.</p>`;
    }
  }

  B.registerJob({
    id: 'sch', name: 'Scholar', abbr: 'SCH', role: 'healer', classJob: 28,
    versions: [{ id: 'arr21', label: 'A Realm Reborn 2.1–2.57', history: 'ARR 2.1–2.57', note: 'Level 50: Cleric Stance, Ruin with Bio, Bio II and Miasma, Energy Drain on Aetherflow, Bane, the faerie; a small MP pool; Final Coil gear', create: () => new ScholarARR() },
      { id: 'arr20', label: 'A Realm Reborn 2.0–2.0', history: 'ARR 2.0–2.0', note: 'Level 50 at launch: Thunder as a fourth DoT, steeper Ruin and Bio II costs, Energy Drain on Aetherflow; Binding Coil gear', create: () => new ScholarARR20() }],
  });
})(window.BLM);
