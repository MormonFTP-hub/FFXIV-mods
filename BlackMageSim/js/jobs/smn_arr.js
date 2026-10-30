// Summoner, A Realm Reborn 2.1–2.57 at level 50. Built on the Heavensward class (smn_hw.js): Bio, Bio II and Miasma
// (plus Miasma II and Shadow Flare), Aetherflow's three stacks for Energy Drain, Fester and Bane, Rouse, Spur,
// Contagion, Enkindle and the egis on their own clocks. What ARR didn't have: Ruin III, Painflare, Tri-disaster,
// Dreadwyrm Trance, Deathflare and Aethertrail Attunement (all 3.0), so Ruin (80) is the filler and Aetherflow always
// gives three stacks. MP costs are the same percentages of level 50's 2,660 as Heavensward's of 8,840, from a pool of
// about 2,980 (Piety 210), so MP is tight again. Garuda-Egi's Wind Blade is 100, Ifrit-Egi's Burning Strike 120. ARR's
// damage formula (B.LEVELS.arr50: the caster fit, a flat ×1.5 crit, no speed on DoTs). Numbers are the Lodestone notes
// for 2.1–2.57, Gamer Escape's ARR pages and the xiv-sim data files (2015); gear is the 2015 Ariyala best-in-slot
// (Apocalypse Zeta, Final Coil i130) with the X-Potion of Intelligence (max 84).
//  - A Realm Reborn 2.0–2.05: Ruin 80 MP, Ruin II 133, Bio II 186 (cut in 2.3 and 2.51); Thunder from Thaumaturge as a
//    fourth DoT (30 + 35 × 18s, 213 MP; Fester doesn't count it; gone in 2.1); Garuda-Egi's Aerial Slash a 3s cast and
//    Ifrit-Egi's Crimson Cyclone and Flaming Crush 105 (2.3 changed both); Enkindle on a 300s recast (Gamer Escape and the
//    2013 class table). The Binding Coil i90 set (Intelligence 498, 69 magic damage) and the NQ X-Potion (max 67).
(function (B) {
  const HW = B.SummonerHW;
  const MP_SCALE = 2660 / 8840;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class SummonerARR extends HW {
    constructor() {
      super();
      this.level = 50;
      this.levelKey = 'arr50';
      this.model = 'smn-arr';
      this.maxMp = 2983;
      this.potionCap = 84;
      const A = Object.assign({}, this.actions);
      for (const k of ['ruin3', 'painflare', 'triDisaster', 'dreadwyrmTrance', 'deathflare']) delete A[k];
      for (const k of Object.keys(A)) if (A[k] && A[k].mp) A[k] = Object.assign({}, A[k], { mp: Math.round(A[k].mp * MP_SCALE) });
      if (A.windBlade) set(A, 'windBlade', { potency: 100 });
      if (A.burningStrike) set(A, 'burningStrike', { potency: 120 });
      A.tincture = Object.assign({}, A.tincture, { name: 'X-Potion of Intelligence', desc: 'This diluted brew temporarily increases intelligence.\nIntelligence +20% (Max 84)\nDuration: 15s' });
      this.actions = A;
      this.stats = Object.assign({}, this.stats, { hp: 7500, main: 665, wd: 82, det: 256, crit: 626, dh: 341, speed: 459, piety: 210, delay: 3.12 });
      this.selfStatusOrder = this.selfStatusOrder.filter(k => k !== 'dreadwyrmTrance');
      this.defaultBars = [
        ['ruin', 'ruin2', 'bio', 'bio2', 'miasma', 'fester', 'energyDrain', 'aetherflow', 'rouse', 'spur', 'enkindle', 'contagion'],
        ['ragingStrikes', 'swiftcast', 'tincture', 'physick', 'summon', 'summon3', 'surecast', 'sprint', 'bane', null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
      this.referenceDps = 650;     // a scripted 2.5 rotation parses about 630 on the dummy
      this.referenceGcd = 2.38;
    }

    // No Aethertrail Attunement: Aetherflow always gives three.
    spendFlow(e) {
      super.spendFlow(e);
      e.g.trail = 0;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.maxMp.toLocaleString()} MP · A Realm Reborn's formula (no Direct Hit)`; }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.1–2.57)</h3>
<p>Level 50 Summoner. Keep <b>Bio</b> (40 × 18s, instant), <b>Bio II</b> (35 × 30s) and <b>Miasma</b> (20 + 35 × 24s) on the dummy and fill with <b>Ruin</b> (80, 2.5s); <b>Ruin II</b> is instant for weaving and moving. <b>Aetherflow</b> (60s) gives three stacks and 20% MP: spend them on <b>Fester</b> (100 for each of your DoTs) and <b>Energy Drain</b> (150 and MP). No Ruin III or Dreadwyrm Trance until Heavensward.</p>
<p>Your egi fights on its own clock: Garuda-Egi's Wind Blade (100), or Ifrit-Egi's Burning Strike (120). <b>Rouse</b> and <b>Spur</b> strengthen it, <b>Contagion</b> extends your DoTs, <b>Enkindle</b> is its big attack. MP is tight: about 2,980 at level 50, every spell priced as in Heavensward but on that small pool.</p>
<h3>The opener (the FFXIV wiki's ARR Summoner guide, 2014)</h3>
${seq([['ragingStrikes'], ['tincture'], 'bio2', 'miasma', 'bio', ['fester'], ['swiftcast'], 'ruin2', ['contagion'], 'ruin2', ['spur'], 'ruin2', ['fester'], ['rouse'], ['enkindle'], 'ruin', 'ruin'])}
<p>Summon your egi and use Aetherflow before the pull.</p>
<p style="color:#a9a3b4">The 2.5x numbers: Ruin 80, Ruin II 80, Bio 40 × 18s, Bio II 35 × 30s, Miasma 20 + 35 × 24s, Fester 100 a DoT, Energy Drain 150, Wind Blade 100, Burning Strike 120. ARR's damage formula here is a refit of the 2013–14 community formulas; pets use your stats as xiv-sim assumed. Gear: the 2015 Ariyala set (Intelligence 665, 82 magic damage) with the X-Potion of Intelligence.</p>`;
    }
  }

  class SummonerARR20 extends SummonerARR {
    constructor() {
      super();
      const A = Object.assign({}, this.actions);
      for (const [k, mp] of Object.entries({ ruin: 80, ruin2: 133, bio2: 186 })) if (A[k]) set(A, k, { mp });
      A.thunder = { name: 'Thunder', kind: 'gcd', school: 'thunder', sound: 'thunder', potency: 30, cast: 2.5, mp: 213, delay: 0.8, target: true, range: 25,
        dot: { potency: 35, duration: 18 }, desc: 'Deals lightning damage with a potency of 30.\nAdditional Effect: Lightning damage over time\nPotency: 35\nDuration: 18s\n(Thaumaturge cross-class skill)' };
      if (A.aerialSlash) set(A, 'aerialSlash', { delay: 3.6 });
      if (A.crimsonCyclone) set(A, 'crimsonCyclone', { potency: 105 });
      if (A.flamingCrush) set(A, 'flamingCrush', { potency: 105 });
      set(A, 'enkindle', { recast: 300 });
      A.tincture = Object.assign({}, A.tincture, { desc: 'This diluted brew temporarily increases intelligence.\nIntelligence +20% (Max 67)\nDuration: 15s' });
      this.actions = A;
      this.potionCap = 67;
      this.stats = Object.assign({}, this.stats, { hp: 6000, main: 498, wd: 69, det: 270, crit: 503, speed: 467, piety: 210, delay: 3.2 });
      this.statuses = Object.assign({}, this.statuses, { thunder: { name: 'Thunder', self: false, icon: 'st_thunder' } });
      this.targetStatusOrder = this.targetStatusOrder.concat(['thunder']);
      this.defaultBars = this.defaultBars.map(r => r.slice());
      this.defaultBars[1][9] = 'thunder';
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, n === 'Cross-class' ? ids.concat(['thunder']) : ids]);
      this.referenceDps = 400;     // a scripted 2.0 rotation parses about 376: MP runs out
      this.referenceGcd = 2.37;
    }

    spell(id, e) {
      if (id === 'thunder') {
        const a = this.actions.thunder;
        e.mp = Math.max(0, e.mp - this.mpCost(id, e));
        e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, () => this.applyDot(e, 'thunder'));
        return;
      }
      super.spell(id, e);
    }

    // Aerial Slash is a 3s cast: Garuda-Egi doesn't swing while it casts.
    petAct(e, id) {
      if (id === 'aerialSlash') e.g.petNext = Math.max(e.g.petNext, e.now + 3);
      super.petAct(e, id);
    }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.0–2.05)</h3>
<p>Level 50 Summoner at launch. Keep <b>Bio</b>, <b>Bio II</b>, <b>Miasma</b> and <b>Thunder</b> (from Thaumaturge, 30 + 35 × 18s; 2.1 took it away) on the dummy and fill with <b>Ruin</b> (80). <b>Aetherflow</b> (60s) gives three stacks for <b>Fester</b> (100 for each of Bio, Bio II and Miasma: Thunder doesn't count) and <b>Energy Drain</b>.</p>
<p>The egis are slower than later: Garuda-Egi's Aerial Slash is a 3s cast, Ifrit-Egi's Crimson Cyclone and Flaming Crush 105, and Enkindle comes back every five minutes. 2.0's MP prices are steeper (Ruin 80, Ruin II 133, Bio II 186) on a 2,983 pool.</p>
<h3>The opener (the 2014 ARR Summoner guide, with Thunder)</h3>
${seq([['ragingStrikes'], ['tincture'], 'bio2', 'miasma', 'bio', ['fester'], 'thunder', ['swiftcast'], 'ruin2', ['contagion'], 'ruin2', ['spur'], 'ruin2', ['fester'], ['rouse'], ['enkindle'], 'ruin', 'ruin'])}
<p style="color:#a9a3b4">Gear: the Binding Coil i90 set with the Allagan Grimoire of Casting (Intelligence 498, 69 magic damage) and the NQ X-Potion of Intelligence (max 67).</p>`;
    }
  }

  B.registerJob({
    id: 'smn', name: 'Summoner', abbr: 'SMN', role: 'caster', classJob: 27,
    versions: [{ id: 'arr21', label: 'A Realm Reborn 2.1–2.57', history: 'ARR 2.1–2.57', note: 'Level 50: three DoTs and Ruin, Aetherflow for Fester and Energy Drain, egis with Rouse and Spur, Contagion; a small MP pool; Final Coil gear', create: () => new SummonerARR() },
      { id: 'arr20', label: 'A Realm Reborn 2.0–2.0', history: 'ARR 2.0–2.0', note: 'Level 50 at launch: Thunder as a fourth DoT, a 3s Aerial Slash, Enkindle every five minutes, steeper MP; Binding Coil gear', create: () => new SummonerARR20() }],
  });
})(window.BLM);
